import React from 'react';
import { Message } from '../../types';
import { formatTime, cn } from '../../lib/utils';
import { FileTransfer } from './FileTransfer';
import { useChatStore } from '../../store/chatStore';

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
  const { peers } = useChatStore();
  const { type, text, sender, senderId, ts, isOwn, fileRef } = message;

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
      <div className="w-full flex justify-center py-2 select-none">
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

  return (
    <div className={cn("w-full flex flex-col mb-1", isOwn ? "items-end" : "items-start")}>
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
        {/* Render text or file transfer widget */}
        {type === 'file' && fileRef ? (
          <FileTransfer fileRef={fileRef} isOwn={isOwn} />
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
    </div>
  );
};
