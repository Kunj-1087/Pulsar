'use client';

import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { Loader2 } from 'lucide-react';

export const PeerStatus: React.FC = () => {
  const { roomStatus } = useChatStore();

  if (roomStatus !== 'reconnecting' && roomStatus !== 'connecting' && roomStatus !== 'signaling') {
    return null;
  }

  return (
    <div className="fixed top-[64px] left-1/2 -translate-x-1/2 z-50 bg-overlay border border-border rounded px-4 py-2 flex items-center gap-2 text-xs font-sans text-text-secondary shadow-lg">
      <Loader2 className="w-3 h-3 animate-spin text-accent" />
      <span>Reconnecting...</span>
    </div>
  );
};
