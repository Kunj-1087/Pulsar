import Dexie, { type Table } from 'dexie';
import { Message, Room, OutboxMessage, FileProgress, Channel } from '../types';

export interface DBFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
  ts: number;
}

class QuarkDatabase extends Dexie {
  messages!: Table<Message, string>;
  files!: Table<DBFile, string>;
  rooms!: Table<Room, string>;
  outbox!: Table<OutboxMessage, string>;
  fileProgress!: Table<FileProgress, string>;
  fileChunks!: Table<{ fileId: string; chunkIndex: number; data: Uint8Array }, [string, number]>;
  channels!: Table<Channel, string>;

  constructor() {
    super('QuarkDB');
    this.version(1).stores({
      messages: 'id, roomId, ts',
      files: 'id, ts',
      rooms: 'roomId, createdAt',
    });
    this.version(2).stores({
      messages: 'id, roomId, ts, deleteAt',
      files: 'id, ts',
      rooms: 'roomId, createdAt',
    });
    this.version(3).stores({
      messages: 'id, roomId, ts, deleteAt',
      files: 'id, ts',
      rooms: 'roomId, createdAt',
      outbox: 'id, roomId, ts',
      fileProgress: 'id, peerId, hash',
    });
    this.version(4).stores({
      messages: 'id, roomId, ts, deleteAt',
      files: 'id, ts',
      rooms: 'roomId, createdAt',
      outbox: 'id, roomId, ts',
      fileProgress: 'id, peerId, hash',
      fileChunks: '[fileId+chunkIndex], fileId',
    });
    this.version(5).stores({
      messages: 'id, roomId, channelId, ts, deleteAt',
      files: 'id, ts',
      rooms: 'roomId, createdAt',
      outbox: 'id, roomId, ts',
      fileProgress: 'id, peerId, hash',
      fileChunks: '[fileId+chunkIndex], fileId',
      channels: 'id, roomId, createdAt',
    });
  }
}

// Instantiate database
export const db = new QuarkDatabase();

// Database helper functions
export async function saveMessage(msg: Message): Promise<void> {
  try {
    // Strip Blob out of fileRef before saving message to avoid redundant storage
    const msgToSave = { ...msg };
    if (msgToSave.fileRef) {
      msgToSave.fileRef = {
        id: msg.fileRef!.id,
        name: msg.fileRef!.name,
        size: msg.fileRef!.size,
        mimeType: msg.fileRef!.mimeType,
        status: msg.fileRef!.status,
        progress: msg.fileRef!.progress
      };
    }
    await db.messages.put(msgToSave);
  } catch (error) {
    console.error('Failed to save message to IndexedDB:', error);
  }
}

export async function getMessages(roomId: string): Promise<Message[]> {
  try {
    const list = await db.messages.where('roomId').equals(roomId).sortBy('ts');
    
    // Attempt to load blobs for file messages if they are completed
    for (const msg of list) {
      if (msg.type === 'file' && msg.fileRef) {
        const storedFile = await db.files.get(msg.fileRef.id);
        if (storedFile) {
          msg.fileRef.blob = storedFile.blob;
          msg.fileRef.status = 'complete';
          msg.fileRef.progress = 100;
        }
      }
    }
    return list;
  } catch (error) {
    console.error('Failed to get messages from IndexedDB:', error);
    return [];
  }
}

export async function saveFile(fileData: { id: string; name: string; size: number; mimeType: string; blob: Blob }): Promise<void> {
  try {
    await db.files.put({
      id: fileData.id,
      name: fileData.name,
      size: fileData.size,
      mimeType: fileData.mimeType,
      blob: fileData.blob,
      ts: Date.now(),
    });
  } catch (error) {
    console.error('Failed to save file blob to IndexedDB:', error);
  }
}

export async function getFile(id: string): Promise<Blob | null> {
  try {
    const file = await db.files.get(id);
    return file ? file.blob : null;
  } catch (error) {
    console.error('Failed to get file blob from IndexedDB:', error);
    return null;
  }
}

export async function clearRoom(roomId: string): Promise<void> {
  try {
    // Clear messages for this room
    const messages = await db.messages.where('roomId').equals(roomId).toArray();
    const messageIds = messages.map(m => m.id);
    const fileIds = messages.filter(m => m.type === 'file' && m.fileRef).map(m => m.fileRef!.id);

    await db.messages.bulkDelete(messageIds);
    await db.files.bulkDelete(fileIds);
    await db.rooms.delete(roomId);
  } catch (error) {
    console.error('Failed to clear room data from IndexedDB:', error);
  }
}

export async function saveRoom(room: Room): Promise<void> {
  try {
    await db.rooms.put(room);
  } catch (error) {
    console.error('Failed to save room to IndexedDB:', error);
  }
}

export async function getRoom(roomId: string): Promise<Room | null> {
  try {
    const room = await db.rooms.get(roomId);
    return room || null;
  } catch (error) {
    console.error('Failed to get room from IndexedDB:', error);
    return null;
  }
}

