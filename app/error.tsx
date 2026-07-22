'use client';

import React, { useEffect } from 'react';
import { Button } from '../components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 font-sans select-none">
      <div className="max-w-md w-full bg-surface border border-border p-6 rounded flex flex-col items-center text-center gap-4">
        <h2 className="text-xl font-bold text-accent">Unexpected Error</h2>
        <p className="text-xs font-mono text-text-secondary break-all">
          {error?.message || 'An error occurred while loading this page.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
