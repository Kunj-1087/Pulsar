import { SignalingDriver, SignalingStatus } from '../signaling';
import { SignalingMessage } from '../../types';

/**
 * MDNSDiscoveryDriver - Stub for future local-network auto-discovery transport.
 * Allows peers on the same local LAN to auto-discover and establish connections
 * using multicast DNS (mDNS) or local HTTP beacons without manual scanning.
 */
export class MDNSDiscoveryDriver implements SignalingDriver {
  private messageHandler: ((msg: SignalingMessage) => void) | null = null;
  private stateChangeHandler: ((state: SignalingStatus) => void) | null = null;
  private status: SignalingStatus = 'disconnected';

  connect(): Promise<void> {
    console.log('[mDNS Stub] mDNS auto-discovery transport connecting (stub)...');
    this.status = 'disconnected';
    return Promise.resolve();
  }

  joinRoom(roomId: string): void {}

  disconnect(): void {
    this.status = 'disconnected';
  }

  send(msg: SignalingMessage): void {}

  onMessage(handler: (msg: SignalingMessage) => void): void {}

  onStateChange(handler: (state: SignalingStatus) => void): void {}

  getStatus(): SignalingStatus {
    return this.status;
  }
}
