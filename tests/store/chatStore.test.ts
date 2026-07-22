import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../../store/chatStore';
import type { Message, Peer } from '../../types';

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  describe('messages', () => {
    const makeMsg = (id: string, overrides: Partial<Message> = {}): Message => ({
      id,
      roomId: 'TEST',
      type: 'text',
      text: 'hello',
      sender: 'Alice',
      senderId: 'alice',
      ts: Date.now(),
      isOwn: true,
      ...overrides,
    });

    it('starts with empty messages', () => {
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it('adds a message', () => {
      const msg = makeMsg('1');
      useChatStore.getState().addMessage(msg);
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].id).toBe('1');
    });

    it('prevents duplicate messages', () => {
      const msg = makeMsg('1');
      useChatStore.getState().addMessage(msg);
      useChatStore.getState().addMessage(msg);
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('sets messages', () => {
      const msgs = [makeMsg('1'), makeMsg('2')];
      useChatStore.getState().setMessages(msgs);
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
  });

  describe('peers', () => {
    beforeEach(() => {
      useChatStore.getState().reset();
    });

    it('starts with empty peers', () => {
      expect(useChatStore.getState().peers.size).toBe(0);
    });

    it('adds a peer', () => {
      useChatStore.getState().addPeer({ peerId: 'peer-1', displayName: 'Alice', connectionState: 'connected', isHost: false });
      const peers = useChatStore.getState().peers;
      expect(peers.size).toBe(1);
      expect(peers.get('peer-1')?.displayName).toBe('Alice');
    });

    it('adds peer with defaults for missing fields', () => {
      useChatStore.getState().addPeer({ peerId: 'abc12345' });
      const peer = useChatStore.getState().peers.get('abc12345')!;
      expect(peer.displayName).toBe('Peer_abc1');
      expect(peer.connectionState).toBe('negotiating');
    });

    it('updates an existing peer', () => {
      useChatStore.getState().addPeer({ peerId: 'p1', connectionState: 'negotiating', isHost: false });
      useChatStore.getState().updatePeer('p1', { displayName: 'Bob', e2eeStatus: 'established' });
      const peer = useChatStore.getState().peers.get('p1')!;
      expect(peer.displayName).toBe('Bob');
      expect(peer.e2eeStatus).toBe('established');
    });

    it('removes a peer', () => {
      useChatStore.getState().addPeer({ peerId: 'p1', connectionState: 'connected', isHost: false });
      useChatStore.getState().removePeer('p1');
      expect(useChatStore.getState().peers.size).toBe(0);
    });

    it('removes peer typing state when peer is removed', () => {
      useChatStore.getState().addPeer({ peerId: 'p1', connectionState: 'connected', isHost: false });
      useChatStore.getState().setTyping('p1', true);
      useChatStore.getState().removePeer('p1');
      expect(useChatStore.getState().typingPeers.has('p1')).toBe(false);
    });

    it('returns peer count', () => {
      useChatStore.getState().addPeer({ peerId: '1', connectionState: 'connected', isHost: false });
      useChatStore.getState().addPeer({ peerId: '2', connectionState: 'connected', isHost: false });
      expect(useChatStore.getState().getPeerCount()).toBe(2);
    });
  });

  describe('room', () => {
    it('sets and gets room', () => {
      const room = { roomId: 'ROOM123', displayName: 'Test', isHost: true, createdAt: Date.now() };
      useChatStore.getState().setRoom(room);
      expect(useChatStore.getState().room?.roomId).toBe('ROOM123');
    });
  });

  describe('roomStatus', () => {
    it('transitions from idle to signaling', () => {
      expect(useChatStore.getState().roomStatus).toBe('idle');
      useChatStore.getState().setRoomStatus('signaling');
      expect(useChatStore.getState().roomStatus).toBe('signaling');
    });
  });

  describe('typing', () => {
    it('adds and removes typing peers', () => {
      useChatStore.getState().setTyping('p1', true);
      expect(useChatStore.getState().typingPeers.has('p1')).toBe(true);
      useChatStore.getState().setTyping('p1', false);
      expect(useChatStore.getState().typingPeers.has('p1')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to defaults', () => {
      useChatStore.getState().setRoom({ roomId: 'R', displayName: 'R', isHost: true, createdAt: Date.now() });
      useChatStore.getState().addPeer({ peerId: 'p1', connectionState: 'connected', isHost: false });
      useChatStore.getState().addMessage({
        id: 'm1', roomId: 'R', type: 'text', text: 'hi', sender: 'A', senderId: 'a', ts: 1, isOwn: true,
      });
      useChatStore.getState().reset();
      expect(useChatStore.getState().room).toBeNull();
      expect(useChatStore.getState().peers.size).toBe(0);
      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().roomStatus).toBe('idle');
    });
  });
});
