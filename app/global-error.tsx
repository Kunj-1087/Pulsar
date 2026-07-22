'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-black text-white font-sans flex items-center justify-center min-h-screen">
        <div className="p-6 bg-surface border border-border rounded text-center max-w-sm">
          <h2 className="text-lg font-bold text-accent mb-2">Global Error</h2>
          <p className="text-xs text-text-secondary mb-4">{error?.message || 'An unexpected error occurred.'}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="bg-accent text-white text-xs px-4 py-2 rounded"
          >
            Reset App
          </button>
        </div>
      </body>
    </html>
  );
}
