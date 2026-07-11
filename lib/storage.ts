import Dexie, { type Table } from 'dexie';
import { Message, Room } from '../types';

export interface DBFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
  ts: number;
}

class PulsarDatabase extends Dexie {
  messages!: Table<Message, string>;
  files!: Table<DBFile, string>;
  rooms!: Table<Room, string>;

  constructor() {
    super('PulsarDB');
    this.version(1).stores({
      messages: 'id, roomId, ts',
      files: 'id, ts',
      rooms: 'roomId, createdAt',
    });
  }
}

// Instantiate database
export const db = new PulsarDatabase();

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
