'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
// @ts-ignore
import { VariableSizeList } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

const AutoSizerComp: any = AutoSizer;
const VariableSizeListComp: any = VariableSizeList || require('react-window').VariableSizeList;
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useChatStore } from '../../store/chatStore';

interface MessageListProps {
  messages: Message[];
  roomId: string;
}

function formatMessageDate(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

type FlatItem =
  | { type: 'date'; id: string; dateStr: string }
  | { type: 'message'; id: string; message: Message; isFirstInGroup: boolean };

const MessageRow: React.FC<{
  item: FlatItem;
  onHeightChange: (height: number) => void;
}> = ({ item, onHeightChange }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(entry.borderBoxSize[0]?.blockSize || entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeightChange]);

  if (item.type === 'date') {
    return (
      <div ref={rowRef} className="flex items-center gap-3 my-4 px-4 select-none">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-widest flex-shrink-0">
          {item.dateStr}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return (
    <div ref={rowRef}>
      <MessageBubble
        message={item.message}
        isFirstInGroup={item.isFirstInGroup}
      />
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({ messages, roomId }) => {
  const listRef = useRef<any>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const itemHeights = useRef<Map<number, number>>(new Map());
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const prevChannelId = useRef<string | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevMessageCount = useRef(messages.length);

  const { activeChannelId, channels } = useChatStore();

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeChannelName = activeChannel ? activeChannel.name : 'general';

  const channelMessages = useMemo(() => {
    if (!activeChannelId) return messages;
    return messages.filter((m) => {
      if (m.channelId) return m.channelId === activeChannelId;
      return activeChannelName === 'general';
    });
  }, [messages, activeChannelId, activeChannelName]);

  const flatItems = useMemo(() => {
    const items: FlatItem[] = [];
    let lastSenderId: string | null = null;
    let lastTs = 0;
    let lastDateStr = '';

    channelMessages.forEach((msg) => {
      const dateStr = formatMessageDate(msg.ts);
      const showDateDivider = dateStr !== lastDateStr;
      if (showDateDivider) {
        items.push({ type: 'date', id: `date-${msg.id}`, dateStr });
        lastDateStr = dateStr;
        lastSenderId = null; // force first in group after date divider
      }

      const isSameSender = msg.senderId === lastSenderId && msg.type !== 'system';
      const isWithin5Min = msg.ts - lastTs <= 300000;
      const isFirstInGroup = !isSameSender || !isWithin5Min;

      items.push({
        type: 'message',
        id: msg.id,
        message: msg,
        isFirstInGroup,
      });

      lastSenderId = msg.senderId;
      lastTs = msg.ts;
    });

    return items;
  }, [channelMessages]);

  const getItemSize = useCallback((index: number) => {
    return itemHeights.current.get(index) || (flatItems[index]?.type === 'date' ? 40 : 56);
  }, [flatItems]);

  const setItemSize = useCallback((index: number, size: number) => {
    if (itemHeights.current.get(index) !== size) {
      itemHeights.current.set(index, size);
      listRef.current?.resetAfterIndex(index, false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom < 150;
    setIsNearBottom(near);
    if (near) setUnreadCount(0);

    if (activeChannelId) {
      scrollPositions.current.set(activeChannelId, el.scrollTop);
    }
  }, [activeChannelId]);

  // Channel switch memory
  useEffect(() => {
    if (prevChannelId.current && outerRef.current) {
      scrollPositions.current.set(prevChannelId.current, outerRef.current.scrollTop);
    }
    prevChannelId.current = activeChannelId;
    itemHeights.current.clear();
    listRef.current?.resetAfterIndex(0);

    const savedPos = activeChannelId ? scrollPositions.current.get(activeChannelId) : undefined;
    if (savedPos !== undefined && outerRef.current) {
      outerRef.current.scrollTop = savedPos;
    } else {
      setTimeout(() => {
        if (flatItems.length > 0) {
          listRef.current?.scrollToItem(flatItems.length - 1, 'end');
        }
      }, 50);
    }
    setUnreadCount(0);
  }, [activeChannelId, flatItems.length]);

  // Auto-scroll on new messages
  useEffect(() => {
    const newCount = messages.length - prevMessageCount.current;
    prevMessageCount.current = messages.length;

    if (newCount <= 0) return;

    if (isNearBottom) {
      listRef.current?.scrollToItem(flatItems.length - 1, 'end');
      setUnreadCount(0);
    } else {
      setUnreadCount((prev) => prev + newCount);
    }
  }, [messages.length, isNearBottom, flatItems.length]);

  if (channelMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto font-sans">
        <div className="font-mono text-7xl text-text-muted mb-4 font-bold">#</div>
        <h2 className="text-text-primary text-lg font-semibold mb-1">
          This is the start of #{activeChannelName}
        </h2>
        <p className="text-text-muted text-sm">Send a message or share a file to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative flex flex-col">
      <TypingIndicator />

      <AutoSizerComp>
        {({ height, width }: { height: number; width: number }) => (
          <VariableSizeListComp
            ref={listRef}
            outerRef={outerRef}
            height={height}
            width={width}
            itemCount={flatItems.length}
            itemSize={getItemSize}
            onScroll={handleScroll}
            className="px-2"
          >
            {({ index, style }: { index: number; style: React.CSSProperties }) => (
              <div style={style}>
                <MessageRow
                  item={flatItems[index]}
                  onHeightChange={(h) => setItemSize(index, h)}
                />
              </div>
            )}
          </VariableSizeListComp>
        )}
      </AutoSizerComp>

      {unreadCount > 0 && (
        <button
          onClick={() => {
            listRef.current?.scrollToItem(flatItems.length - 1, 'end');
            setUnreadCount(0);
          }}
          className="
            absolute bottom-4 left-1/2 -translate-x-1/2
            flex items-center gap-2
            px-3 py-1.5 rounded
            bg-accent text-white
            text-xs font-medium font-sans
            hover:bg-accent-hover transition-colors
            z-10 shadow-lg cursor-pointer
          "
        >
          <span>↓ {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}</span>
        </button>
      )}
    </div>
  );
};
