'use client';

import React, { useEffect, useRef, useState } from 'react';
import { generateId } from '../../lib/utils';
import { useChatStore } from '../../store/chatStore';
import { PulsarSignaling } from '../../lib/signaling';
import { PulsarRoom } from '../../lib/webrtc';
import { FileReceiver } from '../../lib/fileTransfer';
import { getMessages, saveMessage, saveFile, saveRoom } from '../../lib/storage';
import { Message, SignalingMessage, DataChannelMessage } from '../../types';
import { RoomHeader } from './RoomHeader';
import { PeerStatus } from './PeerStatus';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { DevPanel } from '../dev/DevPanel';

interface ChatWindowProps {
  roomId: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId }) => {
  const store = useChatStore();

  const [displayName, setDisplayName] = useState('');
  const [myPeerId] = useState(() => generateId());

  // Stacked toast notifications
  interface ToastItem {
    id: string;
    message: string;
    visible: boolean;
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string) => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, visible: true }]);

    // Slide out/fade after 3s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
      );
      // Remove from state list after 150ms transition
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 150);
    }, 3000);
  };

  // Refs for WebRTC instance mappings
  const signalingRef = useRef<PulsarSignaling | null>(null);
  const roomRef = useRef<PulsarRoom | null>(null);
  const fileReceiversRef = useRef<Map<string, FileReceiver>>(new Map());
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Handle Ctrl+Shift+D / Cmd+Shift+D keyboard shortcuts for Dev Panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.toggleDevMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  // Main connection mounting lifecycle
  useEffect(() => {
    let active = true;

    async function init() {
      // 1. Resolve Display Name
      let myName = '';
      if (typeof window !== 'undefined') {
        myName = localStorage.getItem('pulsar-displayName') || '';
      }
      if (!myName.trim()) {
        myName = `Peer_${Math.random().toString(36).substring(2, 6)}`;
      }
      setDisplayName(myName);

      // Save room metadata in store & local DB
      store.setRoom({
        roomId,
        displayName: myName,
        isHost: false, // will negotiate dynamically in mesh
        createdAt: Date.now(),
      });
      await saveRoom({
        roomId,
        displayName: myName,
        isHost: false,
        createdAt: Date.now(),
      });

      // 2. Load message history from Dexie
      const history = await getMessages(roomId);
      if (active) {
        store.setMessages(history);
      }

      // Add a system announcement message that we are initializing
      const systemWelcome: Message = {
        id: generateId(),
        roomId,
        type: 'system',
        text: 'Direct encrypted channel initialized. Waiting for peers...',
        sender: 'System',
        senderId: 'system',
        ts: Date.now(),
        isOwn: true,
      };
      if (active) {
        store.addMessage(systemWelcome);
      }

      // 3. Setup WebRTC Room Mesh Manager
      const room = new PulsarRoom({
        myId: myPeerId,
        onSignal: (signal) => {
          signalingRef.current?.send(signal);
        },
        onPeerMessage: (peerId, dataChanMsg) => {
          handleIncomingDataMessage(peerId, dataChanMsg);
        },
        onPeerStateChange: (peerId, state) => {
          const oldPeer = store.peers.get(peerId);
          store.updatePeer(peerId, { connectionState: state });

          if (state === 'connected') {
            const timer = disconnectTimersRef.current.get(peerId);
            if (timer) {
              clearTimeout(timer);
              disconnectTimersRef.current.delete(peerId);
            }

            if (oldPeer?.connectionState !== 'connected') {
              const name = oldPeer?.displayName || peerId.substring(0, 8);
              addToast(`Peer joined the room: ${name}`);

              // Send our peer info immediately
              if (displayName) {
                roomRef.current?.sendToPeer(peerId, {
                  type: 'peer-info',
                  peerId: myPeerId,
                  displayName,
                });
              }
            }
          } else if (state === 'disconnected') {
            if (oldPeer?.connectionState === 'connected' && !disconnectTimersRef.current.has(peerId)) {
              const timer = setTimeout(() => {
                disconnectTimersRef.current.delete(peerId);
                const currentPeer = store.peers.get(peerId);
                if (currentPeer && currentPeer.connectionState === 'disconnected') {
                  store.removePeer(peerId);
                  roomRef.current?.removePeer(peerId);

                  const name = currentPeer.displayName || peerId.substring(0, 8);
                  addToast(`Peer left the room: ${name}`);

                  store.addMessage({
                    id: generateId(),
                    roomId,
                    type: 'system',
                    text: `Peer left the room.`,
                    sender: 'System',
                    senderId: 'system',
                    ts: Date.now(),
                    isOwn: false,
                  });
                }
              }, 5000);
              disconnectTimersRef.current.set(peerId, timer);
            }
          } else if (state === 'failed') {
            const timer = disconnectTimersRef.current.get(peerId);
            if (timer) {
              clearTimeout(timer);
              disconnectTimersRef.current.delete(peerId);
            }
            store.removePeer(peerId);
            roomRef.current?.removePeer(peerId);
            addToast('Connection to a peer failed');
          }
        },
        onIceLog: (entry) => {
          store.appendIceLog(entry);
        },
      });
      roomRef.current = room;

      // 4. Setup Signaling Manager
      const signaling = new PulsarSignaling(myPeerId);
      signalingRef.current = signaling;

      signaling.onMessage(async (msg) => {
        await handleIncomingSignaling(msg);
      });

      store.setIsConnecting(true);

      try {
        await signaling.connect();
        await signaling.joinRoom(roomId);
        store.appendIceLog('[Signaling] Connected to signaling channel.');
      } catch (err) {
        console.error('Signaling connection failure:', err);
        store.appendIceLog('[Signaling Error] Failed to connect signaling server.');
        if (active) {
          store.setIsConnecting(false);
          store.addMessage({
            id: generateId(),
            roomId,
            type: 'system',
            text: 'Signaling failed. Make sure the local signaling server (ws://localhost:8080) is running.',
            sender: 'System',
            senderId: 'system',
            ts: Date.now(),
            isOwn: false,
          });
        }
      }


    }

    init();

    // Stats fetching loop
    statsIntervalRef.current = setInterval(async () => {
      const room = roomRef.current;
      if (room && room.peers.size > 0) {
        const firstPeer = Array.from(room.peers.values())[0];
        if (firstPeer) {
          const stats = await firstPeer.getStats();
          store.setConnectionStats(stats);
        }
      }
    }, 2000);

    // Unmount cleanup
    return () => {
      active = false;
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      
      // Clear and clean all disconnect timers
      disconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
      disconnectTimersRef.current.clear();
      
      // Close WebRTC room & Ably connection
      roomRef.current?.close();
      signalingRef.current?.disconnect();
      store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myPeerId]);

  // Signaling Relayer logic
  const handleIncomingSignaling = async (msg: SignalingMessage) => {
    const room = roomRef.current;
    if (!room) return;

    switch (msg.type) {
      case 'room-joined':
        store.appendIceLog(`[Signaling] Joined room. Existing peers: ${msg.existingPeers?.join(', ') || 'None'}`);
        if (msg.existingPeers) {
          for (const peerId of msg.existingPeers) {
            const isInitiator = myPeerId < peerId;
            store.addPeer({
              peerId,
              displayName: `Peer_${peerId.substring(0, 4)}`,
              connectionState: isInitiator ? 'connecting' : 'new',
              isHost: false,
            });
            await room.addPeer(peerId, isInitiator);
          }
        }
        break;

      case 'peer-joined':
        store.appendIceLog(`[Signaling] Peer ${msg.peerId} entered signaling channel.`);
        const isInitiator = myPeerId < msg.peerId;
        store.addPeer({
          peerId: msg.peerId,
          displayName: `Peer_${msg.peerId.substring(0, 4)}`,
          connectionState: isInitiator ? 'connecting' : 'new',
          isHost: false,
        });
        await room.addPeer(msg.peerId, isInitiator);
        break;

      case 'offer':
        if (msg.toPeer === myPeerId) {
          store.appendIceLog(`[Signaling] Received WebRTC offer from ${msg.fromPeer}.`);
          store.setRemoteSdp(msg.sdp.sdp || '');

          let rxPeer = room.peers.get(msg.fromPeer);
          if (!rxPeer) {
            store.addPeer({
              peerId: msg.fromPeer,
              displayName: `Peer_${msg.fromPeer.substring(0, 4)}`,
              connectionState: 'connecting',
              isHost: false,
            });
            rxPeer = await room.addPeer(msg.fromPeer, false);
          }
          
          const answer = await rxPeer.handleOffer(msg.sdp);
          store.setLocalSdp(answer.sdp || '');

          signalingRef.current?.send({
            type: 'answer',
            sdp: answer,
            fromPeer: myPeerId,
            toPeer: msg.fromPeer,
          });
        }
        break;

      case 'answer':
        if (msg.toPeer === myPeerId) {
          store.appendIceLog(`[Signaling] Received WebRTC answer from ${msg.fromPeer}.`);
          store.setRemoteSdp(msg.sdp.sdp || '');
          const txPeer = room.peers.get(msg.fromPeer);
          if (txPeer) {
            await txPeer.handleAnswer(msg.sdp);
          }
        }
        break;

      case 'ice-candidate':
        if (msg.toPeer === myPeerId) {
          await room.addIceCandidate(msg.fromPeer, msg.candidate);
        }
        break;

      case 'peer-left':
        store.appendIceLog(`[Signaling] Peer ${msg.peerId} disconnected.`);
        
        // Immediately cancel disconnect timer
        const timer = disconnectTimersRef.current.get(msg.peerId);
        if (timer) {
          clearTimeout(timer);
          disconnectTimersRef.current.delete(msg.peerId);
        }

        const peerObj = store.peers.get(msg.peerId);
        const name = peerObj?.displayName || msg.peerId.substring(0, 8);

        store.removePeer(msg.peerId);
        room.removePeer(msg.peerId);

        addToast(`Peer left the room: ${name}`);
        
        // System message logging
        store.addMessage({
          id: generateId(),
          roomId,
          type: 'system',
          text: `Peer left the room.`,
          sender: 'System',
          senderId: 'system',
          ts: Date.now(),
          isOwn: false,
        });
        break;

      case 'error':
        if (msg.message === 'room-full') {
          store.addMessage({
            id: generateId(),
            roomId,
            type: 'system',
            text: 'Room is full (max 6 peers). You could not join.',
            sender: 'System',
            senderId: 'system',
            ts: Date.now(),
            isOwn: false,
          });
          addToast('Room is full');
          signalingRef.current?.disconnect();
        }
        break;
    }
  };

  // DataChannel message parser
  const handleIncomingDataMessage = async (peerId: string, msg: DataChannelMessage) => {
    switch (msg.type) {
      case 'peer-info':
        store.updatePeer(peerId, { displayName: msg.displayName });
        store.addMessage({
          id: generateId(),
          roomId,
          type: 'system',
          text: `${msg.displayName} is now connected.`,
          sender: 'System',
          senderId: 'system',
          ts: Date.now(),
          isOwn: false,
        });
        break;

      case 'message':
        const newTextMsg: Message = {
          id: msg.id,
          roomId,
          type: 'text',
          text: msg.text,
          sender: msg.sender,
          senderId: msg.senderId,
          ts: msg.ts,
          isOwn: false,
        };
        store.addMessage(newTextMsg);
        await saveMessage(newTextMsg);
        break;

      case 'file-meta':
        // Initialize file receiving buffer
        const receiver = new FileReceiver(msg.id, msg.name, msg.size, msg.mimeType, msg.totalChunks);
        fileReceiversRef.current.set(msg.id, receiver);

        // Add placeholder in message list
        const fileMsgPlaceholder: Message = {
          id: msg.id,
          roomId,
          type: 'file',
          sender: msg.sender,
          senderId: peerId,
          ts: Date.now(),
          isOwn: false,
          fileRef: {
            id: msg.id,
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
            status: 'receiving',
            progress: 0,
          },
        };
        store.addMessage(fileMsgPlaceholder);
        break;

      case 'file-chunk':
        const rx = fileReceiversRef.current.get(msg.id);
        if (rx) {
          rx.receiveChunk(msg.index, msg.chunk);
          store.updateFileProgress(msg.id, rx.getProgress());
        }
        break;

      case 'file-complete':
        const rxComp = fileReceiversRef.current.get(msg.id);
        if (rxComp && rxComp.isComplete()) {
          try {
            const assembledBlob = rxComp.assemble();
            
            // Save to IndexedDB
            await saveFile({
              id: msg.id,
              name: rxComp.name,
              size: rxComp.size,
              mimeType: rxComp.mimeType,
              blob: assembledBlob,
            });

            // Update UI store and trigger save message metadata
            store.markFileComplete(msg.id, assembledBlob);
            
            const completedMsg = store.messages.find(m => m.id === msg.id);
            if (completedMsg) {
              await saveMessage(completedMsg);
            }
          } catch (err) {
            console.error('File assembly failure:', err);
            store.updateFileProgress(msg.id, 0); // resets or marks error
          } finally {
            fileReceiversRef.current.delete(msg.id);
          }
        }
        break;

      case 'typing':
        store.setTyping(msg.senderId, msg.isTyping);
        break;
    }
  };

  // Action dispatcher: Text Messages
  const handleSendMessage = async (text: string) => {
    const textId = generateId();
    const newMsg: Message = {
      id: textId,
      roomId,
      type: 'text',
      text,
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
      isOwn: true,
    };

    // Update locally
    store.addMessage(newMsg);
    await saveMessage(newMsg);

    // Broadcast to peers
    const wireMsg: DataChannelMessage = {
      type: 'message',
      id: textId,
      text,
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
    };
    roomRef.current?.broadcast(wireMsg);
  };

  // Action dispatcher: Files
  const handleSendFile = async (file: File) => {
    const fileId = generateId();
    const newMsg: Message = {
      id: fileId,
      roomId,
      type: 'file',
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
      isOwn: true,
      fileRef: {
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: 'sending',
        progress: 0,
      },
    };

    store.addMessage(newMsg);

    const activePeers = Array.from(roomRef.current?.peers.values() || []);
    if (activePeers.length === 0) {
      store.updateFileProgress(fileId, 0);
      return;
    }

    try {
      // Send file to all peers (parallelized chunks over channel)
      await Promise.all(
        activePeers.map(peer =>
          peer.sendFile(fileId, file, displayName, (progress) => {
            store.updateFileProgress(fileId, progress);
          })
        )
      );

      // Save complete status local
      await saveFile({
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        blob: file,
      });

      store.markFileComplete(fileId, file);
      
      const completedMsg = store.messages.find(m => m.id === fileId);
      if (completedMsg) {
        await saveMessage(completedMsg);
      }
    } catch (err) {
      console.error('Failed to send file:', err);
      // Mark error
      store.updateFileProgress(fileId, 0);
    }
  };

  // Typing Notification Dispatcher
  const handleTyping = (isTyping: boolean) => {
    const wireMsg: DataChannelMessage = {
      type: 'typing',
      senderId: myPeerId,
      displayName,
      isTyping,
    };
    roomRef.current?.broadcast(wireMsg);
  };

  // When connection opens, broadcast displayName info
  useEffect(() => {
    if (store.isConnected && displayName) {
      const infoMsg: DataChannelMessage = {
        type: 'peer-info',
        peerId: myPeerId,
        displayName,
      };
      roomRef.current?.broadcast(infoMsg);
    }
  }, [store.isConnected, displayName, myPeerId]);

  const handleManualRefreshStats = async () => {
    const room = roomRef.current;
    if (room && room.peers.size > 0) {
      const firstPeer = Array.from(room.peers.values())[0];
      if (firstPeer) {
        const stats = await firstPeer.getStats();
        store.setConnectionStats(stats);
      }
    }
  };

  const isInputDisabled = !store.isConnected;

  // Typing peers display formatter
  const typingPeerNames = Array.from(store.typingPeers)
    .map(id => store.peers.get(id)?.displayName)
    .filter(Boolean);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-bg-primary">
      {/* Main chat interface */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <RoomHeader roomId={roomId} />
        <PeerStatus />
        
        <MessageList messages={store.messages} />

        {/* Typing Indicator HUD bar */}
        {typingPeerNames.length > 0 && (
          <div className="px-4 py-1.5 bg-bg-primary text-[10px] font-mono text-status-yellow select-none flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-yellow animate-pulse" />
            <span>{typingPeerNames.join(', ')} {typingPeerNames.length > 1 ? 'are' : 'is'} typing...</span>
          </div>
        )}

        <MessageInput
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          onTyping={handleTyping}
          disabled={isInputDisabled}
        />
      </div>

      {/* Developer Dashboard slide-out */}
      {store.devModeEnabled && (
        <DevPanel onRefreshStats={handleManualRefreshStats} />
      )}

      {/* Stacked toast notifications */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: '#242424',
              color: '#e6e8e6',
              border: '1px solid #2e2e2e',
              borderRadius: '6px',
              padding: '10px 16px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 400,
              opacity: t.visible ? 1 : 0,
              transition: t.visible ? 'opacity 150ms ease-in' : 'opacity 150ms ease-out',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};
