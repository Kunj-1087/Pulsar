'use client';

import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { Badge } from '../ui/Badge';

export const PeerStatus: React.FC = () => {
  const { peers } = useChatStore();

  const peerList = Array.from(peers.values());
  const connectedPeers = peerList.filter((p) => p.connectionState === 'connected');

  if (connectedPeers.length === 0) {
    return (
      <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between text-xs font-mono text-text-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-status-yellow animate-pulse" />
          <span>Waiting for peers to join.</span>
        </div>
        <div>
          <span>LAN Mode Ready</span>
        </div>
      </div>
    );
  }

  const connectedNames = connectedPeers
    .map((p) => p.displayName || p.peerId.substring(0, 8))
    .join(', ');

  return (
    <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between overflow-x-auto whitespace-nowrap text-xs font-mono text-text-muted scrollbar-none select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse" />
          <span className="text-text-bright">{connectedNames}</span>
        </div>
      </div>
      
      <div className="hidden sm:block">
        <Badge variant="lan" label="DIRECT P2P" />
      </div>
    </div>
  );
};
