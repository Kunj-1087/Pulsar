import { DataChannelMessage } from '../types';
import { encryptChunk } from './crypto';
import { saveTempChunk, getTempChunks, clearTempChunks } from './storage';

export const HEADER_SIZE = 47;

export interface BinaryFrame {
  transferId: string;
  chunkIndex: number;
  chunkData: Uint8Array;
}

/**
 * Encodes a chunk data payload into a binary frame with a 47-byte header.
 * Byte Layout:
 * - Bytes 0-1 (2 bytes): Magic byte 0x51 ('Q') and Version byte 0x01
 * - Byte 2 (1 byte): Frame-type byte (0x00 = Chunk Data)
 * - Bytes 3-38 (36 bytes): Transfer ID (ASCII string of UUID, null-padded)
 * - Bytes 39-42 (4 bytes): Chunk Index (32-bit big-endian unsigned integer)
 * - Bytes 43-46 (4 bytes): Chunk Length (32-bit big-endian unsigned integer)
 * - Bytes 47+: Raw chunk bytes
 */
export function encodeBinaryFrame(transferId: string, chunkIndex: number, chunkData: ArrayBuffer | Uint8Array): ArrayBuffer {
  const transferIdBytes = new TextEncoder().encode(transferId);
  const chunkByteLength = chunkData.byteLength;
  const headerBuffer = new ArrayBuffer(HEADER_SIZE + chunkByteLength);
  const headerView = new DataView(headerBuffer);
  const uint8View = new Uint8Array(headerBuffer);

  headerView.setUint8(0, 0x51); // Magic 'Q'
  headerView.setUint8(1, 0x01); // Version 1
  headerView.setUint8(2, 0x00); // Frame-type (Chunk Data)

  // Write transfer ID (up to 36 bytes) starting at byte index 3
  const writeLen = Math.min(transferIdBytes.length, 36);
  uint8View.set(transferIdBytes.subarray(0, writeLen), 3);

  headerView.setUint32(39, chunkIndex, false); // Big-endian
  headerView.setUint32(43, chunkByteLength, false); // Big-endian

  const payloadBytes = chunkData instanceof Uint8Array ? chunkData : new Uint8Array(chunkData);
  uint8View.set(payloadBytes, HEADER_SIZE);
  return headerBuffer;
}

/**
 * Decodes a binary frame, returning the transferId, chunkIndex, and chunkData view.
 */
export function decodeBinaryFrame(arrayBuffer: ArrayBuffer): BinaryFrame {
  if (arrayBuffer.byteLength < HEADER_SIZE) {
    throw new Error('[Quark FileTransfer] Binary frame is too small');
  }

  const view = new DataView(arrayBuffer);
  const magic = view.getUint8(0);
  const version = view.getUint8(1);
  const type = view.getUint8(2);

  if (magic !== 0x51 || version !== 0x01) {
    throw new Error(`[Quark FileTransfer] Invalid magic (0x${magic.toString(16)}) or version (${version})`);
  }
  if (type !== 0x00) {
    throw new Error(`[Quark FileTransfer] Unsupported frame type: 0x${type.toString(16)}`);
  }

  // Extract transferId (bytes 3 to 38)
  const transferIdBytes = new Uint8Array(arrayBuffer, 3, 36);
  let transferId = new TextDecoder().decode(transferIdBytes);
  const nullIdx = transferId.indexOf('\0');
  if (nullIdx !== -1) {
    transferId = transferId.substring(0, nullIdx);
  }
  transferId = transferId.trim().replace(/\0/g, '');

  const chunkIndex = view.getUint32(39, false); // Big-endian
  const chunkLength = view.getUint32(43, false); // Big-endian

  if (HEADER_SIZE + chunkLength !== arrayBuffer.byteLength) {
    throw new Error(`[Quark FileTransfer] Frame payload size mismatch. Expected ${chunkLength}, buffer has ${arrayBuffer.byteLength - HEADER_SIZE}`);
  }

  // Slice a view over the existing buffer to prevent memory duplication
  const chunkData = new Uint8Array(arrayBuffer, HEADER_SIZE, chunkLength);
  return { transferId, chunkIndex, chunkData };
}

/**
 * Encodes an encrypted control frame (Type 0x01).
 */
