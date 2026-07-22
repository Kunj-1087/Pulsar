'use client';

import React, { useEffect, useRef, useState } from 'react';
import { generateId, cn } from '../../lib/utils';
import { useChatStore } from '../../store/chatStore';
import { FallbackSignalingDriver, SignalingDriver } from '../../lib/signaling';
import { QuarkRoom } from '../../lib/webrtc';
import { FileReceiver, decodeBinaryFrame } from '../../lib/fileTransfer';
import { getMessages, saveMessage, saveFile, saveRoom, cleanupExpiredMessages } from '../../lib/storage';
import dynamic from 'next/dynamic';
import { Message, SignalingMessage, DataChannelMessage, PeerConnectionState } from '../../types';
import { RoomHeader } from './RoomHeader';
import { PeerStatus } from './PeerStatus';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { toast } from '../../store/toastStore';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';

const DevPanel = dynamic(
  () => import('../dev/DevPanel').then((m) => m.DevPanel),
  { ssr: false }
);

interface ChatWindowProps {
  roomId: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId }) => {
  const store = useChatStore();

  const [displayName, setDisplayName] = useState('');
  const [myPeerId] = useState(() => generateId());
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (store.devModeEnabled) {
          store.toggleDevMode();
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const textarea = document.querySelector('textarea');
        textarea?.focus();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.toggleDevMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, showShortcutsModal]);

  // Refs for WebRTC instance mappings
  const signalingRef = useRef<SignalingDriver | null>(null);
  const roomRef = useRef<QuarkRoom | null>(null);
  const fileReceiversRef = useRef<Map<string, FileReceiver>>(new Map());
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const INCOMING_TYPING_TIMEOUT_MS = 5000;

  const cancelledTransfersRef = useRef<Set<string>>(new Set());
  const [ephemeral] = useState(false);

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

  // Helpers for file transfers and peer resource cleaning
  const failFileTransfersForPeer = (peerId: string) => {
    store.messages.forEach((msg) => {
      if (msg.type === 'file' && msg.fileRef) {
        if (!msg.isOwn && msg.senderId === peerId && msg.fileRef.status === 'receiving') {
          store.updateFileProgress(msg.id, msg.fileRef.progress || 0, 'error');
        }
      }
    });
  };

  const failAllFileTransfers = () => {
    store.messages.forEach((msg) => {
      if (msg.type === 'file' && msg.fileRef) {
        if (msg.fileRef.status === 'receiving' || msg.fileRef.status === 'sending') {
          store.updateFileProgress(msg.id, msg.fileRef.progress || 0, 'error');
        }
      }
    });
  };

  const cleanupTypingForPeer = (peerId: string) => {
    const timer = typingTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      typingTimersRef.current.delete(peerId);
    }
    store.setTyping(peerId, false);
  };

  const cleanupPeerResources = (peerId: string) => {
    const timer = disconnectTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimersRef.current.delete(peerId);
    }
    cleanupTypingForPeer(peerId);
    failFileTransfersForPeer(peerId);
    roomRef.current?.removePeer(peerId);
    store.removePeer(peerId);
  };

  // Main connection mounting lifecycle
  useEffect(() => {
    let active = true;

    async function init() {
      // 1. Resolve Display Name and Identity
      let myName = '';
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('quark_identity');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            myName = parsed.handle || '';
          } catch {}
        }
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
        text: '> peer node initialized',
        sender: 'System',
        senderId: 'system',
        ts: Date.now(),
        isOwn: true,
      };
      if (active) {
        store.addMessage(systemWelcome);
      }

      const handlePeerConnectionStateChange = (peerId: string, state: PeerConnectionState) => {
        const oldPeer = store.peers.get(peerId);
        store.updatePeer(peerId, { connectionState: state });

        // Centralized room status transition check
        const currentPeers = Array.from(store.peers.values());
        const hasFailed = currentPeers.some(p => p.connectionState === 'failed');
        const hasDisconnected = currentPeers.some(p => p.connectionState === 'disconnected');
        const allConnected = currentPeers.every(p => p.connectionState === 'connected');

        if (store.roomStatus !== 'reconnecting' && store.roomStatus !== 'failed' && store.roomStatus !== 'closed' && store.roomStatus !== 'closing' && store.roomStatus !== 'signaling') {
          if (currentPeers.length === 0 || allConnected) {
            store.setRoomStatus('connected');
          } else if (hasFailed || hasDisconnected) {
            store.setRoomStatus('degraded');
          } else {
            store.setRoomStatus('connecting');
          }
        }

        if (state === 'connected') {
          const timer = disconnectTimersRef.current.get(peerId);
          if (timer) {
            clearTimeout(timer);
            disconnectTimersRef.current.delete(peerId);
          }

          if (oldPeer?.connectionState !== 'connected') {
            const name = oldPeer?.handle ? `@${oldPeer.handle}` : (oldPeer?.displayName || peerId.substring(0, 8));
            toast.success(`${name} joined. E2EE established.`);

            // Send our peer info immediately
            if (displayName) {
              let myHandle = '';
              let myColor = '';
              try {
                const saved = localStorage.getItem('quark_identity');
                if (saved) {
                  const parsed = JSON.parse(saved);
                  myHandle = parsed.handle;
                  myColor = parsed.peerColor;
                }
              } catch {}

              roomRef.current?.sendToPeer(peerId, {
                type: 'peer-info',
                peerId: myPeerId,
                displayName,
                handle: myHandle,
                peerColor: myColor,
              });
            }
          }
        } else if (state === 'disconnected') {
          if (oldPeer?.connectionState === 'connected' && !disconnectTimersRef.current.has(peerId)) {
            const timer = setTimeout(() => {
              disconnectTimersRef.current.delete(peerId);
              const currentPeer = store.peers.get(peerId);
              if (currentPeer && currentPeer.connectionState === 'disconnected') {
                const name = currentPeer.handle ? `@${currentPeer.handle}` : (currentPeer.displayName || peerId.substring(0, 8));
                
                 cleanupPeerResources(peerId);
                 toast.info(`${name} left.`);

                store.addMessage({
                  id: generateId(),
                  roomId,
                  type: 'system',
                  text: `> peer left: ${name}`,
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
          const oldPeer = store.peers.get(peerId);
          const peerName = oldPeer?.displayName || peerId.substring(0, 8);
          
          cleanupPeerResources(peerId);
          toast.warning(`Connection to ${peerName} failed.`);

          store.addMessage({
            id: generateId(),
            roomId,
            type: 'system',
            text: `> connection failed: ${peerName}`,
            sender: 'System',
            senderId: 'system',
            ts: Date.now(),
            isOwn: false,
          });
        }
      };

      // 3. Setup WebRTC Room Mesh Manager
      const room = new QuarkRoom({
        myId: myPeerId,
        onSignal: (signal) => {
          signalingRef.current?.send(signal);
        },
        onPeerMessage: (peerId, dataChanMsg) => {
          handleIncomingDataMessage(peerId, dataChanMsg);
        },
        onPeerBinaryMessage: (peerId, arrayBuffer) => {
          handleIncomingBinaryMessage(peerId, arrayBuffer);
        },
        onPeerStateChange: handlePeerConnectionStateChange,
        onIceLog: (entry) => {
          store.appendIceLog(entry);
        },
      });
      roomRef.current = room;

      // 4. Setup Signaling Manager
      const signaling = new FallbackSignalingDriver(myPeerId);
      signalingRef.current = signaling;

      store.setRoomStatus('signaling');

      signaling.onStateChange((state) => {
        if (!active) return;

        store.setSignalingDriverName(signaling.getActiveDriverName());

        if (state === 'connected') {
          if (!roomRef.current) {
            roomRef.current = new QuarkRoom({
              myId: myPeerId,
              onSignal: (msg) => signalingRef.current?.send(msg),
              onPeerMessage: (peerId, msg) => handleIncomingDataMessage(peerId, msg),
              onPeerBinaryMessage: (peerId, buf) => handleIncomingBinaryMessage(peerId, buf),
              onPeerStateChange: handlePeerConnectionStateChange,
              onIceLog: (entry) => store.appendIceLog(entry),
            });
          }

          const peerList = Array.from(store.peers.values());
          if (peerList.length === 0) {
            store.setRoomStatus('connected');
          } else {
            store.setRoomStatus('connecting');
          }
          store.appendIceLog('// [Signaling] Connected to signaling channel.');
          
          if (store.roomStatus === 'reconnecting') {
            toast.success('Signaling connection restored.');
            signalingRef.current?.joinRoom(roomId);
          }
        } else if (state === 'reconnecting') {
          store.setRoomStatus('reconnecting');
            store.appendIceLog('// [Signaling Error] Lost connection to signaling. Reconnecting...');
            
            failAllFileTransfers();
          
          typingTimersRef.current.forEach((t) => clearTimeout(t));
          typingTimersRef.current.clear();
          
          roomRef.current?.close();
          
          const peersToCleanup = Array.from(store.peers.keys());
          peersToCleanup.forEach((peerId) => {
            store.removePeer(peerId);
          });
          
          toast.warning('Signaling connection lost. Reconnecting...');
        } else if (state === 'disconnected') {
          if (store.roomStatus !== 'closed' && store.roomStatus !== 'closing') {
            store.setRoomStatus('reconnecting');
          }
        } else if (state === 'failed') {
          store.setRoomStatus('failed');
          toast.error('Signaling offline. Check your network.');
        }
      });

      signaling.onMessage(async (msg) => {
        await handleIncomingSignaling(msg);
      });

      try {
        await signaling.connect();
        await signaling.joinRoom(roomId);
        store.setSignalingDriverName(signaling.getActiveDriverName());
      } catch (err) {
        console.error('Signaling connection failure:', err);
        store.appendIceLog('// [Signaling] Failed to connect signaling server.');
        if (active) {
          store.setRoomStatus('failed');
          toast.error('Unable to connect to signaling.');
          store.addMessage({
            id: generateId(),
            roomId,
            type: 'system',
              text: '> signaling failed. unable to reach server.',
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

    const cleanupInterval = setInterval(() => {
      cleanupExpiredMessages();
    }, 30000);

    const currentDisconnectTimers = disconnectTimersRef.current;
    const currentTypingTimers = typingTimersRef.current;
    const currentReceiversMap = fileReceiversRef.current;

    // Unmount cleanup
    return () => {
      active = false;
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      clearInterval(cleanupInterval);
      
      // Cancel all active transfers
      const currentReceivers = Array.from(currentReceiversMap.keys());
      currentReceivers.forEach((fileId) => {
        handleCancelTransfer(fileId);
      });

      // Clear and clean all timers
      currentDisconnectTimers.forEach((timer) => clearTimeout(timer));
      currentDisconnectTimers.clear();
      currentTypingTimers.forEach((timer) => clearTimeout(timer));
      currentTypingTimers.clear();
      
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
        store.appendIceLog(`// [Signaling] Joined room. Existing peers: ${msg.existingPeers?.join(', ') || 'None'}`);
        if (msg.existingPeers) {
          store.setRoomStatus('connecting');

          // Prune any orphaned peers in local store that left while disconnected
          const activePeerSet = new Set(msg.existingPeers);
          Array.from(store.peers.keys()).forEach((pId) => {
            if (!activePeerSet.has(pId)) {
              cleanupPeerResources(pId);
              store.removePeer(pId);
            }
          });

          for (const peerId of msg.existingPeers) {
            const isInitiator = myPeerId < peerId;
            
            // Cleanup any stale connections for peerId
            cleanupPeerResources(peerId);

            store.addPeer({
              peerId,
              displayName: `Peer_${peerId.substring(0, 4)}`,
              connectionState: isInitiator ? 'negotiating' : 'new',
              isHost: false,
            });
            await room.addPeer(peerId, isInitiator);
          }
        } else {
          store.setRoomStatus('connected');
        }
        break;

      case 'peer-joined':
        store.appendIceLog(`// [Signaling] Peer ${msg.peerId} entered signaling channel.`);
        store.setRoomStatus('connecting');
        
        const isInitiator = myPeerId < msg.peerId;
        
        // Cleanup any stale connections for peerId
        cleanupPeerResources(msg.peerId);

        store.addPeer({
          peerId: msg.peerId,
          displayName: `Peer_${msg.peerId.substring(0, 4)}`,
          connectionState: isInitiator ? 'negotiating' : 'new',
          isHost: false,
        });
        await room.addPeer(msg.peerId, isInitiator);
        break;

      case 'offer':
        if (msg.toPeer === myPeerId) {
          store.appendIceLog(`// [Signaling] Received WebRTC offer from ${msg.fromPeer}.`);
          store.setRemoteSdp(msg.sdp.sdp || '');

          let rxPeer = room.peers.get(msg.fromPeer);
          if (!rxPeer) {
            store.addPeer({
              peerId: msg.fromPeer,
              displayName: `Peer_${msg.fromPeer.substring(0, 4)}`,
              connectionState: 'negotiating',
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
          store.appendIceLog(`// [Signaling] Received WebRTC answer from ${msg.fromPeer}.`);
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
        store.appendIceLog(`// [Signaling] Peer ${msg.peerId} disconnected.`);
        
        const peerObj = store.peers.get(msg.peerId);
        const name = peerObj?.displayName || msg.peerId.substring(0, 8);

        cleanupPeerResources(msg.peerId);

        toast.info(`Peer left the room: ${name}`);
        
        // System message logging
        store.addMessage({
          id: generateId(),
          roomId,
          type: 'system',
          text: `> peer left: ${name}`,
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
            text: '> room is full. max 6 peers.',
            sender: 'System',
            senderId: 'system',
            ts: Date.now(),
            isOwn: false,
          });
          toast.error('This room is full.');
          signalingRef.current?.disconnect();
        }
        break;
    }
  };

  // DataChannel message parser
  const handleIncomingDataMessage = async (peerId: string, msg: DataChannelMessage) => {
    switch (msg.type) {
      case 'peer-info':
        store.updatePeer(peerId, {
          displayName: msg.displayName,
          handle: msg.handle,
          peerColor: msg.peerColor,
        });
        
        const peerName = msg.handle ? `@${msg.handle}` : msg.displayName;
        store.addMessage({
          id: generateId(),
          roomId,
          type: 'system',
          text: `> peer joined: ${peerName}`,
          sender: 'System',
          senderId: 'system',
          ts: Date.now(),
          isOwn: false,
        });
        break;

      case 'message':
        const deleteAt = msg.disappearAfterMs ? Date.now() + msg.disappearAfterMs : undefined;
        const newTextMsg: Message = {
          id: msg.id,
          roomId,
          type: 'text',
          text: msg.text,
          sender: msg.sender,
          senderId: msg.senderId,
          ts: msg.ts,
          isOwn: false,
          deleteAt,
        };
        store.addMessage(newTextMsg);
        if (!ephemeral) {
          await saveMessage(newTextMsg);
        }
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
            store.updateFileProgress(msg.id, 0, 'error');
          } finally {
            fileReceiversRef.current.delete(msg.id);
          }
        }
        break;

      case 'file-cancel':
        fileReceiversRef.current.delete(msg.id);
        store.updateFileProgress(msg.id, 0, 'cancelled');
        const fileMsg = store.messages.find(m => m.id === msg.id);
        if (fileMsg) {
          await saveMessage({
            ...fileMsg,
            fileRef: {
              ...fileMsg.fileRef!,
              status: 'cancelled',
              progress: 0,
            }
          });
        }
        break;

      case 'typing':
        const existingTimer = typingTimersRef.current.get(msg.senderId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          typingTimersRef.current.delete(msg.senderId);
        }

        if (msg.isTyping) {
          store.setTyping(msg.senderId, true);
          
          const newTimer = setTimeout(() => {
            store.setTyping(msg.senderId, false);
            typingTimersRef.current.delete(msg.senderId);
          }, INCOMING_TYPING_TIMEOUT_MS);
          
          typingTimersRef.current.set(msg.senderId, newTimer);
        } else {
          store.setTyping(msg.senderId, false);
        }
        break;
    }
  };

  const handleIncomingBinaryMessage = async (peerId: string, arrayBuffer: ArrayBuffer) => {
    try {
      const { transferId, chunkIndex, chunkData } = decodeBinaryFrame(arrayBuffer);
      if (cancelledTransfersRef.current.has(transferId)) {
        return;
      }
      
      const receiver = fileReceiversRef.current.get(transferId);
      if (receiver) {
        receiver.receiveChunk(chunkIndex, chunkData);
        store.updateFileProgress(transferId, receiver.getProgress());
      } else {
        console.warn(`[Quark ChatWindow] Received binary chunk for unknown transfer: ${transferId}`);
      }
    } catch (err) {
      console.error('[Quark ChatWindow] Failed to handle incoming binary message:', err);
    }
  };

  const handleCancelTransfer = async (fileId: string) => {
    console.log(`[Quark ChatWindow] Cancelling transfer: ${fileId}`);
    cancelledTransfersRef.current.add(fileId);
    fileReceiversRef.current.delete(fileId);
    
    roomRef.current?.broadcast({
      type: 'file-cancel',
      id: fileId,
    });
    
    store.updateFileProgress(fileId, 0, 'cancelled');
    
    const targetMsg = useChatStore.getState().messages.find((m) => m.id === fileId);
    if (targetMsg) {
      await saveMessage({
        ...targetMsg,
        fileRef: {
          ...targetMsg.fileRef!,
          status: 'cancelled',
          progress: 0,
        },
      });
    }
  };

  useEffect(() => {
    const handleCancelEvent = (e: Event) => {
      const { fileId } = (e as CustomEvent).detail;
      handleCancelTransfer(fileId);
    };
    window.addEventListener('quark-cancel-transfer', handleCancelEvent);
    return () => {
      window.removeEventListener('quark-cancel-transfer', handleCancelEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (text: string, disappearAfterMs?: number) => {
    const textId = generateId();
    const deleteAt = disappearAfterMs ? Date.now() + disappearAfterMs : undefined;
    const newMsg: Message = {
      id: textId,
      roomId,
      type: 'text',
      text,
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
      isOwn: true,
      deleteAt,
    };

    store.addMessage(newMsg);
    if (!ephemeral) {
      await saveMessage(newMsg);
    }

    const wireMsg: DataChannelMessage = {
      type: 'message',
      id: textId,
      text,
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
      disappearAfterMs,
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
      store.updateFileProgress(fileId, 0, 'error');
      return;
    }

    try {
      // Send file to all peers (parallelized chunks over channel)
      await Promise.all(
        activePeers.map(peer =>
          peer.sendFile(
            fileId,
            file,
            displayName,
            (progress) => {
              store.updateFileProgress(fileId, progress);
            },
            () => cancelledTransfersRef.current.has(fileId)
          )
        )
      );

      // Save complete status local
      if (!cancelledTransfersRef.current.has(fileId)) {
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
      }
    } catch (err) {
      console.error('Failed to send file:', err);
      const isCancelled = cancelledTransfersRef.current.has(fileId);
      const finalStatus = isCancelled ? 'cancelled' : 'error';
      store.updateFileProgress(fileId, 0, finalStatus);
      
      const failedMsg = store.messages.find(m => m.id === fileId);
      if (failedMsg) {
        await saveMessage({
          ...failedMsg,
          fileRef: {
            ...failedMsg.fileRef!,
            status: finalStatus,
            progress: 0,
          }
        });
      }
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

  const hasConnectedPeers = Array.from(store.peers.values()).some((p) => p.connectionState === 'connected');

  // When connection opens, broadcast displayName info
  useEffect(() => {
    if (hasConnectedPeers && displayName) {
      let myHandle = '';
      let myColor = '';
      try {
        const saved = localStorage.getItem('quark_identity');
        if (saved) {
          const parsed = JSON.parse(saved);
          myHandle = parsed.handle;
          myColor = parsed.peerColor;
        }
      } catch {}

      const infoMsg: DataChannelMessage = {
        type: 'peer-info',
        peerId: myPeerId,
        displayName,
        handle: myHandle,
        peerColor: myColor,
      };
      roomRef.current?.broadcast(infoMsg);
    }
  }, [hasConnectedPeers, displayName, myPeerId]);

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

  const isInputDisabled = !hasConnectedPeers;



  const allPeersFailedICE = Array.from(store.peers.values()).length > 0 && Array.from(store.peers.values()).every(
    (p) => p.connectionState === 'failed' || p.connectionState === 'closed'
  );

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-bg-base">
      {/* Main chat interface */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 h-full relative transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
          store.devModeEnabled && "md:pr-[360px]"
        )}
      >
        <RoomHeader roomId={roomId} />
        <PeerStatus />

        {allPeersFailedICE && (
          <div className="bg-decay/10 border-b border-decay/30 px-4 py-2 flex items-center justify-between text-xs font-mono text-decay select-none">
            <span className="type-uppercase-label">All P2P channels failed. Network may require a TURN relay.</span>
          </div>
        )}
        
        <MessageList messages={store.messages} roomId={roomId} />

        {store.roomStatus === 'failed' ? (
          <div className="border-t border-border bg-bg-elevated px-4 py-4 flex flex-col items-center justify-center gap-3 select-none">
            <p className="type-uppercase-label text-decay">
              <span>Signaling offline. Connection could not be established.</span>
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                store.setRoomStatus('signaling');
                try {
                  await signalingRef.current?.connect();
                  await signalingRef.current?.joinRoom(roomId);
                } catch {
                  store.setRoomStatus('failed');
                }
              }}
              className="text-xs h-8 px-4"
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <MessageInput
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            onTyping={handleTyping}
            disabled={isInputDisabled}
            roomId={roomId}
          />
        )}
      </div>

      {/* Developer Dashboard slide-out */}
      {store.devModeEnabled && <DevPanel onRefreshStats={handleManualRefreshStats} />}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-bg-base/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[340px] bg-bg-surface border border-border rounded-md p-5 relative select-none font-mono">
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="absolute top-4 right-4 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none"
              aria-label="Close shortcuts modal"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="type-uppercase-label text-fg-muted mb-4">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2.5 text-caption text-fg-primary">
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Focus Input</span>
                <span className="text-fg-primary bg-bg-active px-1.5 rounded-sm">Ctrl + K</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Dev Panel</span>
                <span className="text-fg-primary bg-bg-active px-1.5 rounded-sm">Ctrl + Shift + D</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Show Shortcuts</span>
                <span className="text-fg-primary bg-bg-active px-1.5 rounded-sm">Ctrl + /</span>
              </div>
              <div className="flex justify-between">
                <span>Dismiss modal</span>
                <span className="text-fg-primary bg-bg-active px-1.5 rounded-sm">ESC</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
