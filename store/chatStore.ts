import { create } from 'zustand';
import { Message, Peer, Room, ConnectionStats } from '../types';

interface ChatStore {
  room: Room | null;
  setRoom: (room: Room | null) => void;
  
  peers: Map<string, Peer>;
  addPeer: (peer: Peer) => void;
  updatePeer: (peerId: string, update: Partial<Peer>) => void;
  removePeer: (peerId: string) => void;
  
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateFileProgress: (fileId: string, progress: number) => void;
  markFileComplete: (fileId: string, blob: Blob) => void;
  
  isConnecting: boolean;
  setIsConnecting: (isConnecting: boolean) => void;
  isConnected: boolean;
  setIsConnected: (isConnected: boolean) => void;
  
  typingPeers: Set<string>;
  setTyping: (peerId: string, isTyping: boolean) => void;
  
  devModeEnabled: boolean;
  toggleDevMode: () => void;
  connectionStats: ConnectionStats | null;
  setConnectionStats: (stats: ConnectionStats | null) => void;
  iceLog: string[];
  appendIceLog: (entry: string) => void;
  clearIceLog: () => void;
  localSdp: string | null;
  setLocalSdp: (sdp: string | null) => void;
  remoteSdp: string | null;
  setRemoteSdp: (sdp: string | null) => void;
  
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  
  peers: new Map(),
  addPeer: (peer) => set((state) => {
    const next = new Map(state.peers);
    next.set(peer.peerId, peer);
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
  
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => {
    // Avoid duplicate messages
    if (state.messages.some(m => m.id === msg.id)) {
      return {};
    }
    return { messages: [...state.messages, msg] };
  }),
  updateFileProgress: (fileId, progress) => set((state) => {
    return {
      messages: state.messages.map((msg) => {
        if (msg.type === 'file' && msg.fileRef && msg.fileRef.id === fileId) {
          return {
            ...msg,
            fileRef: {
              ...msg.fileRef,
              progress,
              status: progress >= 100 ? 'complete' : msg.fileRef.status,
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
  
  isConnecting: false,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  isConnected: false,
  setIsConnected: (isConnected) => set({ isConnected }),
  
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
  
  // Set default dev mode state from env var
  devModeEnabled: process.env.NEXT_PUBLIC_DEV_MODE === 'true',
  toggleDevMode: () => set((state) => ({ devModeEnabled: !state.devModeEnabled })),
  connectionStats: null,
  setConnectionStats: (connectionStats) => set({ connectionStats }),
  iceLog: [],
  appendIceLog: (entry) => set((state) => {
    // Keep last 100 entries to prevent memory growth
    const nextLog = [...state.iceLog, entry];
    if (nextLog.length > 100) nextLog.shift();
    return { iceLog: nextLog };
  }),
  clearIceLog: () => set({ iceLog: [] }),
  localSdp: null,
  setLocalSdp: (localSdp) => set({ localSdp }),
  remoteSdp: null,
  setRemoteSdp: (remoteSdp) => set({ remoteSdp }),
  
  reset: () => set({
    room: null,
    peers: new Map(),
    messages: [],
    isConnecting: false,
    isConnected: false,
    typingPeers: new Set(),
    connectionStats: null,
    iceLog: [],
    localSdp: null,
    remoteSdp: null,
  }),
}));
