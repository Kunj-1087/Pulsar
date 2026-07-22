import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveAESGCMKey,
  encryptMessage,
  decryptMessage,
  encryptChunk,
  decryptChunk,
  deriveSafetyNumber,
  CRYPTO_PROTOCOL_VERSION,
} from '../../lib/crypto';

describe('generateECDHKeyPair', () => {
  it('generates a key pair with non-extractable private key', async () => {
    const pair = await generateECDHKeyPair();
    expect(pair.publicKey).toBeDefined();
    expect(pair.privateKey).toBeDefined();
    expect(pair.publicKey.type).toBe('public');
    expect(pair.privateKey.type).toBe('private');
    expect(pair.privateKey.extractable).toBe(false);
    expect(pair.publicKey.extractable).toBe(true);
  });

  it('private key is usable for deriveKey', async () => {
    const pair = await generateECDHKeyPair();
    expect(pair.privateKey.usages).toContain('deriveKey');
  });
});

describe('exportPublicKey / importPublicKey', () => {
  it('round-trips a public key through export and import', async () => {
    const pair = await generateECDHKeyPair();
    const jwk = await exportPublicKey(pair.publicKey);
    expect(jwk).toBeDefined();
    expect(jwk.crv).toBe('P-256');
    expect(jwk.kty).toBe('EC');
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();

    const imported = await importPublicKey(jwk);
    expect(imported.type).toBe('public');
    expect(imported.extractable).toBe(true);
    const exportedAgain = await exportPublicKey(imported);
    expect(exportedAgain.x).toBe(jwk.x);
    expect(exportedAgain.y).toBe(jwk.y);
  });
});

describe('deriveAESGCMKey', () => {
  it('derives identical keys on both sides of key agreement', async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();

    const aliceJwk = await exportPublicKey(alicePair.publicKey);
    const bobJwk = await exportPublicKey(bobPair.publicKey);
    const bobPub = await importPublicKey(bobJwk);
    const alicePub = await importPublicKey(aliceJwk);

    const aliceKey = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'alice', 'bob', 'ROOM123');
    const bobKey = await deriveAESGCMKey(bobPair.privateKey, alicePub, 'alice', 'bob', 'ROOM123');
    expect(aliceKey).toBeDefined();
    expect(bobKey).toBeDefined();

    const testMsg = 'hello symmetric world';
    const { iv, ciphertext } = await encryptMessage(aliceKey, testMsg);
    const decrypted = await decryptMessage(bobKey, iv, ciphertext);
    expect(decrypted).toBe(testMsg);
  });

  it('produces different keys for different rooms', async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const bobPub = await importPublicKey(await exportPublicKey(bobPair.publicKey));
    const alicePub = await importPublicKey(await exportPublicKey(alicePair.publicKey));

    const keyA = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'a', 'b', 'ROOM_A');
    const keyB = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'a', 'b', 'ROOM_B');
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys with and without room password', async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const bobPub = await importPublicKey(await exportPublicKey(bobPair.publicKey));

    const keyNoPw = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'a', 'b', 'ROOM', undefined);
    const keyWithPw = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'a', 'b', 'ROOM', 'secret123');
    expect(keyNoPw).not.toBe(keyWithPw);
  });

  it('produces identical keys when password is the same', async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const bobPub = await importPublicKey(await exportPublicKey(bobPair.publicKey));
    const alicePub = await importPublicKey(await exportPublicKey(alicePair.publicKey));

    const keyA = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'a', 'b', 'ROOM', 'shared-pw');
    const keyB = await deriveAESGCMKey(bobPair.privateKey, alicePub, 'a', 'b', 'ROOM', 'shared-pw');
    expect(keyA).toBeDefined();
    expect(keyB).toBeDefined();
    const { iv, ciphertext } = await encryptMessage(keyA, 'password-protected');
    const decrypted = await decryptMessage(keyB, iv, ciphertext);
    expect(decrypted).toBe('password-protected');
  });
});

