import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  validateUrl,
  constantTimeCompare,
  zeroizeBuffer,
  sanitizeMessageText,
  validatePeerId,
} from '../../lib/security';

describe('sanitizeFilename', () => {
  it('replaces path separators with underscores', () => {
    expect(sanitizeFilename('../etc/passwd')).toBe('.._etc_passwd');
    expect(sanitizeFilename('C:\\Windows\\system32')).toBe('C__Windows_system32');
  });

  it('replaces dangerous characters', () => {
    expect(sanitizeFilename('file:*?"<>|')).toBe('file_______');
  });

  it('preserves valid filenames', () => {
    expect(sanitizeFilename('resume.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('photo (1).jpg')).toBe('photo (1).jpg');
    expect(sanitizeFilename('hello_world-v2.txt')).toBe('hello_world-v2.txt');
  });

  it('truncates names longer than 255 characters', () => {
    const long = 'a'.repeat(300);
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('returns "unnamed" for empty input after replacement', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
  });

  it('handles unicode filenames', () => {
    expect(sanitizeFilename('файл.pdf')).toBe('файл.pdf');
    expect(sanitizeFilename('中文文件.txt')).toBe('中文文件.txt');
  });

  it('strips null bytes', () => {
    expect(sanitizeFilename('file\x00.exe')).toBe('file.exe');
  });

  it('strips RTL override characters', () => {
    const rtlEvil = 'safe\u202Ecod.exe';
    const result = sanitizeFilename(rtlEvil);
    expect(result).toBe('safecod.exe');
  });

  it('strips control characters', () => {
    expect(sanitizeFilename('file\u0001\u0002test.txt')).toBe('filetest.txt');
  });
});

describe('validateUrl', () => {
  it('accepts http URLs', () => {
    expect(validateUrl('http://example.com')).toBe(true);
    expect(validateUrl('http://localhost:3000')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(validateUrl('https://quark.chat')).toBe(true);
    expect(validateUrl('https://192.168.1.1:8443')).toBe(true);
  });

  it('accepts ws URLs', () => {
    expect(validateUrl('ws://localhost:8080')).toBe(true);
  });

  it('accepts wss URLs', () => {
    expect(validateUrl('wss://signal.quark.chat')).toBe(true);
  });

  it('rejects javascript URLs', () => {
    expect(validateUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data URLs', () => {
    expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects file URLs', () => {
    expect(validateUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects vbscript URLs', () => {
    expect(validateUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('rejects strings longer than 2048 chars', () => {
    expect(validateUrl('http://a' + 'b'.repeat(2048))).toBe(false);
  });
});

describe('constantTimeCompare', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(constantTimeCompare('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(constantTimeCompare('', '')).toBe(true);
  });

  it('handles unicode correctly', () => {
    expect(constantTimeCompare('🚀quark', '🚀quark')).toBe(true);
    expect(constantTimeCompare('🚀quark', '🚀QUARK')).toBe(false);
  });
});

describe('zeroizeBuffer', () => {
  it('overwrites all bytes with zero', () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 255, 128, 64, 32]);
    zeroizeBuffer(buffer);
    for (let i = 0; i < buffer.length; i++) {
      expect(buffer[i]).toBe(0);
    }
  });

  it('handles an empty buffer', () => {
    const buffer = new Uint8Array(0);
    expect(() => zeroizeBuffer(buffer)).not.toThrow();
  });

  it('handles a large buffer efficiently', () => {
    const buffer = new Uint8Array(100000);
    buffer[50000] = 255;
    zeroizeBuffer(buffer);
    for (let i = 0; i < buffer.length; i++) {
      expect(buffer[i]).toBe(0);
    }
  });
});

describe('sanitizeMessageText', () => {
  it('removes control characters', () => {
    expect(sanitizeMessageText('hello\u0000world')).toBe('helloworld');
    expect(sanitizeMessageText('line1\u000Aline2')).toBe('line1line2');
  });

  it('trims whitespace', () => {
    expect(sanitizeMessageText('  hello  ')).toBe('hello');
  });

  it('preserves normal text', () => {
    expect(sanitizeMessageText('Hello, this is a normal message!')).toBe('Hello, this is a normal message!');
  });

  it('preserves emoji and unicode', () => {
    expect(sanitizeMessageText('Hello 🚀 Quark 安全')).toBe('Hello 🚀 Quark 安全');
  });
});

describe('validatePeerId', () => {
  it('accepts valid UUIDs', () => {
    expect(validatePeerId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validatePeerId('550e8400-e29b-41d4-a716-446655440000'.toUpperCase())).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(validatePeerId('not-a-uuid')).toBe(false);
    expect(validatePeerId('')).toBe(false);
    expect(validatePeerId('550e8400e29b41d4a716446655440000')).toBe(false);
    expect(validatePeerId('xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).toBe(false);
  });
});
