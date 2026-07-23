import { DataChannelMessage, SignalingMessage, ConnectionStats, PeerConnectionState, PROTOCOL_VERSION, Channel } from '../types';
import {
  sendFile,
  encodeBinaryFrame,
  encodeEncryptedControlFrame,
  decodeEncryptedControlFrame,
  decodeEncryptedFileFrame,
  calculateFileHash
} from './fileTransfer';
import { useChatStore } from '../store/chatStore';
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveAESGCMKey,
  encryptMessage,
  decryptMessage,
  decryptChunk,
  deriveSafetyNumber
} from './crypto';

let activeRoomInstance: QuarkRoom | null = null;

export function broadcastChannelCreate(channel: Channel) {
  if (activeRoomInstance) {
    activeRoomInstance.broadcast({
      type: 'channel-create',
      channel,
    });
  }
}

export function broadcastChannelDelete(channelId: string) {
  if (activeRoomInstance) {
    activeRoomInstance.broadcast({
      type: 'channel-delete',
      channelId,
    });
  }
}

export function broadcastTyping(channelId: string): void {
  if (activeRoomInstance) {
    let handle = 'Peer';
    try {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.handle) handle = parsed.handle;
      }
    } catch {}
    activeRoomInstance.broadcast({
      type: 'peer-typing',
      peerId: activeRoomInstance.myId,
      handle,
      channelId,
      ts: Date.now(),
    });
  }
}

export function broadcastLeave(): void {
  if (activeRoomInstance) {
    let handle = 'Peer';
    try {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.handle) handle = parsed.handle;
      }
    } catch {}
    activeRoomInstance.broadcast({
      type: 'peer-leave',
      peerId: activeRoomInstance.myId,
      handle,
    });
    activeRoomInstance.close();
    useChatStore.getState().reset();
  }
}

export class QuarkPeer {
  peerConnection!: RTCPeerConnection;
  dataChannel: RTCDataChannel | null = null;
  myId: string;
  peerId: string;
  isInitiator: boolean;
  
  private candidateQueue: RTCIceCandidateInit[] = [];
  
  public onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  public onMessage?: (msg: DataChannelMessage) => void;
  public onBinaryMessage?: (arrayBuffer: ArrayBuffer) => void;
  public onConnectionStateChange?: (state: PeerConnectionState) => void;
  public onDataChannelOpen?: () => void;
  public onIceLog: (log: string) => void;
  public onIceRestartRequired?: () => void;
  
  private messageCount = 0;
  private bytesSentAccumulator = 0;
  private bytesReceivedAccumulator = 0;
  
  private hasAttemptedIceRestart = false;
  private iceRestartTimer: NodeJS.Timeout | null = null;

  private resumeResolve: (() => void) | null = null;
  private resumeReject: ((err: Error) => void) | null = null;

  private ecdhKeyPair: CryptoKeyPair | null = null;
  private remotePublicKeyJwk: JsonWebKey | null = null;
  private aesKey: CryptoKey | null = null;
  public e2eeStatus: 'pending' | 'established' | 'failed' = 'pending';
  public e2eeSafetyNumber: string = '';
  private pendingOutgoingMessages: DataChannelMessage[] = [];
  public e2eeDecryptionFailures = 0;
  public e2eeMessagesEncrypted = 0;
  public e2eeMessagesDecrypted = 0;

  private sendSeq = 0;
  private lastRecvSeq = -1;
  public remoteProtocolVersion = 0;

  public activeResumes = new Map<string, number[]>();

  constructor(config: {
    peerId: string;
    myId: string;
    isInitiator: boolean;
    onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
    onMessage?: (msg: DataChannelMessage) => void;
    onConnectionStateChange?: (state: PeerConnectionState) => void;
    onDataChannelOpen?: () => void;
    onIceLog: (log: string) => void;
  }) {
    this.peerId = config.peerId;
    this.myId = config.myId;
    this.isInitiator = config.isInitiator;
    this.onIceCandidate = config.onIceCandidate;
    this.onMessage = config.onMessage;
    this.onConnectionStateChange = config.onConnectionStateChange;
    this.onDataChannelOpen = config.onDataChannelOpen;
    this.onIceLog = config.onIceLog;

    this.initialize();
  }

