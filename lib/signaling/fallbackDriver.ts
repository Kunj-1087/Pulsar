import { QuarkSignaling } from '../signaling';
import { AblySignaling } from './ablyDriver';
import { SignalingMessage } from '../../types';
import { toast } from '../../store/toastStore';
import { isOfflineMode } from '../utils';

type MessageHandler = (msg: SignalingMessage) => void;
type StateChangeHandler = (state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;

export class FallbackSignalingDriver {
  private primary: QuarkSignaling;
  private fallback: AblySignaling | null = null;
  private activeDriver: 'primary' | 'fallback' | null = null;

  private messageHandler: MessageHandler | null = null;
  private stateChangeHandler: StateChangeHandler | null = null;
  private peerId: string;
  private roomId: string | null = null;
  private isConnecting = false;

  constructor(peerId: string) {
    this.peerId = peerId;
    this.primary = new QuarkSignaling(peerId);
    
    // In offline mode, do not initialize Ably fallback at all.
    // In online mode, only initialize Ably if it is explicitly enabled.
    const isOffline = isOfflineMode();
    const ablyEnabled = process.env.NEXT_PUBLIC_ENABLE_ABLY_FALLBACK !== 'false';
    
    if (!isOffline && ablyEnabled) {
      this.fallback = new AblySignaling(peerId);
    }
    
    if (isOffline) {
      console.log('[Signaling Fallback] Offline mode detected. Ably fallback disabled.');
    }
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const timeoutMs = Number(process.env.NEXT_PUBLIC_SIGNALING_TIMEOUT_MS) || 5000;
    const isOffline = isOfflineMode();
    
    console.log(`[Signaling Fallback] Attempting primary signaling with ${timeoutMs}ms timeout${isOffline ? ' (offline mode)' : ''}...`);

    // Setup primary handlers in case it succeeds
    this.primary.onMessage((msg) => this.messageHandler?.(msg));
    this.primary.onStateChange((state) => this.handlePrimaryStateChange(state));

    try {
      // Race primary connect against timeout
      await Promise.race([
        this.primary.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Primary signaling connection timeout')), timeoutMs)
        ),
      ]);

      console.log('[Signaling Fallback] Primary signaling connection successful');
      this.activeDriver = 'primary';
      this.isConnecting = false;
      this.stateChangeHandler?.('connected');
    } catch (err) {
      console.warn('[Signaling Fallback] Primary signaling failed:', err);
      
      // Attempt Ably fallback only if offline mode is OFF
      if (!isOffline && this.fallback) {
        toast.info('Primary signaling server unreachable. Switching to backup server...', { title: 'Network Failover' });
        await this.switchToFallback();
      } else {
        this.isConnecting = false;
        
        if (isOffline) {
          // In offline mode, give a specific error message about LAN connectivity
          const errorMsg = 'Cannot reach the LAN signaling server. Make sure you are on the same network as the hub.';
          console.error('[Signaling Fallback]', errorMsg);
          toast.error(errorMsg, { title: 'Offline Mode - No Connection' });
        } else {
          toast.error('Primary signaling failed and backup is not enabled.', { title: 'Signaling Error' });
        }
        
        this.stateChangeHandler?.('failed');
        throw new Error(isOffline ? 'Offline mode: LAN signaling server unreachable' : 'Primary signaling failed and backup is not enabled');
      }
    }
  }

  async joinRoom(roomId: string): Promise<void> {
    this.roomId = roomId;
    if (this.activeDriver === 'primary') {
      this.primary.joinRoom(roomId);
    } else if (this.activeDriver === 'fallback' && this.fallback) {
      await this.fallback.joinRoom(roomId);
    } else {
      console.warn('[Signaling Fallback] Cannot join room, no active driver');
    }
  }

  send(msg: SignalingMessage): void {
    if (this.activeDriver === 'primary') {
      this.primary.send(msg);
    } else if (this.activeDriver === 'fallback' && this.fallback) {
      this.fallback.send(msg);
    } else {
      console.warn('[Signaling Fallback] Cannot send message, no active driver');
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
    this.primary.onMessage(handler);
    this.fallback?.onMessage(handler);
  }

  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandler = handler;
  }

  getStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'failed' {
    if (this.activeDriver === 'primary') {
      return this.primary.getStatus();
    } else if (this.activeDriver === 'fallback' && this.fallback) {
      return this.fallback.getStatus();
    }
    return 'disconnected';
  }

  disconnect(): void {
    this.primary.disconnect();
    this.fallback?.disconnect();
    this.activeDriver = null;
    this.isConnecting = false;
    this.stateChangeHandler?.('disconnected');
  }

  getActiveDriverName(): 'Primary' | 'Backup (Ably)' | 'None' {
    if (this.activeDriver === 'primary') return 'Primary';
    if (this.activeDriver === 'fallback') return 'Backup (Ably)';
    return 'None';
  }

  private async switchToFallback(): Promise<void> {
    if (!this.fallback || !this.roomId) return;
    
    console.log('[Signaling Fallback] Initiating failover to Ably...');
    this.primary.disconnect();
    
    this.fallback.onMessage((msg) => this.messageHandler?.(msg));
    this.fallback.onStateChange((state) => {
      this.stateChangeHandler?.(state);
    });

    try {
      this.activeDriver = 'fallback';
      await this.fallback.connect();
      await this.fallback.joinRoom(this.roomId);
      this.isConnecting = false;
      this.stateChangeHandler?.('connected');
      console.log('[Signaling Fallback] Failover to Ably completed successfully');
    } catch (err) {
      console.error('[Signaling Fallback] Backup signaling failover failed:', err);
      this.isConnecting = false;
      this.stateChangeHandler?.('failed');
      this.activeDriver = null;
      toast.error('Backup signaling connection failed. Please check your internet connection.', { title: 'Signaling Error' });
    }
  }

  private handlePrimaryStateChange(state: 'connected' | 'disconnected' | 'reconnecting' | 'failed') {
    // If primary failed mid-session, failover to Ably
    if (state === 'failed' && this.activeDriver === 'primary' && this.fallback && this.roomId) {
      this.switchToFallback().catch((err) => {
        console.error('[Signaling Fallback] Failed mid-session failover to Ably:', err);
      });
    } else {
      this.stateChangeHandler?.(state);
    }
  }
}