export async function cleanupExpiredMessages(): Promise<void> {
  try {
    const now = Date.now();
    const expired = await db.messages.where('deleteAt').below(now).toArray();
    if (expired.length === 0) return;
    const fileIds = expired.filter(m => m.type === 'file' && m.fileRef).map(m => m.fileRef!.id);
    const msgIds = expired.map(m => m.id);
    await db.messages.bulkDelete(msgIds);
    if (fileIds.length > 0) {
      await db.files.bulkDelete(fileIds);
    }
  } catch (error) {
    console.error('Failed to cleanup expired messages:', error);
  }
}

export async function panicWipe(): Promise<void> {
  try {
    await db.messages.clear();
    await db.files.clear();
    await db.rooms.clear();
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error);
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    for (const key of keys) {
      try { await caches.delete(key); } catch {}
    }
  }
  try {
    await db.outbox.clear();
    await db.fileProgress.clear();
  } catch {}
}

export async function saveOutboxMessage(msg: OutboxMessage): Promise<void> {
  try {
    await db.outbox.put(msg);
  } catch (error) {
    console.error('Failed to save outbox message:', error);
  }
}

export async function getOutboxMessages(roomId: string): Promise<OutboxMessage[]> {
  try {
    return await db.outbox.where('roomId').equals(roomId).sortBy('ts');
  } catch (error) {
    console.error('Failed to retrieve outbox messages:', error);
    return [];
  }
}

export async function removeOutboxMessage(id: string): Promise<void> {
  try {
    await db.outbox.delete(id);
  } catch (error) {
    console.error('Failed to delete outbox message:', error);
  }
}

export async function saveFileProgress(prog: FileProgress): Promise<void> {
  try {
    await db.fileProgress.put(prog);
  } catch (error) {
    console.error('Failed to save file progress:', error);
  }
}

export async function getFileProgress(id: string): Promise<FileProgress | null> {
  try {
    const p = await db.fileProgress.get(id);
    return p || null;
  } catch (error) {
    console.error('Failed to get file progress:', error);
    return null;
  }
}

export async function removeFileProgress(id: string): Promise<void> {
  try {
    await db.fileProgress.delete(id);
  } catch (error) {
    console.error('Failed to remove file progress:', error);
  }
}

export async function saveTempChunk(fileId: string, chunkIndex: number, data: Uint8Array): Promise<void> {
  try {
    await db.fileChunks.put({ fileId, chunkIndex, data });
  } catch (error) {
    console.error('Failed to save temp chunk to DB:', error);
  }
}

export async function getTempChunks(fileId: string): Promise<{ chunkIndex: number; data: Uint8Array }[]> {
  try {
    return await db.fileChunks.where('fileId').equals(fileId).toArray();
  } catch (error) {
    console.error('Failed to retrieve temp chunks:', error);
    return [];
  }
}

export async function clearTempChunks(fileId: string): Promise<void> {
  try {
    const keys = await db.fileChunks.where('fileId').equals(fileId).primaryKeys();
    await db.fileChunks.bulkDelete(keys);
  } catch (error) {
    console.error('Failed to clear temp chunks:', error);
  }
}

export async function createChannel(channel: Channel): Promise<void> {
  try {
    await db.channels.put(channel);
  } catch (error) {
    console.error('Failed to create channel in IndexedDB:', error);
  }
}

export async function getChannelsByRoom(roomId: string): Promise<Channel[]> {
  try {
    return await db.channels.where('roomId').equals(roomId).sortBy('createdAt');
  } catch (error) {
    console.error('Failed to get channels from IndexedDB:', error);
    return [];
  }
}

export async function deleteChannel(channelId: string): Promise<void> {
  try {
    await db.channels.delete(channelId);
    const messages = await db.messages.where('channelId').equals(channelId).toArray();
    const msgIds = messages.map(m => m.id);
    const fileIds = messages.filter(m => m.type === 'file' && m.fileRef).map(m => m.fileRef!.id);
    await db.messages.bulkDelete(msgIds);
    if (fileIds.length > 0) {
      await db.files.bulkDelete(fileIds);
    }
  } catch (error) {
    console.error('Failed to delete channel from IndexedDB:', error);
  }
}

export async function getMessagesByChannel(roomId: string, channelId: string): Promise<Message[]> {
  try {
    const list = await db.messages.where('roomId').equals(roomId).filter(m => m.channelId === channelId).sortBy('ts');
    for (const msg of list) {
      if (msg.type === 'file' && msg.fileRef) {
        const storedFile = await db.files.get(msg.fileRef.id);
        if (storedFile) {
          msg.fileRef.blob = storedFile.blob;
          msg.fileRef.status = 'complete';
          msg.fileRef.progress = 100;
        }
      }
    }
    return list;
  } catch (error) {
    console.error('Failed to get messages by channel:', error);
    return [];
  }
}

export async function updateMessageReactionsInDB(messageId: string, emoji: string, peerId: string, action: 'add' | 'remove'): Promise<void> {
  try {
    const msg = await db.messages.get(messageId);
    if (!msg) return;
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
    msg.reactions = reactions;
    await db.messages.put(msg);
  } catch (error) {
    console.error('Failed to update reactions in DB:', error);
  }
}
