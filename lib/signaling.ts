import { SignalingMessage } from '../types';

type MessageHandler = (msg: SignalingMessage) => void;
type StateChangeHandler = (state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

export class PulsarSignaling {
  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private stateChangeHandler: StateChangeHandler | null = null;
  private url: string;
  private peerId: string;
  private roomId: string | null = null;

  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private generation = 0;

  constructor(peerId: string) {
    this.peerId = peerId;
    this.url = process.env.NEXT_PUBLIC_SIGNALING_WS_URL || 'ws://localhost:8080';
  }

  connect(): Promise<void> {
    this.intentionalClose = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const currentGen = ++this.generation;

    return new Promise((resolve, reject) => {
      console.log(`[Pulsar Signaling] Connecting to signaling server. Gen: ${currentGen}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (currentGen !== this.generation) {
          this.ws?.close();
          return;
        }
        console.log('[Pulsar Signaling] Connected to signaling server');
        this.reconnectAttempts = 0;
        this.stateChangeHandler?.('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (currentGen !== this.generation) return;
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          console.log('[Pulsar Signaling] Received:', msg.type, msg);
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Pulsar Signaling] Parse error:', err);
        }
      };

      this.ws.onerror = (err) => {
        if (currentGen !== this.generation) return;
        console.error('[Pulsar Signaling] WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        if (currentGen !== this.generation) return;
        console.log('[Pulsar Signaling] Disconnected from signaling server');
        this.stateChangeHandler?.('disconnected');
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
    console.log(`[Pulsar Signaling] Reconnecting in ${Math.round(finalDelay)}ms (attempt ${this.reconnectAttempts})`);
    
    this.stateChangeHandler?.('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      if (this.intentionalClose) return;
      const currentGen = ++this.generation;
      console.log(`[Pulsar Signaling] Reconnect attempt start. Gen: ${currentGen}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (currentGen !== this.generation) {
          this.ws?.close();
          return;
        }
        console.log('[Pulsar Signaling] Reconnected to signaling server');
        this.reconnectAttempts = 0;
        this.stateChangeHandler?.('connected');
        if (this.roomId) {
          this.joinRoom(this.roomId);
        }
      };

      this.ws.onmessage = (event) => {
        if (currentGen !== this.generation) return;
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          console.log('[Pulsar Signaling] Received (reconnect):', msg.type, msg);
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Pulsar Signaling] Parse error (reconnect):', err);
        }
      };

      this.ws.onerror = (err) => {
        if (currentGen !== this.generation) return;
        console.error('[Pulsar Signaling] WebSocket error (reconnect):', err);
      };

      this.ws.onclose = () => {
        if (currentGen !== this.generation) return;
        console.log('[Pulsar Signaling] Reconnect socket closed unexpectedly');
        this.stateChangeHandler?.('disconnected');
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
      console.log('[Pulsar Signaling] Sending:', msg.type, msg);
      this.ws.send(str);
    } else {
      console.warn('[Pulsar Signaling] Cannot send — WebSocket not open. State:', this.ws?.readyState);
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
    this.stateChangeHandler?.('disconnected');
  }
}
