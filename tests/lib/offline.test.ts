import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  saveOutboxMessage,
  getOutboxMessages,
  removeOutboxMessage,
  saveFileProgress,
  getFileProgress,
  removeFileProgress,
  saveTempChunk,
  getTempChunks,
  clearTempChunks,
} from '../../lib/storage';
import { OutboxMessage, FileProgress } from '../../types';

describe('Offline Storage Helpers', () => {
  beforeEach(async () => {
    await db.outbox.clear();
    await db.fileProgress.clear();
    await db.fileChunks.clear();
  });

  describe('Outbox Queue', () => {
    it('saves and retrieves outbox messages in chronological order', async () => {
      const msg1: OutboxMessage = {
        id: 'msg-out-1',
        roomId: 'ROOM_A',
        ts: 1000,
        type: 'text',
        text: 'first',
      };
      const msg2: OutboxMessage = {
        id: 'msg-out-2',
        roomId: 'ROOM_A',
        ts: 2000,
        type: 'text',
        text: 'second',
      };
      const msg3: OutboxMessage = {
        id: 'msg-out-3',
        roomId: 'ROOM_B',
        ts: 1500,
        type: 'text',
        text: 'other',
      };

      await saveOutboxMessage(msg1);
      await saveOutboxMessage(msg2);
      await saveOutboxMessage(msg3);

      const roomAMessages = await getOutboxMessages('ROOM_A');
      expect(roomAMessages).toHaveLength(2);
      expect(roomAMessages[0].id).toBe('msg-out-1');
      expect(roomAMessages[1].id).toBe('msg-out-2');

      const roomBMessages = await getOutboxMessages('ROOM_B');
      expect(roomBMessages).toHaveLength(1);
      expect(roomBMessages[0].id).toBe('msg-out-3');
    });

    it('deletes specific messages from the outbox queue', async () => {
      const msg1: OutboxMessage = {
        id: 'msg-out-1',
        roomId: 'ROOM_A',
        ts: 1000,
        type: 'text',
        text: 'to be sent',
      };
      await saveOutboxMessage(msg1);
      
      let pending = await getOutboxMessages('ROOM_A');
      expect(pending).toHaveLength(1);

      await removeOutboxMessage('msg-out-1');
      pending = await getOutboxMessages('ROOM_A');
      expect(pending).toHaveLength(0);
    });
  });

  describe('File Progress & Chunk Resumption Tracker', () => {
    it('persists and retrieves chunk indices and metadata', async () => {
      const progress: FileProgress = {
        id: 'file-transfer-1',
        peerId: 'peer-alice',
        name: 'vacation.png',
        size: 2048,
        mimeType: 'image/png',
        totalChunks: 4,
        receivedChunks: [0, 1],
        hash: 'sha256-hash-signature',
      };

      await saveFileProgress(progress);
      
      const retrieved = await getFileProgress('file-transfer-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('file-transfer-1');
      expect(retrieved!.receivedChunks).toEqual([0, 1]);
      expect(retrieved!.hash).toBe('sha256-hash-signature');
    });

    it('deletes progress record when removeFileProgress is called', async () => {
      const progress: FileProgress = {
        id: 'file-transfer-1',
        peerId: 'peer-alice',
        name: 'vacation.png',
        size: 100,
        mimeType: 'image/png',
        totalChunks: 2,
        receivedChunks: [0],
        hash: 'hash',
      };

      await saveFileProgress(progress);
      await removeFileProgress('file-transfer-1');

      const retrieved = await getFileProgress('file-transfer-1');
      expect(retrieved).toBeNull();
    });

    it('persists, retrieves and deletes raw binary file chunks', async () => {
      const fileId = 'resumable-file-id';
      const chunk0 = new Uint8Array([1, 2, 3]);
      const chunk1 = new Uint8Array([4, 5, 6]);

      await saveTempChunk(fileId, 0, chunk0);
      await saveTempChunk(fileId, 1, chunk1);

      const retrieved = await getTempChunks(fileId);
      expect(retrieved).toHaveLength(2);
      
      const first = retrieved.find(c => c.chunkIndex === 0);
      const second = retrieved.find(c => c.chunkIndex === 1);
      
      expect(first).toBeDefined();
      expect(first!.data).toEqual(chunk0);
      expect(second).toBeDefined();
      expect(second!.data).toEqual(chunk1);

      await clearTempChunks(fileId);
      const remaining = await getTempChunks(fileId);
      expect(remaining).toHaveLength(0);
    });
  });
});
