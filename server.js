// server.js — run with: node server.js
const { WebSocketServer } = require('ws');
const http = require('http');

const CONCURRENT_CONN_LIMIT = Number(process.env.SIGNAL_MAX_CONCURRENT_CONN) || 1000;
const IP_CONN_LIMIT = Number(process.env.SIGNAL_IP_CONN_LIMIT) || 20;
const IP_JOIN_LIMIT = Number(process.env.SIGNAL_IP_JOIN_LIMIT) || 10;
const SOCKET_MSG_LIMIT = Number(process.env.SIGNAL_SOCKET_MSG_LIMIT) || 50;
const WINDOW_MS = 60000; // 60s

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

const server = http.createServer();
const wss = new WebSocketServer({ server });

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

wss.on('connection', (ws, req) => {
  const clientIp = getClientIp(req);

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

    try {
      const msg = JSON.parse(rawData.toString());
      if (!msg || typeof msg !== 'object') {
        logEvent('BAD_PAYLOAD', clientIp, 'Not an object');
        return;
      }

      const { type, roomId, peerId, toPeer, sdp, candidate } = msg;

      // 4. Validate string fields
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
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).forEach((peer) => {
            if (peer !== ws && peer.readyState === 1 && peer._peerId === toPeer) {
              peer.send(rawData.toString());
            }
          });
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

// rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map();

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

server.listen(8080, () => {
  console.log('[Pulsar] Signaling server running on ws://localhost:8080');
});