  /**
   * Initializes the RTCPeerConnection and setups handlers.
   */
  private initialize() {
    console.log(`[Quark WebRTC] Creating RTCPeerConnection for peer: ${this.peerId}`);
    
    const isOffline = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_OFFLINE_MODE === 'true';
    
    // Dynamic ICE servers compilation
    const iceServers: RTCIceServer[] = [];
    
    // In offline LAN mode, skip STUN and TURN entirely
    if (isOffline) {
      console.log(`[Quark WebRTC] Offline LAN mode enabled. Skipping STUN/TURN configuration for peer: ${this.peerId}`);
      this.onIceLog(`[Init] Offline mode: skipping STUN/TURN configuration`);
    } else {
      // 1. Add STUN
      const stunServerEnv = process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302';
      stunServerEnv.split(',').forEach((url) => {
        if (url.trim()) {
          iceServers.push({ urls: url.trim() });
        }
      });

      // 2. Add TURN
      const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
      const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
      const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

      if (turnUrl && turnUsername && turnCredential) {
        turnUrl.split(',').forEach((url) => {
          if (url.trim()) {
            iceServers.push({
              urls: url.trim(),
              username: turnUsername,
              credential: turnCredential,
            });
          }
        });
        console.log(`[Quark WebRTC] TURN relay configured successfully for peer: ${this.peerId}`);
      } else if (turnUrl || turnUsername || turnCredential) {
        console.warn(`[Quark WebRTC] Incomplete TURN configuration for peer ${this.peerId}. URL, username, and credentials must all be present.`);
      }
    }

    const config: RTCConfiguration = {
      iceServers,
      iceCandidatePoolSize: 2, // Pre-gather candidates to minimize signaling latency
    };

    if (process.env.NEXT_PUBLIC_FORCE_RELAY === 'true') {
      console.log(`[Quark WebRTC] Forcing "relay" transport policy for peer ${this.peerId}`);
      config.iceTransportPolicy = 'relay';
    }

    this.peerConnection = new RTCPeerConnection(config);
    this.onIceLog(`[Init] Peer connection created for ${this.peerId}.`);

    // Gather ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candStr = event.candidate.candidate;
        let type = 'unknown';
        const match = candStr.match(/typ\s+(\w+)/);
        if (match) {
          type = match[1];
        }
        console.log(`[Quark WebRTC] Gathered local ICE candidate (${type}) for peer ${this.peerId}:`, candStr);
        this.onIceLog(`[ICE] Local candidate gathered: type=${type}`);
        this.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log(`[Quark WebRTC] Connection state changed for peer ${this.peerId} to: ${state}`);
      this.onIceLog(`[State] Connection state changed to: ${state}`);
      
      let mappedState: PeerConnectionState = 'new';
      if (state === 'new') mappedState = 'new';
      else if (state === 'connecting') mappedState = 'negotiating';
      else if (state === 'connected') mappedState = 'connected';
      else if (state === 'disconnected') mappedState = 'disconnected';
      else if (state === 'failed') mappedState = 'failed';
      else if (state === 'closed') mappedState = 'closed';

      this.onConnectionStateChange?.(mappedState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState;
      this.onIceLog(`[ICE State] ICE connection state: ${iceState}`);
      
      if (iceState === 'disconnected') {
        useChatStore.getState().startPeerGraceTimer(this.peerId);
      } else if (iceState === 'connected' || iceState === 'completed') {
        useChatStore.getState().cancelPeerGraceTimer(this.peerId);
      } else if (iceState === 'failed') {
        useChatStore.getState().cancelPeerGraceTimer(this.peerId);
        this.handleIceFailure();
      }
    };

    // Data Channel Setup
    if (this.isInitiator) {
      console.log(`[Quark WebRTC] Initiating data channel 'quark-data' for peer ${this.peerId}`);
      this.onIceLog(`[DataChannel] Initiating data channel 'quark-data'`);
      this.dataChannel = this.peerConnection.createDataChannel('quark-data', {
        ordered: true,
      });
      this.setupDataChannelHandlers(this.dataChannel);
    } else {
      this.peerConnection.ondatachannel = (event) => {
        console.log(`[Quark WebRTC] Received remote data channel '${event.channel.label}' from peer ${this.peerId}`);
        this.onIceLog(`[DataChannel] Received remote data channel: ${event.channel.label}`);
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers(this.dataChannel);
      };
    }
  }

