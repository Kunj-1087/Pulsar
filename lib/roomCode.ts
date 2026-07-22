const CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 8;

/**
 * Generates a unique 8-character alphanumeric room code.
 */
export function generateRoomCode(): string {
  let code = '';
  const randomValues = new Uint32Array(CODE_LENGTH);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) {
      randomValues[i] = Math.floor(Math.random() * 4294967296);
    }
  }

  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = randomValues[i] % CHARS.length;
    code += CHARS[index];
  }
  return code;
}

/**
 * Validates whether a code format is correct (6 or 8 characters, only allowed alphanumeric characters).
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || (code.length !== 6 && code.length !== 8)) {
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
