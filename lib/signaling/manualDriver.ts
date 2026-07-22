import { SignalingDriver, SignalingStatus } from '../signaling';
import { SignalingMessage } from '../../types';

export class QRManualSignalingDriver implements SignalingDriver {
  private messageHandler: ((msg: SignalingMessage) => void) | null = null;
  private stateChangeHandler: ((state: SignalingStatus) => void) | null = null;
  private status: SignalingStatus = 'disconnected';
  private onLocalSignalCallback: ((msg: SignalingMessage) => void) | null = null;

  connect(): Promise<void> {
    this.status = 'connected';
    this.stateChangeHandler?.('connected');
    return Promise.resolve();
  }

  joinRoom(roomId: string): void {
    // Manual exchange bypasses signaling rooms
  }

  disconnect(): void {
    this.status = 'disconnected';
    this.stateChangeHandler?.('disconnected');
  }

  send(msg: SignalingMessage): void {
    // Hand signals over to UI callback to render QR / copyable text
    if (this.onLocalSignalCallback) {
      this.onLocalSignalCallback(msg);
    }
  }

  onMessage(handler: (msg: SignalingMessage) => void): void {
    this.messageHandler = handler;
  }

  onStateChange(handler: (state: SignalingStatus) => void): void {
    this.stateChangeHandler = handler;
  }

  getStatus(): SignalingStatus {
    return this.status;
  }

  // Hook to capture generated local offers / answers for UI display
  onLocalSignal(callback: (msg: SignalingMessage) => void): void {
    this.onLocalSignalCallback = callback;
  }

  // Trigger signaling message execution from scanned QR or pasted string
  feedSignal(msg: SignalingMessage): void {
    if (this.messageHandler) {
      this.messageHandler(msg);
    }
  }
}
