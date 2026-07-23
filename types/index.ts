export const PROTOCOL_VERSION = 1;

export type MessageType = 'text' | 'file-meta' | 'file-complete' | 'file-cancel' | 'typing' | 'peer-info' | 'system';

// Channel — a named sub-room within a Quark room
export type Channel = {
  id: string;           // UUID
  roomId: string;
  name: string;         // e.g. "general", "resources"
  createdAt: number;
  createdBy: string;    // peer ID of creator
};

// Reaction — emoji reaction on a message
export type Reaction = {
  emoji: string;
  peers: string[];      // peer IDs who reacted
};

// ReplyRef — reference to a quoted message
export type ReplyRef = {
  messageId: string;
  senderHandle: string;
  preview: string;      // first 80 chars of the replied-to message text
};

export interface Message {
  id: string;
  roomId: string;
  type: 'text' | 'file' | 'system';
  text?: string;
  sender: string;
  senderId: string;
  ts: number;
  isOwn: boolean;
  fileRef?: FileRef;
  deleteAt?: number;
  channelId?: string;
  reactions?: Reaction[];
  replyTo?: ReplyRef;
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

export type PeerConnectionState = 'new' | 'negotiating' | 'connected' | 'disconnected' | 'failed' | 'closed' | 'grace';

export interface Peer {
  peerId: string;
  displayName?: string;
  handle?: string;
  peerColor?: string;
  connectionState: PeerConnectionState;
  isHost: boolean;
  e2eeStatus?: 'pending' | 'established' | 'failed';
  e2eeSafetyNumber?: string;
  protocolVersion?: number;
}

export interface Room {
  roomId: string;
  displayName: string;
  isHost: boolean;
  createdAt: number;
  roomPassword?: string;
}

// WebRTC DataChannel message protocol
export type DataChannelMessage =
  | { type: 'message'; id: string; text: string; sender: string; senderId: string; ts: number; protocolVersion?: number; seq?: number; disappearAfterMs?: number; channelId?: string; replyTo?: ReplyRef }
  | { type: 'file-meta'; id: string; name: string; size: number; mimeType: string; totalChunks: number; sender: string; hash?: string; protocolVersion?: number; seq?: number; channelId?: string }
  | { type: 'file-resume'; id: string; receivedChunks: number[]; protocolVersion?: number; seq?: number }
  | { type: 'file-complete'; id: string; protocolVersion?: number; seq?: number }
  | { type: 'file-cancel'; id: string; reason?: string; protocolVersion?: number; seq?: number }
  | { type: 'typing'; senderId: string; displayName: string; isTyping: boolean; protocolVersion?: number; seq?: number }
  | { type: 'peer-typing'; peerId: string; handle: string; channelId: string; ts: number; protocolVersion?: number; seq?: number }
  | { type: 'peer-leave'; peerId: string; handle?: string; protocolVersion?: number; seq?: number }
  | { type: 'peer-info'; peerId: string; displayName: string; handle?: string; peerColor?: string; protocolVersion?: number; seq?: number }
  | { type: 'key-exchange'; publicKey: JsonWebKey; protocolVersion?: number; seq?: number }
  | { type: 'channel-create'; channel: Channel; protocolVersion?: number; seq?: number }
  | { type: 'channel-delete'; channelId: string; protocolVersion?: number; seq?: number }
  | { type: 'message-react'; messageId: string; channelId: string; emoji: string; peerId: string; action: 'add' | 'remove'; protocolVersion?: number; seq?: number }
  | { type: 'channel-list'; channels: Channel[]; protocolVersion?: number; seq?: number };

// Signaling protocol (compatible with Ably)
export type SignalingMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; fromPeer: string; toPeer: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; fromPeer: string; toPeer: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; fromPeer: string; toPeer: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-rejoin'; peerId: string; roomId: string; handle?: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'leave'; peerId: string; roomId: string }
  | { type: 'room-created'; roomId: string }
  | { type: 'room-joined'; roomId: string; existingPeers: string[] }
  | { type: 'join-room'; roomId: string; peerId: string; isHost?: boolean }
  | { type: 'room-not-found'; roomId: string }
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
  e2eeStatus?: string;
  e2eeSafetyNumber?: string;
  e2eeMessagesEncrypted?: number;
  e2eeMessagesDecrypted?: number;
  e2eeDecryptionFailures?: number;
  protocolVersion?: number;
  remoteProtocolVersion?: number;
}

export interface OutboxMessage {
  id: string;
  roomId: string;
  ts: number;
  type: 'text' | 'file';
  text?: string;
  fileRef?: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
  };
}

export interface FileProgress {
  id: string; // fileId
  peerId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: number[]; // indices of completed chunks
  hash: string; // integrity SHA-256 hash
}
