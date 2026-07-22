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
      <div className="h-8 bg-surface-elevated border-b border-dim px-4 flex items-center justify-between text-caption font-mono text-fg-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accretion animate-pulse" />
          <span className="text-accretion font-bold">Signaling lost. Reconnecting...</span>
        </div>
        <div>
          <span className="type-uppercase-label text-fg-muted">mesh paused</span>
        </div>
      </div>
    );
  }

  if (roomStatus === 'failed') {
    return (
      <div className="h-8 bg-surface-elevated border-b border-dim px-4 flex items-center justify-between text-caption font-mono text-fg-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-redshift" />
          <span className="text-redshift font-bold">Signaling connection failed.</span>
        </div>
        <div>
          <span className="type-uppercase-label text-fg-muted">offline</span>
        </div>
      </div>
    );
  }

  if (connectedPeers.length === 0) {
    return (
      <div className="h-8 bg-surface-elevated border-b border-dim px-4 flex items-center justify-between text-caption font-mono text-fg-muted select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accretion animate-pulse" />
          <span>Waiting for peers...</span>
        </div>
        <div>
          <span className="type-uppercase-label text-fg-muted">mesh ready</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-8 bg-surface-elevated border-b border-dim px-4 flex items-center justify-between overflow-x-auto whitespace-nowrap text-caption font-mono text-fg-muted scrollbar-none select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-nebula animate-pulse" />
          <div className="flex items-center gap-3">
            {connectedPeers.map((p) => {
              const handle = p.handle || p.displayName || p.peerId.substring(0, 8);
              const color = p.peerColor || 'var(--fg-subtle)';
              return (
                <div key={p.peerId} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-fg-primary">@{handle}</span>
                  {p.e2eeStatus === 'established' && (
                    <span title="E2EE Active"><Lock className="w-3 h-3 text-nebula" /></span>
                  )}
                  {p.e2eeStatus === 'pending' && (
                    <span title="E2EE Negotiating..."><Lock className="w-3 h-3 text-accretion animate-pulse" /></span>
                  )}
                  {p.e2eeStatus === 'failed' && (
                    <span title="E2EE Failed"><ShieldAlert className="w-3 h-3 text-redshift" /></span>
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
