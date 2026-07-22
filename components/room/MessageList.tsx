import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../store/chatStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import { QRCodeSVG } from 'qrcode.react';

interface MessageListProps {
  messages: Message[];
  roomId: string;
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
      <span className="text-caption font-mono text-fg-muted ml-3 mb-1 select-none">
        {senderName} is typing...
      </span>
      <div className="bg-bg-hover border border-border/60 rounded-[12px_12px_12px_4px] px-4 py-3 flex items-center gap-1.5 h-8 ml-3">
        <span className="w-[5px] h-[5px] rounded-full bg-fg-subtle quark-typing-dot-1" />
        <span className="w-[5px] h-[5px] rounded-full bg-fg-subtle quark-typing-dot-2" />
        <span className="w-[5px] h-[5px] rounded-full bg-fg-subtle quark-typing-dot-3" />
      </div>
    </div>
  );
};

type RenderableItem =
  | { type: 'date'; id: string; dateStr: string }
  | { type: 'group'; id: string; group: MessageGroup }
  | { type: 'typing'; id: string };

export const MessageList: React.FC<MessageListProps> = ({ messages, roomId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [pillRendered, setPillRendered] = useState(false);
  
  const { typingPeers, activeChannelId, channels } = useChatStore();

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const activeChannelName = activeChannel ? activeChannel.name : 'general';

  const channelMessages = useMemo(() => {
    if (!activeChannelId) return messages;
    return messages.filter(m => {
      if (m.channelId) {
        return m.channelId === activeChannelId;
      }
      return activeChannelName === 'general';
    });
  }, [messages, activeChannelId, activeChannelName]);

  const lastScrollCheckRef = useRef(0);
  
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

  const messageGroups = useMemo(() => {
    return groupMessages(channelMessages);
  }, [channelMessages]);

  const flatItems = useMemo(() => {
    const items: RenderableItem[] = [];
    messageGroups.forEach((group) => {
      if (group.showDateSeparator) {
        items.push({
          type: 'date',
          id: `date-${group.groupId}`,
          dateStr: group.dateStr,
        });
      }
      items.push({
        type: 'group',
        id: `group-${group.groupId}`,
        group,
      });
    });
    
    if (typingPeers.size > 0) {
      items.push({
        type: 'typing',
        id: 'typing-indicator',
      });
    }
    return items;
  }, [messageGroups, typingPeers.size]);

  // Setup virtualization
  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (!item) return 72;
      if (item.type === 'date') return 40;
      if (item.type === 'typing') return 60;
      return 60 + item.group.messages.length * 48;
    },
    overscan: 10,
  });

  const scrollToBottom = () => {
    if (flatItems.length > 0) {
      rowVirtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' });
      setHasNewMessages(false);
      setShowScrollButton(false);
    }
  };

  // Monitor user scroll position to toggle scroll triggers (throttled)
  const handleScroll = () => {
    const now = Date.now();
    if (now - lastScrollCheckRef.current < 200) return;
    lastScrollCheckRef.current = now;

    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 150;
    if (isNearBottom) {
      setHasNewMessages(false);
    }

    const isFar = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollButton(isFar);
  };

  // Auto-scroll when new messages arrive *only if* user is already near bottom or it is their own message
  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    const lastMsg = channelMessages[channelMessages.length - 1];
    const isOwnLastMessage = lastMsg ? lastMsg.isOwn : false;
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 250;

    if (isOwnLastMessage || isNearBottom) {
      setTimeout(() => {
        if (flatItems.length > 0) {
          rowVirtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' });
        }
      }, 50);
      setHasNewMessages(false);
      setShowScrollButton(false);
    } else {
      setHasNewMessages(true);
      setShowScrollButton(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelMessages.length, flatItems.length]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    setTimeout(() => {
      if (flatItems.length > 0) {
        rowVirtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' });
      }
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Control pill render lifecycle for exit animations
  useEffect(() => {
    if (hasNewMessages && showScrollButton) {
      setPillRendered(true);
    } else if (pillRendered) {
      const timer = setTimeout(() => setPillRendered(false), 150);
      return () => clearTimeout(timer);
    }
  }, [hasNewMessages, showScrollButton, pillRendered]);

  // Empty state renderer
  if (channelMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
        <div className="font-mono text-7xl text-text-muted mb-4 font-bold">
          #
        </div>
        <h2 className="text-text-secondary text-lg font-semibold mb-1">
          This is the start of #{activeChannelName}
        </h2>
        <p className="text-text-muted text-sm">
          Send a message or share a file to get started.
        </p>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div className="flex-1 min-h-0 relative flex flex-col">
      {/* Scroll area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth relative"
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = flatItems[virtualRow.index];
            if (!item) return null;

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {item.type === 'date' && (
                  <div className="w-full flex items-center justify-center my-4 select-none relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <span className="relative bg-base px-3 text-[11px] font-sans font-medium text-text-muted uppercase tracking-[0.08em]">
                      {item.dateStr}
                    </span>
                  </div>
                )}
                
                {item.type === 'group' && (
                  <MessageGroupComponent
                    group={item.group}
                    animatedMessageIdsRef={animatedMessageIdsRef}
                  />
                )}
                
                {item.type === 'typing' && (
                  <TypingIndicator />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating scroll down pill button */}
      {pillRendered && (
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 bg-bg-hover border border-border text-fg-secondary hover:text-fg-primary rounded-full font-sans text-caption shadow-lg transition-colors focus:outline-none z-10 select-none ${
            hasNewMessages && showScrollButton ? 'quark-pill-visible' : 'quark-pill-hidden'
          }`}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <span>New messages</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
