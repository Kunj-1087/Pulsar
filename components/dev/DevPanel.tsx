'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, Terminal, RefreshCw, FileText } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { formatBytes } from '../../lib/utils';
import { Button } from '../ui/Button';

interface DevPanelProps {
  onRefreshStats: () => void;
}

export const DevPanel: React.FC<DevPanelProps> = ({ onRefreshStats }) => {
  const {
    devModeEnabled,
    toggleDevMode,
    connectionStats,
    iceLog,
    clearIceLog,
    localSdp,
    remoteSdp,
    peers,
  } = useChatStore();

  const [expandedSection, setExpandedSection] = useState<string | null>('connection');
  const [sdpModalType, setSdpModalType] = useState<'local' | 'remote' | null>(null);
  const [copiedSdp, setCopiedSdp] = useState(false);

  if (!devModeEnabled) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleCopySdp = async (sdpText: string) => {
    try {
      await navigator.clipboard.writeText(sdpText);
      setCopiedSdp(true);
      setTimeout(() => setCopiedSdp(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const activePeer = Array.from(peers.values())[0];

  return (
    <>
      <div className="w-[360px] h-full border-l border-border-default bg-[#111111] flex flex-col font-mono text-xs select-none text-text-primary z-40">
        {/* Header */}
        <div className="h-[52px] px-4 border-b border-border-default flex items-center justify-between bg-bg-primary">
          <div className="flex items-center gap-2 text-text-bright">
            <Terminal className="w-4 h-4 text-status-yellow" />
            <span className="font-bold tracking-wider">DEV DIAGNOSTICS</span>
          </div>
          <button
            onClick={toggleDevMode}
            className="text-text-muted hover:text-text-bright transition-colors focus:outline-none"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Section 1: Connection */}
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('connection')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>1. CONNECTION STATE</span>
              <span>{expandedSection === 'connection' ? '[-]' : '[+]'}</span>
            </button>
            {expandedSection === 'connection' && (
              <div className="p-3 space-y-2 bg-[#121212]/50 border-t border-border-default">
                <div className="flex justify-between">
                  <span className="text-text-muted">Active Peer ID:</span>
                  <span className="text-text-bright truncate max-w-[180px]">{activePeer?.peerId || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">ICE Conn State:</span>
                  <span className={`font-bold ${
                    activePeer?.connectionState === 'connected' ? 'text-status-green' : 'text-status-yellow'
                  }`}>{activePeer?.connectionState?.toUpperCase() || 'IDLE'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Candidate Type:</span>
                  <span className="text-text-bright capitalize">{connectionStats?.connectionType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Data Channel:</span>
                  <span className={`font-bold ${
                    connectionStats?.channelState === 'open' ? 'text-status-green' : 'text-status-red'
                  }`}>{connectionStats?.channelState?.toUpperCase() || 'CLOSED'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Realtime Stats */}
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('stats')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>2. NETWORK METRICS</span>
              <span>{expandedSection === 'stats' ? '[-]' : '[+]'}</span>
            </button>
            {expandedSection === 'stats' && (
              <div className="p-3 space-y-2.5 bg-[#121212]/50 border-t border-border-default">
                <div className="flex justify-between">
                  <span className="text-text-muted">Bytes Sent:</span>
                  <span className="text-text-bright">{formatBytes(connectionStats?.bytesSent || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Bytes Received:</span>
                  <span className="text-text-bright">{formatBytes(connectionStats?.bytesReceived || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Messages Count:</span>
                  <span className="text-text-bright">{connectionStats?.messageCount || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Latency RTT:</span>
                  <span className="text-text-bright">
                    {connectionStats?.latencyMs !== null && connectionStats?.latencyMs !== undefined
                      ? `${connectionStats.latencyMs} ms`
                      : 'N/A'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefreshStats}
                  className="w-full h-8 flex items-center justify-center gap-1.5 mt-1"
                >
                  <RefreshCw className="w-3 h-3 animate-pulse" />
                  <span>Query Stats / Ping</span>
                </Button>
              </div>
            )}
          </div>

          {/* Section 3: ICE gathering log */}
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('ice')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>3. GATHERING LOGS</span>
              <span>{expandedSection === 'ice' ? '[-]' : '[+]'}</span>
            </button>
            {expandedSection === 'ice' && (
              <div className="p-3 space-y-2 bg-[#121212]/50 border-t border-border-default">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-text-muted uppercase">ICE Log Stream</span>
                  <button
                    onClick={clearIceLog}
                    className="text-status-red hover:underline focus:outline-none text-[10px]"
                  >
                    CLEAR
                  </button>
                </div>
                <div className="w-full h-40 overflow-y-auto bg-black p-2 border border-border-default/40 rounded text-[10px] text-text-primary leading-normal select-text space-y-1">
                  {iceLog.length === 0 ? (
                    <span className="text-text-muted">Waiting for events...</span>
                  ) : (
                    iceLog.map((log, index) => (
                      <div key={index} className="border-b border-border-default/20 pb-0.5 last:border-0">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: SDP Viewer */}
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('sdp')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>4. SDP SESSION DESCRIPTIONS</span>
              <span>{expandedSection === 'sdp' ? '[-]' : '[+]'}</span>
            </button>
            {expandedSection === 'sdp' && (
              <div className="p-3 space-y-2 bg-[#121212]/50 border-t border-border-default">
                <p className="text-[10px] text-text-muted mb-2 leading-relaxed">
                  Inspect raw Session Description Protocol (SDP) configurations negotiated during handshake.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={!localSdp}
                    onClick={() => setSdpModalType('local')}
                  >
                    Local SDP
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={!remoteSdp}
                    onClick={() => setSdpModalType('remote')}
                  >
                    Remote SDP
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer banner */}
        <div className="p-3 border-t border-border-default/80 bg-bg-primary text-[10px] text-text-muted flex items-center gap-1.5 select-none">
          <ShieldAlert className="w-3.5 h-3.5 text-status-yellow shrink-0" />
          <span>Local telemetry. No cloud reports.</span>
        </div>
      </div>

      {/* SDP Viewer Modal Overlay */}
      {sdpModalType && (
        <div className="fixed inset-0 z-50 bg-[#121212]/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] h-[460px] bg-bg-surface border border-border-default rounded-md p-6 flex flex-col relative select-text">
            <button
              onClick={() => setSdpModalType(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-bright transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-mono text-xs uppercase tracking-wider text-text-bright mb-4 flex items-center gap-1.5 select-none">
              <FileText className="w-4 h-4 text-text-muted" />
              <span>{sdpModalType === 'local' ? 'Local' : 'Remote'} Session SDP</span>
            </h3>

            <textarea
              readOnly
              value={(sdpModalType === 'local' ? localSdp : remoteSdp) || ''}
              className="flex-1 w-full bg-black border border-border-default p-3 rounded font-mono text-[10px] text-text-primary leading-normal focus:outline-none resize-none select-all"
            />

            <div className="mt-4 flex gap-2 justify-end select-none">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setSdpModalType(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="h-8 min-w-[80px]"
                onClick={() => handleCopySdp((sdpModalType === 'local' ? localSdp : remoteSdp) || '')}
              >
                {copiedSdp ? 'Copied!' : 'Copy SDP'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
