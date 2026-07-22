'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 font-sans select-none">
      <div className="max-w-md w-full bg-surface border border-border p-8 rounded flex flex-col items-center text-center gap-5 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
          <WifiOff className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight">
          You're offline
        </h1>

        <p className="text-sm text-text-secondary leading-relaxed font-sans">
          No internet or network connection detected. Your local rooms, messages, and downloaded files remain fully accessible offline in your local database.
        </p>

        <div className="font-mono text-xs text-text-muted bg-elevated border border-border px-3 py-2 rounded w-full">
          &gt; mode: offline_fallback_shell
        </div>

        <Link
          href="/"
          className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 rounded transition-colors text-center mt-1"
        >
          View local history
        </Link>
      </div>
    </div>
  );
}
