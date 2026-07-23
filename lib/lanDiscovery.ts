export interface LanInfo {
  ip: string;
  available: boolean;
  error?: string;
}

/**
 * Fetches the host machine's LAN IP from the signaling server.
 * The signaling server exposes GET /local-ip which reads os.networkInterfaces().
 * This is the only reliable way to get the LAN IP from the browser.
 */
export async function fetchLanIP(): Promise<LanInfo> {
  try {
    // Always call localhost:8080 — this is called by the HOST's browser only,
    // which is always on the same machine as the signaling server.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const res = await fetch('http://localhost:8080/local-ip', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (!data.ip || data.ip === '127.0.0.1') {
      return {
        ip: '127.0.0.1',
        available: false,
        error: 'No LAN network detected. Connect to WiFi or Ethernet.',
      };
    }

    return { ip: data.ip, available: true };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ip: '127.0.0.1',
      available: false,
      error: isAbort
        ? 'Signaling server not running. Start it with: npm run signal'
        : 'Could not reach signaling server. Make sure it is running.',
    };
  }
}

/**
 * Builds the full LAN invite URL for a given room code.
 * This URL is what gets shared with joiners via QR code or copy-paste.
 */
export function buildInviteUrl(lanIP: string, roomCode: string): string {
  return `http://${lanIP}:3000/room/${roomCode}`;
}

/**
 * Checks whether the current page is being served from a LAN IP
 * (i.e. the user is a joiner who opened the invite URL)
 * vs being served from localhost (i.e. the user is the host).
 */
export function isJoiner(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}
