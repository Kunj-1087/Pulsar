'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 font-sans select-none">
      <div className="max-w-md w-full bg-surface border border-border p-6 rounded flex flex-col items-center text-center gap-4">
        <h1 className="text-4xl font-bold text-accent">404</h1>
        <p className="text-sm text-text-secondary">
          This room or page could not be found.
        </p>
        <Link
          href="/"
          className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors mt-2"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
