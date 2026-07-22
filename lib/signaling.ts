import { SignalingMessage } from '../types';
import { getSignalingUrl } from './utils';

type MessageHandler = (msg: SignalingMessage) => void;
type StateChangeHandler = (state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

export class QuarkSignaling {
  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private stateChangeHandler: StateChangeHandler | null = null;
  private url: string;
  private peerId: string;
  private roomId: string | null = null;

  private status: 'connected' | 'disconnected' | 'reconnecting' | 'failed' = 'disconnected';
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private generation = 0;

  constructor(peerId: string) {
    this.peerId = peerId;
    // Use getSignalingUrl() which auto-derives the URL from window.location when needed.
    // Falls back to NEXT_PUBLIC_SIGNALING_WS_URL in online mode.
    // In offline mode or when window is available, it derives ws:// or wss:// + hostname automatically.
    try {
      this.url = getSignalingUrl() || 'ws://localhost:8080';
    } catch {
      // Fallback if getSignalingUrl() throws (should not happen in practice)
      this.url = process.env.NEXT_PUBLIC_SIGNALING_WS_URL || 'ws://localhost:8080';
    }
  }

  private setStatus(state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') {
    this.status = state;
    this.stateChangeHandler?.(state);
  }

  getStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'failed' {
    return this.status;
  }

  connect(): Promise<void> {
    this.intentionalClose = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const currentGen = ++this.generation;

    return new Promise((resolve, reject) => {
      console.log(`[Quark Signaling] Connecting to signaling server. Gen: ${currentGen}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (currentGen !== this.generation) {
          this.ws?.close();
          return;
        }
        console.log('[Quark Signaling] Connected to signaling server');
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (currentGen !== this.generation) return;
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          console.log('[Quark Signaling] Received:', msg.type, msg);
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Quark Signaling] Parse error:', err);
        }
      };

      this.ws.onerror = (err) => {
        if (currentGen !== this.generation) return;
        console.error('[Quark Signaling] WebSocket error:', err);
        this.setStatus('failed');
        reject(err);
      };

      this.ws.onclose = () => {
        if (currentGen !== this.generation) return;
        console.log('[Quark Signaling] Disconnected from signaling server');
        this.setStatus('disconnected');
        if (!this.intentionalClose) {
          this.handleReconnect();
        }
      };
    });
  }

  private handleReconnect() {
    if (this.intentionalClose) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(1.5, this.reconnectAttempts), maxDelay);
    const jitter = Math.random() * 500;
    const finalDelay = delay + jitter;

    this.reconnectAttempts++;
    console.log(`[Quark Signaling] Reconnecting in ${Math.round(finalDelay)}ms (attempt ${this.reconnectAttempts})`);
    
    this.setStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      if (this.intentionalClose) return;
      const currentGen = ++this.generation;
      console.log(`[Quark Signaling] Reconnect attempt start. Gen: ${currentGen}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (currentGen !== this.generation) {
          this.ws?.close();
          return;
        }
        console.log('[Quark Signaling] Reconnected to signaling server');
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        if (this.roomId) {
          this.joinRoom(this.roomId);
        }
      };

      this.ws.onmessage = (event) => {
        if (currentGen !== this.generation) return;
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          console.log('[Quark Signaling] Received (reconnect):', msg.type, msg);
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Quark Signaling] Parse error (reconnect):', err);
        }
      };

      this.ws.onerror = (err) => {
        if (currentGen !== this.generation) return;
        console.error('[Quark Signaling] WebSocket error (reconnect):', err);
      };

      this.ws.onclose = () => {
        if (currentGen !== this.generation) return;
        console.log('[Quark Signaling] Reconnect socket closed unexpectedly');
        this.setStatus('disconnected');
        this.handleReconnect();
      };
    }, finalDelay);
  }

  joinRoom(roomId: string): void {
    this.roomId = roomId;
    this.send({ type: 'join-room', roomId, peerId: this.peerId });
  }

  send(msg: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const str = JSON.stringify(msg);
      console.log('[Quark Signaling] Sending:', msg.type, msg);
      this.ws.send(str);
    } else {
      console.warn('[Quark Signaling] Cannot send — WebSocket not open. State:', this.ws?.readyState);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandler = handler;
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

export type SignalingStatus = 'connected' | 'disconnected' | 'reconnecting' | 'failed';

export interface SignalingDriver {
  connect(): Promise<void>;
  joinRoom(roomId: string): void | Promise<void>;
  disconnect(): void;
  send(msg: SignalingMessage): void;
  onMessage(handler: (msg: SignalingMessage) => void): void;
  onStateChange(handler: (state: SignalingStatus) => void): void;
  getStatus(): SignalingStatus;
}

export { AblySignaling } from './signaling/ablyDriver';
export { FallbackSignalingDriver } from './signaling/fallbackDriver';
export { QRManualSignalingDriver } from './signaling/manualDriver';
export { MDNSDiscoveryDriver } from './signaling/mdnsDriver';
