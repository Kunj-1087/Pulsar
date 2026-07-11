'use client';

import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { Badge } from '../ui/Badge';

export const PeerStatus: React.FC = () => {
  const { peers } = useChatStore();

  const peerList = Array.from(peers.values());

  if (peerList.length === 0) {
    return (
      <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between text-xs font-mono text-text-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-status-yellow animate-pulse" />
          <span>Waiting for peers to join... Invite someone using the code.</span>
        </div>
        <div>
          <span>LAN Mode Ready</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between overflow-x-auto whitespace-nowrap text-xs font-mono text-text-muted scrollbar-none select-none">
      <div className="flex items-center gap-4">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Network Status:</span>
        <div className="flex items-center gap-3">
          {peerList.map((peer) => {
            let badgeVariant: 'connected' | 'connecting' | 'disconnected' = 'connecting';
            if (peer.connectionState === 'connected') {
              badgeVariant = 'connected';
            } else if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
              badgeVariant = 'disconnected';
            }
            
            return (
              <div key={peer.peerId} className="flex items-center gap-1.5">
                <span className="text-text-bright">{peer.displayName}</span>
                <Badge
                  variant={badgeVariant}
                  label={peer.connectionState.toUpperCase()}
                  className="scale-90 origin-left"
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* LAN marker info */}
      <div className="hidden sm:block">
        <Badge variant="lan" label="DIRECT P2P" />
      </div>
    </div>
  );
};
