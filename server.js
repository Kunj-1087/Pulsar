// server.js — WebSocket signaling server for Quark P2P chat
// Supports both online mode (with rate limiting) and offline LAN mode (relaxed limits)
// Usage: node server.js
// 
// Environment variables:
//   OFFLINE_MODE: Set to "true" to run in offline LAN mode with relaxed rate limiting
//   HTTPS_ENABLED: Set to "true" to run over HTTPS/WSS (requires TLS_CERT_PATH and TLS_KEY_PATH)
//   TLS_CERT_PATH: Path to PEM-encoded TLS certificate
//   TLS_KEY_PATH: Path to PEM-encoded TLS private key
//   SIGNALING_PORT: Port to bind to (default: 8080)

const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');

function getLanIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    // Skip virtual adapters by name
    const nameLower = name.toLowerCase();
    if (
      nameLower.includes('vmware') ||
      nameLower.includes('virtualbox') ||
      nameLower.includes('docker') ||
      nameLower.includes('vethernet') ||
      nameLower.includes('loopback')
    ) continue;

    for (const iface of interfaces[name]) {
      // IPv4 only, not internal loopback
      if (iface.family !== 'IPv4' || iface.internal) continue;

      const ip = iface.address;

      // Skip link-local (APIPA — means no DHCP assigned)
      if (ip.startsWith('169.254.')) continue;

      // Skip Docker bridge range
      if (ip.startsWith('172.17.') || ip.startsWith('172.18.')) continue;

      // Prefer 192.168.x.x (home/office WiFi) first
      if (ip.startsWith('192.168.')) {
        candidates.unshift({ ip, name }); // push to front
      } else {
        candidates.push({ ip, name }); // 10.x.x.x etc go to back
      }
    }
  }

  return candidates.length > 0 ? candidates[0].ip : '127.0.0.1';
}

const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';

const CONCURRENT_CONN_LIMIT = Number(process.env.SIGNAL_MAX_CONCURRENT_CONN) || (OFFLINE_MODE ? 50 : 1000);
const IP_CONN_LIMIT = Number(process.env.SIGNAL_IP_CONN_LIMIT) || (OFFLINE_MODE ? 100 : 20);
const IP_JOIN_LIMIT = Number(process.env.SIGNAL_IP_JOIN_LIMIT) || (OFFLINE_MODE ? 50 : 10);
const SOCKET_MSG_LIMIT = Number(process.env.SIGNAL_SOCKET_MSG_LIMIT) || (OFFLINE_MODE ? 200 : 50);
const MAX_MESSAGE_SIZE = Number(process.env.SIGNAL_MAX_MESSAGE_SIZE) || 131072;
const WINDOW_MS = 60000;
const CONN_LIFETIME_MS = Number(process.env.SIGNAL_CONN_LIFETIME_MS) || (OFFLINE_MODE ? 86400000 : 3600000);
const ALLOWED_ORIGINS = (process.env.SIGNAL_ALLOWED_ORIGINS || '').split(',').filter(Boolean);

const SIGNALING_PORT = Number(process.env.SIGNALING_PORT) || 8080;

const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || './certs/lan-cert.pem';
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || './certs/lan-key.pem';

// Optional Redis Pub/Sub scaling setup
const REDIS_URL = process.env.REDIS_URL;
let pubClient = null;
let subClient = null;

