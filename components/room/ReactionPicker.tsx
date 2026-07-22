'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { updateMessageReactionsInDB } from '../../lib/storage';

type ReactionPickerProps = {
  messageId: string;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
};

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '🎉'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  messageId,
  onClose,
  anchorRef,
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const { myPeerId, activeChannelId, updateMessageReactions } = useChatStore();

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, anchorRef]);

  const handleEmojiClick = (emoji: string) => {
    if (!myPeerId) return;
    const channelId = activeChannelId || '';

    // 1. Close picker
    onClose();

    // 2. Optimistic update in Zustand
    updateMessageReactions(messageId, emoji, myPeerId, 'add');

    // 3. Persist to DB
    updateMessageReactionsInDB(messageId, emoji, myPeerId, 'add');

    // 4. Dispatch custom event for ChatWindow to broadcast
    window.dispatchEvent(
      new CustomEvent('quark-broadcast-react', {
        detail: {
          messageId,
          channelId,
          emoji,
          peerId: myPeerId,
          action: 'add',
        },
      })
    );
  };

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full right-0 mb-2 z-50 bg-overlay border border-border rounded-lg p-2 flex gap-1 shadow-lg animate-fade-in select-none"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleEmojiClick(emoji)}
          className="hover:bg-elevated rounded p-1 text-lg cursor-pointer transition-colors focus:outline-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
