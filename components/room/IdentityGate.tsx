'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface IdentityGateProps {
  children: React.ReactNode;
}

interface Identity {
  handle: string;
  peerColor: string;
  createdAt: number;
}

export const IdentityGate: React.FC<IdentityGateProps> = ({ children }) => {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);

  // Form states
  const [handle, setHandle] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [borderFlashRed, setBorderFlashRed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Transition & boot sequence states
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [elementsVisible, setElementsVisible] = useState(false);
  const [fadeState, setFadeState] = useState<'idle' | 'fade-out' | 'blackout' | 'fade-in'>('idle');

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_identity');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.handle === 'string' && parsed.handle.length >= 3) {
            setIdentity(parsed);
          }
        } catch (e) {
          console.error('Invalid identity in localStorage', e);
        }
      }
      setChecking(false);
    }
  }, []);

  // Animated character-by-character typing boot sequence
  useEffect(() => {
    if (checking || identity) return;

    const fullText = "PULSAR NETWORK — NODE INITIALIZATION";
    let textIdx = 0;
    
    const interval = setInterval(() => {
      setTypedText(fullText.substring(0, textIdx + 1));
      textIdx++;
      
      if (textIdx >= fullText.length) {
        clearInterval(interval);
        
        // Show blinking block cursor for 800ms
        setShowCursor(true);
        const cursorTimer = setTimeout(() => {
          setShowCursor(false);
          
          // Wait 600ms to fade in remaining elements
          const elementsTimer = setTimeout(() => {
            setElementsVisible(true);
          }, 600);
          
          return () => clearTimeout(elementsTimer);
        }, 800);
        
        return () => clearTimeout(cursorTimer);
      }
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [checking, identity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Strict handle validation: letters, numbers, underscores, hyphens, dots. No spaces.
    const regex = /^[a-zA-Z0-9_\-\.]*$/;
    
    if (!regex.test(val)) {
      // Flash bottom border red for 200ms
      setBorderFlashRed(true);
      const timer = setTimeout(() => setBorderFlashRed(false), 200);
      return;
    }
    
    // Input stops accepting characters past 20 limit
    if (val.length > 20) {
      return;
    }

    setHandle(val);
    
    if (errorMsg && val.length >= 3) {
      setErrorMsg(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInitializing) return;

    if (handle.length < 3) {
      setErrorMsg("Handle must be at least 3 characters.");
      return;
    }

    setIsInitializing(true);

    // 600ms dramatic delay
    setTimeout(() => {
      // Fixed palette of 8 peer colors
      const colors = [
        '#5b8dee', // blue
        '#5cb85c', // green
        '#f0ad4e', // amber
        '#d9534f', // red
        '#9b59b6', // purple
        '#1abc9c', // teal
        '#e67e22', // orange
        '#3498db'  // sky
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newIdentity: Identity = {
        handle,
        peerColor: randomColor,
        createdAt: Date.now(),
      };
      
      localStorage.setItem('pulsar_identity', JSON.stringify(newIdentity));
      localStorage.setItem('pulsar-displayName', handle); // backwards compatibility fallback

      // Full-screen transition sequence
      setFadeState('fade-out');

      setTimeout(() => {
        setFadeState('blackout');
        setIdentity(newIdentity);
        
        setTimeout(() => {
          setFadeState('fade-in');
          
          setTimeout(() => {
            setFadeState('idle');
          }, 300); // 300ms fade in landing page
        }, 50); // slight frame hold in black
      }, 300); // 300ms fade to black
    }, 600);
  };

  // Skip rendering identity gate if identity exists on initial load
  if (checking) {
    return (
      <div className="fixed inset-0 z-50 bg-[#191919] flex items-center justify-center font-mono text-xs text-text-muted select-none">
        Loading...
      </div>
    );
  }

  // Active state: user logged in, ready to mount children
  if (identity && fadeState === 'idle') {
    return <>{children}</>;
  }

  const showIdentityScreen = !identity || fadeState === 'fade-out';
  const showChildren = identity && (fadeState === 'fade-in' || fadeState === 'blackout');

  // Input validation state
  const isInputInvalid = handle.length > 0 && handle.length < 3;
  const isButtonDisabled = handle.length === 0 || isInputInvalid || isInitializing;

  return (
    <div className="relative w-full h-full min-h-screen">
      {/* Identity creation screen */}
      {showIdentityScreen && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-[#191919] flex flex-col items-center justify-center p-4 select-none",
            fadeState === 'fade-out' ? "opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,1,1)]" : "opacity-100"
          )}
        >
          <div className="w-full max-w-[480px] flex flex-col items-stretch text-left font-mono">
            {/* Top boot sequence animated line */}
            <div className="text-[11px] text-text-muted uppercase tracking-[0.15em] font-medium h-5">
              {typedText}
              {showCursor && <span className="animate-[pulsar-cursor-blink_1s_infinite_steps(2,start)]">█</span>}
            </div>

            {/* Fade-in elements staggered via delay styles */}
            <div className="mt-8 flex flex-col gap-6">
              {/* Element 1: Header */}
              <h2
                className={cn(
                  "font-mono font-bold text-2xl text-[#e6e8e6] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '0ms' }}
              >
                Choose your handle
              </h2>

              {/* Element 2: Description */}
              <p
                className={cn(
                  "font-sans text-[13px] text-text-muted leading-relaxed transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '150ms' }}
              >
                This is how others will see you. Pick something you like — you can't change it mid-session.
              </p>

              {/* Element 3: Input Field */}
              <div
                className={cn(
                  "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '300ms' }}
              >
                <form onSubmit={handleSubmit} className="w-full flex flex-col">
                  <div
                    className={cn(
                      "flex items-center w-full border-b pb-1.5 transition-colors duration-150 relative",
                      borderFlashRed
                        ? "border-status-red"
                        : isFocused
                        ? "border-[#ced0ce]"
                        : "border-[#2e2e2e]"
                    )}
                  >
                    <span className="text-xl text-text-muted select-none mr-2 font-mono">@</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={handleInputChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="your_handle_42"
                      className="flex-1 bg-transparent text-xl font-mono text-[#e6e8e6] placeholder:text-text-muted focus:outline-none caret-[#ced0ce] select-text"
                      disabled={isInitializing}
                      autoFocus
                    />

                    {/* Counter updates colors dynamically */}
                    <span
                      className={cn(
                        "text-[11px] font-sans transition-colors duration-150 select-none ml-2",
                        handle.length >= 20
                          ? "text-[#ced0ce]"
                          : handle.length >= 18
                          ? "text-[#f0ad4e]" // Warning amber
                          : "text-text-muted"
                      )}
                    >
                      {handle.length} / 20
                    </span>
                  </div>

                  {/* Inline error description */}
                  <div className="h-6 mt-2 overflow-hidden relative">
                    {errorMsg && (
                      <p className="text-xs font-sans text-[#ef5350]/80 transition-opacity duration-150 opacity-100 animate-[pulsar-message-in-system_150ms_ease-in_forwards]">
                        {errorMsg}
                      </p>
                    )}
                  </div>
                </form>
              </div>

              {/* Element 4: Submit Button */}
              <div
                className={cn(
                  "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '450ms' }}
              >
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isButtonDisabled}
                  className={cn(
                    "w-full h-11 bg-[#ced0ce] text-[#191919] font-mono text-sm rounded flex items-center justify-center gap-2 transition-all duration-150 select-none border border-transparent",
                    isButtonDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-[#e6e8e6] active:scale-[0.98]"
                  )}
                >
                  {isInitializing && (
                    <span className="w-3.5 h-3.5 border-2 border-[#191919]/30 border-t-[#191919] rounded-full animate-spin shrink-0" />
                  )}
                  <span>{isInitializing ? "Initializing..." : "Initialize node →"}</span>
                </button>
              </div>

              {/* Element 5: Stored Locally Muted Subline */}
              <div
                className={cn(
                  "text-center mt-8 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-50 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '600ms' }}
              >
                <p className="text-[11px] font-sans text-text-muted select-none">
                  Stored locally. Never sent to any server.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main layout content */}
      {showChildren && (
        <div
          className={cn(
            "w-full h-full transition-opacity duration-300",
            fadeState === 'fade-in' ? "opacity-100" : "opacity-0"
          )}
        >
          {children}
        </div>
      )}

      {/* Transition cover */}
      {fadeState === 'blackout' && (
        <div className="fixed inset-0 z-50 bg-black" />
      )}
    </div>
  );
};
