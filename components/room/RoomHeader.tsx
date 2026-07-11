'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, Share2, Terminal, Users, X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface RoomHeaderProps {
  roomId: string;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({ roomId }) => {
  const { peers, devModeEnabled, toggleDevMode, reset } = useChatStore();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const [identity, setIdentity] = useState<{ handle: string; peerColor: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_identity');
      if (saved) {
        try {
          setIdentity(JSON.parse(saved));
        } catch {}
      }
    }
  }, []);

  const confirmReset = () => {
    localStorage.removeItem('pulsar_identity');
    localStorage.removeItem('pulsar-displayName');
    reset();
    window.location.href = '/';
  };

  // Compute invite link
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${roomId}`
    : `https://pulsar.chat/?room=${roomId}`;

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
          title: 'Join my Pulsar P2P Chat Room',
          text: `Connect directly to my device. Room code: ${roomId}`,
          url: inviteLink,
        });
      } catch {
        // Ignore share errors/cancellations
      }
    } else {
      handleCopyLink();
    }
  };

  const connectedPeersCount = Array.from(peers.values()).filter(
    (p) => p.connectionState === 'connected'
  ).length;

  return (
    <>
      <header className="h-[52px] border-b border-border-default bg-bg-primary px-4 flex items-center justify-between select-none">
        {/* Left: Wordmark */}
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm tracking-widest text-text-bright">
            PULSAR
          </span>
          <span className="hidden md:inline text-[9px] font-mono text-text-muted px-1.5 py-0.5 border border-border-default rounded-sm uppercase">
            v1.0-P2P
          </span>
        </div>

        {/* Center: Identity & Monospace room code display */}
        <div className="flex items-center gap-4">
          {identity && (
            <div className="hidden sm:flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0 animate-[pulsar-message-in-system_250ms_ease-in_forwards]"
                style={{ backgroundColor: identity.peerColor }}
              />
              <span className="font-mono text-xs text-[#ced0ce] select-none">
                @{identity.handle}
              </span>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-[11px] font-sans text-text-muted hover:text-text-bright hover:underline cursor-pointer focus:outline-none"
              >
                Reset identity
              </button>
            </div>
          )}

          <div className="flex items-center bg-[#1a1a1a] border border-border-default rounded px-3 py-1 gap-2.5">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              Room Code
            </span>
            <span className="font-mono font-bold text-text-bright tracking-widest select-all text-sm">
              {roomId}
            </span>
            <button
              onClick={handleCopyCode}
              className="text-text-muted hover:text-text-bright transition-colors focus:outline-none"
              title="Copy Code"
              aria-label="Copy Room Code"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-status-green" />
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
            <div className="flex items-center gap-1.5 px-2.5 h-8 bg-bg-surface border border-border-default rounded font-mono text-xs text-text-primary">
              <Users className="w-3.5 h-3.5 text-text-muted" />
              <span>{connectedPeersCount}</span>
            </div>
            {connectedPeersCount >= 5 && (
              <span className="text-[10px] font-mono text-status-yellow uppercase tracking-wider">
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
            <QrCode className="w-4 h-4 text-text-primary" />
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
              <Check className="w-4 h-4 text-status-green" />
            ) : (
              <Share2 className="w-4 h-4 text-text-primary" />
            )}
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
        <div className="fixed inset-0 z-50 bg-[#121212]/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[340px] bg-bg-surface border border-border-default rounded-md p-6 relative">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-bright transition-colors focus:outline-none"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mt-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-text-muted mb-4">
                Scan to Join Room
              </h3>
              
              {/* QR Code Canvas */}
              <div className="bg-[#e6e8e6] p-4 inline-block rounded-sm mb-4">
                <QRCodeSVG
                  value={inviteLink}
                  size={200}
                  bgColor="#e6e8e6"
                  fgColor="#191919"
                  level="M"
                />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-sans text-text-muted leading-relaxed">
                  Scan this code on another device to join this direct encrypted peer channel.
                </p>
                <div className="flex gap-1.5">
                  <Input
                    readOnly
                    value={inviteLink}
                    className="h-8 text-xs font-mono select-all bg-[#121212]"
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
      {/* Reset Confirmation Overlay Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-[#121212]/85 flex items-center justify-center p-4">
          <div className="w-full max-w-[320px] bg-bg-surface border border-border-default rounded-md p-5 select-none animate-[pulsar-sdp-modal-in_200ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <p className="font-sans text-xs text-text-primary leading-normal mb-4">
              This will clear your handle and color. You will need to pick a new one. Continue?
            </p>
            <div className="flex items-center justify-end gap-3 font-mono text-[11px]">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-text-muted hover:text-text-bright hover:underline focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="bg-status-red text-text-bright px-3 py-1.5 rounded hover:bg-status-red/90 font-medium transition-colors focus:outline-none animate-pulse"
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
