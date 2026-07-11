import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Button } from '../ui/Button';
import { useChatStore } from '../../store/chatStore';

interface MessageListProps {
  messages: Message[];
}

interface MessageGroup {
  groupId: string;
  senderId: string;
  senderName: string;
  isOwn: boolean;
  messages: Message[];
  showDateSeparator: boolean;
  dateStr: string;
}

// Inner Component for Group Hover Highlight & Bubble Entrance Animation
const MessageGroupComponent: React.FC<{
  group: MessageGroup;
  animatedMessageIdsRef: React.RefObject<Set<string>>;
}> = ({ group, animatedMessageIdsRef }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full flex flex-col gap-1"
    >
      {group.messages.map((msg, idx) => {
        const hasAnimated = animatedMessageIdsRef.current?.has(msg.id);
        const ageMs = Date.now() - msg.ts;
        const shouldAnimate = !hasAnimated && ageMs < 5000;
        
        if (shouldAnimate && animatedMessageIdsRef.current) {
          animatedMessageIdsRef.current.add(msg.id);
        } else if (animatedMessageIdsRef.current) {
          animatedMessageIdsRef.current.add(msg.id);
        }

        // Show sender name on first message in group for all users
        const showSenderName = idx === 0;

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            showSender={showSenderName}
            isGroupHovered={isHovered}
            shouldAnimate={shouldAnimate}
          />
        );
      })}
    </div>
  );
};

// Inline Staggered Vertical Dot Bouncing Typing Indicator
const TypingIndicator: React.FC = () => {
  const { typingPeers, peers } = useChatStore();
  const [visible, setVisible] = useState(false);

  const typingIds = Array.from(typingPeers);
  const isTyping = typingIds.length > 0;

  useEffect(() => {
    if (isTyping) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000); // Fades out after 3s of no typing signal
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  if (!visible) return null;

  const senderName = typingIds
    .map((id) => peers.get(id)?.displayName)
    .filter(Boolean)
    .join(', ') || 'Someone';

  return (
    <div
      className="w-full flex flex-col mb-1 items-start transition-opacity duration-150 ease-in-out"
      style={{ opacity: isTyping ? 1 : 0 }}
    >
      <span className="text-[11px] font-mono text-text-muted ml-3 mb-1 select-none">
        {senderName} is typing...
      </span>
      <div className="bg-[#1f1f1f] border border-border-default/60 rounded-[12px_12px_12px_4px] px-4 py-3 flex items-center gap-1.5 h-8 ml-3">
        <span className="w-[5px] h-[5px] rounded-full bg-[#7a7a7a] pulsar-typing-dot-1" />
        <span className="w-[5px] h-[5px] rounded-full bg-[#7a7a7a] pulsar-typing-dot-2" />
        <span className="w-[5px] h-[5px] rounded-full bg-[#7a7a7a] pulsar-typing-dot-3" />
      </div>
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [pillRendered, setPillRendered] = useState(false);

  // Slice limit for message window virtualization
  const [visibleLimit, setVisibleLimit] = useState(200);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setHasNewMessages(false);
    }
  };

  // Monitor user scroll position to toggle scroll triggers
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 30;
    if (isNearBottom) {
      setHasNewMessages(false);
    }

    const isFar = scrollHeight - scrollTop - clientHeight > 200;
    setShowScrollButton(isFar);
  };

  // Auto-scroll when new messages arrive *only if* user is already near bottom
  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 300;
    if (isNearBottom) {
      setTimeout(scrollToBottom, 50);
      setHasNewMessages(false);
    } else {
      setHasNewMessages(true);
      setShowScrollButton(true);
    }
  }, [messages.length]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, []);

  // Control pill render lifecycle for exit animations
  useEffect(() => {
    if (hasNewMessages && showScrollButton) {
      setPillRendered(true);
    } else if (pillRendered) {
      const timer = setTimeout(() => setPillRendered(false), 150); // delay matching exit animation duration
      return () => clearTimeout(timer);
    }
  }, [hasNewMessages, showScrollButton, pillRendered]);

  const handleLoadMore = () => {
    setVisibleLimit((prev) => prev + 200);
  };

  // Helper to group consecutive messages
  const groupMessages = (msgs: Message[]) => {
    const groups: MessageGroup[] = [];

    msgs.forEach((msg, idx) => {
      const currentMsgDate = new Date(msg.ts).toDateString();
      const prevMsg = idx > 0 ? msgs[idx - 1] : null;
      const prevMsgDate = prevMsg ? new Date(prevMsg.ts).toDateString() : null;
      const showDateSeparator = currentMsgDate !== prevMsgDate;

      const isSameSender = prevMsg
        ? prevMsg.senderId === msg.senderId && prevMsg.type !== 'system'
        : false;
      
      // Group bubbles sent within 60s
      const isGrouped = isSameSender && (msg.ts - prevMsg!.ts) <= 60000 && !showDateSeparator;

      if (isGrouped && groups.length > 0 && msg.type !== 'system') {
        groups[groups.length - 1].messages.push(msg);
      } else {
        groups.push({
          groupId: `${msg.senderId}-${msg.ts}`,
          senderId: msg.senderId,
          senderName: msg.sender,
          isOwn: msg.isOwn,
          messages: [msg],
          showDateSeparator,
          dateStr: currentMsgDate === new Date().toDateString() ? 'TODAY' : currentMsgDate.toUpperCase(),
        });
      }
    });

    return groups;
  };

  const visibleMessages = messages.slice(-visibleLimit);
  const hasMore = messages.length > visibleLimit;
  const messageGroups = groupMessages(visibleMessages);

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
        {messageGroups.map((group) => (
          <React.Fragment key={group.groupId}>
            {group.showDateSeparator && (
              <div className="w-full flex justify-center py-4 select-none">
                <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 border border-border-default bg-[#161616]/40 rounded-sm">
                  {group.dateStr}
                </span>
              </div>
            )}
            
            <MessageGroupComponent
              group={group}
              animatedMessageIdsRef={animatedMessageIdsRef}
            />
          </React.Fragment>
        ))}

        {/* Typing indicator rendered at the end of logs flow */}
        <TypingIndicator />
      </div>

      {/* Floating scroll down pill button */}
      {pillRendered && (
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-[14px] py-1.5 bg-[#242424] border border-[#2e2e2e] text-[#ced0ce] hover:text-[#e6e8e6] rounded-[20px] font-sans text-xs shadow-lg transition-colors focus:outline-none z-10 select-none ${
            hasNewMessages && showScrollButton ? 'pulsar-pill-visible' : 'pulsar-pill-hidden'
          }`}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <span>New message</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
