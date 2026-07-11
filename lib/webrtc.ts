import { DataChannelMessage, SignalingMessage, ConnectionStats } from '../types';
import { sendFile } from './fileTransfer';

export class PulsarPeer {
  peerConnection!: RTCPeerConnection;
  dataChannel: RTCDataChannel | null = null;
  myId: string;
  peerId: string;
  isInitiator: boolean;
  
  private candidateQueue: RTCIceCandidateInit[] = [];
  private onSignal: (msg: SignalingMessage) => void;
  private onMessage: (msg: DataChannelMessage) => void;
  private onStateChange: (state: RTCPeerConnectionState) => void;
  private onIceLog: (log: string) => void;
  
  private messageCount = 0;
  private bytesSentAccumulator = 0;
  private bytesReceivedAccumulator = 0;

  constructor(config: {
    peerId: string;
    myId: string;
    isInitiator: boolean;
    onSignal: (msg: SignalingMessage) => void;
    onMessage: (msg: DataChannelMessage) => void;
    onStateChange: (state: RTCPeerConnectionState) => void;
    onIceLog: (log: string) => void;
  }) {
    this.peerId = config.peerId;
    this.myId = config.myId;
    this.isInitiator = config.isInitiator;
    this.onSignal = config.onSignal;
    this.onMessage = config.onMessage;
    this.onStateChange = config.onStateChange;
    this.onIceLog = config.onIceLog;

    this.initialize();
  }

  /**
   * Initializes the RTCPeerConnection and setups handlers.
   */
  private initialize() {
    const stunServer = process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302';
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: stunServer },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    this.onIceLog(`[Init] Peer connection created for ${this.peerId}. Stun: ${stunServer}`);

    // Gather ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceLog(`[ICE] Local candidate gathered: ${event.candidate.candidate}`);
        this.onSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          fromPeer: this.myId,
          toPeer: this.peerId,
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.onIceLog(`[State] Connection state changed to: ${state}`);
      this.onStateChange(state);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      this.onIceLog(`[ICE State] ICE connection state: ${this.peerConnection.iceConnectionState}`);
    };

    // Data Channel Setup
    if (this.isInitiator) {
      this.onIceLog(`[DataChannel] Initiating data channel 'pulsar-data'`);
      this.dataChannel = this.peerConnection.createDataChannel('pulsar-data', {
        ordered: true,
      });
      this.setupDataChannelHandlers(this.dataChannel);
    } else {
      this.peerConnection.ondatachannel = (event) => {
        this.onIceLog(`[DataChannel] Received remote data channel: ${event.channel.label}`);
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers(this.dataChannel);
      };
    }
  }

  /**
   * Setup data channel open/close/message events
   */
  private setupDataChannelHandlers(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.onIceLog(`[DataChannel] Data channel is OPEN`);
      // Update connection state
      this.onStateChange('connected');
    };

    channel.onclose = () => {
      this.onIceLog(`[DataChannel] Data channel is CLOSED`);
      this.onStateChange('disconnected');
    };

    channel.onerror = (error) => {
      console.error(`[DataChannel Error]`, error);
      this.onIceLog(`[DataChannel Error] ${JSON.stringify(error)}`);
    };

    channel.onmessage = (event) => {
      try {
        const rawData = event.data;
        
        // Track stats
        this.messageCount++;
        if (typeof rawData === 'string') {
          this.bytesReceivedAccumulator += rawData.length;
          const msg = JSON.parse(rawData) as DataChannelMessage;
          this.onMessage(msg);
        } else if (rawData instanceof ArrayBuffer) {
          this.bytesReceivedAccumulator += rawData.byteLength;
          // Binary array buffers are not expected in JSON text mode but handled if they happen
        }
      } catch (err) {
        console.error('Failed to parse DataChannel message:', err);
      }
    };
  }

  /**
   * Creates SDP Offer.
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.onIceLog(`[SDP] Creating offer...`);
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.onIceLog(`[SDP] Local description set (offer)`);
    return offer;
  }

  /**
   * Handles incoming SDP Offer and returns Answer description.
   */
  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.onIceLog(`[SDP] Handling incoming offer...`);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    this.onIceLog(`[SDP] Remote description set (offer)`);
    
    // Process any candidates queued before remote description was set
    await this.processCandidateQueue();
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.onIceLog(`[SDP] Local description set (answer)`);
    return answer;
  }

  /**
   * Handles incoming SDP Answer.
   */
  async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    this.onIceLog(`[SDP] Handling incoming answer...`);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    this.onIceLog(`[SDP] Remote description set (answer)`);
    
    // Process any candidates queued before remote description was set
    await this.processCandidateQueue();
  }

  /**
   * Receives ICE candidate from signal channel and attempts to register it.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        this.onIceLog(`[ICE] Remote candidate added successfully`);
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
        this.onIceLog(`[ICE Error] Failed to add: ${JSON.stringify(e)}`);
      }
    } else {
      this.onIceLog(`[ICE Queue] Remote candidate queued (no remote description yet)`);
      this.candidateQueue.push(candidate);
    }
  }

  /**
   * Processes the backlog of gathered remote ICE candidates.
   */
  private async processCandidateQueue(): Promise<void> {
    this.onIceLog(`[ICE Queue] Flushing candidate queue of size ${this.candidateQueue.length}`);
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          this.onIceLog(`[ICE Queue] Remote candidate applied from queue`);
        } catch (e) {
          console.error('Error adding queued ICE candidate:', e);
        }
      }
    }
  }

  /**
   * Send JSON text payload over data channel
   */
  sendMessage(msg: DataChannelMessage) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('Data channel is not open, cannot send message');
      return;
    }
    const raw = JSON.stringify(msg);
    this.dataChannel.send(raw);
    this.messageCount++;
    this.bytesSentAccumulator += raw.length;
  }

  /**
   * Sends file binary buffer.
   */
  async sendFile(fileId: string, file: File, senderName: string, onProgress: (pct: number) => void): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }
    
    const initialBytesSent = this.bytesSentAccumulator;
    await sendFile(this.dataChannel, fileId, file, senderName, (progress) => {
      // Approximate bytes sent during chunk transfers
      const approxBytes = Math.round((file.size * progress) / 100);
      this.bytesSentAccumulator = initialBytesSent + approxBytes;
      onProgress(progress);
    });
  }

  /**
   * Generates active diagnostics and connections metrics.
   */
  async getStats(): Promise<ConnectionStats> {
    let bytesSent = this.bytesSentAccumulator;
    let bytesReceived = this.bytesReceivedAccumulator;
    let latencyMs: number | null = null;
    let connectionType = 'unknown';

    try {
      const statsReport = await this.peerConnection.getStats();
      statsReport.forEach((report) => {
        // Fallback for transfer metrics if native transport is exposed
        if (report.type === 'transport') {
          bytesSent = report.bytesSent || bytesSent;
          bytesReceived = report.bytesReceived || bytesReceived;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime !== undefined) {
            latencyMs = Math.round(report.currentRoundTripTime * 1000);
          }
          const remoteCandidate = statsReport.get(report.remoteCandidateId);
          if (remoteCandidate) {
            connectionType = remoteCandidate.candidateType || 'unknown';
          }
        }
      });
    } catch {
      // Fail silently
    }

    return {
      bytesSent,
      bytesReceived,
      messageCount: this.messageCount,
      latencyMs,
      connectionType,
      iceState: this.peerConnection.iceConnectionState,
      channelState: this.dataChannel ? this.dataChannel.readyState : 'closed',
    };
  }

  /**
   * Close connection.
   */
  close() {
    this.onIceLog(`[Cleanup] Closing peer connection...`);
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
    }
    try {
      this.peerConnection.close();
    } catch {}
  }
}