  private async handleIceFailure() {
    if (this.hasAttemptedIceRestart) {
      this.onIceLog('[ICE Restart] Already attempted ICE restart. Declaring connection failed.');
      this.onConnectionStateChange?.('failed');
      return;
    }
    
    this.hasAttemptedIceRestart = true;
    
    if (this.isInitiator) {
      this.onIceLog('[ICE Restart] ICE connection failed. Initiating ICE restart offer...');
      this.onIceRestartRequired?.();
    } else {
      this.onIceLog('[ICE Restart] ICE connection failed. Waiting for initiator to restart ICE...');
      this.iceRestartTimer = setTimeout(() => {
        if (this.peerConnection.iceConnectionState === 'failed') {
          this.onIceLog('[ICE Restart] Initiator failed to restart ICE within 10s. Declaring failed.');
          this.onConnectionStateChange?.('failed');
        }
      }, 10000);
    }
  }

  /**
   * Setup data channel open/close/message events
   */
  private setupDataChannelHandlers(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer'; // Set binaryType for binary chunk frame reception
    channel.bufferedAmountLowThreshold = 65536; // 64KB backpressure trigger threshold

    channel.onopen = async () => {
      console.log(`[Quark WebRTC] DataChannel '${channel.label}' is OPEN for peer ${this.peerId}`);
      this.onIceLog(`[DataChannel] Data channel is OPEN`);
      this.onConnectionStateChange?.('connected');
      
      try {
        this.e2eeStatus = 'pending';
        useChatStore.getState().updatePeer(this.peerId, {
          e2eeStatus: 'pending'
        });
        
        // Generate ECDH key pair
        this.ecdhKeyPair = await generateECDHKeyPair();
        const jwk = await exportPublicKey(this.ecdhKeyPair.publicKey);
        
        // Send our public key JWK in plaintext
        this.sendPlaintextMessage({
          type: 'key-exchange',
          publicKey: jwk
        });
        this.onIceLog(`[E2EE] Local public key sent via key-exchange message`);
      } catch (err) {
        console.error('[Quark E2EE] Failed to generate/export local keys:', err);
        this.e2eeStatus = 'failed';
        useChatStore.getState().updatePeer(this.peerId, {
          e2eeStatus: 'failed'
        });
      }
    };

    channel.onclose = () => {
      console.log(`[Quark WebRTC] DataChannel '${channel.label}' is CLOSED for peer ${this.peerId}`);
      this.onIceLog(`[DataChannel] Data channel is CLOSED`);
      if (this.resumeReject) {
        this.resumeReject(new Error('Data channel closed'));
        this.resumeResolve = null;
        this.resumeReject = null;
      }
      this.onConnectionStateChange?.('disconnected');
    };

    channel.onerror = (error) => {
      console.error(`[Quark WebRTC] DataChannel '${channel.label}' Error for peer ${this.peerId}:`, error);
      this.onIceLog(`[DataChannel Error] ${JSON.stringify(error)}`);
      if (this.resumeReject) {
        this.resumeReject(new Error('Data channel error'));
        this.resumeResolve = null;
        this.resumeReject = null;
      }
    };

    channel.onbufferedamountlow = () => {
      if (this.resumeResolve) {
        this.onIceLog(`[Backpressure] Buffered amount low, resolving pause promise`);
        this.resumeResolve();
        this.resumeResolve = null;
        this.resumeReject = null;
      }
    };

    channel.onmessage = async (event) => {
      try {
        const rawData = event.data;
        
        // Track stats
        this.messageCount++;
        if (typeof rawData === 'string') {
          this.bytesReceivedAccumulator += rawData.length;
          const msg = JSON.parse(rawData) as DataChannelMessage;
          
          if (msg.type === 'key-exchange') {
            this.onIceLog(`[E2EE] Received remote public key via key-exchange`);
            await this.completeKeyAgreement(msg.publicKey);
            return;
          }
          
          if (this.e2eeStatus === 'established') {
            console.warn(`[Quark E2EE] Dropping unencrypted plaintext control string received after key agreement: ${msg.type}`);
            return;
          }
          
          console.warn(`[Quark E2EE] Dropping application message received before key agreement: ${msg.type}`);
        } else if (rawData instanceof ArrayBuffer) {
          this.bytesReceivedAccumulator += rawData.byteLength;
          if (rawData.byteLength < 3) {
            console.warn('[Quark E2EE] Received oversized or malformed binary packet');
            return;
          }
          const view = new DataView(rawData);
          const magic = view.getUint8(0);
          const version = view.getUint8(1);
          const frameType = view.getUint8(2);
          
          if (magic !== 0x51 || version !== 0x01) {
            console.warn('[Quark E2EE] Invalid binary magic/version');
            return;
          }
          
          if (frameType === 0x01) {
            // Encrypted control frame
            if (!this.aesKey) {
              console.warn('[Quark E2EE] Received encrypted control frame before key agreement complete');
              return;
            }
            try {
              const { iv, ciphertext } = decodeEncryptedControlFrame(rawData);
              const plaintextStr = await decryptMessage(this.aesKey, iv, ciphertext);
              this.e2eeMessagesDecrypted++;
              const msg = JSON.parse(plaintextStr) as DataChannelMessage;
              if (msg.type === 'file-resume') {
                this.activeResumes.set(msg.id, msg.receivedChunks);
                return;
              }
              if (this.trackReceivedMessage(msg)) {
                this.onMessage?.(msg);
              }
            } catch (err) {
              console.error('[Quark E2EE] Failed to decrypt control frame:', err);
              this.e2eeDecryptionFailures++;
            }
          } else if (frameType === 0x02) {
            // Encrypted file chunk frame
            if (!this.aesKey) {
              console.warn('[Quark E2EE] Received encrypted file chunk before key agreement complete');
              return;
            }
            try {
              const { transferId, chunkIndex, iv, ciphertext } = decodeEncryptedFileFrame(rawData);
              const decryptedPayload = await decryptChunk(this.aesKey, iv, ciphertext);
              this.e2eeMessagesDecrypted++;
              
              // Re-assemble back to Type 0x00 binary frame for ChatWindow receiver
              const reassembled = encodeBinaryFrame(transferId, chunkIndex, decryptedPayload);
              this.onBinaryMessage?.(reassembled);
            } catch (err) {
              console.error('[Quark E2EE] Failed to decrypt file chunk frame:', err);
              this.e2eeDecryptionFailures++;
              
              // Abort/Cancel this transfer
              try {
                const { transferId } = decodeEncryptedFileFrame(rawData);
                window.dispatchEvent(new CustomEvent('quark-cancel-transfer', {
                  detail: { fileId: transferId }
                }));
              } catch {}
            }
          } else {
            console.warn(`[Quark E2EE] Unsupported frame type: ${frameType}`);
          }
        }
      } catch (err) {
        console.error('Failed to parse/decrypt DataChannel message:', err);
      }
    };
  }

