import { create } from 'zustand';
import { Message, Peer, Room, RoomConnectionStatus, Channel } from '../types';

interface ChatStore {
  room: Room | null;
  setRoom: (room: Room | null) => void;
  
  peers: Map<string, Peer>;
  addPeer: (peer: Partial<Peer> & { peerId: string }) => void;
  updatePeer: (peerId: string, update: Partial<Peer>) => void;
  removePeer: (peerId: string) => void;
  getPeerCount: () => number;
  
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateFileProgress: (fileId: string, progress: number, status?: 'sending' | 'receiving' | 'complete' | 'error' | 'cancelled') => void;
  markFileComplete: (fileId: string, blob: Blob) => void;
  
  // Channels
  channels: Channel[];
  activeChannelId: string | null;
  setActiveChannel: (id: string) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (id: string) => void;

  // Reply state
  replyingTo: Message | null;
  setReplyingTo: (message: Message | null) => void;

  // Local peer ID
  myPeerId: string | null;
  setMyPeerId: (id: string) => void;

  // Reactions
  updateMessageReactions: (messageId: string, emoji: string, peerId: string, action: 'add' | 'remove') => void;

  roomStatus: RoomConnectionStatus;
  setRoomStatus: (roomStatus: RoomConnectionStatus) => void;
  
  typingPeers: Set<string>;
  setTyping: (peerId: string, isTyping: boolean) => void;
  
  signalingDriverName: 'Primary' | 'Backup (Ably)' | 'None';
  setSignalingDriverName: (name: 'Primary' | 'Backup (Ably)' | 'None') => void;

  outboxPendingIds: Set<string>;
  addOutboxPendingId: (id: string) => void;
  removeOutboxPendingId: (id: string) => void;
  setOutboxPendingIds: (ids: string[]) => void;

  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  room: null,
  channels: [],
  activeChannelId: null,
  replyingTo: null,
  myPeerId: null,

  setMyPeerId: (id) => set({ myPeerId: id }),
  setActiveChannel: (id) => set({ activeChannelId: id }),
  addChannel: (channel) => set((state) => {
    if (state.channels.some(c => c.id === channel.id)) return {};
    const nextChannels = [...state.channels, channel];
    return {
      channels: nextChannels,
      activeChannelId: state.activeChannelId || channel.id
    };
  }),
  removeChannel: (id) => set((state) => {
    const nextChannels = state.channels.filter(c => c.id !== id);
    let nextActiveId = state.activeChannelId;
    if (state.activeChannelId === id) {
      const general = nextChannels.find(c => c.name === 'general');
      nextActiveId = general ? general.id : (nextChannels[0]?.id || null);
    }
    return {
      channels: nextChannels,
      activeChannelId: nextActiveId,
      messages: state.messages.filter(m => m.channelId !== id)
    };
  }),
  setReplyingTo: (message) => set({ replyingTo: message }),
  updateMessageReactions: (messageId, emoji, peerId, action) => set((state) => {
    return {
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = msg.reactions ? [...msg.reactions] : [];
        const existingIdx = reactions.findIndex(r => r.emoji === emoji);
        if (existingIdx > -1) {
          const rx = reactions[existingIdx];
          const peersSet = new Set(rx.peers);
          if (action === 'add') {
            peersSet.add(peerId);
          } else {
            peersSet.delete(peerId);
          }
          const updatedPeers = Array.from(peersSet);
          if (updatedPeers.length === 0) {
            reactions.splice(existingIdx, 1);
          } else {
            reactions[existingIdx] = { ...rx, peers: updatedPeers };
          }
        } else if (action === 'add') {
          reactions.push({ emoji, peers: [peerId] });
        }
        return { ...msg, reactions };
      })
    };
  }),

  outboxPendingIds: new Set(),
  addOutboxPendingId: (id) => set((state) => {
    const next = new Set(state.outboxPendingIds);
    next.add(id);
    return { outboxPendingIds: next };
  }),
  removeOutboxPendingId: (id) => set((state) => {
    const next = new Set(state.outboxPendingIds);
    next.delete(id);
    return { outboxPendingIds: next };
  }),
  setOutboxPendingIds: (ids) => set({ outboxPendingIds: new Set(ids) }),
  setRoom: (room) => set({ room }),
  
  peers: new Map(),
  addPeer: (peer) => set((state) => {
    const next = new Map(state.peers);
    const existing = next.get(peer.peerId);
    next.set(peer.peerId, {
      displayName: `Peer_${peer.peerId.substring(0, 4)}`,
      connectionState: 'negotiating',
      isHost: false,
      ...existing,
      ...peer,
    });
    return { peers: next };
  }),
  updatePeer: (peerId, update) => set((state) => {
    const next = new Map(state.peers);
    const existing = next.get(peerId);
    if (existing) {
      next.set(peerId, { ...existing, ...update });
    }
    return { peers: next };
  }),
  removePeer: (peerId) => set((state) => {
    const next = new Map(state.peers);
    next.delete(peerId);
    
    // Also remove from typing list if present
    const nextTyping = new Set(state.typingPeers);
    nextTyping.delete(peerId);
    
    return { peers: next, typingPeers: nextTyping };
  }),
  getPeerCount: () => {
    return get().peers.size;
  },
  
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => {
    if (state.messages.some(m => m.id === msg.id)) {
      return {};
    }
    return { messages: [...state.messages, msg] };
  }),
  updateFileProgress: (fileId, progress, status) => set((state) => {
    return {
      messages: state.messages.map((msg) => {
        if (msg.type === 'file' && msg.fileRef && msg.fileRef.id === fileId) {
          return {
            ...msg,
            fileRef: {
              ...msg.fileRef,
              progress,
              status: status || (progress >= 100 ? 'complete' : msg.fileRef.status),
            },
          };
        }
        return msg;
      }),
    };
  }),
  markFileComplete: (fileId, blob) => set((state) => {
    return {
      messages: state.messages.map((msg) => {
        if (msg.type === 'file' && msg.fileRef && msg.fileRef.id === fileId) {
          return {
            ...msg,
            fileRef: {
              ...msg.fileRef,
              blob,
              progress: 100,
              status: 'complete',
            },
          };
        }
        return msg;
      }),
    };
  }),
  
  roomStatus: 'idle',
  setRoomStatus: (roomStatus) => set({ roomStatus }),
  
  typingPeers: new Set(),
  setTyping: (peerId, isTyping) => set((state) => {
    const next = new Set(state.typingPeers);
    if (isTyping) {
      next.add(peerId);
    } else {
      next.delete(peerId);
    }
    return { typingPeers: next };
  }),
  
  signalingDriverName: 'None',
  setSignalingDriverName: (signalingDriverName) => set({ signalingDriverName }),

  reset: () => set({
    room: null,
    channels: [],
    activeChannelId: null,
    replyingTo: null,
    myPeerId: null,
    peers: new Map(),
    messages: [],
    roomStatus: 'idle',
    typingPeers: new Set(),
    signalingDriverName: 'None',
    outboxPendingIds: new Set(),
  }),
}));
