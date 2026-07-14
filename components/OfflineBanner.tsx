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
      toast.success('Connection restored. Back online.', { title: 'Network Restored' });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('Network connection lost. Running in offline mode.', { title: 'Network Disconnected' });
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
    <div className="w-full bg-status-yellow text-[#191919] font-mono text-[11px] font-bold py-1.5 px-4 flex items-center justify-center gap-2 select-none z-50 relative animate-pulse shadow-md">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>OFFLINE MODE ACTIVE. PEER DISCOVERY AND ROOM CREATION ARE DISABLED.</span>
    </div>
  );
};
