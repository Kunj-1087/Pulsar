export type MessageType = 'text' | 'file-meta' | 'file-complete' | 'file-cancel' | 'typing' | 'peer-info' | 'system';

export interface Message {
  id: string;
  roomId: string;
  type: 'text' | 'file' | 'system';
  text?: string;
  sender: string;          // display name
  senderId: string;        // peerId
  ts: number;
  isOwn: boolean;
  fileRef?: FileRef;
}

export interface FileRef {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  blob?: Blob;             // only after receive complete
  progress?: number;       // 0–100 during transfer
  status: 'sending' | 'receiving' | 'complete' | 'error' | 'cancelled';
}

export type RoomConnectionStatus = 'idle' | 'signaling' | 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'failed' | 'closing' | 'closed';

export type PeerConnectionState = 'new' | 'negotiating' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface Peer {
  peerId: string;
  displayName?: string;
  handle?: string;
  peerColor?: string;
  connectionState: PeerConnectionState;
  isHost: boolean;
  e2eeStatus?: 'pending' | 'established' | 'failed';
  e2eeSafetyNumber?: string;
}

export interface Room {
  roomId: string;
  displayName: string;
  isHost: boolean;
  createdAt: number;
}

// WebRTC DataChannel message protocol
export type DataChannelMessage =
  | { type: 'message'; id: string; text: string; sender: string; senderId: string; ts: number }
  | { type: 'file-meta'; id: string; name: string; size: number; mimeType: string; totalChunks: number; sender: string }
  | { type: 'file-complete'; id: string }
  | { type: 'file-cancel'; id: string; reason?: string }
  | { type: 'typing'; senderId: string; displayName: string; isTyping: boolean }
  | { type: 'peer-info'; peerId: string; displayName: string; handle?: string; peerColor?: string }
  | { type: 'key-exchange'; publicKey: JsonWebKey };

// Signaling protocol (compatible with Ably)
export type SignalingMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; fromPeer: string; toPeer: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; fromPeer: string; toPeer: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; fromPeer: string; toPeer: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'room-created'; roomId: string }
  | { type: 'room-joined'; roomId: string; existingPeers: string[] }
  | { type: 'join-room'; roomId: string; peerId: string }
  | { type: 'error'; message: string };

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  messageCount: number;
  latencyMs: number | null;
  connectionType: string;
  iceState: RTCIceConnectionState;
  channelState: RTCDataChannelState;
  localCandidateType?: string;
  remoteCandidateType?: string;
  turnUsed?: boolean;
  turnCandidatesGathered?: boolean;
}