  private async completeKeyAgreement(remoteJwk: JsonWebKey) {
    try {
      if (!this.ecdhKeyPair) {
        throw new Error('Local key pair not generated yet');
      }
      this.remotePublicKeyJwk = remoteJwk;
      
      const remotePublicKey = await importPublicKey(remoteJwk);
      const storeState = useChatStore.getState();
      const roomId = storeState.room?.roomId || '';
      const roomPassword = storeState.room?.roomPassword;

      this.aesKey = await deriveAESGCMKey(
        this.ecdhKeyPair.privateKey,
        remotePublicKey,
        this.myId,
        this.peerId,
        roomId,
        roomPassword
      );

      // Derive Safety Number
      const localJwk = await exportPublicKey(this.ecdhKeyPair.publicKey);
      this.e2eeSafetyNumber = await deriveSafetyNumber(localJwk, remoteJwk);
      
      this.e2eeStatus = 'established';
      this.onIceLog(`[E2EE] Key agreement established. Safety number: ${this.e2eeSafetyNumber}`);
      
      // Update UI peer details in store
      useChatStore.getState().updatePeer(this.peerId, {
        e2eeStatus: 'established',
        e2eeSafetyNumber: this.e2eeSafetyNumber
      });

      // Dispatch queued pending messages
      const msgs = [...this.pendingOutgoingMessages];
      this.pendingOutgoingMessages = [];
      for (const m of msgs) {
        await this.sendMessageEncrypted(m);
      }

      this.onDataChannelOpen?.(); // Notify that channel is open and encrypted!
    } catch (err) {
      console.error('[Quark E2EE] Key agreement derivation failure:', err);
      this.e2eeStatus = 'failed';
      useChatStore.getState().updatePeer(this.peerId, {
        e2eeStatus: 'failed'
      });
    }
  }

