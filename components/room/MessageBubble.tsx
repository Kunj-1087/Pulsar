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
      const saved = localStorage.getItem('pulsar_identity');
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
            "px-3 py-1 bg-bg-surface/50 border border-border-default/40 rounded-sm text-[11px] font-sans text-text-muted text-center uppercase tracking-wider max-w-[80%]",
            shouldAnimate && "pulsar-animate-system-msg"
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
            className="w-2 h-2 rounded-full shrink-0 animate-[pulsar-message-in-system_250ms_ease-in_forwards]"
            style={{ backgroundColor: senderColor }}
          />
          <span className="text-[11px] font-mono text-text-muted font-bold">
            @{senderHandle}
          </span>
        </div>
      )}

      {/* Bubble wrapper */}
      <div
        className={cn(
          "bubble-container max-w-[80%] md:max-w-[70%] px-3 py-2 text-sm shadow-none border border-transparent font-sans break-words relative transition-colors duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOwn
            ? "bg-[#2a2a2a] text-text-bright rounded-[12px_12px_4px_12px] border-text-primary/5"
            : "bg-[#1f1f1f] text-text-primary rounded-[12px_12px_12px_4px] border-border-default/60",
          isGroupHovered && (isOwn ? "bg-[#343434]" : "bg-[#282828]"),
          shouldAnimate && (isOwn ? "pulsar-animate-sent" : "pulsar-animate-received")
        )}
      >
        {/* Render text or file transfer widget */}
        {type === 'file' && fileRef ? (
          <FileTransfer fileRef={fileRef} isOwn={isOwn} />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{text}</p>
        )}

        {/* Timestamp hover reveal container */}
        <div className="timestamp-container w-full flex justify-end text-[10px] font-mono text-text-muted mt-1 select-none">
          <span>{formatTime(ts)}</span>
        </div>
      </div>
    </div>
  );
};
