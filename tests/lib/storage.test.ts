import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  saveMessage,
  getMessages,
  saveRoom,
  getRoom,
  clearRoom,
  saveFile,
  getFile,
  cleanupExpiredMessages,
  panicWipe,
} from '../../lib/storage';
import type { Message, Room } from '../../types';

const testRoomId = 'TESTROOM';
const testMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  roomId: testRoomId,
  type: 'text',
  text: 'hello',
  sender: 'Alice',
  senderId: 'alice-id',
  ts: Date.now(),
  isOwn: true,
  ...overrides,
});

const testRoom: Room = {
  roomId: testRoomId,
  displayName: 'Test Room',
  isHost: false,
  createdAt: Date.now(),
};

describe('saveMessage / getMessages', () => {
  beforeEach(async () => {
    await db.messages.clear();
    await db.files.clear();
    await db.rooms.clear();
  });

  it('persists a message and retrieves it by roomId', async () => {
    const msg = testMessage();
    await saveMessage(msg);
    const messages = await getMessages(testRoomId);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(msg.id);
    expect(messages[0].text).toBe(msg.text);
  });

  it('does not return messages from other rooms', async () => {
    const msg1 = testMessage({ id: '1', roomId: 'ROOM_A' });
    const msg2 = testMessage({ id: '2', roomId: 'ROOM_B' });
    await saveMessage(msg1);
    await saveMessage(msg2);
    const results = await getMessages('ROOM_A');
    expect(results).toHaveLength(1);
    expect(results[0].roomId).toBe('ROOM_A');
  });

  it('returns messages ordered by timestamp', async () => {
    await saveMessage(testMessage({ id: '1', ts: 100 }));
    await saveMessage(testMessage({ id: '2', ts: 200 }));
    await saveMessage(testMessage({ id: '3', ts: 50 }));
    const messages = await getMessages(testRoomId);
    expect(messages.map(m => m.ts)).toEqual([50, 100, 200]);
  });

  it('handles empty room', async () => {
    const messages = await getMessages('EMPTY');
    expect(messages).toEqual([]);
  });
});

describe('saveRoom / getRoom', () => {
  beforeEach(async () => {
    await db.rooms.clear();
  });

  it('persists and retrieves a room', async () => {
    await saveRoom(testRoom);
    const retrieved = await getRoom(testRoomId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.roomId).toBe(testRoomId);
  });

  it('returns null for non-existent room', async () => {
    const retrieved = await getRoom('NONEXISTENT');
    expect(retrieved).toBeNull();
  });
});

describe('clearRoom', () => {
  beforeEach(async () => {
    await db.messages.clear();
    await db.files.clear();
    await db.rooms.clear();
  });

  it('removes all messages and files for a room', async () => {
    await saveMessage(testMessage({ id: 'm1' }));
    await saveRoom(testRoom);
    await saveFile({ id: 'f1', name: 'test.txt', size: 100, mimeType: 'text/plain', blob: new Blob(['data']) });
    await clearRoom(testRoomId);
    const messages = await getMessages(testRoomId);
    expect(messages).toHaveLength(0);
    const room = await getRoom(testRoomId);
    expect(room).toBeNull();
  });
});

describe('saveFile / getFile', () => {
  beforeEach(async () => {
    await db.files.clear();
  });

  it('persists and retrieves a file blob', async () => {
    const blob = new Blob(['test file content']);
    await saveFile({ id: 'file1', name: 'test.txt', size: 18, mimeType: 'text/plain', blob });
    const file = await db.files.get('file1');
    expect(file).not.toBeNull();
    expect(file!.name).toBe('test.txt');
    expect(file!.size).toBe(18);
    expect(file!.mimeType).toBe('text/plain');

    const retrieved = await getFile('file1');
    expect(retrieved).not.toBeNull();
  });
});

describe('cleanupExpiredMessages', () => {
  beforeEach(async () => {
    await db.messages.clear();
    await db.files.clear();
  });

  it('removes messages with deleteAt in the past', async () => {
    await db.messages.put(testMessage({ id: 'expired', deleteAt: Date.now() - 1000 }));
    await db.messages.put(testMessage({ id: 'active', deleteAt: Date.now() + 60000 }));
    await cleanupExpiredMessages();
    const remaining = await db.messages.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('active');
  });

  it('does nothing when no messages are expired', async () => {
    await db.messages.put(testMessage({ id: '1' }));
    await cleanupExpiredMessages();
    const remaining = await db.messages.toArray();
    expect(remaining).toHaveLength(1);
  });
});

describe('panicWipe', () => {
  beforeEach(async () => {
    await db.messages.clear();
    await db.files.clear();
    await db.rooms.clear();
  });

  it('clears all IndexedDB data', async () => {
    await saveMessage(testMessage({ id: 'm1' }));
    await saveRoom(testRoom);
    await saveFile({ id: 'f1', name: 't.txt', size: 1, mimeType: 'text/plain', blob: new Blob(['x']) });
    await panicWipe();
    const messages = await db.messages.toArray();
    const rooms = await db.rooms.toArray();
    const files = await db.files.toArray();
    expect(messages).toHaveLength(0);
    expect(rooms).toHaveLength(0);
    expect(files).toHaveLength(0);
  });

  it('handles already-empty database', async () => {
    await expect(panicWipe()).resolves.not.toThrow();
  });
});
