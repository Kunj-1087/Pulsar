'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ServerOff, UserX, CloudOff, Github, ArrowRight } from 'lucide-react';
import { IdentityGate } from '../components/room/IdentityGate';
import { generateRoomCode } from '../lib/roomCode';

export default function Home() {
  const router = useRouter();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);

    try {
      let roomId = '';
      try {
        const res = await fetch('/api/signal/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.roomId) roomId = data.roomId;
        }
      } catch (e) {
        console.warn('API signal create fallback to client generator', e);
      }

      if (!roomId) {
        roomId = generateRoomCode();
      }

      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error(err);
      setError('Failed to initialize room.');
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCode.trim().toUpperCase();
    if (!clean) return;
    router.push(`/room/${clean}`);
  };

  return (
    <IdentityGate>
      <main className="h-screen w-screen bg-black overflow-hidden flex flex-col justify-between items-center px-4 py-8 relative select-none font-sans">
        <div />

        {/* Hero Content */}
        <div className="flex flex-col items-center text-center max-w-xl">
          {/* Logo & Tagline */}
          <h1 className="text-5xl font-bold text-white tracking-tight">
            quark
          </h1>
          <p className="text-lg text-text-secondary mt-2">
            Offline. Private. Direct.
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex items-center gap-3 h-10">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-6 py-2.5 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create a Room'}
            </button>

            {showJoinInput ? (
              <form onSubmit={handleJoinSubmit} className="flex items-center gap-1.5 animate-fade-in">
                <input
                  type="text"
                  autoFocus
                  maxLength={8}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className="w-36 bg-elevated border border-border focus:border-accent text-white font-mono text-xs px-3 py-2 rounded outline-none placeholder:text-text-muted uppercase tracking-widest"
                />
                <button
                  type="submit"
                  disabled={!roomCode.trim()}
                  className="bg-accent hover:bg-accent-hover text-white p-2 rounded transition-colors cursor-pointer disabled:opacity-40"
                  title="Join Room"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowJoinInput(true)}
                className="bg-transparent border border-border text-text-secondary hover:border-accent hover:text-white text-sm font-medium px-6 py-2.5 rounded transition-colors cursor-pointer"
              >
                Join a Room
              </button>
            )}
          </div>

          {error && (
            <p className="text-accent text-xs font-mono mt-3">{error}</p>
          )}

          {/* Feature Callouts */}
          <div className="mt-16 flex items-center justify-center gap-12 sm:gap-16">
            <div className="flex flex-col items-center">
              <ServerOff className="w-5 h-5 text-accent mb-2" />
              <span className="text-text-primary text-[13px] font-medium">No servers</span>
              <span className="text-text-muted text-[12px] mt-0.5">Runs entirely in your browser</span>
            </div>

            <div className="flex flex-col items-center">
              <UserX className="w-5 h-5 text-accent mb-2" />
              <span className="text-text-primary text-[13px] font-medium">No accounts</span>
              <span className="text-text-muted text-[12px] mt-0.5">Just pick a name and connect</span>
            </div>

            <div className="flex flex-col items-center">
              <CloudOff className="w-5 h-5 text-accent mb-2" />
              <span className="text-text-primary text-[13px] font-medium">No cloud</span>
              <span className="text-text-muted text-[12px] mt-0.5">Files go device to device</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full text-center flex flex-col items-center gap-1 text-xs text-text-muted">
          <span>Open source. Always free.</span>
          <a
            href="https://github.com/kunjnakrani/quark"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors mt-0.5"
          >
            <Github className="w-3.5 h-3.5" />
            <span>github.com/kunjnakrani/quark</span>
          </a>
        </footer>
      </main>
    </IdentityGate>
  );
}
