'use client';

import React, { useState, useRef } from 'react';
import { SmilePlus, Reply, File, FileImage, FileText, Download } from 'lucide-react';
import { Message } from '../../types';
import { formatTime, formatBytes, cn } from '../../lib/utils';
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
  isGroupHovered = false,
  shouldAnimate = false,
}) => {
  const { peers, setReplyingTo, myPeerId, activeChannelId, updateMessageReactions } = useChatStore();
  const { type, text, sender, senderId, ts, isOwn, fileRef } = message;

  const [showPicker, setShowPicker] = useState(false);
  const smileRef = useRef<HTMLButtonElement>(null);

  // Resolve dynamic handle and peer color
  let senderHandle = sender;
  let senderColor = '#7a7a7a'; // fallback color

  if (isOwn) {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quark_identity');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          senderHandle = parsed.handle;
          senderColor = parsed.peerColor;
        } catch {}
      }
    }
  } else {
    const peer = peers.get(senderId);
    if (peer) {
      senderHandle = peer.handle || peer.displayName || sender;
      senderColor = peer.peerColor || '#7a7a7a';
    }
  }

  // System message styling
  if (type === 'system') {
    return (
      <div className="w-full flex justify-center py-2 select-none" data-message-id={message.id}>
        <div
          className={cn(
            "px-3 py-1 bg-bg-surface/50 border border-border/40 rounded-sm font-mono text-caption text-fg-muted text-center max-w-[80%]",
            shouldAnimate && "quark-animate-system-msg"
          )}
        >
          {text}
        </div>
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
      className={cn("w-full flex flex-col mb-1 group relative", isOwn ? "items-end" : "items-start")}
    >
      {/* Sender label */}
      {showSender && (
        <div className={cn("flex items-center gap-1.5 mb-1 select-none", isOwn ? "justify-end mr-3" : "justify-start ml-3")}>
          <span
            className="w-2 h-2 rounded-full shrink-0 animate-[quark-message-in-system_250ms_ease-in_forwards]"
            style={{ backgroundColor: senderColor }}
          />
          <span className="font-mono text-caption text-fg-muted font-bold">
            @{senderHandle}
          </span>
        </div>
      )}

      {/* Reply quote block */}
      {message.replyTo && (
        <div
          onClick={handleReplyClick}
          className="mb-1 cursor-pointer border-l-2 border-accent-muted bg-accent-muted px-2.5 py-1 rounded text-xs text-text-secondary max-w-[80%] md:max-w-[70%] truncate font-sans hover:brightness-110 transition-all select-none"
        >
          @{message.replyTo.senderHandle}: {message.replyTo.preview.substring(0, 60)}
        </div>
      )}

      {/* Bubble wrapper */}
      <div
        className={cn(
          "bubble-container max-w-[80%] md:max-w-[70%] px-3 py-2 text-sm shadow-none border font-sans break-words relative transition-colors duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOwn
            ? "bg-surface-elevated text-fg-primary rounded-[12px_12px_4px_12px] border-pulsar/30 shadow-[0_2px_12px_rgba(229,9,20,0.06)]"
            : "bg-surface text-fg-primary rounded-[12px_12px_12px_4px] border-dim",
          isGroupHovered && (isOwn ? "bg-surface-hover border-pulsar/50" : "bg-surface-elevated border-border-strong"),
          shouldAnimate && (isOwn ? "quark-animate-sent" : "quark-animate-received")
        )}
      >
        {/* Hover action bar */}
        <div className="absolute -top-3 right-2 hidden group-hover:flex items-center bg-overlay border border-border rounded px-1 gap-1 z-20 shadow">
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

        {/* Reaction picker modal */}
        {showPicker && (
          <ReactionPicker
            messageId={message.id}
            onClose={() => setShowPicker(false)}
            anchorRef={smileRef}
          />
        )}

        {/* Render text or inline file card */}
        {type === 'file' && fileRef ? (
          <div className="flex flex-col gap-2">
            {fileRef.mimeType.startsWith('image/') && fileRef.blob && (
              <img
                src={URL.createObjectURL(fileRef.blob)}
                alt={fileRef.name}
                className="max-h-48 rounded object-contain bg-black/40"
              />
            )}
            <div className="bg-elevated rounded p-3 flex items-center gap-3 min-w-48 max-w-80 border border-border">
              <div className="text-accent shrink-0">
                {fileRef.mimeType.startsWith('image/') ? (
                  <FileImage className="w-5 h-5" />
                ) : fileRef.mimeType.startsWith('text/') ? (
                  <FileText className="w-5 h-5" />
                ) : (
                  <File className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-sm font-medium truncate" title={fileRef.name}>
                  {fileRef.name}
                </div>
                <div className="text-text-muted text-xs font-mono">
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
                  className="text-accent hover:text-accent-hover p-1 focus:outline-none"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
            {fileRef.status === 'receiving' && (
              <div className="w-full bg-overlay h-1 rounded overflow-hidden">
                <div
                  className="bg-accent h-full transition-all duration-200"
                  style={{ width: `${fileRef.progress || 0}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed text-body">{text}</p>
        )}

        {/* Timestamp hover reveal container */}
        <div className="timestamp-container w-full flex items-center justify-end gap-1.5 type-timestamp mt-1 select-none font-mono">
          <span>{formatTime(ts)}</span>
          {isOwn && (
            <span className="flex items-center">
              {useChatStore.getState().outboxPendingIds.has(message.id) ? (
                useChatStore.getState().roomStatus === 'failed' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-redshift" title="Delivery failed (offline)" />
                ) : useChatStore.getState().roomStatus === 'reconnecting' || useChatStore.getState().roomStatus === 'connecting' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-accretion animate-pulse" title="Flushing/Reconnecting..." />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-accretion" title="Pending delivery" />
                )
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-nebula" title="Delivered" />
              )}
            </span>
          )}
        </div>
      </div>

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
                <span className="font-mono">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
