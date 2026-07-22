'use client';

import React, { useEffect, useRef, useState } from 'react';
import { generateId, cn } from '../../lib/utils';
import { useChatStore } from '../../store/chatStore';
import { FallbackSignalingDriver, SignalingDriver } from '../../lib/signaling';
import { QuarkRoom } from '../../lib/webrtc';
import { FileReceiver, decodeBinaryFrame } from '../../lib/fileTransfer';
import { getMessages, saveMessage, saveFile, saveRoom, getRoom, cleanupExpiredMessages, saveOutboxMessage, getOutboxMessages, removeOutboxMessage, saveFileProgress, getFileProgress, removeFileProgress, getChannelsByRoom, createChannel, deleteChannel, dedupeDefaultChannels, updateMessageReactionsInDB } from '../../lib/storage';
import { Message, SignalingMessage, DataChannelMessage, PeerConnectionState, Channel } from '../../types';
import { RoomHeader } from './RoomHeader';
import { PeerStatus } from './PeerStatus';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChannelSidebar } from './ChannelSidebar';
import { MembersList } from './MembersList';
import { ManualPairingModal } from './ManualPairingModal';
import { toast } from '../../store/toastStore';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';

interface ChatWindowProps {
  roomId: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId }) => {
  const store = useChatStore();

  const [displayName, setDisplayName] = useState('');
  const [myPeerId] = useState(() => generateId());
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showManualPairing, setShowManualPairing] = useState(false);
  const [showChannelSidebar, setShowChannelSidebar] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const flushOutbox = async () => {
    const connectedPeers = Array.from(store.peers.values()).filter(p => p.connectionState === 'connected');
    if (connectedPeers.length === 0) return;

    try {
      const pending = await getOutboxMessages(roomId);
      if (pending.length === 0) return;

      console.log(`[Quark Outbox] Flushing ${pending.length} pending messages...`);
      for (const msg of pending) {
        if (msg.type === 'text') {
          const wireMsg: DataChannelMessage = {
            type: 'message',
            id: msg.id,
            text: msg.text || '',
            sender: displayName,
            senderId: myPeerId,
            ts: msg.ts,
          };
          roomRef.current?.broadcast(wireMsg);
          await removeOutboxMessage(msg.id);
          store.removeOutboxPendingId(msg.id);
        }
      }
      toast.success('Offline outbox messages delivered!');
    } catch (err) {
      console.error('[Quark Outbox] Error flushing outbox:', err);
    }
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
      store.setMyPeerId(myPeerId);

      // Check if room already exists in DB to preserve isHost
      const existingRoom = await getRoom(roomId);
      const isHost = existingRoom ? existingRoom.isHost : false;

      // Save room metadata in store & local DB
      store.setRoom({
        roomId,
        displayName: myName,
        isHost,
        createdAt: existingRoom ? existingRoom.createdAt : Date.now(),
      });
      if (!existingRoom) {
        await saveRoom({
          roomId,
          displayName: myName,
          isHost: false,
          createdAt: Date.now(),
        });
      }

      // 2. Run dedupe migration then load message history, channels, and outbox messages from Dexie
      await dedupeDefaultChannels(roomId);
      const history = await getMessages(roomId);
      const outbox = await getOutboxMessages(roomId);
      const savedChannels = await getChannelsByRoom(roomId);

      if (active) {
        store.setMessages(history);
        store.setOutboxPendingIds(outbox.map((o) => o.id));
        if (savedChannels.length > 0) {
          savedChannels.forEach((ch) => store.addChannel(ch));
          store.setActiveChannel(savedChannels[0].id);
        }
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
            
            // Deliver pending messages in outbox
            flushOutbox();

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

            if (store.room?.isHost && store.channels.length > 0) {
              roomRef.current?.sendToPeer(peerId, {
                type: 'channel-list',
                channels: store.channels,
              });
            }
          }
        } else if (state === 'disconnected' || state === 'failed') {
          if (!disconnectTimersRef.current.has(peerId)) {
            const timer = setTimeout(() => {
              disconnectTimersRef.current.delete(peerId);
              const currentPeer = store.peers.get(peerId);
              if (currentPeer && (currentPeer.connectionState === 'disconnected' || currentPeer.connectionState === 'failed')) {
                const name = currentPeer.handle ? `@${currentPeer.handle}` : (currentPeer.displayName || peerId.substring(0, 8));

                cleanupPeerResources(peerId);
                store.removePeer(peerId);
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
        onIceLog: () => {},
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
              onIceLog: () => {},
            });
          }

          toast.dismiss('signaling-status');
          const peerList = Array.from(store.peers.values());
          if (peerList.length === 0) {
            store.setRoomStatus('connected');
          } else {
            store.setRoomStatus('connecting');
          }

          signalingRef.current?.joinRoom(roomId);
        } else if (state === 'reconnecting') {
          toast.warning('Signaling connection lost. Reconnecting…', { id: 'signaling-status' });
        } else if (state === 'disconnected') {
          if (store.roomStatus !== 'closed' && store.roomStatus !== 'closing') {
            store.setRoomStatus('reconnecting');
          }
        } else if (state === 'failed') {
          store.setRoomStatus('failed');
          toast.error('Signaling offline. Check your network.', { id: 'signaling-status' });
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
        if (active) {
          store.setRoomStatus('failed');
          toast.error('Unable to connect to signaling.');
          store.addMessage({
            id: generateId(),
            roomId,
            type: 'system',
            text: 'signaling failed. unable to reach server.',
            sender: 'System',
            senderId: 'system',
            ts: Date.now(),
            isOwn: false,
          });
        }
      }
    }

    init();

    const cleanupInterval = setInterval(() => {
      cleanupExpiredMessages();
    }, 30000);

    const outboxInterval = setInterval(() => {
      flushOutbox();
    }, 5000);

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        // @ts-ignore
        reg.sync.register('flush-quark-outbox').catch(() => {});
      }).catch(() => {});
    }

    const currentDisconnectTimers = disconnectTimersRef.current;
    const currentTypingTimers = typingTimersRef.current;
    const currentReceiversMap = fileReceiversRef.current;

    // Unmount cleanup
    return () => {
      active = false;
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      clearInterval(cleanupInterval);
      clearInterval(outboxInterval);
      
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
        const isLocalHost = !msg.existingPeers || msg.existingPeers.length === 0;

        if (store.room) {
          const updatedRoom = { ...store.room, isHost: isLocalHost };
          store.setRoom(updatedRoom);
          await saveRoom(updatedRoom);
        }

        if (isLocalHost) {
          const existingChannels = await getChannelsByRoom(roomId);
          if (existingChannels.length === 0) {
            const defaultChannel: Channel = {
              id: generateId(),
              roomId,
              name: 'general',
              createdAt: Date.now(),
              createdBy: myPeerId,
            };
            store.addChannel(defaultChannel);
            await createChannel(defaultChannel);
            store.setActiveChannel(defaultChannel.id);
          }
        }

        if (msg.existingPeers && msg.existingPeers.length > 0) {
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
          channelId: msg.channelId,
          replyTo: msg.replyTo,
        };
        store.addMessage(newTextMsg);
        if (!ephemeral) {
          await saveMessage(newTextMsg);
        }
        break;

      case 'channel-create':
        store.addChannel(msg.channel);
        await createChannel(msg.channel);
        break;

      case 'channel-delete':
        store.removeChannel(msg.channelId);
        await deleteChannel(msg.channelId);
        break;

      case 'message-react':
        store.updateMessageReactions(msg.messageId, msg.emoji, msg.peerId, msg.action);
        await updateMessageReactionsInDB(msg.messageId, msg.emoji, msg.peerId, msg.action);
        break;

      case 'channel-list':
        for (const ch of msg.channels) {
          store.addChannel(ch);
          await createChannel(ch);
        }
        break;

      case 'file-meta':
        // Initialize file receiving buffer
        const receiver = new FileReceiver(msg.id, msg.name, msg.size, msg.mimeType, msg.totalChunks);
        fileReceiversRef.current.set(msg.id, receiver);

        // Check for resume progress record
        getFileProgress(msg.id).then(async (prog) => {
          if (prog) {
            await receiver.loadFromDB();
            store.updateFileProgress(msg.id, receiver.getProgress());
            // Send resume control feedback back
            roomRef.current?.sendToPeer(peerId, {
              type: 'file-resume',
              id: msg.id,
              receivedChunks: prog.receivedChunks,
            });
          } else {
            await saveFileProgress({
              id: msg.id,
              peerId,
              name: msg.name,
              size: msg.size,
              mimeType: msg.mimeType,
              totalChunks: msg.totalChunks,
              receivedChunks: [],
              hash: msg.hash || '',
            });
          }
        });

        // Add placeholder in message list
        const fileMsgPlaceholder: Message = {
          id: msg.id,
          roomId,
          type: 'file',
          sender: msg.sender,
          senderId: peerId,
          ts: Date.now(),
          isOwn: false,
          channelId: msg.channelId,
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
            
            // File hash integrity checks
            const prog = await getFileProgress(msg.id);
            if (prog && prog.hash) {
              const { calculateFileHash } = await import('../../lib/fileTransfer');
              const computedHash = await calculateFileHash(assembledBlob);
              if (computedHash !== prog.hash) {
                console.error('[Quark Integrity] Hash mismatch detected! Expected:', prog.hash, 'Got:', computedHash);
                toast.error('File integrity check failed. File may be corrupted.', { title: 'Integrity Failure' });
                store.updateFileProgress(msg.id, 0, 'error');
                return;
              }
              console.log('[Quark Integrity] Hash matches expected SHA-256 value. Transfer verified!');
            }

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

            // Remove progress record & temp chunks
            await removeFileProgress(msg.id);
            rxComp.clearFromDB();
          } catch (err) {
            console.error('File assembly failure:', err);
            store.updateFileProgress(msg.id, 0, 'error');
          } finally {
            fileReceiversRef.current.delete(msg.id);
          }
        }
        break;

      case 'file-cancel':
        const rxCancel = fileReceiversRef.current.get(msg.id);
        if (rxCancel) {
          rxCancel.clearFromDB();
          fileReceiversRef.current.delete(msg.id);
        }
        await removeFileProgress(msg.id);
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

        // Persist chunk index progress in Dexie
        const currentProgress = await getFileProgress(transferId);
        const received = currentProgress ? [...currentProgress.receivedChunks] : [];
        if (!received.includes(chunkIndex)) {
          received.push(chunkIndex);
        }
        await saveFileProgress({
          id: transferId,
          peerId,
          name: receiver.name,
          size: receiver.size,
          mimeType: receiver.mimeType,
          totalChunks: receiver.totalChunks,
          receivedChunks: received,
          hash: currentProgress?.hash || '',
        });
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
    
    const rx = fileReceiversRef.current.get(fileId);
    if (rx) {
      rx.clearFromDB();
      fileReceiversRef.current.delete(fileId);
    }
    await removeFileProgress(fileId);
    
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
    const handleOpenManual = () => {
      setShowManualPairing(true);
    };
    const handleBroadcastReact = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      roomRef.current?.broadcast({
        type: 'message-react',
        messageId: detail.messageId,
        channelId: detail.channelId,
        emoji: detail.emoji,
        peerId: detail.peerId,
        action: detail.action,
      });
    };

    window.addEventListener('quark-cancel-transfer', handleCancelEvent);
    window.addEventListener('open-manual-pairing', handleOpenManual);
    window.addEventListener('quark-broadcast-react', handleBroadcastReact);

    return () => {
      window.removeEventListener('quark-cancel-transfer', handleCancelEvent);
      window.removeEventListener('open-manual-pairing', handleOpenManual);
      window.removeEventListener('quark-broadcast-react', handleBroadcastReact);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (text: string, disappearAfterMs?: number) => {
    const textId = generateId();
    const deleteAt = disappearAfterMs ? Date.now() + disappearAfterMs : undefined;
    const activeChannelId = store.activeChannelId;
    const replyingTo = store.replyingTo;

    let replyToRef = undefined;
    if (replyingTo) {
      const preview = (replyingTo.text || '').substring(0, 80);
      let senderHandle = replyingTo.sender;
      if (!replyingTo.isOwn) {
        const peer = store.peers.get(replyingTo.senderId);
        if (peer) {
          senderHandle = peer.handle || peer.displayName || replyingTo.sender;
        }
      }
      replyToRef = {
        messageId: replyingTo.id,
        senderHandle,
        preview,
      };
    }

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
      channelId: activeChannelId || undefined,
      replyTo: replyToRef,
    };

    store.addMessage(newMsg);
    if (!ephemeral) {
      await saveMessage(newMsg);
    }

    const connectedPeers = Array.from(store.peers.values()).filter(p => p.connectionState === 'connected');
    if (connectedPeers.length === 0) {
      // Offline outbox queue
      store.addOutboxPendingId(textId);
      await saveOutboxMessage({
        id: textId,
        roomId,
        ts: Date.now(),
        type: 'text',
        text,
      });
      toast.info('No connected peers found. Message queued for delivery.');
      return;
    }

    const wireMsg: DataChannelMessage = {
      type: 'message',
      id: textId,
      text,
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
      disappearAfterMs,
      channelId: activeChannelId || undefined,
      replyTo: replyToRef,
    };
    roomRef.current?.broadcast(wireMsg);
  };

  // Action dispatcher: Files
  const handleSendFile = async (file: File) => {
    const fileId = generateId();
    const activeChannelId = store.activeChannelId;
    const newMsg: Message = {
      id: fileId,
      roomId,
      type: 'file',
      sender: displayName,
      senderId: myPeerId,
      ts: Date.now(),
      isOwn: true,
      channelId: activeChannelId || undefined,
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
            () => cancelledTransfersRef.current.has(fileId),
            activeChannelId || undefined
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


  const isInputDisabled = !hasConnectedPeers;



  const allPeersFailedICE = Array.from(store.peers.values()).length > 0 && Array.from(store.peers.values()).every(
    (p) => p.connectionState === 'failed' || p.connectionState === 'closed'
  );

  return (
    <div className="flex flex-col h-screen bg-base overflow-hidden select-none">
      <RoomHeader
        roomId={roomId}
        onToggleChannelSidebar={() => setShowChannelSidebar(!showChannelSidebar)}
        onToggleMembersList={() => setShowMembersList(!showMembersList)}
        onOpenManualPairing={() => setShowManualPairing(true)}
      />

      {/* Middle row — 3 panel layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Channel Sidebar */}
        <div className="hidden md:block w-60 flex-shrink-0 bg-surface border-r border-border h-full">
          <ChannelSidebar />
        </div>

        {/* Mobile Channel Sidebar Drawer Overlay */}
        {showChannelSidebar && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div className="w-60 bg-surface h-full border-r border-border shadow-2xl z-50">
              <ChannelSidebar />
            </div>
            <div
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowChannelSidebar(false)}
            />
          </div>
        )}

        {/* Center Panel */}
        <main className="flex flex-col flex-1 overflow-hidden bg-base relative">
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
              <div className="flex gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualPairing(true)}
                  className="text-xs h-8 px-4 border border-dim text-accretion hover:bg-accretion/10"
                >
                  Connect offline via QR/Local
                </Button>
              </div>
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
        </main>

        {/* Desktop Members Sidebar */}
        <div className="hidden md:block w-50 flex-shrink-0 bg-surface border-l border-border h-full">
          <MembersList />
        </div>

        {/* Mobile Members List Drawer Overlay */}
        {showMembersList && (
          <div className="md:hidden fixed inset-0 z-40 flex justify-end">
            <div
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowMembersList(false)}
            />
            <div className="w-50 bg-surface h-full border-l border-border shadow-2xl z-50">
              <MembersList />
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[340px] bg-surface border border-border rounded p-5 relative select-none font-sans">
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors focus:outline-none"
              aria-label="Close shortcuts modal"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2.5 text-xs text-text-primary">
              <div className="flex justify-between border-b border-border pb-1.5">
                <span>Focus Input</span>
                <span className="font-mono text-text-secondary bg-elevated px-1.5 rounded">Ctrl + K</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1.5">
                <span>Show Shortcuts</span>
                <span className="font-mono text-text-secondary bg-elevated px-1.5 rounded">Ctrl + /</span>
              </div>
              <div className="flex justify-between">
                <span>Dismiss modal</span>
                <span className="font-mono text-text-secondary bg-elevated px-1.5 rounded">ESC</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Manual/QR Pairing Modal */}
      {showManualPairing && (
        <ManualPairingModal
          onClose={() => setShowManualPairing(false)}
          myPeerId={myPeerId}
          roomId={roomId}
          roomRef={roomRef}
        />
      )}
    </div>
  );
};
