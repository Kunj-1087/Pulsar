export function sanitizeFilename(name: string): string {
  let s = name.replace(/[/\\:*?"<>|]/g, '_');
  s = s.replace(/[\x00-\x1f\x7f-\x9f\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '');
  return s.substring(0, 255) || 'unnamed';
}

export function validateUrl(url: string): boolean {
  if (!url || url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:' ||
           parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let result = a.length ^ b.length;
    const min = Math.min(a.length, b.length);
    for (let i = 0; i < min; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return result === 0;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function zeroizeBuffer(buffer: Uint8Array): void {
  for (let i = 0; i < buffer.length; i++) buffer[i] = 0;
}

export function sanitizeMessageText(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

export function validatePeerId(id: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}
