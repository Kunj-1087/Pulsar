import { SignalingMessage } from '../types';

type MessageHandler = (msg: SignalingMessage) => void;

export class PulsarSignaling {
  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private url: string;
  private peerId: string;
  private roomId: string | null = null;

  constructor(peerId: string) {
    this.peerId = peerId;
    this.url = process.env.NEXT_PUBLIC_SIGNALING_WS_URL || 'ws://localhost:8080';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[Pulsar Signaling] Connected to signaling server');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          console.log('[Pulsar Signaling] Received:', msg.type, msg);
          this.messageHandler?.(msg);
        } catch (err) {
          console.error('[Pulsar Signaling] Parse error:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[Pulsar Signaling] WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('[Pulsar Signaling] Disconnected');
      };
    });
  }

  joinRoom(roomId: string): void {
    this.roomId = roomId;
    this.send({ type: 'join-room', roomId, peerId: this.peerId } as any);
  }

  send(msg: SignalingMessage | any): void {
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

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
