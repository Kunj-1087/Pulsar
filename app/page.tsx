import { Suspense } from 'react';
import { RoomCreator } from '../components/room/RoomCreator';
import { Github } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { IdentityGate } from '../components/room/IdentityGate';

export default function Home() {
  const isOfflineMode = process.env.NEXT_PUBLIC_OFFLINE_MODE === 'true';

  return (
    <main className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-void px-4 py-6 sm:px-6 overflow-y-auto">
      <IdentityGate>
        {/* Offline Mode Info Block */}
        {isOfflineMode && (
          <div className="w-full max-w-[440px] mb-6 px-6 py-4 border border-dim bg-surface rounded-md">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="type-uppercase-label text-fg-primary mb-2">
                  Offline LAN Mode
                </h2>
                <p className="font-sans text-small text-fg-secondary leading-relaxed mb-3">
                  Running without internet. Share the URL or QR with devices on the same network.
                </p>
                <div className="bg-surface-elevated border border-dim rounded px-3 py-2 mb-3">
                  <p className="font-mono text-caption text-fg-primary break-all">
                    {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
                  </p>
                </div>
                <p className="font-sans text-micro text-fg-subtle">
                  All traffic stays on your local network.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Centered Room Creator with Suspense context */}
        <Suspense fallback={
          <div className="w-full max-w-[440px] px-6 py-24 border border-dim bg-surface rounded-md flex flex-col items-center justify-center gap-4">
            <Spinner className="w-6 h-6 text-pulsar" />
            <span className="type-terminal-msg text-fg-secondary">loading<span className="animate-cursor-blink ml-0.5 text-pulsar">_</span></span>
          </div>
        }>
          <RoomCreator />
        </Suspense>
      </IdentityGate>

      {/* Subtle Footer */}
      <footer className="mt-8 flex flex-col items-center gap-2 select-none">
        <a
          href="https://github.com/kunjnakrani/quark"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 type-micro text-fg-subtle hover:text-fg-primary transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          <span>quark-chat (MIT License)</span>
        </a>
      </footer>
    </main>
  );
}
