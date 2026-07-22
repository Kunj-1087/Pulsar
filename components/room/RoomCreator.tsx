'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { isValidRoomCode } from '../../lib/roomCode';

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
    <div className="w-full max-w-[440px] px-6 py-8 border border-border bg-bg-surface rounded-md">
      {/* Wordmark logo */}
      <div className="text-center mb-8">
        <h1 className="type-wordmark text-mega text-fg-primary">
          quark
        </h1>
        <p className="type-terminal-msg text-fg-muted mt-2">
          Chat without the middle.
        </p>
      </div>

      <div className="space-y-8">
        {/* Node Identity Display */}
        {identity && (
          <div className="flex flex-col gap-1.5 p-3.5 bg-bg-base border border-border rounded">
            <span className="type-uppercase-label text-fg-muted select-none">
              Active Node Identity
            </span>
            <div className="flex items-center gap-2 select-none">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: identity.peerColor }}
              />
              <span className="type-peer-name text-fg-primary">
                @{identity.handle}
              </span>
            </div>
          </div>
        )}

        {/* Section divider line */}
        <div className="h-px bg-border" />

        {isOffline && (
          <div className="p-3 bg-pulse/10 border border-pulse/30 text-pulse text-caption font-mono rounded select-none text-center">
            You are offline. Create and join require network signaling.
          </div>
        )}

        {/* Create Room Form */}
        <form onSubmit={handleCreateRoom} className="space-y-3">
          <h2 className="type-uppercase-label text-fg-muted">
            New room
          </h2>
          <Button
            type="submit"
            className="w-full"
            loading={isCreating}
            disabled={isJoining || isOffline}
          >
            Create room
          </Button>
          {createError && (
            <p className="text-caption font-mono text-decay mt-1">{createError}</p>
          )}
        </form>

        {/* Section divider line */}
        <div className="h-px bg-border" />

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
              className="font-mono uppercase text-center text-lg tracking-wider"
              disabled={isJoining || isCreating || isOffline}
            />
            <Button
              type="submit"
              variant="ghost"
              className="shrink-0"
              loading={isJoining}
              disabled={isCreating || !roomCode || isOffline}
            >
              Join
            </Button>
          </div>
          {joinError && (
            <p className="text-caption font-mono text-decay mt-1">{joinError}</p>
          )}
        </form>
      </div>

      {/* Footer info */}        <div className="mt-8 text-center type-micro text-fg-subtle">
        <p>P2P WebRTC • E2EE • No servers</p>
      </div>
    </div>
  );
};
