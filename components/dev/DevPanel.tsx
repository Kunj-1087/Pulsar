'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert, Terminal, RefreshCw, FileText, ChevronRight } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { formatBytes, cn } from '../../lib/utils';
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
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[360px] border-l border-border-default bg-[#111111] flex flex-col font-mono text-xs select-none text-text-primary z-40 transition-all",
          devModeEnabled
            ? "translate-x-0 opacity-100 duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
            : "translate-x-full opacity-0 pointer-events-none duration-180 ease-[cubic-bezier(0.4,0,1,1)]"
        )}
      >
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
              <span className="flex items-center gap-0.5">
                <span className="text-text-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    expandedSection === 'connection' && "rotate-90"
                  )}
                />
                <span className="text-text-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'connection'
                  ? "max-h-[400px] opacity-100 border-border-default duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2 bg-[#121212]/50">
                <div className="flex justify-between">
                  <span className="text-text-muted">Active Peer ID:</span>
                  <span className="text-text-bright truncate max-w-[180px]">{activePeer?.peerId || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">ICE Conn State:</span>
                  <span
                    className={cn(
                      "font-bold transition-colors",
                      iceStateHighlight ? "text-text-bright duration-100" : "duration-300",
                      !iceStateHighlight && {
                        "text-status-green": activePeer?.connectionState === 'connected',
                        "text-status-yellow": activePeer?.connectionState === 'negotiating' || activePeer?.connectionState === 'new',
                        "text-amber-600": !activePeer?.connectionState || activePeer?.connectionState === 'idle',
                        "text-status-red": ['failed', 'disconnected', 'closed'].includes(activePeer?.connectionState || ''),
                      }
                    )}
                  >
                    {activePeer?.connectionState?.toUpperCase() || 'IDLE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Candidate Type:</span>
                  <span className="text-text-bright capitalize">{connectionStats?.connectionType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Local Candidate:</span>
                  <span className="text-text-bright capitalize">{connectionStats?.localCandidateType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Remote Candidate:</span>
                  <span className="text-text-bright capitalize">{connectionStats?.remoteCandidateType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">TURN Candidates:</span>
                  <span className={cn(connectionStats?.turnCandidatesGathered ? "text-status-green font-bold" : "text-text-muted")}>
                    {connectionStats?.turnCandidatesGathered ? 'GATHERED' : 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">TURN Relaying:</span>
                  <span className={cn(connectionStats?.turnUsed ? "text-status-yellow font-bold" : "text-text-muted")}>
                    {connectionStats?.turnUsed ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Data Channel:</span>
                  <span
                    className={cn(
                      "font-bold transition-colors",
                      channelStateHighlight ? "text-text-bright duration-100" : "duration-300",
                      !channelStateHighlight && (
                        connectionStats?.channelState === 'open' ? 'text-status-green' : 'text-status-red'
                      )
                    )}
                  >
                    {connectionStats?.channelState?.toUpperCase() || 'CLOSED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Realtime Stats */}
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('stats')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>2. NETWORK METRICS</span>
              <span className="flex items-center gap-0.5">
                <span className="text-text-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    expandedSection === 'stats' && "rotate-90"
                  )}
                />
                <span className="text-text-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'stats'
                  ? "max-h-[400px] opacity-100 border-border-default duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2.5 bg-[#121212]/50">
                <div className="flex justify-between">
                  <span className="text-text-muted">Bytes Sent:</span>
                  <span className="text-text-bright">
                    <AnimatedCounter
                      value={connectionStats?.bytesSent || 0}
                      duration={300}
                      format={formatBytes}
                      unit="B"
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Bytes Received:</span>
                  <span className="text-text-bright">
                    <AnimatedCounter
                      value={connectionStats?.bytesReceived || 0}
                      duration={300}
                      format={formatBytes}
                      unit="B"
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Messages Count:</span>
                  <span className="text-text-bright">
                    <AnimatedCounter
                      value={connectionStats?.messageCount || 0}
                      duration={300}
                      format={(val) => val.toString()}
                      unit=""
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Latency RTT:</span>
                  <span className={cn("text-text-bright", connectionStats?.latencyMs !== null && "pulsar-latency-fade-in")}>
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
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('ice')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>3. GATHERING LOGS</span>
              <span className="flex items-center gap-0.5">
                <span className="text-text-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    expandedSection === 'ice' && "rotate-90"
                  )}
                />
                <span className="text-text-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'ice'
                  ? "max-h-[400px] opacity-100 border-border-default duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2 bg-[#121212]/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-text-muted uppercase">ICE Log Stream</span>
                  <button
                    onClick={clearIceLog}
                    className="text-status-red hover:underline focus:outline-none text-[10px]"
                  >
                    CLEAR
                  </button>
                </div>
                <div
                  ref={logContainerRef}
                  className="w-full h-40 overflow-y-auto bg-black p-2 border border-border-default/40 rounded text-[10px] text-text-primary leading-normal select-text space-y-1"
                >
                  {iceLog.length === 0 ? (
                    <span className="text-text-muted">Waiting for events...</span>
                  ) : (
                    iceLog.map((log, index) => {
                      const delay = logAnimationDelays[index] || 0;
                      return (
                        <div
                          key={index}
                          className="pulsar-log-entry border-b border-border-default/20 pb-0.5 last:border-0 opacity-0"
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
          <div className="border border-border-default rounded">
            <button
              onClick={() => toggleSection('sdp')}
              className="w-full px-3 py-2 flex items-center justify-between bg-[#171717] font-semibold text-text-bright hover:bg-bg-surface text-left"
            >
              <span>4. SDP SESSION DESCRIPTIONS</span>
              <span className="flex items-center gap-0.5">
                <span className="text-text-muted">[</span>
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    expandedSection === 'sdp' && "rotate-90"
                  )}
                />
                <span className="text-text-muted">]</span>
              </span>
            </button>
            <div
              className={cn(
                "transition-all overflow-hidden border-t",
                expandedSection === 'sdp'
                  ? "max-h-[400px] opacity-100 border-border-default duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  : "max-h-0 opacity-0 border-transparent duration-250 ease-[cubic-bezier(0.4,0,1,1)]"
              )}
            >
              <div className="p-3 space-y-2 bg-[#121212]/50">
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
            </div>
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
          <div className="w-full max-w-[500px] h-[460px] bg-bg-surface border border-border-default rounded-md p-6 flex flex-col relative select-text pulsar-sdp-modal-in">
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

            <div className="flex-1 w-full bg-black border border-border-default p-3 rounded font-mono text-[10px] text-text-primary leading-normal overflow-auto select-all relative">
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
