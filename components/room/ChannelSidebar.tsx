'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Channel } from '../../types';
import { generateId } from '../../lib/utils';
import { createChannel, deleteChannel } from '../../lib/storage';
import { broadcastChannelCreate, broadcastChannelDelete } from '../../lib/webrtc';

export const ChannelSidebar: React.FC = () => {
  const {
    channels,
    activeChannelId,
    setActiveChannel,
    addChannel,
    removeChannel,
    room,
    myPeerId,
  } = useChatStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const isHost = room?.isHost ?? false;

  // Fix: Deduplicate channels by id
  const uniqueChannels = channels.filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
  );

  // On mount, auto-create #general if empty
  useEffect(() => {
    if (uniqueChannels.length === 0 && room?.roomId) {
      const generalChannel: Channel = {
        id: generateId(),
        roomId: room.roomId,
        name: 'general',
        createdAt: Date.now(),
        createdBy: myPeerId || 'system',
      };
      addChannel(generalChannel);
      createChannel(generalChannel);
      setActiveChannel(generalChannel.id);
      if (isHost) {
        broadcastChannelCreate(generalChannel);
      }
    }
  }, [uniqueChannels.length, room?.roomId, isHost, myPeerId, addChannel, setActiveChannel]);

  const handleCreateChannel = () => {
    const cleanName = newChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    if (!cleanName || !room?.roomId) return;

    const newChannel: Channel = {
      id: generateId(),
      roomId: room.roomId,
      name: cleanName,
      createdAt: Date.now(),
      createdBy: myPeerId || 'user',
    };

    addChannel(newChannel);
    createChannel(newChannel);
    broadcastChannelCreate(newChannel);
    setActiveChannel(newChannel.id);

    setNewChannelName('');
    setIsAdding(false);
  };

  const handleDeleteChannel = (e: React.MouseEvent, channel: Channel) => {
    e.stopPropagation();
    if (channel.name === 'general') return;

    removeChannel(channel.id);
    deleteChannel(channel.id);
    broadcastChannelDelete(channel.id);
  };

  return (
    <aside className="w-[240px] flex-shrink-0 bg-surface border-r border-border h-full flex flex-col font-sans select-none overflow-y-auto">
      {/* Section Header */}
      <div className="px-3 pt-4 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        CHANNELS
      </div>

      {/* Channel List Items */}
      <div className="flex-1 space-y-0.5">
        {uniqueChannels.map((ch) => {
          const isActive = ch.id === activeChannelId;

          return (
            <div
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`group relative flex items-center h-8 px-2 mx-1 rounded text-sm cursor-pointer transition-colors ${
                isActive
                  ? 'bg-elevated text-text-primary font-medium border-l-2 border-accent'
                  : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
              }`}
            >
              <span className="text-text-muted font-normal mr-1.5">#</span>
              <span className="truncate text-[14px]">{ch.name}</span>

              {isHost && ch.name !== 'general' && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteChannel(e, ch)}
                  className="opacity-0 group-hover:opacity-100 absolute right-2 text-text-muted hover:text-accent p-1 transition-all focus:outline-none"
                  title="Delete channel"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Channel Button / Inline Input */}
        <div className="pt-2 px-1">
          {isAdding ? (
            <div className="flex items-center gap-1 bg-elevated border border-border focus-within:border-accent rounded px-2 py-1">
              <span className="text-text-muted text-xs">#</span>
              <input
                type="text"
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChannel();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                placeholder="channel-name"
                className="w-full bg-transparent text-text-primary text-[13px] font-sans outline-none placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={handleCreateChannel}
                className="text-text-muted hover:text-text-primary p-0.5 focus:outline-none"
              >
                <Check className="w-3.5 h-3.5 text-accent" />
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-text-muted hover:text-text-primary p-0.5 focus:outline-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 w-full h-8 px-2 text-[13px] text-text-muted hover:text-text-primary hover:bg-elevated rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Channel</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
