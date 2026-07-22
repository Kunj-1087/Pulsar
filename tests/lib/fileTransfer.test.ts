import { describe, it, expect } from 'vitest';
import {
  encodeBinaryFrame,
  decodeBinaryFrame,
  encodeEncryptedControlFrame,
  decodeEncryptedControlFrame,
  encodeEncryptedFileFrame,
  decodeEncryptedFileFrame,
  HEADER_SIZE,
} from '../../lib/fileTransfer';

describe('encodeBinaryFrame / decodeBinaryFrame', () => {
  const transferId = '550e8400-e29b-41d4-a716-446655440000';
  const chunkIndex = 42;
  const chunkData = new Uint8Array([0x10, 0x20, 0x30, 0x40, 0xff]);

  it('round-trips binary frame', () => {
    const frame = encodeBinaryFrame(transferId, chunkIndex, chunkData.buffer);
    const decoded = decodeBinaryFrame(frame);
    expect(decoded.transferId).toBe(transferId);
    expect(decoded.chunkIndex).toBe(chunkIndex);
    expect(Array.from(decoded.chunkData)).toEqual([0x10, 0x20, 0x30, 0x40, 0xff]);
  });

  it('encodes magic and version bytes correctly', () => {
    const frame = encodeBinaryFrame(transferId, chunkIndex, chunkData.buffer);
    const view = new DataView(frame);
    expect(view.getUint8(0)).toBe(0x51); // 'Q'
    expect(view.getUint8(1)).toBe(0x01); // Version 1
    expect(view.getUint8(2)).toBe(0x00); // Chunk Data type
  });

  it('encodes transfer ID at correct offset', () => {
    const frame = encodeBinaryFrame(transferId, chunkIndex, chunkData.buffer);
    const idBytes = new Uint8Array(frame, 3, 36);
    const decodedId = new TextDecoder().decode(idBytes);
    expect(decodedId.startsWith(transferId)).toBe(true);
  });

  it('encodes chunk index as big-endian 32-bit', () => {
    const frame = encodeBinaryFrame(transferId, 0x01020304, chunkData.buffer);
    const view = new DataView(frame);
    expect(view.getUint32(39, false)).toBe(0x01020304);
  });

  it('throws on frame too small', () => {
    const tiny = new ArrayBuffer(10);
    expect(() => decodeBinaryFrame(tiny)).toThrow();
  });

  it('throws on invalid magic byte', () => {
    const frame = encodeBinaryFrame(transferId, chunkIndex, chunkData.buffer);
    new Uint8Array(frame)[0] = 0x00;
    expect(() => decodeBinaryFrame(frame)).toThrow();
  });

  it('throws on unsupported frame type', () => {
    const frame = encodeBinaryFrame(transferId, chunkIndex, chunkData.buffer);
    new Uint8Array(frame)[2] = 0xFF;
    expect(() => decodeBinaryFrame(frame)).toThrow();
  });

  it('throws on payload size mismatch', () => {
    const frame = encodeBinaryFrame(transferId, chunkIndex, chunkData.buffer);
    const truncated = frame.slice(0, HEADER_SIZE + 2);
    expect(() => decodeBinaryFrame(truncated)).toThrow();
  });

  it('handles maximum transfer ID length', () => {
    const longId = 'a'.repeat(36);
    const frame = encodeBinaryFrame(longId, 0, chunkData.buffer);
    const decoded = decodeBinaryFrame(frame);
    expect(decoded.transferId).toBe(longId);
  });

  it('strips null padding from transfer ID', () => {
    const frame = encodeBinaryFrame('short-id', 0, chunkData.buffer);
    const decoded = decodeBinaryFrame(frame);
    expect(decoded.transferId).toBe('short-id');
  });
});

describe('encodeEncryptedControlFrame / decodeEncryptedControlFrame', () => {
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) iv[i] = i;
  const ciphertext = new Uint8Array([0xaa, 0xbb, 0xcc]);

  it('round-trips encrypted control frame', () => {
    const frame = encodeEncryptedControlFrame(iv, ciphertext);
    const decoded = decodeEncryptedControlFrame(frame);
    expect(Array.from(decoded.iv)).toEqual(Array.from(iv));
    expect(Array.from(decoded.ciphertext)).toEqual(Array.from(ciphertext));
  });

  it('has correct magic and type bytes', () => {
    const frame = encodeEncryptedControlFrame(iv, ciphertext);
    const view = new DataView(frame);
    expect(view.getUint8(0)).toBe(0x51);
    expect(view.getUint8(1)).toBe(0x01);
    expect(view.getUint8(2)).toBe(0x01); // Type 0x01
  });

  it('throws on frame too small', () => {
    const tiny = new ArrayBuffer(10);
    expect(() => decodeEncryptedControlFrame(tiny)).toThrow();
  });
});

describe('encodeEncryptedFileFrame / decodeEncryptedFileFrame', () => {
  const transferId = 'file-uuid-1234-5678';
  const chunkIndex = 7;
  const ciphertextLength = 64;
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) iv[i] = 0x10 + i;
  const ciphertext = new Uint8Array(64);
  for (let i = 0; i < 64; i++) ciphertext[i] = i;

  it('round-trips encrypted file frame', () => {
    const frame = encodeEncryptedFileFrame(transferId, chunkIndex, ciphertextLength, iv, ciphertext);
    const decoded = decodeEncryptedFileFrame(frame);
    expect(decoded.transferId).toBe(transferId);
    expect(decoded.chunkIndex).toBe(chunkIndex);
    expect(decoded.ciphertextLength).toBe(ciphertextLength);
    expect(Array.from(decoded.iv)).toEqual(Array.from(iv));
    expect(Array.from(decoded.ciphertext)).toEqual(Array.from(ciphertext));
  });

  it('has correct magic and type bytes', () => {
    const frame = encodeEncryptedFileFrame(transferId, chunkIndex, ciphertextLength, iv, ciphertext);
    const view = new DataView(frame);
    expect(view.getUint8(0)).toBe(0x51);
    expect(view.getUint8(1)).toBe(0x01);
    expect(view.getUint8(2)).toBe(0x02); // Type 0x02
  });

  it('throws on frame too small', () => {
    const tiny = new ArrayBuffer(50);
    expect(() => decodeEncryptedFileFrame(tiny)).toThrow();
  });
});

describe('HEADER_SIZE constant', () => {
  it('is 47 bytes for binary frames', () => {
    expect(HEADER_SIZE).toBe(47);
  });
});
