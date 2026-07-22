'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert, Terminal, RefreshCw, FileText, ChevronRight, Radio } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { formatBytes, cn, isOfflineMode, getSignalingUrl } from '../../lib/utils';
import { Button } from '../ui/Button';

interface DevPanelProps {
  onRefreshStats: () => void;
}

// RequestAnimationFrame Count-up Interpolator
const AnimatedCounter: React.FC<{
  value: number;
  duration: number;
  format: (val: number) => string;
  unit?: string;
}> = ({ value, duration, format, unit = 'B' }) => {
  const [displayVal, setDisplayVal] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    if (start === end) {
      setDisplayVal(end);
      return;
    }

    setIsAnimating(true);
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (end - start) * easedProgress);

      setDisplayVal(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        prevValueRef.current = end;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span>
      {isAnimating ? `${displayVal.toLocaleString()}${unit ? ' ' + unit : ''}` : format(value)}
    </span>
  );
};

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
    signalingDriverName,
  } = useChatStore();

  const [expandedSection, setExpandedSection] = useState<string | null>('connection');
  const [sdpModalType, setSdpModalType] = useState<'local' | 'remote' | null>(null);
  const [copiedSdp, setCopiedSdp] = useState(false);

  // Connection value flash states
  const [iceStateHighlight, setIceStateHighlight] = useState(false);
  const [channelStateHighlight, setChannelStateHighlight] = useState(false);

  // Ping states
  const [isPingActive, setIsPingActive] = useState(false);
  const [pingOpacityFlash, setPingOpacityFlash] = useState(false);
  
  // Stagger delays map for new iceLog entries
  const [logAnimationDelays, setLogAnimationDelays] = useState<number[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const prevIceState = useRef(peers.values().next().value?.connectionState);
  const prevChannelState = useRef(connectionStats?.channelState);
  const prevLatency = useRef(connectionStats?.latencyMs);

  const activePeer = Array.from(peers.values())[0];

  // Track value updates to trigger flash highlights
  useEffect(() => {
    const currentState = activePeer?.connectionState;
    if (currentState !== prevIceState.current) {
      setIceStateHighlight(true);
      const timer = setTimeout(() => setIceStateHighlight(false), 400);
      prevIceState.current = currentState;
      return () => clearTimeout(timer);
    }
  }, [activePeer?.connectionState]);

  useEffect(() => {
    const currentChannel = connectionStats?.channelState;
    if (currentChannel !== prevChannelState.current) {
      setChannelStateHighlight(true);
      const timer = setTimeout(() => setChannelStateHighlight(false), 400);
      prevChannelState.current = currentChannel;
      return () => clearTimeout(timer);
    }
  }, [connectionStats?.channelState]);

  // Track latency update to clear active ping button state
  useEffect(() => {
    if (connectionStats?.latencyMs !== prevLatency.current) {
      setIsPingActive(false);
      prevLatency.current = connectionStats?.latencyMs;
    }
  }, [connectionStats?.latencyMs]);

  // Stagger cascading arrival of log lines
  useEffect(() => {
    setLogAnimationDelays((prev) => {
      const nextDelays = [...prev];
      for (let i = nextDelays.length; i < iceLog.length; i++) {
        const batchIndex = i - prev.length;
        nextDelays.push(batchIndex * 40); // 40ms stagger per entry in the same batch
      }
      return nextDelays;
    });

    // Auto-scroll logs smoothly
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [iceLog.length]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handlePingClick = () => {
    setIsPingActive(true);
    setPingOpacityFlash(true);
    setTimeout(() => setPingOpacityFlash(false), 100); // 100ms click flash feedback
    onRefreshStats();
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

  return (
    <>
      <aside
      className={cn(
        "fixed top-0 right-0 h-full w-full sm:w-[360px] border-l border-dim bg-surface flex flex-col font-mono text-caption select-none text-fg-primary z-40 transition-all shadow-2xl",
        devModeEnabled
          ? "translate-x-0 opacity-100 duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          : "translate-x-full opacity-0 pointer-events-none duration-180 ease-[cubic-bezier(0.4,0,1,1)]"
      )}
    >
      {/* Panel header */}
      <div className="h-10 border-b border-dim px-3 flex items-center justify-between bg-surface-elevated shrink-0">
        <div className="flex items-center gap-2 text-fg-primary">
          <Terminal className="w-4 h-4 text-pulsar" />
          <span className="type-uppercase-label text-pulsar font-bold">Dev Diagnostics</span>
        </div>
        <button
          onClick={toggleDevMode}
          className="text-fg-muted hover:text-fg-primary transition-colors focus:outline-none p-2.5 md:p-0"
          title="Close Panel"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Section 1: Connection */}
        <div className="border border-dim rounded">
          <button
            onClick={() => toggleSection('connection')}
            className="w-full px-3 py-2 flex items-center justify-between bg-surface-elevated font-semibold text-fg-primary hover:bg-surface-hover text-left"
          >
            <span className="type-uppercase-label">1. Connection State</span>
            <span className="flex items-center gap-0.5">
              <span className="text-fg-muted">[</span>
              <ChevronRight
                className={cn(
                  "w-3 h-3 transition-transform duration-150 ease-standard",
                  expandedSection === 'connection' && "rotate-90"
                )}
              />
              <span className="text-fg-muted">]</span>
            </span>
          </button>
          <div
            className={cn(
              "transition-all overflow-hidden border-t",
              expandedSection === 'connection'
                ? "max-h-[400px] opacity-100 border-dim duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
            )}
          >
            <div className="p-3 space-y-2 bg-void/50">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Signaling Transport:</span>
                  <span className="font-bold text-fg-primary">{signalingDriverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Active Peer ID:</span>
                  <span className="text-fg-primary truncate max-w-[180px]">{activePeer?.peerId || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">ICE Conn State:</span>
                  <span
                    className={cn(
                      "font-bold transition-colors",
                      iceStateHighlight ? "text-fg-primary duration-100" : "duration-300",
                      !iceStateHighlight && (
                        activePeer?.connectionState === 'connected' ? 'text-photon' :
                        (activePeer?.connectionState === 'negotiating' || activePeer?.connectionState === 'new') ? 'text-pulse' :
                        !activePeer?.connectionState ? 'text-pulse' :
                        'text-decay'
                      )
                    )}
                  >
                    {activePeer?.connectionState?.toUpperCase() || 'IDLE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Candidate Type:</span>
                  <span className="text-fg-primary capitalize">{connectionStats?.connectionType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Local Candidate:</span>
                  <span className="text-fg-primary capitalize">{connectionStats?.localCandidateType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Remote Candidate:</span>
                  <span className="text-fg-primary capitalize">{connectionStats?.remoteCandidateType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">TURN Candidates:</span>
                  <span className={cn(connectionStats?.turnCandidatesGathered ? "text-photon font-bold" : "text-fg-muted")}>
                    {connectionStats?.turnCandidatesGathered ? 'GATHERED' : 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">TURN Relaying:</span>
                  <span className={cn(connectionStats?.turnUsed ? "text-pulse font-bold" : "text-fg-muted")}>
                    {connectionStats?.turnUsed ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Data Channel:</span>
                  <span
                    className={cn(
                      "font-bold transition-colors",
                      channelStateHighlight ? "text-fg-primary duration-100" : "duration-300",
                      !channelStateHighlight && (
                        connectionStats?.channelState === 'open' ? 'text-photon' : 'text-decay'
                      )
                    )}
                  >
                    {connectionStats?.channelState?.toUpperCase() || 'CLOSED'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-1.5 mt-1.5">
                  <span className="text-fg-muted">E2EE Status:</span>
                  <span
                    className={cn(
                      "font-bold",
                      connectionStats?.e2eeStatus === 'established' && "text-photon",
                      connectionStats?.e2eeStatus === 'pending' && "text-pulse",
                      connectionStats?.e2eeStatus === 'failed' && "text-decay"
                    )}
                  >
                    {connectionStats?.e2eeStatus?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Safety Number:</span>
                  <span className="text-fg-primary font-bold select-all tracking-wider">
                    {connectionStats?.e2eeSafetyNumber || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Key Derivation:</span>
                  <span className="text-fg-muted text-micro truncate max-w-[150px]" title="ECDH P-256 → HKDF SHA-256 → AES-GCM 256">
                    ECDH P-256 → HKDF → AES-256-GCM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">E2EE Encrypted:</span>
                  <span className="text-fg-primary">{connectionStats?.e2eeMessagesEncrypted ?? 0} msgs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">E2EE Decrypted:</span>
                  <span className="text-fg-primary">{connectionStats?.e2eeMessagesDecrypted ?? 0} msgs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">E2EE Decrypt Failures:</span>
                  <span className={cn((connectionStats?.e2eeDecryptionFailures ?? 0) > 0 ? "text-decay font-bold" : "text-fg-primary")}>
                    {connectionStats?.e2eeDecryptionFailures ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Realtime Stats */}
          <div className="border border-border rounded">
            <button
              onClick={() => toggleSection('stats')}
              className="w-full px-3 py-2 flex items-center justify-between bg-bg-surface font-semibold text-fg-primary hover:bg-bg-hover text-left"
            >
              <span className="type-uppercase-label">2. Network Metrics</span>
              <span className="flex items-center gap-0.5">
                <span className="text-fg-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-standard",
                    expandedSection === 'stats' && "rotate-90"
                  )}
                />
                <span className="text-fg-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'stats'
                  ? "max-h-[400px] opacity-100 border-border duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2.5 bg-bg-base/50">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Bytes Sent:</span>
                  <span className="text-fg-primary">
                    <AnimatedCounter
                      value={connectionStats?.bytesSent || 0}
                      duration={300}
                      format={formatBytes}
                      unit="B"
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Bytes Received:</span>
                  <span className="text-fg-primary">
                    <AnimatedCounter
                      value={connectionStats?.bytesReceived || 0}
                      duration={300}
                      format={formatBytes}
                      unit="B"
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Messages Count:</span>
                  <span className="text-fg-primary">
                    <AnimatedCounter
                      value={connectionStats?.messageCount || 0}
                      duration={300}
                      format={(val) => val.toString()}
                      unit=""
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Latency RTT:</span>
                  <span className={cn("text-fg-primary", connectionStats?.latencyMs !== null && "quark-latency-fade-in")}>
                    <AnimatedCounter
                      value={connectionStats?.latencyMs || 0}
                      duration={400}
                      format={(val) => val > 0 ? `${val} ms` : 'N/A'}
                      unit="ms"
                    />
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePingClick}
                  className={cn(
                    "w-full h-8 flex items-center justify-center gap-1.5 mt-1 transition-opacity duration-100",
                    pingOpacityFlash && "opacity-60"
                  )}
                >
                  <RefreshCw className={cn("w-3 h-3", isPingActive ? "animate-spin" : "animate-pulse")} />
                  <span>{isPingActive ? '...' : 'Query Stats / Ping'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: ICE gathering log */}
          <div className="border border-border rounded">
            <button
              onClick={() => toggleSection('ice')}
              className="w-full px-3 py-2 flex items-center justify-between bg-bg-surface font-semibold text-fg-primary hover:bg-bg-hover text-left"
            >
              <span className="type-uppercase-label">3. ICE Log</span>
              <span className="flex items-center gap-0.5">
                <span className="text-fg-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-standard",
                    expandedSection === 'ice' && "rotate-90"
                  )}
                />
                <span className="text-fg-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'ice'
                  ? "max-h-[400px] opacity-100 border-border duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2 bg-bg-base/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-micro text-fg-muted uppercase">ICE Log Stream</span>
                  <button
                    onClick={clearIceLog}
                    className="text-decay hover:underline focus:outline-none text-micro"
                  >
                    CLEAR
                  </button>
                </div>
                <div
                  ref={logContainerRef}
                  className="w-full h-40 overflow-y-auto bg-bg-base p-2 border border-border/40 rounded text-micro text-fg-primary leading-normal select-text space-y-1"
                >
                  {iceLog.length === 0 ? (
                    <span className="text-fg-muted">Waiting for events...</span>
                  ) : (
                    iceLog.map((log, index) => {
                      const delay = logAnimationDelays[index] || 0;
                      return (
                        <div
                          key={index}
                          className="quark-log-entry border-b border-border/20 pb-0.5 last:border-0 opacity-0"
                          style={{ animationDelay: `${delay}ms` }}
                        >
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: SDP Viewer */}
          <div className="border border-border rounded">
            <button
              onClick={() => toggleSection('sdp')}
              className="w-full px-3 py-2 flex items-center justify-between bg-bg-surface font-semibold text-fg-primary hover:bg-bg-hover text-left"
            >
              <span className="type-uppercase-label">4. SDP Session Descriptions</span>
              <span className="flex items-center gap-0.5">
                <span className="text-fg-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-standard",
                    expandedSection === 'sdp' && "rotate-90"
                  )}
                />
                <span className="text-fg-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'sdp'
                  ? "max-h-[400px] opacity-100 border-border duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2 bg-bg-base/50">
                <p className="text-micro text-fg-muted mb-2 leading-relaxed">
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
            </div>
          </div>

          {/* Section 5: Offline Mode */}
          <div className="border border-border rounded">
            <button
              onClick={() => toggleSection('offline')}
              className="w-full px-3 py-2 flex items-center justify-between bg-bg-surface font-semibold text-fg-primary hover:bg-bg-hover text-left"
            >
              <span className="type-uppercase-label">5. Offline Mode</span>
              <span className="flex items-center gap-0.5">
                <span className="text-fg-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-standard",
                    expandedSection === 'offline' && "rotate-90"
                  )}
                />
                <span className="text-fg-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'offline'
                  ? "max-h-[300px] opacity-100 border-border duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2 bg-bg-base/50">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Mode:</span>
                  <span className="font-bold text-fg-primary flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    {isOfflineMode() ? 'OFFLINE LAN' : 'ONLINE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Signaling URL:</span>
                  <span className="text-fg-primary font-mono text-micro truncate max-w-[200px]" title={getSignalingUrl()}>
                    {getSignalingUrl().replace(/^wss?:\/\//, '')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Window Protocol:</span>
                  <span className="text-fg-primary font-mono text-micro">
                    {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Window Host:</span>
                  <span className="text-fg-primary font-mono text-micro">
                    {typeof window !== 'undefined' ? window.location.host : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">ICE Servers:</span>
                  <span className="text-fg-primary font-bold">
                    {isOfflineMode() ? '[ empty ]' : '[ configured ]'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer banner */}
        <div className="p-3 border-t border-border/80 bg-bg-base text-micro text-fg-muted flex items-center gap-1.5 select-none">
          <ShieldAlert className="w-3.5 h-3.5 text-pulse shrink-0" />
          <span>{'//'} Local telemetry. No cloud reports.</span>
        </div>
      </aside>

      {/* SDP Viewer Modal Overlay */}
      {sdpModalType && (
        <div className="fixed inset-0 z-50 bg-bg-base/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] h-[460px] bg-bg-surface border border-border rounded-md p-6 flex flex-col relative select-text quark-sdp-modal-in">
            <button
              onClick={() => setSdpModalType(null)}
              className="absolute top-4 right-4 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="type-uppercase-label text-fg-primary mb-4 flex items-center gap-1.5 select-none">
              <FileText className="w-4 h-4 text-fg-muted" />
              <span>{sdpModalType === 'local' ? 'Local' : 'Remote'} Session SDP</span>
            </h3>

            <div className="flex-1 w-full bg-bg-base border border-border p-3 rounded font-mono text-micro text-fg-primary leading-normal overflow-auto select-all relative">
              <pre className="whitespace-pre-wrap sdp-text-container select-text">
                {(sdpModalType === 'local' ? localSdp : remoteSdp) || ''}
              </pre>
            </div>

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
