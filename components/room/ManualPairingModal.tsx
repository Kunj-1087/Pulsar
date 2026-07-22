'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Camera, Clipboard, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useChatStore } from '../../store/chatStore';
import { QuarkRoom } from '../../lib/webrtc';
import { toast } from '../../store/toastStore';

interface ManualPairingModalProps {
  onClose: () => void;
  myPeerId: string;
  roomId: string;
  roomRef: React.MutableRefObject<QuarkRoom | null>;
}

export const ManualPairingModal: React.FC<ManualPairingModalProps> = ({
  onClose,
  myPeerId,
  roomId,
  roomRef,
}) => {
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<'select' | 'initiator' | 'receiver'>('select');
  
  // Initiator states
  const [localOfferStr, setLocalOfferStr] = useState<string>('');
  const [remoteAnswerStr, setRemoteAnswerStr] = useState<string>('');
  const [isGatheringOffer, setIsGatheringOffer] = useState(false);
  
  // Receiver states
  const [remoteOfferStr, setRemoteOfferStr] = useState<string>('');
  const [localAnswerStr, setLocalAnswerStr] = useState<string>('');
  const [isGatheringAnswer, setIsGatheringAnswer] = useState(false);

  // Helper to package SDP
  const encodePayload = (peerId: string, sdp: RTCSessionDescriptionInit) => {
    return btoa(JSON.stringify({ peerId, sdp }));
  };

  // Helper to decode SDP
  const decodePayload = (str: string): { peerId: string; sdp: RTCSessionDescriptionInit } | null => {
    try {
      const decoded = atob(str.trim());
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.peerId && parsed.sdp) {
        return parsed;
      }
    } catch (e) {
      console.error('[ManualPairing] Decoding payload failed:', e);
    }
    return null;
  };

  // Helper to wait for ICE gathering
  const waitForIceGathering = (pc: RTCPeerConnection): Promise<void> => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const listener = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', listener);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', listener);
    });
  };

  // 1. INITIATOR FLOW: Create offer, wait for candidates, generate QR code string
  const handleStartAsInitiator = async () => {
    setRole('initiator');
    setIsGatheringOffer(true);
    toast.info('Generating local P2P offer... Gathering connection paths.');

    try {
      // Setup room if closed
      const store = useChatStore.getState();
      if (!roomRef.current) {
        roomRef.current = new QuarkRoom({
          myId: myPeerId,
          onSignal: () => {}, // Manual flow bypasses default signaling
          onPeerMessage: (peerId, msg) => window.dispatchEvent(new CustomEvent('quark-peer-message', { detail: { peerId, msg } })),
          onPeerBinaryMessage: (peerId, buf) => window.dispatchEvent(new CustomEvent('quark-peer-binary', { detail: { peerId, buf } })),
          onPeerStateChange: (peerId, state) => {
            store.updatePeer(peerId, { connectionState: state });
            if (state === 'connected') {
              store.setRoomStatus('connected');
              toast.success('P2P connection established successfully!');
              onClose();
            }
          },
          onIceLog: (entry) => store.appendIceLog(entry),
        });
      }

      // Generate a temporary peer ID or use a fixed receiver ID
      // For manual P2P, we can use a standard target peerId like 'manual-peer' until we discover it via offer exchange
      const dummyPeerId = `peer_${Math.random().toString(36).substring(2, 6)}`;
      const peer = await roomRef.current.addPeer(dummyPeerId, true);
      
      const offer = await peer.createOffer();
      await waitForIceGathering(peer.peerConnection);

      const offerPayload = encodePayload(myPeerId, peer.peerConnection.localDescription || offer);
      setLocalOfferStr(offerPayload);
      
      // Update room host state
      store.updatePeer(dummyPeerId, { isHost: true });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate local offer description.');
      setRole('select');
    } finally {
      setIsGatheringOffer(false);
    }
  };

  // 2. INITIATOR FLOW: Paste Receiver's answer to complete connection
  const handleApplyAnswer = async () => {
    if (!remoteAnswerStr.trim()) return;
    const parsed = decodePayload(remoteAnswerStr);
    if (!parsed) {
      toast.error('Invalid answer code structure.');
      return;
    }

    try {
      const room = roomRef.current;
      if (!room) return;

      // Find the negotiating peer connection we started
      const negotiatingPeer = Array.from(room.peers.values())[0];
      if (negotiatingPeer) {
        // Remap their true peerId instead of dummy ID
        const oldId = negotiatingPeer.peerId;
        negotiatingPeer.peerId = parsed.peerId;
        room.peers.delete(oldId);
        room.peers.set(parsed.peerId, negotiatingPeer);

        useChatStore.getState().addPeer({
          peerId: parsed.peerId,
          connectionState: 'negotiating',
          isHost: false,
        });
        useChatStore.getState().removePeer(oldId);

        await negotiatingPeer.handleAnswer(parsed.sdp);
        toast.info('Answer applied. Awaiting peer connection handshake...');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error applying remote answer.');
    }
  };

  // 3. RECEIVER FLOW: Paste Initiator's offer, generate answer, wait for ICE, present back
  const handleApplyOfferAndAnswer = async () => {
    const parsed = decodePayload(remoteOfferStr);
    if (!parsed) {
      toast.error('Invalid offer code structure.');
      return;
    }

    setIsGatheringAnswer(true);
    toast.info('Analyzing offer and gathering answer candidates...');

    try {
      const store = useChatStore.getState();
      if (!roomRef.current) {
        roomRef.current = new QuarkRoom({
          myId: myPeerId,
          onSignal: () => {},
          onPeerMessage: (peerId, msg) => window.dispatchEvent(new CustomEvent('quark-peer-message', { detail: { peerId, msg } })),
          onPeerBinaryMessage: (peerId, buf) => window.dispatchEvent(new CustomEvent('quark-peer-binary', { detail: { peerId, buf } })),
          onPeerStateChange: (peerId, state) => {
            store.updatePeer(peerId, { connectionState: state });
            if (state === 'connected') {
              store.setRoomStatus('connected');
              toast.success('P2P connection established successfully!');
              onClose();
            }
          },
          onIceLog: (entry) => store.appendIceLog(entry),
        });
      }

      // Add the peer connection using initiator's actual peer ID
      const peer = await roomRef.current.addPeer(parsed.peerId, false);
      const answer = await peer.handleOffer(parsed.sdp);
      await waitForIceGathering(peer.peerConnection);

      const answerPayload = encodePayload(myPeerId, peer.peerConnection.localDescription || answer);
      setLocalAnswerStr(answerPayload);
    } catch (err) {
      console.error(err);
      toast.error('Error establishing connection from offer.');
    } finally {
      setIsGatheringAnswer(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('P2P pairing code copied.');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-void/90 flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-surface border border-dim rounded-md p-6 relative flex flex-col font-mono text-caption select-none text-fg-primary shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none p-2.5 md:p-0"
          aria-label="Close Pairing Modal"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="type-uppercase-label text-pulsar mb-4">
          Local Offline Pairing
        </h3>

        {role === 'select' && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-small font-sans text-fg-secondary leading-relaxed mb-4">
              Connect directly with another device on the same local network without using any signaling servers.
            </p>
            <div className="flex flex-col gap-2.5">
              <Button onClick={handleStartAsInitiator} variant="primary" className="h-11 md:h-10 text-small md:text-sm">
                1. Invite Peer (Initiator)
              </Button>
              <Button onClick={() => setRole('receiver')} variant="ghost" className="h-11 md:h-10 text-small md:text-sm">
                2. Scan / Paste Invite (Receiver)
              </Button>
            </div>
          </div>
        )}

        {role === 'initiator' && (
          <div className="space-y-4">
            {isGatheringOffer ? (
              <div className="text-center py-6">
                <p className="animate-pulse text-accretion">Gathering connection paths...</p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-micro text-fg-secondary mb-3">
                    Let the other peer scan this QR code or copy the string:
                  </p>
                  
                  {localOfferStr && (
                    <div className="bg-fg-primary p-4 inline-block rounded-sm mb-3">
                      <QRCodeSVG
                        value={localOfferStr}
                        size={200}
                        bgColor="#f5f5f5"
                        fgColor="#0a0a0a"
                        level="L"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={localOfferStr}
                      className="h-11 md:h-8 text-small md:text-micro font-mono bg-void border-dim"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 md:h-8 shrink-0 text-small md:text-micro px-4"
                      onClick={() => handleCopyText(localOfferStr)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-dim my-4" />

                <div className="space-y-2">
                  <p className="text-micro text-fg-secondary">
                    Paste the response code from the other peer below:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste answer code..."
                      value={remoteAnswerStr}
                      onChange={(e) => setRemoteAnswerStr(e.target.value)}
                      className="h-11 md:h-8 text-small md:text-micro font-mono bg-void border-dim"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      className="h-11 md:h-8 shrink-0 text-small md:text-micro font-semibold px-4"
                      onClick={handleApplyAnswer}
                      disabled={!remoteAnswerStr.trim()}
                    >
                      Connect
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {role === 'receiver' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-micro text-fg-secondary">
                Paste the invite code from the other peer here:
              </p>
              <textarea
                placeholder="Paste offer code..."
                value={remoteOfferStr}
                onChange={(e) => setRemoteOfferStr(e.target.value)}
                className="w-full h-20 p-2 bg-void border border-dim text-small md:text-micro font-mono text-fg-primary rounded focus:outline-none focus:border-pulsar focus:ring-1 focus:ring-pulsar/40"
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full h-11 md:h-8 text-small md:text-xs font-semibold"
                onClick={handleApplyOfferAndAnswer}
                loading={isGatheringAnswer}
                disabled={!remoteOfferStr.trim()}
              >
                Process Invite
              </Button>
            </div>

            {localAnswerStr && (
              <>
                <div className="h-px bg-dim my-3" />
                <div className="text-center space-y-3">
                  <p className="text-micro text-fg-secondary">
                    Provide this code back to the inviting peer:
                  </p>
                  <div className="bg-fg-primary p-4 inline-block rounded-sm">
                    <QRCodeSVG
                      value={localAnswerStr}
                      size={200}
                      bgColor="#f5f5f5"
                      fgColor="#0a0a0a"
                      level="L"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={localAnswerStr}
                      className="h-11 md:h-8 text-small md:text-micro font-mono bg-void border-dim"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 md:h-8 shrink-0 text-small md:text-micro px-4"
                      onClick={() => handleCopyText(localAnswerStr)}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
