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
  
  // Clean port or trailing markers from WebRTC IP strings
  const cleanIp = ip.split(':')[0].trim();
  
  // RFC 1918 Private IPv4 Addresses, localhost, loopbacks, and link-local (169.254.x.x)
  const ipv4PrivateRegex = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|127\.0\.0\.1|169\.254\.\d+\.\d+|localhost)$/;
  // Unique Local Address (ULA fdxx::) or Loopback (::1) or Link-Local (fe80::)
  const ipv6PrivateRegex = /^(fd[0-9a-f]{2}:|fe80:|::1)/i;
  
  return ipv4PrivateRegex.test(cleanIp) || ipv6PrivateRegex.test(cleanIp) || cleanIp.endsWith('.local');
}
