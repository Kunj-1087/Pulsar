import { DataChannelMessage } from '../types';

const CHUNK_SIZE = Number(process.env.NEXT_PUBLIC_CHUNK_SIZE_BYTES) || 16384; // 16KB default
const BUFFER_THRESHOLD = 1024 * 1024; // 1MB threshold for flow control

/**
 * Converts an ArrayBuffer to a Base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Sends a file over an RTCDataChannel in chunks with backpressure handling.
 */
export async function sendFile(
  channel: RTCDataChannel,
  fileId: string,
  file: File,
  senderName: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // Set the threshold for bufferedamountlow event
  channel.bufferedAmountLowThreshold = 65536; // 64KB

  // 1. Send file metadata
  const metaMsg: DataChannelMessage = {
    type: 'file-meta',
    id: fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    sender: senderName,
  };
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

  for (chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    // Flow control: if the channel's output buffer is full, wait for it to clear
    if (channel.bufferedAmount > BUFFER_THRESHOLD) {
      await new Promise<void>((resolve) => {
        const handleLow = () => {
          channel.removeEventListener('bufferedamountlow', handleLow);
          resolve();
        };
        channel.addEventListener('bufferedamountlow', handleLow);
      });
    }

    try {
      const arrayBuffer = await readNextChunk();
      const base64Chunk = arrayBufferToBase64(arrayBuffer);
      
      const chunkMsg: DataChannelMessage = {
        type: 'file-chunk',
        id: fileId,
        chunk: base64Chunk,
        index: chunkIndex,
      };
      
      channel.send(JSON.stringify(chunkMsg));
      onProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
    } catch (err) {
      console.error(`Error sending chunk ${chunkIndex} of file ${file.name}:`, err);
      throw err;
    }
  }

  // 3. Send file complete message
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
  chunks: string[];
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
   * Stores an incoming base64 chunk.
   */
  receiveChunk(index: number, base64Chunk: string): void {
    if (index >= 0 && index < this.totalChunks && !this.chunks[index]) {
      this.chunks[index] = base64Chunk;
      this.receivedChunksCount++;
    }
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
   * Compiles the stored base64 chunks into a single Blob.
   */
  assemble(): Blob {
    const byteArrays = this.chunks.map((base64, idx) => {
      if (base64 === undefined) {
        throw new Error(`Cannot assemble: missing chunk index ${idx}`);
      }
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    });
    
    return new Blob(byteArrays, { type: this.mimeType });
  }
}
