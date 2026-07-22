'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, Share2, Terminal, Users, X, Lock, ShieldAlert, Radio, Shield } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { isOfflineMode } from '../../lib/utils';
import { SecurityCenter } from './SecurityCenter';

interface RoomHeaderProps {
  roomId: string;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({ roomId }) => {
  const { peers, devModeEnabled, toggleDevMode, reset, setRoomStatus } = useChatStore();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const [identity, setIdentity] = useState<{ handle: string; peerColor: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSecurityCenter, setShowSecurityCenter] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          setIdentity(JSON.parse(saved));
        } catch {}
      }
      setOfflineMode(isOfflineMode());
    }
  }, []);

  const confirmReset = () => {
    setRoomStatus('closing');
    localStorage.removeItem('quark_identity');
    localStorage.removeItem('quark-displayName');
    reset();
    setRoomStatus('closed');
    window.location.href = '/';
  };

  // Compute invite link
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${roomId}`
    : `https://quark.chat/?room=${roomId}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error('Failed to copy room code:', e);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error('Failed to copy invite link:', e);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Quark — Chat without the middle',
          text: `Join my peer-to-peer chat. Room code: ${roomId}`,
          url: inviteLink,
        });
      } catch {
        // Ignore share errors/cancellations
      }
    } else {
      handleCopyLink();
    }
  };

  const peerList = Array.from(peers.values());
  const connectedPeers = peerList.filter(
    (p) => p.connectionState === 'connected'
  );
  const connectedPeersCount = connectedPeers.length;

  const hasPeers = connectedPeersCount > 0;
  const allPeersE2EE = hasPeers && connectedPeers.every((p) => p.e2eeStatus === 'established');
  const anyPeerE2EEFailed = connectedPeers.some((p) => p.e2eeStatus === 'failed');

  return (
    <>
      <header className="h-13 border-b border-border bg-bg-base px-4 flex items-center justify-between select-none">
        {/* Left: Wordmark */}
        <div className="flex items-center gap-2">
          <span className="type-wordmark text-sm text-fg-primary group cursor-default">
            q<span className="group-hover:text-quantum transition-colors duration-300 ease-standard">ua</span>rk
          </span>
          <span className="hidden md:inline type-uppercase-label text-fg-muted px-1.5 py-0.5 border border-border rounded-sm">
            v1.0-P2P
          </span>
          {hasPeers && (
            allPeersE2EE ? (
              <span className="flex items-center gap-1 type-uppercase-label text-nebula border border-nebula/30 bg-nebula/10 rounded px-1.5 py-0.5" title="End-to-end encrypted">
                <Lock className="w-2.5 h-2.5" />
                <span>E2EE</span>
              </span>
            ) : anyPeerE2EEFailed ? (
              <span className="flex items-center gap-1 type-uppercase-label text-redshift border border-redshift/30 bg-redshift/10 rounded px-1.5 py-0.5" title="E2EE key agreement failed">
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>E2EE ALERT</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 type-uppercase-label text-accretion border border-accretion/30 bg-accretion/10 rounded px-1.5 py-0.5" title="Encrypting channels...">
                <Lock className="w-2.5 h-2.5" />
                <span>SECURING</span>
              </span>
            )
          )}
          {offlineMode && (
            <span className="flex items-center gap-1 type-uppercase-label text-pulsar border border-pulsar/30 bg-pulsar/10 rounded px-1.5 py-0.5" title="Offline LAN mode">
              <Radio className="w-2.5 h-2.5" />
              <span>OFFLINE LAN</span>
            </span>
          )}
        </div>

        {/* Center: Identity & Monospace room code display */}
        <div className="flex items-center gap-4">
          {identity && (
            <div className="hidden sm:flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0 animate-[quark-message-in-system_250ms_ease-in_forwards]"
                style={{ backgroundColor: identity.peerColor }}
              />
              <span className="type-peer-name text-fg-primary select-none">
                @{identity.handle}
              </span>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-caption font-sans text-fg-muted hover:text-fg-primary hover:underline cursor-pointer focus:outline-none"
              >
                Reset identity
              </button>
            </div>
          )}

          <div className="flex items-center bg-bg-elevated border border-border rounded px-3 py-1 gap-2.5">
            <span className="type-uppercase-label text-fg-muted">
              Room Code
            </span>
            <span className="type-hero-numeral text-fg-primary text-sm font-bold select-all">
              {roomId}
            </span>
            <button
              onClick={handleCopyCode}
              className="text-fg-muted hover:text-fg-primary transition-colors focus:outline-none"
              title="Copy Code"
              aria-label="Copy Room Code"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-photon" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Right: Actions & Badges */}
        <div className="flex items-center gap-2">
          {/* Peer Count Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 h-8 bg-bg-surface border border-border rounded font-mono text-xs text-fg-primary">
              <Users className="w-3.5 h-3.5 text-fg-subtle" />
              <span>{connectedPeersCount}</span>
            </div>
            {connectedPeersCount >= 5 && (
              <span className="type-uppercase-label text-pulse">
                Room full
              </span>
            )}
          </div>

          {/* QR Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQRModal(true)}
            className="w-8 h-8 p-0"
            title="Show QR Code"
            aria-label="Show QR Code"
          >
            <QrCode className="w-4 h-4 text-fg-primary" />
          </Button>

          {/* Share Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="w-8 h-8 p-0"
            title="Share Room Link"
            aria-label="Share Room Link"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-photon" />
            ) : (
              <Share2 className="w-4 h-4 text-fg-primary" />
            )}
          </Button>

          {/* Local Offline Pairing */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.dispatchEvent(new Event('open-manual-pairing'))}
            className="w-8 h-8 p-0 border border-dim"
            title="Local Offline Pairing"
            aria-label="Local Offline Pairing"
          >
            <Radio className="w-4 h-4 text-accretion" />
          </Button>

          {/* Security Center */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecurityCenter(true)}
            className="w-8 h-8 p-0"
            title="Security Center"
            aria-label="Open Security Center"
          >
            <Shield className="w-4 h-4 text-fg-primary" />
          </Button>

          {/* Dev mode Toggle */}
          <Button
            variant={devModeEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={toggleDevMode}
            className="w-8 h-8 p-0"
            title="Toggle Developer Diagnostics"
            aria-label="Toggle Developer Panel"
          >
            <Terminal className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* QR Code Modal Overlay */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-bg-base/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[340px] bg-bg-surface border border-border rounded-md p-6 relative">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mt-2">
              <h3 className="type-uppercase-label text-fg-muted mb-4">
                Scan to Join Room
              </h3>
              
              {/* QR Code Canvas */}
              <div className="bg-fg-primary p-4 inline-block rounded-sm mb-4">
                <QRCodeSVG
                  value={inviteLink}
                  size={200}
                  bgColor="#f5f5f5"
                  fgColor="#0a0a0a"
                  level="M"
                />
              </div>

              <div className="space-y-3">
                <p className="text-small font-sans text-fg-muted leading-relaxed">
                  Scan with another device to join this room.
                </p>
                <div className="flex gap-1.5">
                  <Input
                    readOnly
                    value={inviteLink}
                    className="h-8 text-caption font-mono select-all bg-bg-elevated"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleCopyLink}
                  >
                    {copiedLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Security Center Modal */}
      {showSecurityCenter && (
        <SecurityCenter onClose={() => setShowSecurityCenter(false)} />
      )}

      {/* Reset Confirmation Overlay Modal */}
      {showResetConfirm && (              <div className="fixed inset-0 z-50 bg-bg-base/85 flex items-center justify-center p-4">
          <div className="w-full max-w-[320px] bg-bg-surface border border-border rounded-md p-5 select-none animate-[quark-sdp-modal-in_200ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <p className="font-sans text-small text-fg-primary leading-normal mb-4">
              This will clear your handle. You will need to pick a new one.
            </p>
            <div className="flex items-center justify-end gap-3 font-mono text-[11px]">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-fg-muted hover:text-fg-primary hover:underline focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="bg-decay text-fg-primary px-3 py-1.5 rounded hover:bg-decay-hover font-medium transition-colors focus:outline-none"
              >
                Yes, reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
