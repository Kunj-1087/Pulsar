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
      '> no accounts. no servers. no trace.',
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
      setBorderFlashRed(true);
      setTimeout(() => setBorderFlashRed(false), 200);
      return;
    }
    
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
      setErrorMsg('> use 3-20 characters: letters, numbers, -, _, .');
      return;
    }

    setIsInitializing(true);

    setTimeout(() => {
      const colors = [
        '#E50914', // Netflix Red
        '#5b8dee', // blue
        '#5cb85c', // green
        '#f0ad4e', // amber
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
      localStorage.setItem('quark-displayName', handle);

      setFadeState('fade-out');

      setTimeout(() => {
        setFadeState('blackout');
        setIdentity(newIdentity);
        
        setTimeout(() => {
          setFadeState('fade-in');
          
          setTimeout(() => {
            setFadeState('idle');
          }, 300);
        }, 50);
      }, 300);
    }, 600);
  };

  if (checking) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center font-mono text-xs text-text-muted select-none">
        <span>loading<span className="animate-pulse ml-0.5 text-accent">_</span></span>
      </div>
    );
  }

  const showIdentityScreen = !identity || fadeState === 'fade-out';
  const showChildren = !!identity;

  const isInputInvalid = handle.length > 0 && handle.length < 3;
  const isButtonDisabled = handle.length === 0 || isInputInvalid || isInitializing;

  return (
    <div className="relative w-full min-h-screen bg-black text-white font-sans">
      {/* Identity creation screen */}
      {showIdentityScreen && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black flex flex-col items-center justify-center p-6 select-none",
            fadeState === 'fade-out' ? "opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,1,1)]" : "opacity-100"
          )}
        >
          <div className="w-full max-w-[440px] flex flex-col items-center text-center font-sans">
            {/* Top boot sequence animated lines */}
            <div className="font-mono text-text-secondary whitespace-pre-wrap min-h-[6rem] text-sm text-center">
              {typedText}
              {showCursor && <span className="animate-pulse text-accent">█</span>}
            </div>

            {/* Fade-in elements */}
            <div className="mt-6 flex flex-col gap-5 w-full">
              {/* Handle prompt */}
              <div
                className={cn(
                  "font-mono text-text-secondary text-sm transition-all duration-300 text-center",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
              >
                {'>'} handle:
              </div>

              {/* Input Field */}
              <div
                className={cn(
                  "transition-all duration-300 w-full",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '120ms' }}
              >
                <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
                  <div
                    className={cn(
                      "flex items-center w-full rounded bg-elevated border px-3 py-2.5 transition-colors relative",
                      borderFlashRed
                        ? "border-accent"
                        : isFocused
                        ? "border-accent"
                        : "border-border"
                    )}
                  >
                    <span className="font-mono text-accent text-sm mr-2 select-none">@</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={handleInputChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder=""
                      className="flex-1 bg-transparent text-base font-sans text-white placeholder:text-text-muted focus:outline-none caret-accent select-text"
                      disabled={isInitializing}
                      autoFocus
                    />

                    <span
                      className={cn(
                        "text-xs font-mono transition-colors select-none ml-2",
                        handle.length >= 20
                          ? "text-accent"
                          : "text-text-muted"
                      )}
                    >
                      {handle.length}/20
                    </span>
                  </div>

                  {/* Inline error description */}
                  <div className="h-5 mt-2 overflow-hidden relative">
                    {errorMsg && (
                      <p className="text-xs font-mono text-accent">
                        {errorMsg}
                      </p>
                    )}
                  </div>
                </form>
              </div>

              {/* Submit Button */}
              <div
                className={cn(
                  "transition-all duration-300 w-full",
                  elementsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '240ms' }}
              >
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isButtonDisabled}
                  className={cn(
                    "w-full h-10 bg-accent hover:bg-accent-hover text-white font-medium text-sm rounded flex items-center justify-center gap-2 transition-colors select-none cursor-pointer",
                    isButtonDisabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isInitializing && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  )}
                  <span>{isInitializing ? "initializing..." : "continue →"}</span>
                </button>
              </div>

              {/* Stored Locally Subline */}
              <div
                className={cn(
                  "text-center mt-6 transition-all duration-300",
                  elementsVisible ? "opacity-60 translate-y-0" : "opacity-0 translate-y-2"
                )}
                style={{ transitionDelay: '360ms' }}
              >
                <p className="text-xs text-text-muted select-none">
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
            "w-full h-full flex flex-col transition-opacity duration-300",
            (fadeState === 'idle' || fadeState === 'fade-in') ? "opacity-100" : "opacity-0"
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
