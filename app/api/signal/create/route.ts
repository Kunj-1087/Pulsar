import { NextResponse, NextRequest } from 'next/server';
import { generateRoomCode } from '../../../../lib/roomCode';

// Simple in-memory rate limiter
const LIMIT = 10;
const WINDOW_MS = 60000;
const ipRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = ipRequests.get(ip) || [];
  const validTimes = times.filter((t) => now - t < WINDOW_MS);
  if (validTimes.length >= LIMIT) {
    ipRequests.set(ip, validTimes);
    return true;
  }
  validTimes.push(now);
  ipRequests.set(ip, validTimes);
  return false;
}

// Clean up map every minute to avoid memory leaks
if (typeof global !== 'undefined') {
  const g = global as unknown as { __createRoomCleanupRegistered?: boolean };
  if (!g.__createRoomCleanupRegistered) {
    setInterval(() => {
      const now = Date.now();
      for (const [ip, times] of Array.from(ipRequests.entries())) {
        const validTimes = times.filter((t: number) => now - t < WINDOW_MS);
        if (validTimes.length === 0) {
          ipRequests.delete(ip);
        } else {
          ipRequests.set(ip, validTimes);
        }
      }
    }, WINDOW_MS);
    g.__createRoomCleanupRegistered = true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    if (isRateLimited(clientIp)) {
      console.warn(`[Quark API] Room creation rate limited for IP: ${clientIp}`);
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const roomId = generateRoomCode();
    return NextResponse.json({ roomId });
  } catch (error) {
    console.error('Failed to create room ID:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
