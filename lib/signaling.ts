import { SignalingMessage } from '../types';
import { toast } from '../store/toastStore';

type MessageHandler = (msg: SignalingMessage) => void;
type StateChangeHandler = (state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

function getSignalingUrl(): string {
  // In a browser environment, derive the signaling URL from the current page's hostname.
  // This means if the user loaded the app from http://192.168.1.5:3000,
  // signaling automatically points to ws://192.168.1.5:8080.
  // If loaded from localhost, it points to ws://localhost:8080.
  // This requires zero configuration from the user.
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `ws://${hostname}:8080`;
  }
  // SSR fallback — not used in practice since signaling is client-only
  return process.env.NEXT_PUBLIC_SIGNALING_WS_URL ?? 'ws://localhost:8080';
}

export class QuarkSignaling {
  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private stateChangeHandler: StateChangeHandler | null = null;
  private url: string;
  private peerId: string;
  private roomId: string | null = null;

  private status: 'connected' | 'disconnected' | 'reconnecting' | 'failed' = 'disconnected';
  private intentionalClose = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(peerId: string) {
    this.peerId = peerId;
    this.url = getSignalingUrl();
    console.log('[Signaling] Using URL:', this.url);
  }

  private setStatus(state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') {
    this.status = state;
    if (state === 'reconnecting') {
      toast.warning('Signaling connection lost. Reconnecting…', { id: 'signaling-status' });
    } else if (state === 'connected') {
      toast.dismiss('signaling-status');
    } else if (state === 'failed') {
      toast.error('Signaling connection failed.', { id: 'signaling-status' });
    }
    this.stateChangeHandler?.(state);
  }

  getStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'failed' {
    return this.status;
  }

  connect(): Promise<void> {
    this.intentionalClose = false;

    // Single-flight guard — never start a second connection attempt while connecting or open
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('[Signaling] Connect call skipped: connection active or in progress');
      return Promise.resolve();
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      console.log(`[Signaling] Connecting to ${this.url}`);
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this.isConnecting = false;
        this.setStatus('failed');
        reject(err);
        return;
      }

      const openTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.warn('[Signaling] Connection timeout — closing socket');
          this.isConnecting = false;
          this.ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 8000);

      this.ws.onopen = () => {
        clearTimeout(openTimeout);
        this.isConnecting = false;
        this.reconnectAttempts = 0; // reset backoff on success
        console.log('[Signaling] Connected');
        this.setStatus('connected');

        if (this.roomId) {
          this.send({ type: 'join-room', roomId: this.roomId, peerId: this.peerId });
        }
        resolve();
      };

      this.ws.onmessage = (event) => {
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
        this.isConnecting = false;
        console.error('[Signaling] WebSocket error');
        this.ws?.close();
      };

      this.ws.onclose = (event) => {
        clearTimeout(openTimeout);
        this.isConnecting = false;
        console.log(`[Signaling] Closed (code: ${event.code})`);
        this.setStatus('disconnected');

        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };
    });
  }

  private scheduleReconnect() {
    if (this.intentionalClose) return;
    if (this.reconnectTimer) return; // already scheduled, don't stack timers

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Signaling] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.setStatus('failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // capped exponential backoff
    this.reconnectAttempts++;
    console.log(`[Signaling] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.setStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.warn('[Signaling] Reconnect attempt failed:', err);
      });
    }, delay);
  }

  joinRoom(roomId: string): void {
    this.roomId = roomId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'join-room', roomId, peerId: this.peerId });
    }
  }

  send(msg: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const str = JSON.stringify(msg);
      console.log('[Quark Signaling] Sending:', msg.type);
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
    this.isConnecting = false;
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
