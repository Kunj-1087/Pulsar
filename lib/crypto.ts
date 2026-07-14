/**
 * SECURITY MODEL SUMMARY & THREAT MODEL BOUNDARIES:
 * 
 * What is protected:
 * - Message content is confidential between the two peers in each DataChannel. 
 *   Even if a TURN relay is used, the relay sees only ciphertext.
 * - File content and file metadata (name, size, type) are confidential.
 * - Message integrity is guaranteed by AES-GCM authentication tags. Tampering is detected.
 * - Forward secrecy is provided per connection because ephemeral ECDH keys are generated 
 *   per peer connection and never persisted.
 * - The signaling server cannot read application data because it only relays SDP and ICE, 
 *   not DataChannel traffic.
 * 
 * What is NOT protected in this phase:
 * - The signaling server sees SDP offers/answers, which contain IP addresses and DTLS 
 *   fingerprints. This is inherent to WebRTC and not solvable without a different architecture.
 * - Room codes are transmitted in plaintext to the signaling server. The server knows 
 *   which rooms exist and which peers are in them.
 * - Identity handles are local and self-asserted. There is no identity verification 
 *   infrastructure beyond the optional safety number.
 * - There is no protection against a malicious peer who is legitimately in the room. 
 *   E2EE protects the channel, not the endpoint.
 * - IndexedDB stores decrypted messages and files locally. Device compromise exposes 
 *   local history. This is intentional for usability.
 */

// Static public salt for HKDF key derivation (32 bytes)
const HKDF_SALT = new Uint8Array([
  0x70, 0x75, 0x6c, 0x73, 0x61, 0x72, 0x2d, 0x65,
  0x32, 0x65, 0x65, 0x2d, 0x73, 0x61, 0x6c, 0x74,
  0x2d, 0x76, 0x31, 0x2d, 0x73, 0x74, 0x61, 0x74,
  0x69, 0x63, 0x2d, 0x76, 0x61, 0x6c, 0x75, 0x65
]);

/**
 * Generates an ephemeral ECDH key pair on the P-256 curve.
 */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false, // Private key must be non-extractable
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Exports a public key to JSON Web Key (JWK) format.
 */
export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/**
 * Imports a remote public key from JWK format.
 */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // Extractable (allows re-exporting if needed for verification)
    []
  );
}

/**
 * Derives a 256-bit AES-GCM encryption key from local private key and remote public key.
 * Uses HKDF with a custom context binding containing lexicographically sorted peer IDs and roomId.
 */
export async function deriveAESGCMKey(
  privateKey: CryptoKey,
  remotePublicKey: CryptoKey,
  peerId1: string,
  peerId2: string,
  roomId: string
): Promise<CryptoKey> {
  // Step 1: Derive the shared secret master key from ECDH key agreement
  const masterSecret = await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: remotePublicKey,
    },
    privateKey,
    {
      name: 'HKDF',
    },
    false, // Non-extractable
    ['deriveKey']
  );

  // Step 2: Bind the context to prevent key reuse across protocols / sessions
  const sortedPeers = [peerId1, peerId2].sort();
  const infoString = `pulsar-e2ee-v1:${sortedPeers[0]}:${sortedPeers[1]}:${roomId}`;
  const infoBytes = new TextEncoder().encode(infoString);

  // Step 3: Derive final AES-GCM 256-bit key using HKDF (SHA-256)
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT,
      info: infoBytes,
    },
    masterSecret,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Non-extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext UTF-8 string message using AES-GCM.
 * Generates a fresh, random 12-byte IV for the operation.
 */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertextBuffer),
  };
}

/**
 * Decrypts an AES-GCM ciphertext message back to a UTF-8 string.
 */
export async function decryptMessage(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<string> {
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Encrypts a raw binary chunk payload using AES-GCM.
 * Generates a fresh, random 12-byte IV.
 */
export async function encryptChunk(
  key: CryptoKey,
  chunk: ArrayBuffer
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    chunk
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertextBuffer),
  };
}

/**
 * Decrypts an AES-GCM encrypted file chunk payload.
 */
export async function decryptChunk(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertext
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Derives a 6-digit verification code (Safety Number) from public keys of two peers.
 * Can be displayed out-of-band for identity checks.
 */
export async function deriveSafetyNumber(
  localJwk: JsonWebKey,
  remoteJwk: JsonWebKey
): Promise<string> {
  // Sort JWKs stably to ensure order symmetry on both peers
  const localStr = JSON.stringify(localJwk, Object.keys(localJwk).sort());
  const remoteStr = JSON.stringify(remoteJwk, Object.keys(remoteJwk).sort());
  const combinedStr = [localStr, remoteStr].sort().join(':');
  
  const encoded = new TextEncoder().encode(combinedStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = new Uint8Array(hashBuffer);

  // Derive a simple 6-digit numeric string from the hash bytes
  let value = 0;
  for (let i = 0; i < 4; i++) {
    value = (value << 8) | hashArray[i];
  }
  value = Math.abs(value) % 1000000;
  return value.toString().padStart(6, '0');
}
