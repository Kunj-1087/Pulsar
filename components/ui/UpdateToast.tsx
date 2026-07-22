'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export const UpdateToast: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      setShowUpdate(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        setShowUpdate(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setShowUpdate(true);
            }
          });
        }
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-overlay border border-border rounded px-4 py-2.5 flex items-center gap-3 shadow-xl font-sans animate-slide-up text-xs select-none">
      <div className="flex items-center gap-2 text-text-primary font-medium">
        <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />
        <span>New version available</span>
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        className="bg-accent hover:bg-accent-hover text-white px-3 py-1 rounded font-medium transition-colors"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setShowUpdate(false)}
        className="text-text-muted hover:text-text-primary p-0.5"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
