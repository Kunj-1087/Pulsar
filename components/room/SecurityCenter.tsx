'use client';

import React from 'react';
import { X, Shield, ShieldAlert, Lock, Trash2, Users } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { PROTOCOL_VERSION } from '../../types';
import { Button } from '../ui/Button';
import { panicWipe } from '../../lib/storage';

interface SecurityCenterProps {
  onClose: () => void;
}

export const SecurityCenter: React.FC<SecurityCenterProps> = ({ onClose }) => {
  const { peers, room } = useChatStore();
  const peerList = Array.from(peers.values());

  const handlePanicWipe = async () => {
    await panicWipe();
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-base/80 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-bg-surface border border-border rounded-md p-5 relative select-none max-h-[80vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none"
          aria-label="Close Security Center"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="type-uppercase-label text-fg-muted mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security Center
        </h3>

        <div className="space-y-4">
          <div className="bg-bg-elevated border border-border rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="type-uppercase-label text-fg-muted text-[10px]">Protocol</span>
              <span className="font-mono text-caption text-quantum">v{PROTOCOL_VERSION}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="type-uppercase-label text-fg-muted text-[10px]">Room Password</span>
              <span className="font-mono text-caption text-fg-primary">
                {room?.roomPassword ? 'Enabled' : 'None'}
              </span>
            </div>
          </div>

          <div className="bg-bg-elevated border border-border rounded p-3">
            <h4 className="type-uppercase-label text-fg-muted text-[10px] mb-3 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Peers ({peerList.length})
            </h4>
            {peerList.length === 0 ? (
              <p className="font-mono text-caption text-fg-muted">No peers connected</p>
            ) : (
              <div className="space-y-2">
                {peerList.map((p) => (
                  <div key={p.peerId} className="border border-border/40 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-caption text-fg-primary">
                        {p.handle || p.displayName || p.peerId.substring(0, 8)}
                      </span>
                      {p.e2eeStatus === 'established' ? (
                        <span title="E2EE Established"><Lock className="w-3 h-3 text-nebula" /></span>
                      ) : p.e2eeStatus === 'pending' ? (
                        <span title="E2EE Pending"><ShieldAlert className="w-3 h-3 text-accretion" /></span>
                      ) : (
                        <span title="E2EE Failed"><ShieldAlert className="w-3 h-3 text-redshift" /></span>
                      )}
                    </div>
                    {p.e2eeSafetyNumber && (
                      <div className="font-mono text-micro text-fg-muted">
                        Safety #: {p.e2eeSafetyNumber}
                      </div>
                    )}
                    {p.protocolVersion !== undefined && (
                      <div className="font-mono text-micro text-fg-muted mt-0.5">
                        Protocol: v{p.protocolVersion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-decay/10 border border-decay/30 rounded p-3">
            <h4 className="type-uppercase-label text-decay text-[10px] mb-2 flex items-center gap-1.5">
              <Trash2 className="w-3 h-3" />
              Danger Zone
            </h4>
            <p className="font-mono text-micro text-fg-muted mb-3">
              Clears all local messages, files, rooms, and cached data. This cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={handlePanicWipe}
              className="w-full h-8 text-xs"
            >
              Panic Wipe — Erase All Local Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