export class PulsarRoom {
  peers: Map<string, PulsarPeer> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private myId: string;
  private onSignal: (msg: SignalingMessage) => void;
  private onPeerMessage: (peerId: string, msg: DataChannelMessage) => void;
  private onPeerStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  private onIceLog: (entry: string) => void;

  constructor(config: {
    myId: string;
    onSignal: (msg: SignalingMessage) => void;
    onPeerMessage: (peerId: string, msg: DataChannelMessage) => void;
    onPeerStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
    onIceLog: (entry: string) => void;
  }) {
    this.myId = config.myId;
    this.onSignal = config.onSignal;
    this.onPeerMessage = config.onPeerMessage;
    this.onPeerStateChange = config.onPeerStateChange;
    this.onIceLog = config.onIceLog;
  }

  /**
   * Connects a new peer, starting initiator offers if requested.
   */
  async addPeer(peerId: string, isInitiator: boolean): Promise<PulsarPeer> {
    if (this.peers.has(peerId)) {
      this.peers.get(peerId)!.close();
    }

    const peer = new PulsarPeer({
      peerId,
      myId: this.myId,
      isInitiator,
      onSignal: this.onSignal,
      onMessage: (msg) => this.onPeerMessage(peerId, msg),
      onStateChange: (state) => this.onPeerStateChange(peerId, state),
      onIceLog: (log) => this.onIceLog(`[Peer:${peerId}] ${log}`),
    });

    this.peers.set(peerId, peer);

    // Flush any pending candidates queued for this peer
    const pending = this.pendingCandidates.get(peerId);
    if (pending && pending.length > 0) {
      this.onIceLog(`[ICE Queue] Flushing ${pending.length} pending candidates for peer ${peerId}`);
      for (const candidate of pending) {
        await peer.addIceCandidate(candidate);
      }
      this.pendingCandidates.delete(peerId);
    }

    if (isInitiator) {
      try {
        const offer = await peer.createOffer();
        this.onSignal({
          type: 'offer',
          sdp: offer,
          fromPeer: this.myId,
          toPeer: peerId,
        });
      } catch (err) {
        console.error(`Failed to create offer for peer ${peerId}:`, err);
      }
    }

    return peer;
  }

  /**
   * Adds an ICE candidate to the peer. Queues it if the peer is not initialized yet.
   */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(peerId);
    if (peer) {
      await peer.addIceCandidate(candidate);
    } else {
      this.onIceLog(`[ICE Queue] Peer ${peerId} not initialized yet. Queuing candidate.`);
      if (!this.pendingCandidates.has(peerId)) {
        this.pendingCandidates.set(peerId, []);
      }
      this.pendingCandidates.get(peerId)!.push(candidate);
    }
  }

  /**
   * Removes peer from room topology.
   */
  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  /**
   * Broadcasts message to all connected data channels.
   */
  broadcast(msg: DataChannelMessage) {
    this.peers.forEach((peer) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.sendMessage(msg);
      }
    });
  }

  /**
   * Clean up all connections.
   */
  close() {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.pendingCandidates.clear();
  }
}
