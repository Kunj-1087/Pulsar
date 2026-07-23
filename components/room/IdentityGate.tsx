'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, migrateLegacyStorage, cleanupLegacyDatabase } from '../../lib/utils';

export interface IdentityGateProps {
  children?: React.ReactNode;
  onComplete?: () => void;
}

export interface Identity {
  handle: string;
  color: string;
  peerColor?: string;
  peerId: string;
  createdAt?: number;
}

const PEER_COLORS = [
  '#E50914',  // red (accent — Netflix red)
  '#E8A838',  // amber
  '#4FC3F7',  // sky blue
  '#81C784',  // sage green
  '#CE93D8',  // lavender
  '#FF8A65',  // coral
  '#4DD0E1',  // teal
  '#F06292',  // pink
];

const COLOR_NAMES = [
  'red',
  'amber',
  'sky blue',
  'sage green',
  'lavender',
  'coral',
  'teal',
  'pink',
];

type GatePhase = 'intro' | 'form' | 'submitting' | 'complete';

export const IdentityGate: React.FC<IdentityGateProps> = ({ children, onComplete }) => {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);
  const [phase, setPhase] = useState<GatePhase>('intro');
  const [introVisible, setIntroVisible] = useState(false);

  // Form states
  const [handle, setHandle] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
  });
  const [isFocused, setIsFocused] = useState(false);
  const [borderFlashRed, setBorderFlashRed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          if (parsed && typeof parsed.handle === 'string' && parsed.handle.length >= 1) {
            setIdentity(parsed);
            setPhase('complete');
          }
        } catch (e) {
          console.error('Invalid identity in localStorage', e);
        }
      }
      setChecking(false);
    }
  }, []);

  // Timeline: intro (0–1.2s) -> form phase
  useEffect(() => {
    if (checking || identity) return;

    // Trigger intro fade-in transition
    const frameId = requestAnimationFrame(() => {
      setIntroVisible(true);
    });

    // After 1200ms (400ms fade-in + 800ms hold), move to form state
    const introTimer = setTimeout(() => {
      setPhase('form');
    }, 1200);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(introTimer);
    };
  }, [checking, identity]);

  // Focus input when form phase activates
  useEffect(() => {
    if (phase === 'form') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Handle input change & strict validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // Max length: 20 chars
    if (val.length > 20) return;

    // Allowed: a-z A-Z 0-9 _ - . (Spaces and other chars silently rejected)
    const regex = /^[a-zA-Z0-9_\-\.]*$/;

    if (!regex.test(val)) {
      setBorderFlashRed(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setBorderFlashRed(false);
      }, 300);
      return;
    }

    setHandle(val);

    if (errorMsg && val.length >= 1) {
      setErrorMsg(null);
    }
  };

  const handleSubmit = () => {
    if (phase === 'submitting' || phase === 'complete') return;

    const trimmed = handle.trim();
    if (trimmed.length < 1) {
      setErrorMsg('Handle must be at least 1 character');
      setBorderFlashRed(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setBorderFlashRed(false);
      }, 300);
      return;
    }

    setPhase('submitting');

    setTimeout(() => {
      // Get existing peerId or generate new one once on first visit
      let peerId = '';
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.peerId === 'string' && parsed.peerId) {
            peerId = parsed.peerId;
          }
        } catch {}
      }

      if (!peerId) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          peerId = crypto.randomUUID();
        } else {
          peerId = 'peer_' + Math.random().toString(36).substring(2, 11);
        }
      }

      const newIdentity: Identity = {
        handle: trimmed,
        color: selectedColor,
        peerColor: selectedColor,
        peerId,
        createdAt: Date.now(),
      };

      // Write identity to localStorage
      localStorage.setItem('quark_identity', JSON.stringify(newIdentity));
      localStorage.setItem('quark-displayName', trimmed);

      // Animate form out over 300ms
      setPhase('complete');

      setTimeout(() => {
        setIdentity(newIdentity);
        if (onComplete) {
          onComplete();
        }
      }, 300);
    }, 250);
  };

  if (checking) {
    return <div className="fixed inset-0 z-50 bg-black" />;
  }

  const showGate = !identity || phase !== 'complete';
  const showChildren = !!identity;
  const isButtonDisabled = handle.trim().length === 0 || phase === 'submitting';

  return (
    <>
      {showChildren && children}

      {showGate && (
        <div
          role="dialog"
          aria-label="Set up your identity"
          className={cn(
            "fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 select-none transition-all duration-300 ease-out",
            phase === 'complete' ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"
          )}
        >
          <div className="w-full max-w-[360px] flex flex-col items-center text-center font-sans">
            {/* "quark" wordmark — transition smoothly from 48px intro to 20px header */}
            <h1
              className={cn(
                "font-bold text-white tracking-[-0.03em] transition-all duration-400 ease-out select-none",
                phase === 'intro'
                  ? cn(
                      "text-[48px] mb-0",
                      introVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                    )
                  : "text-[20px] mb-1.5 opacity-100 translate-y-0"
              )}
            >
              quark
            </h1>

            {/* Moment 2 — Identity Form */}
            <div
              className={cn(
                "w-full flex flex-col items-center transition-all duration-400 ease-out",
                phase === 'intro'
                  ? "opacity-0 translate-y-4 pointer-events-none invisible"
                  : "opacity-100 translate-y-0 visible"
              )}
            >
              {/* Subtitle */}
              <p className="text-[13px] text-text-muted mb-6">
                Choose your identity
              </p>

              {/* Handle Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                className="w-full flex flex-col items-start mb-6"
              >
                <div
                  className={cn(
                    "relative w-full rounded-[4px] bg-elevated border py-3 px-3.5 pl-[32px] transition-colors duration-150 flex items-center",
                    borderFlashRed || errorMsg
                      ? "border-accent"
                      : isFocused
                      ? "border-accent"
                      : "border-border"
                  )}
                >
                  {/* @ Prefix */}
                  <span className="absolute left-[14px] text-[14px] text-text-muted select-none pointer-events-none">
                    @
                  </span>

                  <input
                    ref={inputRef}
                    type="text"
                    value={handle}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="yourhandle"
                    disabled={phase === 'submitting' || phase === 'complete'}
                    className="w-full bg-transparent text-[16px] text-white placeholder:text-text-muted outline-none border-none p-0 caret-accent select-text"
                    autoFocus
                  />
                </div>

                {/* Error message */}
                {errorMsg && (
                  <p className="text-[11px] text-accent mt-1.5 transition-opacity duration-200 text-left">
                    {errorMsg}
                  </p>
                )}
              </form>

              {/* Color Swatches */}
              <div className="w-full flex flex-col items-center mb-6">
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-3 select-none">
                  Pick a color
                </span>

                <div className="flex items-center justify-center gap-[10px]">
                  {PEER_COLORS.map((colorHex, idx) => {
                    const isSelected = selectedColor === colorHex;
                    return (
                      <button
                        key={colorHex}
                        type="button"
                        onClick={() => setSelectedColor(colorHex)}
                        disabled={phase === 'submitting' || phase === 'complete'}
                        aria-label={`Select color ${COLOR_NAMES[idx] || colorHex}`}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all duration-150 ease-in-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white",
                          isSelected
                            ? "border-2 border-white opacity-100 scale-110"
                            : "border-0 opacity-70 hover:opacity-100 hover:scale-[1.05]"
                        )}
                        style={{ backgroundColor: colorHex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isButtonDisabled}
                className={cn(
                  "w-full h-[44px] rounded-[4px] font-medium text-[14px] text-white flex items-center justify-center transition-colors duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-white",
                  isButtonDisabled
                    ? "bg-overlay text-text-muted cursor-not-allowed"
                    : "bg-accent hover:bg-accent-hover cursor-pointer"
                )}
              >
                {phase === 'submitting' ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  "Enter Quark"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
