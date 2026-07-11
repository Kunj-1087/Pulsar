export type MessageType = 'text' | 'file-meta' | 'file-chunk' | 'file-complete' | 'typing' | 'peer-info' | 'system';

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
  status: 'sending' | 'receiving' | 'complete' | 'error';
}

export interface Peer {
  peerId: string;
  displayName?: string;
  connectionState: RTCPeerConnectionState;
  isHost: boolean;
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
  | { type: 'file-chunk'; id: string; chunk: string; index: number } // base64 encoded chunk
  | { type: 'file-complete'; id: string }
  | { type: 'typing'; senderId: string; displayName: string; isTyping: boolean }
  | { type: 'peer-info'; peerId: string; displayName: string };

// Signaling protocol (compatible with Ably)
export type SignalingMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; fromPeer: string; toPeer: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; fromPeer: string; toPeer: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; fromPeer: string; toPeer: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'room-created'; roomId: string }
  | { type: 'room-joined'; roomId: string; existingPeers: string[] }
  | { type: 'error'; message: string };

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  messageCount: number;
  latencyMs: number | null;
  connectionType: string;
  iceState: RTCIceConnectionState;
  channelState: RTCDataChannelState;
}
