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
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(peerId: string) {
    this.peerId = peerId;
    // URL fallback chain:
    //   1. NEXT_PUBLIC_SIGNALING_WS_URL env var
    //   2. getSignalingUrl() auto-derivation from window.location
    //   3. Hardcoded localhost fallback
    this.url =
      process.env.NEXT_PUBLIC_SIGNALING_WS_URL ||
      (() => {
        try { return getSignalingUrl(); } catch { return null; }
      })() ||
      'ws://localhost:8080';
    console.log('[Signaling] Using URL:', this.url);
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
      console.log(`[Signaling] Connecting (gen ${currentGen}) to ${this.url}`);
      this.ws = new WebSocket(this.url);

      const openTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.warn('[Signaling] Connection timeout — closing');
          this.ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 8000);

      this.ws.onopen = () => {
        clearTimeout(openTimeout);
        if (currentGen !== this.generation) {
          this.ws?.close();
          return;
        }
        console.log('[Signaling] Connected');
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (currentGen !== this.generation) return;
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          console.log('[Signaling] Received:', msg.type);
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Signaling] Parse error:', err);
        }
      };

      this.ws.onerror = () => {
        clearTimeout(openTimeout);
        if (currentGen !== this.generation) return;
        console.error('[Signaling] WebSocket error — is the signaling server running?');
      };

      this.ws.onclose = (event) => {
        clearTimeout(openTimeout);
        if (currentGen !== this.generation) return;
        console.log(`[Signaling] Closed (code: ${event.code})`);
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

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Signaling] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.setStatus('failed');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, capped at 15s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
    const jitter = Math.random() * 500;
    const finalDelay = delay + jitter;

    this.reconnectAttempts++;
    console.log(`[Signaling] Reconnecting in ${Math.round(finalDelay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.setStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      if (this.intentionalClose) return;

      const currentGen = ++this.generation;
      console.log(`[Signaling] Reconnect attempt ${this.reconnectAttempts}`);
      this.ws = new WebSocket(this.url);

      const openTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
        }
      }, 8000);

      this.ws.onopen = () => {
        clearTimeout(openTimeout);
        if (currentGen !== this.generation) {
          this.ws?.close();
          return;
        }
        console.log('[Signaling] Reconnected');
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
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Signaling] Parse error (reconnect):', err);
        }
      };

      this.ws.onerror = () => {
        clearTimeout(openTimeout);
        if (currentGen !== this.generation) return;
        console.error('[Signaling] Reconnect error');
      };

      this.ws.onclose = () => {
        clearTimeout(openTimeout);
        if (currentGen !== this.generation) return;
        console.log('[Signaling] Reconnect socket closed');
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
