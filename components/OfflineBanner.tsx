'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from '../store/toastStore';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Connection restored.');
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('Network connection lost.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="w-full bg-accretion text-void font-mono text-caption font-bold py-1.5 px-4 flex items-center justify-center gap-2 select-none z-50 relative animate-pulse shadow-md">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>No internet. Peer discovery and room creation unavailable.</span>
    </div>
  );
};
