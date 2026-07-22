'use client';

import React, { useState, useRef } from 'react';
import { SmilePlus, Reply, File, FileImage, FileVideo, FileText, Download } from 'lucide-react';
import { Message } from '../../types';
import { formatTime, formatBytes } from '../../lib/utils';
import { useChatStore } from '../../store/chatStore';
import { Tooltip } from '../ui/Tooltip';
import { ReactionPicker } from './ReactionPicker';
import { updateMessageReactionsInDB } from '../../lib/storage';

interface MessageBubbleProps {
  message: Message;
  showSender: boolean;
  isGroupHovered?: boolean;
  shouldAnimate?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showSender,
}) => {
  const { peers, setReplyingTo, myPeerId, activeChannelId, updateMessageReactions } = useChatStore();
  const { type, text, sender, senderId, ts, isOwn, fileRef } = message;

  const [showPicker, setShowPicker] = useState(false);
  const smileRef = useRef<HTMLButtonElement>(null);

  // Resolve handle and peer color
  let senderHandle = sender;
  let senderColor = '#E50914'; // Netflix Red default

  if (isOwn) {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.handle) senderHandle = parsed.handle;
          if (parsed.peerColor) senderColor = parsed.peerColor;
        } catch {}
      }
    }
  } else {
    const peer = peers.get(senderId);
    if (peer) {
      senderHandle = peer.handle || peer.displayName || sender;
      senderColor = peer.peerColor || '#E50914';
    }
  }

  // System Message (Spec D & E: Centered, 12px Space Mono, text-muted, no border box, no > prefix)
  if (type === 'system') {
    const cleanText = text ? text.replace(/^>\s*/, '') : '';
    return (
      <div className="w-full flex justify-center py-1 select-none font-mono text-[12px] text-text-muted text-center" data-message-id={message.id}>
        {cleanText}
      </div>
    );
  }

  const handleReplyClick = () => {
    if (!message.replyTo) return;
    const el = document.querySelector(`[data-message-id="${message.replyTo.messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      data-message-id={message.id}
      className="group relative w-full flex flex-col py-1 px-2 hover:bg-elevated/40 rounded transition-colors font-sans"
    >
      {/* Hover action bar */}
      <div className="absolute top-1 right-2 hidden group-hover:flex items-center bg-overlay border border-border rounded px-1 gap-1 z-20 shadow-sm">
        <Tooltip content="React">
          <button
            ref={smileRef}
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="text-text-muted hover:text-text-primary p-1 focus:outline-none"
          >
            <SmilePlus className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Reply">
          <button
            type="button"
            onClick={() => setReplyingTo(message)}
            className="text-text-muted hover:text-text-primary p-1 focus:outline-none"
          >
            <Reply className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Reaction picker */}
      {showPicker && (
        <ReactionPicker
          messageId={message.id}
          onClose={() => setShowPicker(false)}
          anchorRef={smileRef}
        />
      )}

      {/* Reply quote block */}
      {message.replyTo && (
        <div
          onClick={handleReplyClick}
          className="ml-[18px] mb-1 cursor-pointer border-l-2 border-accent-muted bg-accent-muted/50 px-2 py-0.5 rounded text-xs text-text-secondary max-w-xl truncate hover:brightness-110 transition-all select-none"
        >
          @{message.replyTo.senderHandle}: {message.replyTo.preview.substring(0, 60)}
        </div>
      )}

      {/* Header row (showSender = true) or indented continuation */}
      {showSender ? (
        <div className="flex items-center gap-2 mb-0.5">
          {/* 8px colored dot */}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: senderColor }}
          />
          {/* Sender handle */}
          <span className="text-[13px] font-semibold text-text-primary">
            @{senderHandle}
          </span>
          {/* Timestamp */}
          <span className="font-mono text-[11px] text-text-muted">
            {formatTime(ts)}
          </span>
        </div>
      ) : null}

      {/* Content wrapper */}
      <div className={showSender ? "ml-[18px]" : "ml-[18px]"}>
        {type === 'file' && fileRef ? (
          <div className="flex flex-col gap-2 my-1">
            {fileRef.mimeType.startsWith('image/') && fileRef.blob && (
              <img
                src={URL.createObjectURL(fileRef.blob)}
                alt={fileRef.name}
                className="max-h-[200px] w-auto rounded object-contain bg-black/40 border border-border"
              />
            )}
            <div className="bg-elevated border border-border rounded p-2.5 flex items-center gap-3 min-w-[200px] max-w-[320px] relative overflow-hidden">
              <div className="text-accent shrink-0">
                {fileRef.mimeType.startsWith('image/') ? (
                  <FileImage className="w-5 h-5 text-accent" />
                ) : fileRef.mimeType.startsWith('video/') ? (
                  <FileVideo className="w-5 h-5 text-accent" />
                ) : fileRef.mimeType.startsWith('text/') ? (
                  <FileText className="w-5 h-5 text-accent" />
                ) : (
                  <File className="w-5 h-5 text-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-[14px] font-medium truncate" title={fileRef.name}>
                  {fileRef.name}
                </div>
                <div className="text-text-muted text-[12px] font-sans">
                  {formatBytes(fileRef.size)}
                </div>
              </div>
              {fileRef.blob && (
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(fileRef.blob!);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileRef.name;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-accent hover:text-accent-hover p-1 focus:outline-none shrink-0"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {fileRef.status === 'receiving' && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-overlay">
                  <div
                    className="bg-accent h-full transition-all duration-200"
                    style={{ width: `${fileRef.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-text-primary leading-normal whitespace-pre-wrap break-words">
            {text}
          </p>
        )}

        {/* Reaction chips */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 select-none">
            {message.reactions.map((rx) => {
              const hasReacted = myPeerId ? rx.peers.includes(myPeerId) : false;
              const count = rx.peers.length;
              if (count === 0) return null;

              const handleReactionClick = () => {
                if (!myPeerId) return;
                const action = hasReacted ? 'remove' : 'add';
                const channelId = activeChannelId || '';

                updateMessageReactions(message.id, rx.emoji, myPeerId, action);
                updateMessageReactionsInDB(message.id, rx.emoji, myPeerId, action);

                window.dispatchEvent(
                  new CustomEvent('quark-broadcast-react', {
                    detail: {
                      messageId: message.id,
                      channelId,
                      emoji: rx.emoji,
                      peerId: myPeerId,
                      action,
                    },
                  })
                );
              };

              return (
                <button
                  key={rx.emoji}
                  type="button"
                  onClick={handleReactionClick}
                  className={`rounded px-2 py-0.5 text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                    hasReacted
                      ? 'border border-accent bg-accent-muted text-text-primary'
                      : 'bg-overlay border border-border text-text-secondary hover:bg-elevated'
                  }`}
                >
                  <span>{rx.emoji}</span>
                  <span className="font-mono text-[11px]">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
