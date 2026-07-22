import '@testing-library/jest-dom';

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

import * as nodeCrypto from 'node:crypto';

if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  globalThis.crypto = nodeCrypto.webcrypto as unknown as Crypto;
}

class MockRTCPeerConnection {
  createDataChannel() {
    return {
      readyState: 'open' as const,
      binaryType: 'arraybuffer' as BinaryType,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }
  createOffer() { return Promise.resolve({ type: 'offer' as const, sdp: '' }); }
  createAnswer() { return Promise.resolve({ type: 'answer' as const, sdp: '' }); }
  setLocalDescription() { return Promise.resolve(); }
  setRemoteDescription() { return Promise.resolve(); }
  close() {}
  addEventListener() {}
  removeEventListener() {}
  getStats() { return Promise.resolve(new Map()); }
  addIceCandidate() { return Promise.resolve(); }
  get iceConnectionState() { return 'new' as RTCIceConnectionState; }
  get connectionState() { return 'new' as RTCPeerConnectionState; }
  get signalingState() { return 'stable' as RTCSignalingState; }
  get localDescription() { return null; }
}

class MockRTCDataChannel extends EventTarget {
  readyState: RTCDataChannelState = 'open';
  binaryType: BinaryType = 'arraybuffer';
  send = vi.fn();
  close = vi.fn();
  bufferedAmount = 0;
  label = 'quark-data';
}

globalThis.RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection;
globalThis.RTCDataChannel = MockRTCDataChannel as unknown as typeof RTCDataChannel;

class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 1;
  url: string;
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(url: string) {
    super();
    this.url = url;
  }
  send = vi.fn();
  close = vi.fn();
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(), getAll: vi.fn() }),
  usePathname: () => '',
  redirect: vi.fn(),
}));

vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: any) => node,
}));
