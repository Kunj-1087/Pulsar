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

  // Load identity and room code from localStorage / URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_identity');
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
      setCreateError('Could not initialize room. Check signaling server connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    setJoinError(null);

    const cleanCode = roomCode.trim().toUpperCase();

    if (!isValidRoomCode(cleanCode)) {
      setJoinError('Invalid room code format (must be 6 alphanumeric chars).');
      setIsJoining(false);
      return;
    }

    router.push(`/room/${cleanCode}`);
  };

  return (
    <div className="w-full max-w-[440px] px-6 py-8 border border-border-default bg-bg-surface rounded-md">
      {/* Wordmark logo */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-text-bright">
          PULSAR
        </h1>
        <p className="text-xs font-mono text-text-muted mt-1">
          Signal travels. No server needed.
        </p>
      </div>

      <div className="space-y-8">
        {/* Node Identity Display */}
        {identity && (
          <div className="flex flex-col gap-1.5 p-3.5 bg-bg-primary border border-border-default rounded">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider select-none">
              Active Node Identity
            </span>
            <div className="flex items-center gap-2 select-none">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: identity.peerColor }}
              />
              <span className="font-mono text-sm text-[#ced0ce]">
                @{identity.handle}
              </span>
            </div>
          </div>
        )}

        {/* Section divider line */}
        <div className="h-[1px] bg-border-default" />

        {/* Create Room Form */}
        <form onSubmit={handleCreateRoom} className="space-y-3">
          <h2 className="text-xs font-mono uppercase text-text-muted">
            Host a New Room
          </h2>
          <Button
            type="submit"
            className="w-full"
            loading={isCreating}
            disabled={isJoining}
          >
            Create Room
          </Button>
          {createError && (
            <p className="text-xs font-mono text-status-red mt-1">{createError}</p>
          )}
        </form>

        {/* Section divider line */}
        <div className="h-[1px] bg-border-default" />

        {/* Join Room Form */}
        <form onSubmit={handleJoinRoom} className="space-y-3">
          <h2 className="text-xs font-mono uppercase text-text-muted">
            Join Existing Room
          </h2>
          <div className="flex gap-2">
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="font-mono uppercase text-center text-lg tracking-wider"
              disabled={isJoining || isCreating}
            />
            <Button
              type="submit"
              variant="ghost"
              className="shrink-0"
              loading={isJoining}
              disabled={isCreating || !roomCode}
            >
              Join
            </Button>
          </div>
          {joinError && (
            <p className="text-xs font-mono text-status-red mt-1">{joinError}</p>
          )}
        </form>
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center text-[10px] font-mono text-text-muted">
        <p>Open Source • P2P WebRTC • Local Encrypted Session</p>
      </div>
    </div>
  );
};
