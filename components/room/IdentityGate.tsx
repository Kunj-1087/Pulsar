'use client';

import React, { useState, useEffect } from 'react';
import { cn, migrateLegacyStorage, cleanupLegacyDatabase } from '../../lib/utils';

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

  // Run legacy migration and cleanup on first load
  useEffect(() => {
    migrateLegacyStorage();
    cleanupLegacyDatabase();
  }, []);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
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

    const bootLines = [
      '> quark v1.0.0',
      '> initializing peer node',
      "> no accounts. no servers. no trace.",
      '> ',
    ];
    let currentLine = 0;
    let charIdx = 0;
    let activeInterval: NodeJS.Timeout | null = null;
    let cursorTimer: NodeJS.Timeout | null = null;
    let elementsTimer: NodeJS.Timeout | null = null;
    
    const typeLine = () => {
      if (currentLine >= bootLines.length) {
        setShowCursor(true);
        cursorTimer = setTimeout(() => {
          setShowCursor(false);
          elementsTimer = setTimeout(() => {
            setElementsVisible(true);
          }, 600);
        }, 800);
        return;
      }
      
      const line = bootLines[currentLine];
      activeInterval = setInterval(() => {
        charIdx++;
        const prefix = bootLines.slice(0, currentLine).join('\n');
        const currentText = prefix + (prefix ? '\n' : '') + line.substring(0, charIdx);
        setTypedText(currentText);
        
        if (charIdx >= line.length) {
          if (activeInterval) clearInterval(activeInterval);
          charIdx = 0;
          currentLine++;
          setTimeout(typeLine, 120);
        }
      }, 12);
    };
    
    typeLine();

    return () => {
      if (activeInterval) clearInterval(activeInterval);
      if (cursorTimer) clearTimeout(cursorTimer);
      if (elementsTimer) clearTimeout(elementsTimer);
    };
  }, [checking, identity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Strict handle validation: letters, numbers, underscores, hyphens, dots. No spaces.
    const regex = /^[a-zA-Z0-9_\-\.]*$/;
    
    if (!regex.test(val)) {
      // Flash bottom border red for 200ms
      setBorderFlashRed(true);
      setTimeout(() => setBorderFlashRed(false), 200);
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
      setErrorMsg("> invalid: use letters, numbers, hyphen, underscore, period. max 20 characters.");
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
      
      localStorage.setItem('quark_identity', JSON.stringify(newIdentity));
      localStorage.setItem('quark-displayName', handle); // backwards compatibility fallback

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
      <div className="fixed inset-0 z-50 bg-void flex items-center justify-center font-mono text-caption text-fg-secondary select-none">
        <span>loading<span className="animate-cursor-blink ml-0.5 text-pulsar">_</span></span>
      </div>
    );
  }

  const showIdentityScreen = !identity || fadeState === 'fade-out';
  const showChildren = !!identity;

  // Input validation state
  const isInputInvalid = handle.length > 0 && handle.length < 3;
  const isButtonDisabled = handle.length === 0 || isInputInvalid || isInitializing;

  return (
    <div className="relative w-full min-h-[100dvh] bg-void">
      {/* Identity creation screen */}
      {showIdentityScreen && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-void flex flex-col items-center justify-center p-6 sm:p-8 select-none",
            fadeState === 'fade-out' ? "opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,1,1)]" : "opacity-100"
          )}
        >
          <div className="w-full max-w-[480px] flex flex-col items-center text-center font-mono">
            {/* Top boot sequence animated lines */}
            <div className="type-terminal-msg text-fg-secondary whitespace-pre-wrap min-h-[6rem] text-sm sm:text-base text-center">
              {typedText}
              {showCursor && <span className="animate-cursor-blink text-pulsar">█</span>}
            </div>

            {/* Fade-in elements staggered via delay styles */}
            <div className="mt-6 flex flex-col gap-5">
              {/* Element 1: Handle prompt */}
              <div
                className={cn(
                  "type-terminal-msg text-fg-secondary text-sm sm:text-base transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] text-center",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '0ms' }}
              >
                {'>'} handle:
              </div>

              {/* Element 2: Input Field */}
              <div
                className={cn(
                  "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '120ms' }}
              >
                <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
                  <div
                    className={cn(
                      "flex items-center w-full rounded-md border bg-surface/40 px-3 py-3 transition-colors duration-150 relative",
                      borderFlashRed
                        ? "border-redshift"
                        : isFocused
                        ? "border-pulsar shadow-[0_0_0_1px_rgba(229,9,20,0.4)]"
                        : "border-dim"
                    )}
                  >
                    <span className="type-terminal-prefix select-none mr-2 text-pulsar text-sm sm:text-base">@</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={handleInputChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder=""
                      className="flex-1 bg-transparent text-base sm:text-lg font-mono text-fg-primary placeholder:text-fg-subtle focus:outline-none caret-pulsar select-text"
                      disabled={isInitializing}
                      autoFocus
                    />

                    {/* Counter updates colors dynamically */}
                    <span
                      className={cn(
                        "text-xs font-sans transition-colors duration-150 select-none ml-2",
                        handle.length >= 20
                          ? "text-fg-primary"
                          : handle.length >= 18
                          ? "text-accretion"
                          : "text-fg-muted"
                      )}
                    >
                      {handle.length} / 20
                    </span>
                  </div>

                  {/* Inline error description */}
                  <div className="h-5 mt-2 overflow-hidden relative">
                    {errorMsg && (
                      <p className="text-xs font-mono text-redshift transition-opacity duration-150 opacity-100 quark-animate-system">
                        {errorMsg}
                      </p>
                    )}
                  </div>
                </form>
              </div>

              {/* Element 3: Submit Button */}
              <div
                className={cn(
                  "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '240ms' }}
              >
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isButtonDisabled}
                  className={cn(
                    "w-full h-12 bg-fg-primary text-bg-base font-mono text-sm sm:text-base tracking-wide rounded-md flex items-center justify-center gap-2 transition-all duration-150 select-none border border-transparent",
                    isButtonDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-fg-secondary active:scale-[0.98]"
                  )}
                >
                  {isInitializing && (
                    <span className="w-3.5 h-3.5 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin shrink-0" />
                  )}
                  <span>                  {isInitializing ? "initializing..." : "continue →"}</span>
                </button>
              </div>

              {/* Element 4: Stored Locally Muted Subline */}
              <div
                className={cn(
                  "text-center mt-8 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  elementsVisible ? "opacity-50 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '360ms' }}
              >
                <p className="text-xs text-fg-muted select-none">
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
            "w-full flex flex-col items-center justify-center transition-opacity duration-300 py-6",
            (fadeState === 'idle' || fadeState === 'fade-in') ? "opacity-100" : "opacity-0"
          )}
        >
          {children}
        </div>
      )}

      {/* Transition cover */}
      {fadeState === 'blackout' && (
        <div className="fixed inset-0 z-50 bg-bg-base" />
      )}
    </div>
  );
};
