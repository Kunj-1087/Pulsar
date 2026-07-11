'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ArrowDown, MessageSquare } from 'lucide-react';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Button } from '../ui/Button';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Slice limit for message window virtualization
  const [visibleLimit, setVisibleLimit] = useState(200);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  // Monitor user scroll position to toggle "Scroll to Bottom" button
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    // If user is more than 200px away from bottom, show scroll button
    const isFar = scrollHeight - scrollTop - clientHeight > 200;
    setShowScrollButton(isFar);
  };

  // Auto-scroll when new messages arrive *only if* user is already near bottom
  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 300;
    if (isNearBottom) {
      // Small timeout to let images or elements render
      setTimeout(scrollToBottom, 50);
    } else {
      setShowScrollButton(true);
    }
  }, [messages.length]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, []);

  const handleLoadMore = () => {
    setVisibleLimit((prev) => prev + 200);
  };

  const visibleMessages = messages.slice(-visibleLimit);
  const hasMore = messages.length > visibleLimit;

  // Empty state renderer
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <MessageSquare className="w-10 h-10 text-text-muted mb-3" />
        <h3 className="font-mono text-sm text-text-bright font-medium">No messages yet</h3>
        <p className="font-sans text-xs text-text-muted mt-1 max-w-[260px] leading-relaxed">
          Send a message or drop a file to start communicating directly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative flex flex-col">
      {/* Scroll area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth"
      >
        {/* Load More Button */}
        {hasMore && (
          <div className="w-full flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              className="text-xs font-mono py-1 h-8"
            >
              Load older messages ({messages.length - visibleLimit} remaining)
            </Button>
          </div>
        )}

        {/* Message groups */}
        {visibleMessages.map((msg, idx) => {
          // Check if date partition is needed
          const currentMsgDate = new Date(msg.ts).toDateString();
          const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
          const prevMsgDate = prevMsg ? new Date(prevMsg.ts).toDateString() : null;
          const showDateSeparator = currentMsgDate !== prevMsgDate;

          // Check if sender shifted to group consecutive bubbles
          const isSameSender = prevMsg 
            ? prevMsg.senderId === msg.senderId && prevMsg.type !== 'system'
            : false;
          // Group bubbles sent within 60s
          const isGrouped = isSameSender && (msg.ts - prevMsg!.ts) <= 60000;
          const showSenderName = !msg.isOwn && !isGrouped;

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="w-full flex justify-center py-4 select-none">
                  <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 border border-border-default bg-[#161616]/40 rounded-sm">
                    {currentMsgDate === new Date().toDateString() ? 'TODAY' : currentMsgDate.toUpperCase()}
                  </span>
                </div>
              )}
              
              <MessageBubble
                message={msg}
                showSender={showSenderName}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Floating scroll down button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-text-primary text-bg-primary hover:bg-text-bright border border-transparent rounded-full shadow-lg transition-all duration-150 active:scale-95 animate-bounce focus:outline-none"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
