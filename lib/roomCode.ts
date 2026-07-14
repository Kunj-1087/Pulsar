// Characters to use: A-Z and 2-9, excluding ambiguous letters/numbers:
// '0', 'O' (zero and capital O)
// '1', 'I', 'L' (one, capital I, capital L)
const CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/**
 * Increased CODE_LENGTH from 6 to 8.
 * Entropy Calculation:
 * - Character Set Size (N) = 30
 * - Length (L) = 8
 * - Total Unique Combinations = N^L = 30^8 = 656,100,000,000 (656 billion combinations).
 * This significantly prevents brute-force room enumeration attacks while retaining
 * case-insensitive, user-friendly room codes.
 */
const CODE_LENGTH = 8;

/**
 * Generates a unique 8-character alphanumeric room code.
 */
export function generateRoomCode(): string {
  let code = '';
  // Use crypto API for secure random numbers
  const randomValues = new Uint32Array(CODE_LENGTH);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomValues);
  } else {
    // Node.js fallback if run server-side
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    const bytes = crypto.randomBytes(CODE_LENGTH);
    for (let i = 0; i < CODE_LENGTH; i++) {
      randomValues[i] = bytes[i];
    }
  }

  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = randomValues[i] % CHARS.length;
    code += CHARS[index];
  }
  return code;
}

/**
 * Validates whether a code format is correct (8 characters, only allowed alphanumeric characters).
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || code.length !== CODE_LENGTH) {
    return false;
  }
  const cleanCode = code.toUpperCase();
  const allowedSet = new Set(CHARS.split(''));
  for (let i = 0; i < cleanCode.length; i++) {
    if (!allowedSet.has(cleanCode[i])) {
      return false;
    }
  }
  return true;
}
