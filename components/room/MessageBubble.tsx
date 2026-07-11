import React from 'react';
import { Message } from '../../types';
import { formatTime, cn } from '../../lib/utils';
import { FileTransfer } from './FileTransfer';

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
  const { type, text, sender, ts, isOwn, fileRef } = message;

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
      {/* Sender label (only show on received messages when the bubble sender shifts) */}
      {!isOwn && showSender && (
        <span className="text-[11px] font-mono text-text-muted ml-3 mb-1 select-none">
          {sender}
        </span>
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