export function encodeEncryptedControlFrame(iv: Uint8Array, ciphertext: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(15 + ciphertext.byteLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  view.setUint8(0, 0x51); // 'Q'
  view.setUint8(1, 0x01); // Version 1
  view.setUint8(2, 0x01); // Type 0x01: Encrypted control message

  uint8.set(iv, 3);
  uint8.set(ciphertext, 15);
  return buffer;
}

/**
 * Decodes an encrypted control frame (Type 0x01).
 */
export function decodeEncryptedControlFrame(buffer: ArrayBuffer): { iv: Uint8Array; ciphertext: Uint8Array } {
  if (buffer.byteLength < 15) {
    throw new Error('[Quark FileTransfer] Encrypted control frame too small');
  }
  const iv = new Uint8Array(buffer, 3, 12);
  const ciphertext = new Uint8Array(buffer, 15, buffer.byteLength - 15);
  return { iv, ciphertext };
}

/**
 * Encodes an encrypted file chunk frame (Type 0x02).
 */
export function encodeEncryptedFileFrame(
  transferId: string,
  chunkIndex: number,
  ciphertextLength: number,
  iv: Uint8Array,
  ciphertext: Uint8Array
): ArrayBuffer {
  const transferIdBytes = new TextEncoder().encode(transferId);
  const buffer = new ArrayBuffer(59 + ciphertext.byteLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  view.setUint8(0, 0x51); // 'Q'
  view.setUint8(1, 0x01); // Version 1
  view.setUint8(2, 0x02); // Type 0x02: Encrypted file chunk

  // Write transfer ID (up to 36 bytes) starting at byte index 3
  const writeLen = Math.min(transferIdBytes.length, 36);
  uint8.set(transferIdBytes.subarray(0, writeLen), 3);

  view.setUint32(39, chunkIndex, false); // Big-endian
  view.setUint32(43, ciphertextLength, false); // Big-endian

  uint8.set(iv, 47);
  uint8.set(ciphertext, 59);
  return buffer;
}

/**
 * Decodes an encrypted file chunk frame (Type 0x02).
 */
export function decodeEncryptedFileFrame(buffer: ArrayBuffer): {
  transferId: string;
  chunkIndex: number;
  ciphertextLength: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
} {
  if (buffer.byteLength < 59) {
    throw new Error('[Quark FileTransfer] Encrypted file frame too small');
  }
  const view = new DataView(buffer);
  const transferIdBytes = new Uint8Array(buffer, 3, 36);
  let transferId = new TextDecoder().decode(transferIdBytes);
  const nullIdx = transferId.indexOf('\0');
  if (nullIdx !== -1) {
    transferId = transferId.substring(0, nullIdx);
  }
  transferId = transferId.trim().replace(/\0/g, '');

  const chunkIndex = view.getUint32(39, false);
  const ciphertextLength = view.getUint32(43, false);

  const iv = new Uint8Array(buffer, 47, 12);
  const ciphertext = new Uint8Array(buffer, 59, buffer.byteLength - 59);

  return { transferId, chunkIndex, ciphertextLength, iv, ciphertext };
}

/**
 * Sends a file over an RTCDataChannel in chunks using the binary protocol.
 */
export async function calculateFileHash(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sendFile(
  channel: RTCDataChannel,
  fileId: string,
  file: File,
  senderName: string,
  onProgress: (progress: number) => void,
  isCancelled: () => boolean,
  checkBackpressure: () => Promise<void>,
  encryptionKey?: CryptoKey,
  skippedChunks?: number[],
  hash?: string
): Promise<void> {
  const maxMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 100;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File size exceeds maximum allowed limit of ${maxMb}MB`);
  }

  const sanitizedName = file.name.replace(/[\/\x00-\x1F\x7F]/g, '_').substring(0, 255);

  const rawChunkSize = Number(process.env.NEXT_PUBLIC_CHUNK_SIZE_BYTES) || 16384;
  const CLAMP_MIN = 1024;
  const CLAMP_MAX = 65536; // 64KB safe upper bound
  const CHUNK_SIZE = Math.min(Math.max(rawChunkSize, CLAMP_MIN), CLAMP_MAX);

  if (rawChunkSize < CLAMP_MIN || rawChunkSize > CLAMP_MAX) {
    console.warn(`[Quark FileTransfer] Configured chunk size ${rawChunkSize} is out of safe bounds. Clamped to ${CHUNK_SIZE}.`);
  }

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Derive file hash for integrity checks if not already provided
  const fileHash = hash || await calculateFileHash(file);

  // 1. Send file metadata (JSON control string)
  const metaMsg: DataChannelMessage = {
    type: 'file-meta',
    id: fileId,
    name: sanitizedName,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    sender: senderName,
    hash: fileHash,
  };
  // Note: the metaMsg itself will be encrypted if sent via our encrypted control channel path in ChatWindow,
  // but here it represents metadata channel messaging structure.
  channel.send(JSON.stringify(metaMsg));

  // 2. Read and send file in chunks
  const fileReader = new FileReader();
  let chunkIndex = 0;

  const readNextChunk = (): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      fileReader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          resolve(e.target.result);
        } else {
          reject(new Error('Failed to read chunk as ArrayBuffer'));
        }
      };
      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsArrayBuffer(blob);
    });
  };

  let progressCount = skippedChunks ? skippedChunks.length : 0;

  for (chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    // Check cancellation signal
    if (isCancelled()) {
      throw new Error('Transfer cancelled');
    }

    if (skippedChunks && skippedChunks.includes(chunkIndex)) {
      continue;
    }

    // Await backpressure resolution if output buffer is full
    await checkBackpressure();

    try {
      const arrayBuffer = await readNextChunk();
      
      let frame: ArrayBuffer;
      if (encryptionKey) {
        const { iv, ciphertext } = await encryptChunk(encryptionKey, arrayBuffer);
        frame = encodeEncryptedFileFrame(fileId, chunkIndex, ciphertext.byteLength, iv, ciphertext);
      } else {
        frame = encodeBinaryFrame(fileId, chunkIndex, arrayBuffer);
      }
      
      channel.send(frame);
      progressCount++;
      onProgress(Math.round((progressCount / totalChunks) * 100));
    } catch (err) {
      console.error(`[Quark FileTransfer] Error sending chunk ${chunkIndex} of file ${file.name}:`, err);
      throw err;
    }
  }

  // 3. Send file complete message (JSON control string)
  const completeMsg: DataChannelMessage = {
    type: 'file-complete',
    id: fileId,
  };
  channel.send(JSON.stringify(completeMsg));
}

/**
 * Manages chunk reception and reassembly for incoming file transfers.
 */
export class FileReceiver {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunks: Uint8Array[];
  receivedChunksCount: number;

  constructor(id: string, name: string, size: number, mimeType: string, totalChunks: number) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.mimeType = mimeType;
    this.totalChunks = totalChunks;
    this.chunks = new Array(totalChunks);
    this.receivedChunksCount = 0;
  }

  /**
   * Stores an incoming binary chunk.
   */
  receiveChunk(index: number, chunkBytes: Uint8Array): void {
    if (index >= 0 && index < this.totalChunks && !this.chunks[index]) {
      this.chunks[index] = chunkBytes;
      this.receivedChunksCount++;
      // Asynchronously store temp chunk in DB
      saveTempChunk(this.id, index, chunkBytes).catch((err) => {
        console.error('[Quark FileReceiver] Failed to save chunk to Dexie:', err);
      });
    }
  }

  /**
   * Pre-loads chunks already stored in Dexie.
   */
  async loadFromDB(): Promise<void> {
    const saved = await getTempChunks(this.id);
    for (const chunk of saved) {
      if (chunk.chunkIndex >= 0 && chunk.chunkIndex < this.totalChunks) {
        this.chunks[chunk.chunkIndex] = chunk.data;
      }
    }
    this.receivedChunksCount = this.chunks.filter((c) => c !== undefined).length;
  }

  /**
   * Clean up database records once file is assembled or cancelled.
   */
  clearFromDB(): void {
    clearTempChunks(this.id).catch((err) => {
      console.error('[Quark FileReceiver] Failed to clear temp chunks:', err);
    });
  }

  /**
   * Returns progress percentage (0 - 100).
   */
  getProgress(): number {
    if (this.totalChunks === 0) return 0;
    return Math.round((this.receivedChunksCount / this.totalChunks) * 100);
  }

  /**
   * Checks if all chunks have been received.
   */
  isComplete(): boolean {
    return this.receivedChunksCount === this.totalChunks;
  }

  /**
   * Compiles the stored binary chunks into a single Blob.
   */
  assemble(): Blob {
    for (let i = 0; i < this.totalChunks; i++) {
      if (this.chunks[i] === undefined) {
        throw new Error(`[Quark FileTransfer] Cannot assemble: missing chunk index ${i}`);
      }
    }
    return new Blob(this.chunks as BlobPart[], { type: this.mimeType });
  }
}