if (REDIS_URL) {
  try {
    const Redis = require('ioredis');
    pubClient = new Redis(REDIS_URL);
    subClient = new Redis(REDIS_URL);
    console.log('[Quark] Redis scaling mode enabled. Connected to Redis Pub/Sub.');

    subClient.psubscribe('quark:peer:*', 'quark:room:*', (err) => {
      if (err) console.error('[Quark Redis] Subscription error:', err);
    });

    subClient.on('pmessage', (pattern, channel, messageStr) => {
      try {
        const payload = JSON.parse(messageStr);
        if (channel.startsWith('quark:peer:')) {
          const targetPeerId = channel.replace('quark:peer:', '');
          wss.clients.forEach((client) => {
            if (client.readyState === 1 && client._peerId === targetPeerId) {
              client.send(JSON.stringify(payload.data));
            }
          });
        } else if (channel.startsWith('quark:room:')) {
          const targetRoomId = channel.replace('quark:room:', '');
          wss.clients.forEach((client) => {
            if (client.readyState === 1 && client._roomId === targetRoomId && client._peerId !== payload.senderPeerId) {
              client.send(JSON.stringify(payload.data));
            }
          });
        }
      } catch (err) {
        console.error('[Quark Redis] Parse error on pmessage:', err);
      }
    });
  } catch (err) {
    console.warn('[Quark] Failed to initialize Redis scaling:', err.message);
  }
}

// Simple rolling window rate limiter for IP tracking
class RollingWindowLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.requests = new Map(); // key -> timestamps[]
  }

  isRateLimited(key) {
    const now = Date.now();
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    const times = this.requests.get(key);
    const validTimes = times.filter(t => now - t < this.windowMs);
    if (validTimes.length >= this.limit) {
      this.requests.set(key, validTimes);
      return true;
    }
    validTimes.push(now);
    this.requests.set(key, validTimes);
    return false;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, times] of this.requests.entries()) {
      const validTimes = times.filter(t => now - t < this.windowMs);
      if (validTimes.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimes);
      }
    }
  }
}

const LAN_IP = getLanIP();
const PORT = SIGNALING_PORT || 8080;

// Create HTTP server that also handles WebSocket upgrades
const httpServer = http.createServer((req, res) => {
  // CORS headers so browser can call this from any origin on the LAN
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/local-ip' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: LAN_IP }));
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      rooms: typeof rooms !== 'undefined' ? rooms.size : 0,
      uptime: process.uptime(),
      connections: typeof totalConnectedSockets !== 'undefined' ? totalConnectedSockets : 0,
    }));
    return;
  }

  // All other HTTP requests: 404
  res.writeHead(404);
  res.end('Not found');
});

const server = httpServer;
const wss = new WebSocketServer({ server: httpServer });

// rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map();

let totalConnectedSockets = 0;
const ipConnLimiter = new RollingWindowLimiter(IP_CONN_LIMIT, WINDOW_MS);
const ipJoinLimiter = new RollingWindowLimiter(IP_JOIN_LIMIT, WINDOW_MS);

// Cleanup interval to avoid memory leaks
const cleanupInterval = setInterval(() => {
  ipConnLimiter.cleanup();
  ipJoinLimiter.cleanup();
}, WINDOW_MS);

