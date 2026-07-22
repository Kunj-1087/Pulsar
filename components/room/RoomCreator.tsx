'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { isValidRoomCode } from '../../lib/roomCode';
import { StarfieldBackground } from './StarfieldBackground';

export const RoomCreator: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [identity, setIdentity] = useState<{ handle: string; peerColor: string } | null>(null);
  const [roomCode, setRoomCode] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Monitor connectivity state
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
      
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Load identity and room code from localStorage / URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          setIdentity(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
      
      // Auto-populate room code if present in URL
      const codeFromUrl = searchParams.get('room');
      if (codeFromUrl) {
        setRoomCode(codeFromUrl.toUpperCase());
      }
    }
  }, [searchParams]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/signal/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Server returned an error');
      }

      const data = await res.json();
      if (data.roomId) {
        router.push(`/room/${data.roomId}`);
      } else {
        throw new Error('No roomId received');
      }
    } catch (err) {
      console.error(err);
      setCreateError('Could not initialize room. Check signaling connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;
    setIsJoining(true);
    setJoinError(null);

    const cleanCode = roomCode.trim().toUpperCase();

    if (!isValidRoomCode(cleanCode)) {
      setJoinError('> invalid room code. use 8 alphanumeric characters.');
      setIsJoining(false);
      return;
    }

    router.push(`/room/${cleanCode}`);
  };

  return (
    <div className="room-creator-theme relative w-full flex flex-col items-center justify-center">
      <StarfieldBackground />

      {/* Soft glow aura behind the card — bleeds red light into the starfield */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[1]" aria-hidden="true">
        <div className="w-[520px] h-[620px]" style={{ background: 'var(--card-glow-aura)' }} />
      </div>

      {/* Card surface — glassmorphism with backdrop blur */}
      <div
        className="relative z-10 w-full max-w-[440px] px-4 py-6 sm:px-6 sm:py-8 rounded-lg"
        style={{
          background: 'var(--card-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Wordmark logo */}
        <div className="text-center mb-8 sm:mb-10">
          <h1
            className="type-wordmark text-4xl sm:text-5xl text-pulsar"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(220,59,74,0.3)) drop-shadow(0 0 60px rgba(220,59,74,0.08))',
            }}
          >
            quark
          </h1>
          <p className="type-terminal-msg text-fg-secondary mt-3 text-sm sm:text-base">
            Chat without the middle.
          </p>
        </div>

        <div className="space-y-7 sm:space-y-8">
          {/* Node Identity Display */}
          {identity && (
            <div className="flex flex-col gap-2 p-4 bg-void rounded-md"
              style={{ border: '1px solid var(--node-border)' }}>
              <span className="type-uppercase-label text-fg-secondary select-none">
                Active Node Identity
              </span>
              <div className="flex items-center gap-2 select-none">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: identity.peerColor }}
                />
                <span className="type-peer-name text-fg-primary text-sm sm:text-base">
                  @{identity.handle}
                </span>
              </div>
            </div>
          )}

          {/* Section divider line */}
          <div className="h-px bg-gradient-to-r from-transparent via-pulsar/15 to-transparent" />

          {isOffline && (
            <div className="p-3.5 bg-accretion/10 border border-accretion/30 text-accretion text-xs font-mono rounded-md select-none text-center">
              You are offline. Create and join require network signaling.
            </div>
          )}

          {/* Create Room Form */}
          <form onSubmit={handleCreateRoom} className="space-y-3">
            <h2 className="type-uppercase-label text-fg-secondary">
              New room
            </h2>
            <Button
              type="submit"
              size="lg"
              className="bg-gradient-to-b from-[#E84A58] to-[var(--accent-pulsar)] hover:from-[var(--accent-pulsar)] hover:to-[var(--accent-pulsar-hover)] w-full shadow-[var(--btn-glow)] hover:shadow-[var(--btn-glow-hover)] transition-all duration-200"
              loading={isCreating}
              disabled={isJoining || isOffline}
            >
              Create room
            </Button>
            {createError && (
              <p className="text-xs font-mono text-redshift mt-1">{createError}</p>
            )}
          </form>

          {/* Section divider line */}
          <div className="h-px bg-gradient-to-r from-transparent via-pulsar/15 to-transparent" />

          {/* Join Room Form */}
          <form onSubmit={handleJoinRoom} className="space-y-3">
            <h2 className="type-uppercase-label text-fg-muted">
              Join a room
            </h2>
            <div className="flex gap-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="6-character code"
                maxLength={8}
                className="font-mono uppercase text-center text-sm tracking-[0.2em]"
                disabled={isJoining || isCreating || isOffline}
              />
              <Button
                type="submit"
                variant="ghost"
                size="lg"
                className="shrink-0 min-w-[88px] hover:border-pulsar hover:text-pulsar hover:shadow-[0_0_16px_rgba(220,59,74,0.12)] transition-all duration-200"
                loading={isJoining}
                disabled={isCreating || !roomCode || isOffline}
              >
                Join
              </Button>
            </div>
            {joinError && (
              <p className="text-xs font-mono text-decay mt-1">{joinError}</p>
            )}
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-7 text-center text-xs text-fg-subtle">
          <p>P2P WebRTC • E2EE • No servers</p>
        </div>
      </div>
    </div>
  );
};
