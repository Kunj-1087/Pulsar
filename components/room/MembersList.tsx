'use client';

import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';

export const MembersList: React.FC = () => {
  const { peers, myPeerId } = useChatStore();
  const [localIdentity, setLocalIdentity] = useState<{ handle: string; peerColor: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          setLocalIdentity(JSON.parse(saved));
        } catch {}
      }
    }
  }, []);

  const peerList = Array.from(peers.values());
  const totalCount = peerList.length + 1; // peers + self

  // Sort: self first, then alphabetical by handle/displayName
  const sortedPeers = [...peerList].sort((a, b) => {
    const nameA = a.handle || a.displayName || a.peerId;
    const nameB = b.handle || b.displayName || b.peerId;
    return nameA.localeCompare(nameB);
  });

  return (
    <aside className="w-50 flex-shrink-0 bg-surface border-l border-border h-full flex flex-col p-4 select-none overflow-y-auto">
      <div className="font-mono text-[11px] text-text-muted uppercase tracking-widest mb-4">
        MEMBERS — {totalCount}
      </div>

      <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
        ONLINE
      </div>

      <div className="space-y-2">
        {/* Local user */}
        <div className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-elevated transition-colors">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: localIdentity?.peerColor || 'var(--accent)' }}
          />
          <span className="text-text-secondary text-sm font-medium truncate">
            {localIdentity?.handle || 'You'}
          </span>
          <span className="text-text-muted text-xs font-mono ml-auto">
            (you)
          </span>
        </div>

        {/* Remote connected peers */}
        {sortedPeers.map((peer) => {
          const isOnline = peer.connectionState === 'connected';
          const name = peer.handle || peer.displayName || peer.peerId.substring(0, 8);
          
          return (
            <div
              key={peer.peerId}
              className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-elevated transition-colors"
            >
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  isOnline ? '' : 'bg-text-muted'
                }`}
                style={isOnline ? { backgroundColor: peer.peerColor || 'var(--accent)' } : undefined}
              />
              <span className="text-text-secondary text-sm font-medium truncate">
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
