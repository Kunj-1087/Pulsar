'use client';

import React from 'react';
import { useChatStore } from '../../store/chatStore';

export const TypingIndicator: React.FC = () => {
  const { typingPeers, activeChannelId, myPeerId } = useChatStore();

  const typers: string[] = [];
  typingPeers.forEach((data, peerId) => {
    if (peerId !== myPeerId && (!activeChannelId || data.channelId === activeChannelId)) {
      typers.push(data.handle);
    }
  });

  if (typers.length === 0) return null;

  let textContent: React.ReactNode;
  if (typers.length === 1) {
    textContent = (
      <>
        <span className="font-semibold text-text-secondary">@{typers[0]}</span> is typing
      </>
    );
  } else if (typers.length === 2) {
    textContent = (
      <>
        <span className="font-semibold text-text-secondary">@{typers[0]}</span> and{' '}
        <span className="font-semibold text-text-secondary">@{typers[1]}</span> are typing
      </>
    );
  } else {
    textContent = (
      <>
        <span className="font-semibold text-text-secondary">@{typers[0]}</span>,{' '}
        <span className="font-semibold text-text-secondary">@{typers[1]}</span> and{' '}
        <span className="font-semibold text-text-secondary">{typers.length - 2} others</span> are typing
      </>
    );
  }

  return (
    <div className="absolute bottom-[56px] left-4 z-10 h-[20px] flex items-center text-xs text-text-muted font-sans pointer-events-none select-none">
      <span>{textContent}</span>
      <span className="inline-flex gap-[2px] ml-1 items-center">
        <span className="typing-dot w-[3px] h-[3px] rounded-full bg-text-muted" />
        <span className="typing-dot w-[3px] h-[3px] rounded-full bg-text-muted" />
        <span className="typing-dot w-[3px] h-[3px] rounded-full bg-text-muted" />
      </span>
    </div>
  );
};
