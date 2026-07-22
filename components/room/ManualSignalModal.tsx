'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
import { createManualOffer, acceptManualOffer, completeManualConnection } from '../../lib/webrtc';
import { toast } from '../../store/toastStore';

interface ManualSignalModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManualSignalModal({ open, onClose }: ManualSignalModalProps) {
  const [activeTab, setActiveTab] = useState<'starting' | 'joining'>('starting');
  const [copied, setCopied] = useState(false);

  // Starting flow states
  const [localOffer, setLocalOffer] = useState('');
  const [remoteAnswerInput, setRemoteAnswerInput] = useState('');
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [pcInstance, setPcInstance] = useState<RTCPeerConnection | null>(null);

  // Joining flow states
  const [remoteOfferInput, setRemoteOfferInput] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);

  if (!open) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleGenerateOffer = async () => {
    setIsGeneratingOffer(true);
    try {
      const offerStr = await createManualOffer();
      setLocalOffer(offerStr);
      toast.success('Offer payload generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate offer');
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  const handleConnectAnswer = async () => {
    if (!remoteAnswerInput.trim()) return;
    try {
      const { sdp } = JSON.parse(atob(remoteAnswerInput.trim()));
      if (pcInstance) {
        await completeManualConnection(pcInstance, remoteAnswerInput.trim());
      }
      toast.success('Manual connection completing...');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Invalid answer payload format');
    }
  };

  const handleGenerateAnswer = async () => {
    if (!remoteOfferInput.trim()) return;
    setIsGeneratingAnswer(true);
    try {
      const answerStr = await acceptManualOffer(remoteOfferInput.trim());
      setLocalAnswer(answerStr);
      toast.success('Answer payload generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process offer payload');
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-[#141414] border border-[#262626] rounded-md max-w-md w-full p-5 relative text-white">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#525252] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold mb-4 text-white">Manual Zero-Network Connection</h3>

        {/* Tabs */}
        <div className="flex border-b border-[#262626] mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('starting')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'starting'
                ? 'border-[#E50914] text-white font-semibold'
                : 'border-transparent text-[#a3a3a3] hover:text-white'
            }`}
          >
            I'm starting the connection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('joining')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'joining'
                ? 'border-[#E50914] text-white font-semibold'
                : 'border-transparent text-[#a3a3a3] hover:text-white'
            }`}
          >
            I'm joining
          </button>
        </div>

        {/* Tab 1: Starting */}
        {activeTab === 'starting' && (
          <div className="space-y-4 text-xs">
            {!localOffer ? (
              <button
                type="button"
                onClick={handleGenerateOffer}
                disabled={isGeneratingOffer}
                className="w-full bg-[#E50914] hover:bg-[#f40612] text-white font-medium py-2 rounded transition-colors disabled:opacity-50"
              >
                {isGeneratingOffer ? 'Generating Offer...' : 'Generate offer'}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-[#a3a3a3]">1. Share this offer string with the other device:</p>
                <div className="flex items-center justify-center bg-white p-2 rounded w-fit mx-auto">
                  <QRCodeSVG value={localOffer} size={130} />
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    value={localOffer}
                    className="w-full h-16 bg-[#1f1f1f] border border-[#262626] text-white font-mono text-[11px] p-2 rounded resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(localOffer)}
                    className="absolute top-2 right-2 text-[#a3a3a3] hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#E50914]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <p className="text-[#a3a3a3] pt-2">2. Paste their answer here:</p>
                <textarea
                  value={remoteAnswerInput}
                  onChange={(e) => setRemoteAnswerInput(e.target.value)}
                  placeholder="Paste Remote Answer Payload..."
                  className="w-full h-16 bg-[#1f1f1f] border border-[#262626] text-white font-mono text-[11px] p-2 rounded resize-none outline-none focus:border-[#E50914]"
                />
                <button
                  type="button"
                  onClick={handleConnectAnswer}
                  disabled={!remoteAnswerInput.trim()}
                  className="w-full bg-[#E50914] hover:bg-[#f40612] text-white font-medium py-2 rounded transition-colors disabled:opacity-40"
                >
                  Connect
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Joining */}
        {activeTab === 'joining' && (
          <div className="space-y-4 text-xs">
            <p className="text-[#a3a3a3]">1. Paste their offer here:</p>
            <textarea
              value={remoteOfferInput}
              onChange={(e) => setRemoteOfferInput(e.target.value)}
              placeholder="Paste Remote Offer Payload..."
              className="w-full h-16 bg-[#1f1f1f] border border-[#262626] text-white font-mono text-[11px] p-2 rounded resize-none outline-none focus:border-[#E50914]"
            />

            {!localAnswer ? (
              <button
                type="button"
                onClick={handleGenerateAnswer}
                disabled={!remoteOfferInput.trim() || isGeneratingAnswer}
                className="w-full bg-[#E50914] hover:bg-[#f40612] text-white font-medium py-2 rounded transition-colors disabled:opacity-40"
              >
                {isGeneratingAnswer ? 'Generating Answer...' : 'Generate answer'}
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-[#a3a3a3]">2. Show/send this answer string back to them:</p>
                <div className="flex items-center justify-center bg-white p-2 rounded w-fit mx-auto">
                  <QRCodeSVG value={localAnswer} size={130} />
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    value={localAnswer}
                    className="w-full h-16 bg-[#1f1f1f] border border-[#262626] text-white font-mono text-[11px] p-2 rounded resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(localAnswer)}
                    className="absolute top-2 right-2 text-[#a3a3a3] hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#E50914]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
