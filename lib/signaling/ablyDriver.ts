import * as Ably from 'ably';
import { SignalingMessage } from '../../types';

type MessageHandler = (msg: SignalingMessage) => void;
type StateChangeHandler = (state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

export class AblySignaling {
  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;
  private messageHandler: MessageHandler | null = null;
  private stateChangeHandler: StateChangeHandler | null = null;
  private status: 'connected' | 'disconnected' | 'reconnecting' | 'failed' = 'disconnected';
  
  private peerId!: string;
  private roomId: string | null = null;

  constructor(peerId: string) {
    this.peerId = peerId;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    this.setStatus('reconnecting');
    console.log('[Quark Ably] Initializing Ably client connection...');

    this.client = new Ably.Realtime({
      authCallback: (tokenParams: any, callback: any) => {
        fetch('/api/signal/token')
          .then(async (res) => {
            if (!res.ok) {
              callback(new Error(`Failed to fetch Ably token: ${res.statusText}`), null);
              return;
            }
            const tokenRequest = await res.json();
            callback(null, tokenRequest);
          })
          .catch((err) => {
            callback(err, null);
          });
      },
    });

    // Map connection states
    this.client.connection.on((stateChange) => {
      const current = stateChange.current;
      console.log(`[Quark Ably] Connection state changed to: ${current}`);
      
      if (current === 'connected') {
        this.setStatus('connected');
      } else if (current === 'disconnected') {
        this.setStatus('disconnected');
      } else if (current === 'connecting' || current === 'suspended') {
        this.setStatus('reconnecting');
      } else if (current === 'failed') {
        this.setStatus('failed');
      }
    });

    // Await connected state
    await new Promise<void>((resolve, reject) => {
      if (!this.client) return reject(new Error('Client not initialized'));
      
      if (this.client.connection.state === 'connected') {
        resolve();
        return;
      }

      const onConnected = () => {
        this.client?.connection.off('connected', onConnected);
        this.client?.connection.off('failed', onFailed);
        resolve();
      };

      const onFailed = () => {
        this.client?.connection.off('connected', onConnected);
        this.client?.connection.off('failed', onFailed);
        reject(new Error('Ably connection failed'));
      };

      this.client.connection.once('connected', onConnected);
      this.client.connection.once('failed', onFailed);
    });
  }

  async joinRoom(roomId: string): Promise<void> {
    this.roomId = roomId;
    if (!this.client) {
      throw new Error('[Quark Ably] Client not connected');
    }

    console.log(`[Quark Ably] Joining channel 'quark-room-${roomId}'`);
    const channelName = `quark-room-${roomId}`;
    this.channel = this.client.channels.get(channelName);

    // Subscribe to presence (peer discovery)
    this.channel.presence.subscribe('enter', (member) => {
      if (member.clientId === this.peerId) return;
      console.log(`[Quark Ably] Presence ENTER: ${member.clientId}`);
      this.messageHandler?.({
        type: 'peer-joined',
        peerId: member.clientId,
      });
    });

    this.channel.presence.subscribe('leave', (member) => {
      if (member.clientId === this.peerId) return;
      console.log(`[Quark Ably] Presence LEAVE: ${member.clientId}`);
      this.messageHandler?.({
        type: 'peer-left',
        peerId: member.clientId,
      });
    });

    // Subscribe to incoming signal messages
    this.channel.subscribe('signal', (message) => {
      const msg = message.data as SignalingMessage;
      if ('toPeer' in msg && msg.toPeer === this.peerId) {
        this.messageHandler?.(msg);
      }
    });

    // Enter presence
    await this.channel.presence.enter(this.peerId);

    // Fetch list of current participants
    const members = await this.channel.presence.get();
    const existingPeers = members
      .map((m) => m.clientId)
      .filter((id) => id && id !== this.peerId);

    // Mimic the websocket room-joined packet
    this.messageHandler?.({
      type: 'room-joined',
      roomId,
      existingPeers,
    });
  }

  send(msg: SignalingMessage): void {
    if (!this.channel) {
      console.warn('[Quark Ably] Cannot send message, channel not active');
      return;
    }

    // Publish to Ably channel
    this.channel.publish('signal', msg).catch((err) => {
      console.error('[Quark Ably] Failed to publish message:', err);
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandler = handler;
  }

  getStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'failed' {
    return this.status;
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.presence.leave(this.peerId).catch(() => {});
      this.channel.unsubscribe();
      this.channel.presence.unsubscribe();
      this.channel = null;
    }
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.setStatus('disconnected');
  }

  private setStatus(state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') {
    this.status = state;
    this.stateChangeHandler?.(state);
  }
}