// Helper for structural logging without sensitive parameters
const logEvent = (event, clientIp, details = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [IP: ${clientIp}] ${event} ${details}`);
};

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  return req.socket.remoteAddress || 'unknown';
}

function isValidOrigin(req) {
  if (OFFLINE_MODE) return true;
  if (ALLOWED_ORIGINS.length === 0) return true;
  const origin = req.headers['origin'] || req.headers['sec-websocket-origin'] || '';
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

wss.on('connection', (ws, req) => {
  const clientIp = getClientIp(req);

  if (!isValidOrigin(req)) {
    logEvent('ORIGIN_REJECTED', clientIp, `Origin: ${req.headers['origin'] || 'none'}`);
    ws.close(4000, 'origin-rejected');
    return;
  }

  const connStartedAt = Date.now();

  // 1. Overall server connection limit check
  if (totalConnectedSockets >= CONCURRENT_CONN_LIMIT) {
    logEvent('CONN_REJECTED', clientIp, 'Server full');
    ws.close(4000, 'server-full');
    return;
  }

  // 2. Connection rate limiting check
  if (ipConnLimiter.isRateLimited(clientIp)) {
    logEvent('CONN_RATE_LIMITED', clientIp);
    ws.close(4029, 'rate-limited');
    return;
  }

  totalConnectedSockets++;
  ws.isAlive = true;
  let currentRoom = null;
  let msgCount = 0;
  let secStart = Date.now();

  logEvent('CONN_OPEN', clientIp, `Active connections: ${totalConnectedSockets}`);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (rawData) => {
    // 3. Per-socket message rate limiting check
    const now = Date.now();
    if (now - secStart >= 1000) {
      msgCount = 0;
      secStart = now;
    }
    msgCount++;
    if (msgCount > SOCKET_MSG_LIMIT) {
      logEvent('MSG_RATE_LIMITED', clientIp, `Disconnecting socket exceeding ${SOCKET_MSG_LIMIT}/s`);
      ws.close(4029, 'rate-limited');
      return;
    }

    // 4. Message size limit
    if (rawData.length > MAX_MESSAGE_SIZE) {
      logEvent('MSG_TOO_LARGE', clientIp, `Size: ${rawData.length}`);
      ws.close(4029, 'message-too-large');
      return;
    }

    // 5. Connection lifetime limit
    if (Date.now() - connStartedAt > CONN_LIFETIME_MS) {
      logEvent('CONN_LIFETIME_EXPIRED', clientIp);
      ws.close(4000, 'connection-expired');
      return;
    }

    try {
      const msg = JSON.parse(rawData.toString());
      if (!msg || typeof msg !== 'object') {
        logEvent('BAD_PAYLOAD', clientIp, 'Not an object');
        return;
      }

      const { type, roomId, peerId, toPeer, sdp, candidate } = msg;

      // 6. Validate string fields
      if (typeof type !== 'string' || type.length > 32) {
        logEvent('BAD_TYPE', clientIp, 'Type invalid or too long');
        return;
      }

      // Check allowed type strings
      const allowedTypes = ['join-room', 'offer', 'answer', 'ice-candidate'];
      if (!allowedTypes.includes(type)) {
        logEvent('UNKNOWN_TYPE', clientIp, `Dropping type: ${type}`);
        return;
      }

      if (roomId && (typeof roomId !== 'string' || roomId.length > 64)) {
        logEvent('BAD_ROOM_ID', clientIp, 'roomId too long');
        return;
      }
      if (peerId && (typeof peerId !== 'string' || peerId.length > 64)) {
        logEvent('BAD_PEER_ID', clientIp, 'peerId too long');
        return;
      }
      if (toPeer && (typeof toPeer !== 'string' || toPeer.length > 64)) {
        logEvent('BAD_TARGET_PEER_ID', clientIp, 'toPeer too long');
        return;
      }

      // 5. Room Code format validation (entropy L=8, clean case-insensitive charset)
      if (roomId && !/^[ABCDEFGHJKMNPQRSTVWXYZ2-9]{8}$/.test(roomId)) {
        logEvent('REJECTED_ROOM_CODE', clientIp, `Invalid layout: ${roomId}`);
        return;
      }

      // 6. SDP & ICE Candidate payload size bounding
      if (sdp) {
        const sdpString = typeof sdp === 'object' ? JSON.stringify(sdp) : String(sdp);
        if (sdpString.length > 65536) {
          logEvent('REJECTED_SDP_SIZE', clientIp, `Size: ${sdpString.length} bytes`);
          return;
        }
      }
      if (candidate) {
        const candString = typeof candidate === 'object' ? JSON.stringify(candidate) : String(candidate);
        if (candString.length > 2048) {
          logEvent('REJECTED_ICE_SIZE', clientIp, `Size: ${candString.length} bytes`);
          return;
        }
      }

      // 7. Route messages
      if (type === 'join-room') {
        // Room join rate limit check
        if (ipJoinLimiter.isRateLimited(clientIp)) {
          logEvent('ROOM_JOIN_RATE_LIMITED', clientIp);
          ws.close(4029, 'rate-limited');
          return;
        }

        currentRoom = roomId;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        const room = rooms.get(currentRoom);

        // Cleanup stale sockets for rejoining peers
        let staleSocket = null;
        room.forEach((peer) => {
          if (peer !== ws && peer._peerId === peerId) {
            staleSocket = peer;
          }
        });

        if (staleSocket) {
          logEvent('STALE_SOCKET_CLEANUP', clientIp, `Peer: ${peerId}`);
          room.delete(staleSocket);
          room.forEach((peer) => {
            if (peer !== ws && peer.readyState === 1) {
              peer.send(JSON.stringify({
                type: 'peer-left',
                peerId: peerId,
              }));
            }
          });
          staleSocket._roomId = null;
          staleSocket.close();
        }

        if (room.size >= 6) {
          logEvent('ROOM_FULL', clientIp, `Room: ${currentRoom}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'room-full',
          }));
          ws.close();
          return;
        }

        // Notify existing peers
        room.forEach((peer) => {
          if (peer !== ws && peer.readyState === 1) {
            peer.send(JSON.stringify({
              type: 'peer-joined',
              peerId: peerId,
            }));
          }
        });

        // Send existing list to new peer
        const existingPeers = [];
        room.forEach((peer) => {
          if (peer !== ws && peer._peerId) {
            existingPeers.push(peer._peerId);
          }
        });
        ws.send(JSON.stringify({
          type: 'room-joined',
          roomId: currentRoom,
          existingPeers,
        }));

        room.add(ws);
        ws._peerId = peerId;
        ws._roomId = currentRoom;
        logEvent('ROOM_JOIN', clientIp, `Room: ${currentRoom}, Peer: ${peerId}, Size: ${room.size}`);
      } else {
        // Relay to target peer
        let deliveredLocally = false;
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).forEach((peer) => {
            if (peer !== ws && peer.readyState === 1 && peer._peerId === toPeer) {
              peer.send(rawData.toString());
              deliveredLocally = true;
            }
          });
        }
        if (!deliveredLocally && toPeer && pubClient) {
          pubClient.publish(`quark:peer:${toPeer}`, JSON.stringify({ data: msg }));
        }
      }
    } catch (err) {
      logEvent('PARSE_ERROR', clientIp, err.message);
    }
  });

  ws.on('close', () => {
    totalConnectedSockets = Math.max(0, totalConnectedSockets - 1);
    logEvent('CONN_CLOSE', clientIp, `Active connections: ${totalConnectedSockets}`);

    if (ws._roomId && rooms.has(ws._roomId)) {
      const room = rooms.get(ws._roomId);
      const wasDeleted = room.delete(ws);
      if (wasDeleted) {
        room.forEach((peer) => {
          if (peer.readyState === 1) {
            peer.send(JSON.stringify({
              type: 'peer-left',
              peerId: ws._peerId,
            }));
          }
        });
        if (room.size === 0) {
          rooms.delete(ws._roomId);
          logEvent('ROOM_CLEANUP', clientIp, `Room: ${ws._roomId}`);
        } else {
          logEvent('ROOM_LEAVE', clientIp, `Room: ${ws._roomId}, Peer: ${ws._peerId}, Remaining: ${room.size}`);
        }
      }
    }
  });
});

// Active connection sweep (ping every 30s)
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      logEvent('PING_TIMEOUT', getClientIp(ws._socket || {}), 'Terminating inactive socket');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.on('close', () => {
  clearInterval(pingInterval);
  clearInterval(cleanupInterval);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██╗  ██╗');
  console.log('  ██╔═══██╗██║   ██║██╔══██╗██╔══██╗██║ ██╔╝');
  console.log('  ██║   ██║██║   ██║███████║██████╔╝█████╔╝ ');
  console.log('  ██║▄▄ ██║██║   ██║██╔══██║██╔══██╗██╔═██╗ ');
  console.log('  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██║  ██╗');
  console.log('   ╚══▀▀═╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝');
  console.log('');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Local:     http://localhost:3000`);
  console.log(`  Network:   http://${LAN_IP}:3000   ← share this`);
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Signaling: ws://${LAN_IP}:${PORT}`);
  console.log('');
  if (LAN_IP === '127.0.0.1') {
    console.log('  ⚠  WARNING: No LAN IP detected. LAN mode unavailable.');
    console.log('     Make sure you are connected to a WiFi or Ethernet network.');
  }
  console.log('');
});
