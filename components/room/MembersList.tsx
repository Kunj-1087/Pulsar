'use client';

import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';

export const MembersList: React.FC = () => {
  const { peers } = useChatStore();
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
  const onlinePeers = peerList.filter((p) => p.connectionState === 'connected');
  const totalCount = onlinePeers.length + 1; // connected peers + self

  // Sort online peers: alphabetical by handle/displayName
  const sortedPeers = [...onlinePeers].sort((a, b) => {
    const nameA = a.handle || a.displayName || a.peerId;
    const nameB = b.handle || b.displayName || b.peerId;
    return nameA.localeCompare(nameB);
  });

  return (
    <aside className="w-[200px] flex-shrink-0 bg-surface border-l border-border h-full flex flex-col p-3 pt-4 font-sans select-none overflow-y-auto">
      {/* Header */}
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        MEMBERS — {totalCount}
      </div>

      {/* Sub-label */}
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mt-3 mb-2">
        ONLINE
      </div>

      <div className="space-y-1">
        {/* Local user (always first) */}
        <div className="h-9 flex items-center gap-2.5 px-1 rounded hover:bg-elevated transition-colors">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-accent" />
          <span className="text-[13px] text-text-secondary truncate">
            {localIdentity?.handle || 'You'}
          </span>
          <span className="text-[12px] text-text-muted italic ml-auto shrink-0">
            (you)
          </span>
        </div>

        {/* Remote online peers */}
        {sortedPeers.map((peer) => {
          const name = peer.handle || peer.displayName || peer.peerId.substring(0, 8);

          return (
            <div
              key={peer.peerId}
              className="h-9 flex items-center gap-2.5 px-1 rounded hover:bg-elevated transition-colors"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-accent" />
              <span className="text-[13px] text-text-secondary truncate">
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
