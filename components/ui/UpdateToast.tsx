'use client';

import { useEffect, useState } from 'react';

export default function UpdateToast() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) setUpdateReady(true);
    };

    navigator.serviceWorker.ready.then((reg) => {
      checkWaiting(reg);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    });
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#1f1f1f] border border-[#262626] text-white px-4 py-3 rounded flex items-center gap-3 shadow-lg font-sans">
      <span className="text-sm">New version available</span>
      <button
        onClick={() => window.location.reload()}
        className="bg-[#E50914] hover:bg-[#f40612] text-white text-sm px-3 py-1 rounded font-medium transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
