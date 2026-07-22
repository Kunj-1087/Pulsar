import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes dynamically using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats bytes into a human-readable file size string (e.g. 1.4 MB, 340 KB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i]}`;
}

/**
 * Formats a timestamp into HH:MM format.
 */
export function formatTime(ts: number): string {
  const date = new Date(ts);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Generates a cryptographically secure random UUID with a fallback.
 */
export function generateId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Checks if an IP address is a private (LAN) IP.
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;
  
  let cleanIp = ip.trim();

  // Handle WebRTC IPv6 format: [fd12::1]:port or [::1]:port
  if (cleanIp.startsWith('[')) {
    const bracketEnd = cleanIp.indexOf(']');
    if (bracketEnd !== -1) {
      cleanIp = cleanIp.slice(1, bracketEnd);
    }
  }
  // IPv6 addresses contain at least 2 colons (except ::1)
  else if ((cleanIp.match(/:/g) || []).length > 1 || cleanIp === '::1') {
    // Already a clean IPv6 address
  }
  // IPv4 with port: strip port after first colon
  else if (cleanIp.includes(':')) {
    cleanIp = cleanIp.split(':')[0];
  }

  // RFC 1918 Private IPv4 Addresses, localhost, loopbacks, and link-local (169.254.x.x)
  const ipv4PrivateRegex = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|127\.0\.0\.1|169\.254\.\d+\.\d+|localhost)$/;
  // Unique Local Address (ULA fdxx::) or Loopback (::1) or Link-Local (fe80::)
  const ipv6PrivateRegex = /^(fd[0-9a-f]{1,}:|fe80:|::1)/i;
  
  return ipv4PrivateRegex.test(cleanIp) || ipv6PrivateRegex.test(cleanIp) || cleanIp.endsWith('.local');
}

/**
 * Detects if offline LAN mode is enabled.
 * Returns true when NEXT_PUBLIC_OFFLINE_MODE === "true".
 * This function provides a single point of truth for offline mode detection.
 */
export function isOfflineMode(): boolean {
  // Safe to call on client-side; if called on server, env variables are used.
  if (typeof window === 'undefined') {
    // Server-side: check if OFFLINE_MODE env variable is set
    return process.env.OFFLINE_MODE === 'true';
  }
  
  // Client-side: check if NEXT_PUBLIC_OFFLINE_MODE is set
  return process.env.NEXT_PUBLIC_OFFLINE_MODE === 'true';
}

/**
 * Derives the signaling WebSocket URL for the application.
 * 
 * In offline mode or when NEXT_PUBLIC_SIGNALING_WS_URL is not set:
 * - Derives the URL from window.location (must be called client-side only)
 * - Uses the current protocol (ws:// or wss://)
 * - Uses the current hostname and port (with fallback to default)
 * 
 * In online mode when NEXT_PUBLIC_SIGNALING_WS_URL is set:
 * - Uses the configured environment variable
 * 
 * This ensures the client automatically works regardless of how the app was accessed.
 */
export function getSignalingUrl(): string {
  // Guard: must only be called client-side
  if (typeof window === 'undefined') {
    console.warn('[Signaling] getSignalingUrl() called server-side. Returning empty string.');
    return '';
  }

  // If online mode and NEXT_PUBLIC_SIGNALING_WS_URL is set, use it
  if (!isOfflineMode() && process.env.NEXT_PUBLIC_SIGNALING_WS_URL) {
    return process.env.NEXT_PUBLIC_SIGNALING_WS_URL;
  }

  // Otherwise, derive from window.location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  const port = process.env.NEXT_PUBLIC_SIGNALING_PORT || '8080';
  const path = '/signal';

  return `${protocol}//${hostname}:${port}${path}`;
}

/**
 * Migrates legacy 'pulsar_identity' and 'pulsar-displayName' localStorage keys
 * to their new 'quark_identity' and 'quark-displayName' equivalents.
 * Safe to call multiple times (idempotent). Removes old keys after migration.
 */
export function migrateLegacyStorage(): void {
  try {
    if (typeof window === 'undefined') return;

    // Migrate pulsar_identity → quark_identity
    const oldIdentity = localStorage.getItem('pulsar_identity');
    const newIdentity = localStorage.getItem('quark_identity');
    if (oldIdentity && !newIdentity) {
      localStorage.setItem('quark_identity', oldIdentity);
      localStorage.removeItem('pulsar_identity');
      console.log('[Quark Migration] Migrated pulsar_identity → quark_identity');
    } else if (oldIdentity && newIdentity) {
      // Both exist — remove stale old key
      localStorage.removeItem('pulsar_identity');
    }

    // Migrate pulsar-displayName → quark-displayName
    const oldDisplayName = localStorage.getItem('pulsar-displayName');
    const newDisplayName = localStorage.getItem('quark-displayName');
    if (oldDisplayName && !newDisplayName) {
      localStorage.setItem('quark-displayName', oldDisplayName);
      localStorage.removeItem('pulsar-displayName');
      console.log('[Quark Migration] Migrated pulsar-displayName → quark-displayName');
    } else if (oldDisplayName && newDisplayName) {
      localStorage.removeItem('pulsar-displayName');
    }

    // Migrate pulsar_install_prompt_dismissed → quark_install_prompt_dismissed
    const oldDismissed = sessionStorage.getItem('pulsar_install_prompt_dismissed');
    const newDismissed = sessionStorage.getItem('quark_install_prompt_dismissed');
    if (oldDismissed && !newDismissed) {
      sessionStorage.setItem('quark_install_prompt_dismissed', oldDismissed);
      sessionStorage.removeItem('pulsar_install_prompt_dismissed');
    } else if (oldDismissed && newDismissed) {
      sessionStorage.removeItem('pulsar_install_prompt_dismissed');
    }
  } catch (err) {
    console.warn('[Quark Migration] localStorage migration failed:', err);
  }
}

/**
 * Cleans up the legacy 'PulsarDB' IndexedDB database.
 * Safe to call multiple times (idempotent). Removes old database if it exists.
 */
export function cleanupLegacyDatabase(): void {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    // Try indexedDB.databases() first (not universally supported)
    if (typeof indexedDB.databases === 'function') {
      indexedDB.databases().then((databases) => {
        const hasLegacy = databases.some((db) => db.name === 'PulsarDB');
        if (hasLegacy) {
          indexedDB.deleteDatabase('PulsarDB');
          console.log('[Quark Migration] Deleted legacy PulsarDB IndexedDB database');
        }
      }).catch(() => {
        // Silently ignore — databases() not supported
      });
    } else {
      // Fallback: attempt to open and immediately delete
      try {
        const request = indexedDB.open('PulsarDB');
        request.onsuccess = () => {
          request.result.close();
          indexedDB.deleteDatabase('PulsarDB');
          console.log('[Quark Migration] Deleted legacy PulsarDB IndexedDB database (fallback)');
        };
        request.onerror = () => {
          // Database doesn't exist or can't be opened — nothing to do
        };
      } catch {
        // Ignore errors
      }
    }
  } catch (err) {
    console.warn('[Quark Migration] IndexedDB cleanup failed:', err);
  }
}
