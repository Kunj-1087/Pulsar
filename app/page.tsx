import { Suspense } from 'react';
import { RoomCreator } from '../components/room/RoomCreator';
import { Github } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { IdentityGate } from '../components/room/IdentityGate';

export default function Home() {
  return (
    <main className="w-screen h-screen flex flex-col items-center justify-center bg-bg-primary p-4 overflow-y-auto">
      <IdentityGate>
        {/* Centered Room Creator with Suspense context */}
        <Suspense fallback={
          <div className="w-full max-w-[440px] px-6 py-24 border border-border-default bg-bg-surface rounded-md flex flex-col items-center justify-center gap-4">
            <Spinner className="w-6 h-6 text-text-primary" />
            <span className="font-mono text-xs text-text-muted">Loading Pulsar module...</span>
          </div>
        }>
          <RoomCreator />
        </Suspense>
      </IdentityGate>

      {/* Subtle Footer */}
      <footer className="mt-8 flex flex-col items-center gap-2 select-none">
        <a
          href="https://github.com/kunjnakrani/pulsar"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-text-bright transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          <span>pulsar-chat (MIT License)</span>
        </a>
      </footer>
    </main>
  );
}
