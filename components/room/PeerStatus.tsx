import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { Badge } from '../ui/Badge';
import { Lock, ShieldAlert } from 'lucide-react';

export const PeerStatus: React.FC = () => {
  const { peers, roomStatus } = useChatStore();

  const peerList = Array.from(peers.values());
  const connectedPeers = peerList.filter((p) => p.connectionState === 'connected');

  if (roomStatus === 'reconnecting') {
    return (
      <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between text-xs font-mono text-text-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-status-yellow animate-pulse" />
          <span className="text-status-yellow font-bold">Signaling connection lost. Reconnecting...</span>
        </div>
        <div>
          <span>Mesh Paused</span>
        </div>
      </div>
    );
  }

  if (roomStatus === 'failed') {
    return (
      <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between text-xs font-mono text-text-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-status-red" />
          <span className="text-status-red font-bold">Signaling server connection failed.</span>
        </div>
        <div>
          <span>Offline</span>
        </div>
      </div>
    );
  }

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

  return (
    <div className="h-8 bg-[#1a1a1a] border-b border-border-default px-4 flex items-center justify-between overflow-x-auto whitespace-nowrap text-xs font-mono text-text-muted scrollbar-none select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse" />
          <div className="flex items-center gap-3">
            {connectedPeers.map((p) => {
              const handle = p.handle || p.displayName || p.peerId.substring(0, 8);
              const color = p.peerColor || '#7a7a7a';
              return (
                <div key={p.peerId} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-text-bright">@{handle}</span>
                  {p.e2eeStatus === 'established' && (
                    <Lock className="w-3 h-3 text-status-green" title="E2EE Active" />
                  )}
                  {p.e2eeStatus === 'pending' && (
                    <Lock className="w-3 h-3 text-status-yellow animate-pulse" title="E2EE Negotiating..." />
                  )}
                  {p.e2eeStatus === 'failed' && (
                    <ShieldAlert className="w-3 h-3 text-status-red" title="E2EE Failed" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="hidden sm:block">
        <Badge variant="lan" label="DIRECT P2P" />
      </div>
    </div>
  );
};