describe('encryptMessage / decryptMessage', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const bobPub = await importPublicKey(await exportPublicKey(bobPair.publicKey));
    key = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'alice', 'bob', 'TEST');
  });

  it('round-trips a simple string', async () => {
    const text = 'Hello, secure world!';
    const { iv, ciphertext } = await encryptMessage(key, text);
    const decrypted = await decryptMessage(key, iv, ciphertext);
    expect(decrypted).toBe(text);
  });

  it('round-trips empty string', async () => {
    const { iv, ciphertext } = await encryptMessage(key, '');
    const decrypted = await decryptMessage(key, iv, ciphertext);
    expect(decrypted).toBe('');
  });

  it('round-trips unicode characters', async () => {
    const text = '🚀 Quark クォーク 安全 ✅ áéíóú ñ 中文';
    const { iv, ciphertext } = await encryptMessage(key, text);
    const decrypted = await decryptMessage(key, iv, ciphertext);
    expect(decrypted).toBe(text);
  });

  it('round-trips a large payload (10KB)', async () => {
    const text = 'x'.repeat(10240);
    const { iv, ciphertext } = await encryptMessage(key, text);
    const decrypted = await decryptMessage(key, iv, ciphertext);
    expect(decrypted).toBe(text);
  });

  it('produces unique ciphertext for the same plaintext (fresh IV)', async () => {
    const text = 'same text each time';
    const result1 = await encryptMessage(key, text);
    const result2 = await encryptMessage(key, text);
    expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    expect(result1.iv).not.toEqual(result2.iv);
  });

  it('fails decryption with wrong key', async () => {
    const text = 'secret message';
    const { iv, ciphertext } = await encryptMessage(key, text);

    const attackerPair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const bobPub = await importPublicKey(await exportPublicKey(bobPair.publicKey));
    const wrongKey = await deriveAESGCMKey(attackerPair.privateKey, bobPub, 'attacker', 'bob', 'TEST');

    await expect(decryptMessage(wrongKey, iv, ciphertext)).rejects.toThrow();
  });

  it('fails decryption with tampered ciphertext', async () => {
    const { iv, ciphertext } = await encryptMessage(key, 'important data');
    ciphertext[5] ^= 0xff;
    await expect(decryptMessage(key, iv, ciphertext)).rejects.toThrow();
  });

  it('fails decryption with wrong IV', async () => {
    const { iv, ciphertext } = await encryptMessage(key, 'data');
    iv[0] ^= 0x01;
    await expect(decryptMessage(key, iv, ciphertext)).rejects.toThrow();
  });
});

describe('encryptChunk / decryptChunk', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const bobPub = await importPublicKey(await exportPublicKey(bobPair.publicKey));
    key = await deriveAESGCMKey(alicePair.privateKey, bobPub, 'a', 'b', 'CHUNK_TEST');
  });

  it('round-trips binary data', async () => {
    const data = new Uint8Array([0, 1, 2, 3, 255, 254, 253, 252]).buffer;
    const { iv, ciphertext } = await encryptChunk(key, data);
    const decrypted = await decryptChunk(key, iv, ciphertext);
    expect(Array.from(decrypted)).toEqual([0, 1, 2, 3, 255, 254, 253, 252]);
  });

  it('round-trips large binary data (64KB)', async () => {
    const data = new Uint8Array(65536);
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    const { iv, ciphertext } = await encryptChunk(key, data.buffer);
    expect(ciphertext.length).toBeGreaterThan(65536);
    const decrypted = await decryptChunk(key, iv, ciphertext);
    expect(decrypted.length).toBe(65536);
    for (let i = 0; i < 65536; i++) {
      expect(decrypted[i]).toBe(i & 0xff);
    }
  });

  it('fails decryption of tampered encrypted chunk', async () => {
    const data = new TextEncoder().encode('file-content').buffer;
    const { iv, ciphertext } = await encryptChunk(key, data);
    ciphertext[10] ^= 0xaa;
    await expect(decryptChunk(key, iv, ciphertext)).rejects.toThrow();
  });
});

describe('deriveSafetyNumber', () => {
  it('produces a 6-digit string', async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const aliceJwk = await exportPublicKey(alicePair.publicKey);
    const bobJwk = await exportPublicKey(bobPair.publicKey);

    const num = await deriveSafetyNumber(aliceJwk, bobJwk);
    expect(num).toMatch(/^\d{6}$/);
  });

  it('produces the same number from both sides (Alice vs Bob perspective)', async () => {
    const alicePair = await generateECDHKeyPair();
    const bobPair = await generateECDHKeyPair();
    const aliceJwk = await exportPublicKey(alicePair.publicKey);
    const bobJwk = await exportPublicKey(bobPair.publicKey);

    const fromAlice = await deriveSafetyNumber(aliceJwk, bobJwk);
    const fromBob = await deriveSafetyNumber(bobJwk, aliceJwk);
    expect(fromAlice).toBe(fromBob);
  });

  it('produces different numbers for different key pairs', async () => {
    const a1 = await generateECDHKeyPair();
    const b1 = await generateECDHKeyPair();
    const a2 = await generateECDHKeyPair();
    const b2 = await generateECDHKeyPair();

    const num1 = await deriveSafetyNumber(
      await exportPublicKey(a1.publicKey),
      await exportPublicKey(b1.publicKey),
    );
    const num2 = await deriveSafetyNumber(
      await exportPublicKey(a2.publicKey),
      await exportPublicKey(b2.publicKey),
    );
    expect(num1).not.toBe(num2);
  });

  it('is deterministic given the same keys', async () => {
    const aPair = await generateECDHKeyPair();
    const bPair = await generateECDHKeyPair();
    const aJwk = await exportPublicKey(aPair.publicKey);
    const bJwk = await exportPublicKey(bPair.publicKey);

    const first = await deriveSafetyNumber(aJwk, bJwk);
    for (let i = 0; i < 10; i++) {
      expect(await deriveSafetyNumber(aJwk, bJwk)).toBe(first);
    }
  });
});

describe('CRYPTO_PROTOCOL_VERSION', () => {
  it('is exported as a number', () => {
    expect(typeof CRYPTO_PROTOCOL_VERSION).toBe('number');
    expect(CRYPTO_PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
  });
});
