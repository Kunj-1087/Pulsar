import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateId, isPrivateIP, isOfflineMode, getSignalingUrl, formatBytes, formatTime, cn } from '../../lib/utils';

describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('formatTime', () => {
  it('formats a timestamp to HH:MM', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = formatTime(date.getTime());
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });
});

describe('isPrivateIP', () => {
  it('detects 10.x.x.x', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
  });

  it('detects 192.168.x.x', () => {
    expect(isPrivateIP('192.168.1.100')).toBe(true);
  });

  it('detects 172.16-31.x.x', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
  });

  it('detects 127.0.0.1', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
  });

  it('detects link-local', () => {
    expect(isPrivateIP('169.254.1.1')).toBe(true);
  });

  it('detects IPv6 ULA', () => {
    expect(isPrivateIP('fd12:3456::1')).toBe(true);
  });

  it('detects IPv6 loopback', () => {
    expect(isPrivateIP('::1')).toBe(true);
  });

  it('detects localhost string', () => {
    expect(isPrivateIP('localhost')).toBe(true);
  });

  it('rejects public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isPrivateIP('')).toBe(false);
  });
});

describe('isOfflineMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true when NEXT_PUBLIC_OFFLINE_MODE is true', () => {
    process.env.NEXT_PUBLIC_OFFLINE_MODE = 'true';
    expect(isOfflineMode()).toBe(true);
  });

  it('returns false when NEXT_PUBLIC_OFFLINE_MODE is false', () => {
    process.env.NEXT_PUBLIC_OFFLINE_MODE = 'false';
    expect(isOfflineMode()).toBe(false);
  });

  it('returns false when not set', () => {
    delete process.env.NEXT_PUBLIC_OFFLINE_MODE;
    expect(isOfflineMode()).toBe(false);
  });
});

describe('getSignalingUrl', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OFFLINE_MODE = 'false';
    delete process.env.NEXT_PUBLIC_SIGNALING_WS_URL;
    delete process.env.NEXT_PUBLIC_SIGNALING_PORT;
  });

  it('returns empty string when called server-side', () => {
    const windowSpy = vi.spyOn(globalThis as any, 'window', 'get');
    windowSpy.mockReturnValue(undefined);
    expect(getSignalingUrl()).toBe('');
    windowSpy.mockRestore();
  });
});
