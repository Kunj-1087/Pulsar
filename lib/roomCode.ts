// Characters to use: A-Z and 2-9, excluding ambiguous letters/numbers:
// '0', 'O' (zero and capital O)
// '1', 'I', 'L' (one, capital I, capital L)
const CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generates a unique 6-character alphanumeric room code.
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
 * Validates whether a code format is correct (6 characters, only allowed alphanumeric characters).
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
