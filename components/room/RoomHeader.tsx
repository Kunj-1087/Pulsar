'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, Share2, Users, MoreVertical, Menu, WifiOff, QrCode as QrIcon } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useNetworkStatus } from '../../lib/useNetworkStatus';
import { fetchLanIP, buildInviteUrl, isJoiner } from '../../lib/lanDiscovery';

interface RoomHeaderProps {
  roomId: string;
  onToggleChannelSidebar?: () => void;
  onToggleMembersList?: () => void;
  onOpenManualPairing?: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomId,
  onToggleChannelSidebar,
  onToggleMembersList,
  onOpenManualPairing,
}) => {
  const { peers, channels, activeChannelId } = useChatStore();
  const isOnline = useNetworkStatus();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [identity, setIdentity] = useState<{ handle: string; peerColor: string } | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isJoiner()) {
      setInviteUrl(window.location.href);
    } else {
      setInviteUrl(`${window.location.origin}/room/${roomId}`);
      fetchLanIP().then((lan) => {
        if (lan.available) {
          setInviteUrl(buildInviteUrl(lan.ip, roomId));
        }
      }).catch(() => {});
    }
  }, [roomId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          setIdentity(JSON.parse(saved));
        } catch {}
      }
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleShareLink = () => {
    const urlToCopy = inviteUrl || (typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : '');
    navigator.clipboard.writeText(urlToCopy);
    setCopiedLink(true);
    setShowDropdown(false);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleResetIdentity = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quark_identity');
      window.location.reload();
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeChannelName = activeChannel ? activeChannel.name : 'general';

  const peerList = Array.from(peers.values());
  const connectedPeersCount = peerList.filter((p) => p.connectionState === 'connected').length;

  let statusLabel: string;
  let statusColor: string;

  if (!isOnline) {
    statusLabel = 'Offline — viewing local history';
    statusColor = '#525252';
  } else if (connectedPeersCount === 0) {
    statusLabel = 'No peers connected';
    statusColor = '#a3a3a3';
  } else {
    statusLabel = `Connected — ${connectedPeersCount} peer${connectedPeersCount > 1 ? 's' : ''}`;
    statusColor = '#E50914';
  }

  return (
    <>
      <header className="h-[52px] bg-surface border-b border-border px-4 flex items-center justify-between select-none shrink-0 font-sans z-30 relative">
        {/* LEFT SECTION */}
        <div className="flex items-center gap-3">
          {onToggleChannelSidebar && (
            <button
              type="button"
              onClick={onToggleChannelSidebar}
              className="md:hidden text-text-muted hover:text-text-primary p-1 focus:outline-none"
              title="Toggle Channels"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <span className="text-white text-base font-bold tracking-tight">
            quark
          </span>

          <div className="w-px h-4 bg-border" />

          <span className="text-white text-sm font-medium truncate max-w-[100px] sm:max-w-[140px]">
            # {activeChannelName}
          </span>
        </div>

        {/* CENTER SECTION */}
        <div className="flex items-center gap-2 relative">
          <span className="hidden sm:inline-block text-[10px] text-text-muted font-sans font-medium uppercase tracking-widest">
            ROOM
          </span>
          <span className="font-mono text-xs text-text-primary tracking-widest font-semibold">
            {roomId}
          </span>

          <div className="relative flex items-center">
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-text-muted hover:text-text-primary p-1 transition-colors focus:outline-none"
              title="Copy Room Code"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {copiedCode && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-overlay border border-border text-text-primary text-[11px] font-sans px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
                Copied!
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="text-text-secondary hover:text-text-primary p-1 transition-colors focus:outline-none"
            title="Show QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-3">
          {/* Network & Peer Connectivity Badge (Step 6) */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: statusColor }}
            />
            <span className="hidden sm:inline" style={{ color: statusColor }}>
              {statusLabel}
            </span>
            <span className="sm:hidden" style={{ color: statusColor }}>
              {!isOnline ? 'Offline' : connectedPeersCount === 0 ? 'No peers' : `${connectedPeersCount} peer${connectedPeersCount > 1 ? 's' : ''}`}
            </span>
          </div>

          {/* User Identity */}
          {identity && (
            <div className="hidden lg:flex items-center gap-1.5 text-text-secondary text-xs">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: identity.peerColor || 'var(--accent)' }}
              />
              <span className="truncate max-w-[100px]">@{identity.handle}</span>
            </div>
          )}

          {/* Mobile Members Toggle Button */}
          {onToggleMembersList && (
            <button
              type="button"
              onClick={onToggleMembersList}
              className="md:hidden text-text-muted hover:text-text-primary p-1 focus:outline-none"
              title="Toggle Members"
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* Overflow Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="text-text-muted hover:text-text-primary p-1 transition-colors focus:outline-none"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-overlay border border-border rounded shadow-lg py-1 z-50 text-xs font-sans">
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="w-full text-left px-3 py-1.5 text-text-primary hover:bg-elevated flex items-center justify-between"
                >
                  <span>Invite</span>
                  <Share2 className="w-3.5 h-3.5 text-text-muted" />
                </button>

                {onOpenManualPairing && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      onOpenManualPairing();
                    }}
                    className="w-full text-left px-3 py-1.5 text-text-primary hover:bg-elevated flex items-center justify-between"
                  >
                    <span>Connect Manually (QR)</span>
                    <QrIcon className="w-3.5 h-3.5 text-accent" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowResetConfirm(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-accent hover:bg-elevated"
                >
                  Reset Identity
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded max-w-xs w-full flex flex-col items-center gap-4 text-center font-sans">
            <h3 className="text-text-primary font-bold text-base">Scan Room QR</h3>
            <div className="bg-white p-3 rounded">
              <QRCodeSVG
                value={inviteUrl || (typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : '')}
                size={160}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="M"
              />
            </div>
            <p className="text-text-secondary text-xs">
              Scan with another device to join room <span className="font-mono text-text-primary">{roomId}</span> instantly.
            </p>
            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="w-full bg-elevated hover:bg-overlay border border-border text-text-primary text-xs py-2 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reset Identity Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-5 rounded max-w-xs w-full flex flex-col gap-3 text-sans text-xs">
            <h4 className="text-text-primary font-bold text-sm">Reset Identity?</h4>
            <p className="text-text-secondary leading-relaxed">
              This will clear your local handle and color assignments for this session.
            </p>
            <div className="flex gap-2 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-elevated hover:bg-overlay text-text-primary rounded border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetIdentity}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white font-medium rounded"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