  private sendPlaintextMessage(msg: DataChannelMessage) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('Data channel is not open, cannot send plaintext message');
      return;
    }
    const seq = this.sendSeq++;
    const enriched = { ...msg, protocolVersion: PROTOCOL_VERSION, seq } as DataChannelMessage;
    const raw = JSON.stringify(enriched);
    this.dataChannel.send(raw);
    this.messageCount++;
    this.bytesSentAccumulator += raw.length;
  }

  private async sendMessageEncrypted(msg: DataChannelMessage) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open' || !this.aesKey) {
      return;
    }
    try {
      const seq = this.sendSeq++;
      const enriched = { ...msg, protocolVersion: PROTOCOL_VERSION, seq } as DataChannelMessage;
      const rawPlaintext = JSON.stringify(enriched);
      const { iv, ciphertext } = await encryptMessage(this.aesKey, rawPlaintext);
      const frame = encodeEncryptedControlFrame(iv, ciphertext);
      
      this.dataChannel.send(frame);
      this.messageCount++;
      this.e2eeMessagesEncrypted++;
      this.bytesSentAccumulator += frame.byteLength;
    } catch (err) {
      console.error('[Quark E2EE] Error encrypting control message:', err);
      throw err;
    }
  }

  /**
   * Creates SDP Offer.
   */
  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    this.onIceLog(`[SDP] Creating offer${options?.iceRestart ? ' (ICE Restart)' : ''}...`);
    const offer = await this.peerConnection.createOffer(options);
    await this.peerConnection.setLocalDescription(offer);
    this.onIceLog(`[SDP] Local description set (offer)`);
    return offer;
  }

  /**
   * Handles incoming SDP Offer and returns Answer description.
   */
  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    console.log(`[Quark WebRTC] Handling incoming offer from peer ${this.peerId}. State: ${this.peerConnection.signalingState}`);
    this.onIceLog(`[SDP] Handling incoming offer...`);
    if (this.iceRestartTimer) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
    if (this.peerConnection.signalingState !== 'stable' && this.peerConnection.signalingState !== 'have-local-offer') {
      console.warn(`[Quark WebRTC] Ignoring offer because signaling state is: ${this.peerConnection.signalingState}`);
      return this.peerConnection.localDescription || { type: 'answer', sdp: '' };
    }
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
    console.log(`[Quark WebRTC] Handling incoming answer from peer ${this.peerId}. State: ${this.peerConnection.signalingState}`);
    this.onIceLog(`[SDP] Handling incoming answer...`);
    if (this.peerConnection.signalingState !== 'have-local-offer') {
      console.warn(`[Quark WebRTC] Ignoring answer because signaling state is not 'have-local-offer'. State: ${this.peerConnection.signalingState}`);
      this.onIceLog(`[SDP Warning] Answer ignored (state: ${this.peerConnection.signalingState})`);
      return;
    }
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

  private trackReceivedMessage(msg: DataChannelMessage): boolean {
    if (msg.seq !== undefined) {
      if (msg.seq <= this.lastRecvSeq) {
        console.warn(`[Quark E2EE] Replay attack detected: seq ${msg.seq} <= last ${this.lastRecvSeq} from ${this.peerId}`);
        this.onIceLog(`[Replay] Dropping replayed message seq=${msg.seq}`);
        return false;
      }
      this.lastRecvSeq = msg.seq;
    }

    if (msg.protocolVersion !== undefined) {
      this.remoteProtocolVersion = msg.protocolVersion;
      if (msg.protocolVersion !== PROTOCOL_VERSION) {
        console.warn(`[Quark E2EE] Protocol version mismatch: remote=${msg.protocolVersion}, local=${PROTOCOL_VERSION} from ${this.peerId}`);
        this.onIceLog(`[Downgrade] Remote version ${msg.protocolVersion}, local ${PROTOCOL_VERSION}`);
      }
    }

    return true;
  }

  /**
   * Send JSON text payload over data channel
   */
  sendMessage(msg: DataChannelMessage) {
    if (msg.type === 'key-exchange') {
      this.sendPlaintextMessage(msg);
      return;
    }

    if (this.e2eeStatus === 'established' && this.aesKey) {
      this.sendMessageEncrypted(msg).catch((err) => {
        console.error('[Quark E2EE] Encryption failed for outbound message:', err);
      });
    } else {
      if (msg.type !== 'typing') {
        this.onIceLog(`[E2EE Queue] Deferring outgoing message: E2EE not ready yet`);
        this.pendingOutgoingMessages.push(msg);
      }
    }
  }

  /**
   * Sends file binary buffer.
   */
  async sendFile(
    fileId: string,
    file: File,
    senderName: string,
    onProgress: (pct: number) => void,
    isCancelled: () => boolean,
    channelId?: string
  ): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    const checkBackpressure = () => {
      // Pause if output buffer exceeds 256KB High Watermark
      if (this.dataChannel && this.dataChannel.bufferedAmount > 262144) {
        return new Promise<void>((resolve, reject) => {
          this.resumeResolve = resolve;
          this.resumeReject = reject;
        });
      }
      return Promise.resolve();
    };

    // Calculate file hash for resumed transfer validation
    const fileHash = await calculateFileHash(file);

    // Wait up to 1000ms for a file-resume payload if receiver has chunks
    let skippedChunks: number[] = [];
    this.activeResumes.delete(fileId);
    
    for (let i = 0; i < 20; i++) {
      if (this.activeResumes.has(fileId)) {
        skippedChunks = this.activeResumes.get(fileId) || [];
        console.log(`[Quark Peer] Resuming file transfer! Found ${skippedChunks.length} existing chunks to skip.`);
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    
    const initialBytesSent = this.bytesSentAccumulator;
    await sendFile(
      this.dataChannel,
      fileId,
      file,
      senderName,
      (progress) => {
        const approxBytes = Math.round((file.size * progress) / 100);
        this.bytesSentAccumulator = initialBytesSent + approxBytes;
        onProgress(progress);
      },
      isCancelled,
      checkBackpressure,
      this.aesKey || undefined,
      skippedChunks,
      fileHash,
      channelId
    );
  }

  /**
   * Generates active diagnostics and connections metrics.
   */
  async getStats(): Promise<ConnectionStats> {
    let bytesSent = this.bytesSentAccumulator;
    let bytesReceived = this.bytesReceivedAccumulator;
    let latencyMs: number | null = null;
    let connectionType = 'unknown';
    let localCandidateType = 'unknown';
    let remoteCandidateType = 'unknown';
    let turnUsed = false;
    let turnCandidatesGathered = false;

    try {
      const statsReport = await this.peerConnection.getStats();
      statsReport.forEach((report) => {
        // Fallback for transfer metrics if native transport is exposed
        if (report.type === 'transport') {
          bytesSent = report.bytesSent || bytesSent;
          bytesReceived = report.bytesReceived || bytesReceived;
        }
        if (report.type === 'local-candidate') {
          if (report.candidateType === 'relay') {
            turnCandidatesGathered = true;
          }
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime !== undefined) {
            latencyMs = Math.round(report.currentRoundTripTime * 1000);
          }
          const localCand = statsReport.get(report.localCandidateId);
          const remoteCand = statsReport.get(report.remoteCandidateId);
          
          if (localCand) {
            localCandidateType = localCand.candidateType || 'unknown';
            if (localCand.candidateType === 'relay') {
              turnUsed = true;
            }
          }
          if (remoteCand) {
            remoteCandidateType = remoteCand.candidateType || 'unknown';
            connectionType = remoteCand.candidateType || 'unknown';
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
      localCandidateType,
      remoteCandidateType,
      turnUsed,
      turnCandidatesGathered,
      e2eeStatus: this.e2eeStatus,
      e2eeSafetyNumber: this.e2eeSafetyNumber,
      e2eeMessagesEncrypted: this.e2eeMessagesEncrypted,
      e2eeMessagesDecrypted: this.e2eeMessagesDecrypted,
      e2eeDecryptionFailures: this.e2eeDecryptionFailures,
      protocolVersion: PROTOCOL_VERSION,
      remoteProtocolVersion: this.remoteProtocolVersion,
    };
  }

  /**
   * Close connection.
   */
  close() {
    this.onIceLog(`[Cleanup] Closing peer connection...`);
    if (this.iceRestartTimer) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
    if (this.resumeReject) {
      this.resumeReject(new Error('Peer connection closed'));
      this.resumeResolve = null;
      this.resumeReject = null;
    }
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
    }
    try {
      this.peerConnection.close();
    } catch {}

    this.aesKey = null;
    this.ecdhKeyPair = null;
  }
}

// PROTOCOL CONSTANT — Changing the DataChannel label ('quark-data') breaks compatibility
// with clients using the old protocol. Coordinate updates across all deployed clients.

export class QuarkRoom {
  peers: Map<string, QuarkPeer> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  public myId: string;
  private onSignal: (msg: SignalingMessage) => void;
  private onPeerMessage: (peerId: string, msg: DataChannelMessage) => void;
  private onPeerBinaryMessage: (peerId: string, msg: ArrayBuffer) => void;
  private onPeerStateChange: (peerId: string, state: PeerConnectionState) => void;
  private onIceLog: (entry: string) => void;

  constructor(config: {
    myId: string;
    onSignal: (msg: SignalingMessage) => void;
    onPeerMessage: (peerId: string, msg: DataChannelMessage) => void;
    onPeerBinaryMessage: (peerId: string, msg: ArrayBuffer) => void;
    onPeerStateChange: (peerId: string, state: PeerConnectionState) => void;
    onIceLog: (entry: string) => void;
  }) {
    this.myId = config.myId;
    this.onSignal = config.onSignal;
    this.onPeerMessage = config.onPeerMessage;
    this.onPeerBinaryMessage = config.onPeerBinaryMessage;
    this.onPeerStateChange = config.onPeerStateChange;
    this.onIceLog = config.onIceLog;
    activeRoomInstance = this;
  }

  /**
   * Connects a new peer, starting initiator offers if requested.
   */
  async addPeer(peerId: string, isInitiator: boolean): Promise<QuarkPeer> {
    if (this.peers.has(peerId)) {
      this.peers.get(peerId)!.close();
    }

    const peer = new QuarkPeer({
      peerId,
      myId: this.myId,
      isInitiator,
      onIceCandidate: (candidate) => {
        this.onSignal({
          type: 'ice-candidate',
          candidate,
          fromPeer: this.myId,
          toPeer: peerId,
        });
      },
      onMessage: (msg) => this.onPeerMessage(peerId, msg),
      onConnectionStateChange: (state) => this.onPeerStateChange(peerId, state),
      onIceLog: (log) => this.onIceLog(`[Peer:${peerId}] ${log}`),
    });

    peer.onBinaryMessage = (arrayBuffer) => this.onPeerBinaryMessage(peerId, arrayBuffer);

    peer.onIceRestartRequired = async () => {
      const roomStatus = useChatStore.getState().roomStatus;
      if (roomStatus === 'reconnecting' || roomStatus === 'failed') {
        this.onIceLog(`[Peer:${peerId}] [ICE Restart] Signaling not stable (status: ${roomStatus}). Deferring ICE restart.`);
        return;
      }

      try {
        this.onIceLog(`[Peer:${peerId}] [ICE Restart] Initiating ICE restart offer`);
        const offer = await peer.createOffer({ iceRestart: true });
        this.onSignal({
          type: 'offer',
          sdp: offer,
          fromPeer: this.myId,
          toPeer: peerId,
        });
      } catch (err) {
        console.error(`[ICE Restart] Failed to create restart offer for peer ${peerId}:`, err);
      }
    };

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
   * Sends a message to a specific peer's DataChannel.
   */
  sendToPeer(peerId: string, msg: DataChannelMessage) {
    const peer = this.peers.get(peerId);
    if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.sendMessage(msg);
    }
  }

  /**
   * Returns the number of peers currently in the Map.
   */
  getPeerCount(): number {
    return this.peers.size;
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

export function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', checkState);
  });
}

export async function createManualOffer(): Promise<string> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const dataChannel = pc.createDataChannel('quark-data');

  dataChannel.onopen = () => {
    console.log('[ManualP2P] DataChannel opened (Offer side)');
  };
  dataChannel.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent('quark-peer-message', { detail: { peerId: 'manual-peer', msg } }));
    } catch (e) {
      console.error('[ManualP2P] Error handling manual message:', e);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await waitForIceGatheringComplete(pc);

  const payload = { sdp: pc.localDescription, type: 'offer' };
  return btoa(JSON.stringify(payload));
}

export async function acceptManualOffer(encodedOffer: string): Promise<string> {
  const { sdp } = JSON.parse(atob(encodedOffer));
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  pc.ondatachannel = (event) => {
    const dc = event.channel;
    dc.onopen = () => {
      console.log('[ManualP2P] DataChannel opened (Answer side)');
    };
    dc.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        window.dispatchEvent(new CustomEvent('quark-peer-message', { detail: { peerId: 'manual-peer', msg } }));
      } catch (e) {
        console.error('[ManualP2P] Error handling manual message:', e);
      }
    };
  };

  await pc.setRemoteDescription(sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await waitForIceGatheringComplete(pc);

  const payload = { sdp: pc.localDescription, type: 'answer' };
  return btoa(JSON.stringify(payload));
}

export async function completeManualConnection(pc: RTCPeerConnection, encodedAnswer: string): Promise<void> {
  const { sdp } = JSON.parse(atob(encodedAnswer));
  await pc.setRemoteDescription(sdp);
}
