// server.js — run with: node server.js
const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocketServer({ server });

// rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.type === 'join-room') {
        currentRoom = msg.roomId;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        const room = rooms.get(currentRoom);

        // Check if there is an existing socket for the same peerId
        let staleSocket = null;
        room.forEach((peer) => {
          if (peer !== ws && peer._peerId === msg.peerId) {
            staleSocket = peer;
          }
        });

        if (staleSocket) {
          console.log(`[Pulsar Server] Stale socket found for rejoining peer ${msg.peerId}. Cleaning it up.`);
          room.delete(staleSocket);
          // Notify other peers about the stale peer leaving so they reset WebRTC
          room.forEach((peer) => {
            if (peer !== ws && peer.readyState === 1) {
              peer.send(JSON.stringify({
                type: 'peer-left',
                peerId: msg.peerId,
              }));
            }
          });
          staleSocket._roomId = null; // Bypass the normal close event notification loop
          staleSocket.close();
        }

        if (room.size >= 6) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'room-full',
          }));
          ws.close();
          return;
        }

        // Tell existing peers that a new peer joined
        room.forEach((peer) => {
          if (peer !== ws && peer.readyState === 1) {
            peer.send(JSON.stringify({
              type: 'peer-joined',
              peerId: msg.peerId,
            }));
          }
        });

        // Tell the new peer about all existing peers
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
        ws._peerId = msg.peerId;
        ws._roomId = currentRoom;
        console.log(`[Pulsar] Peer ${msg.peerId} joined room ${currentRoom}. Room size: ${room.size}`);
      } else {
        // Relay all other messages (offer, answer, ice-candidate) to target peer
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).forEach((peer) => {
            if (peer !== ws && peer.readyState === 1) {
              if (peer._peerId === msg.toPeer) {
                peer.send(rawData.toString());
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('[Pulsar] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    if (ws._roomId && rooms.has(ws._roomId)) {
      const room = rooms.get(ws._roomId);
      const wasDeleted = room.delete(ws);
      if (wasDeleted) {
        // Notify remaining peers
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
        }
        console.log(`[Pulsar] Peer ${ws._peerId} left room ${ws._roomId}. Room size: ${room.size}`);
      }
    }
  });
});

server.listen(8080, () => {
  console.log('[Pulsar] Signaling server running on ws://localhost:8080');
});
