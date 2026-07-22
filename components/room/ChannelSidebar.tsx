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

  // On mount, auto-create #general if empty
  useEffect(() => {
    if (channels.length === 0 && room?.roomId) {
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
  }, [channels.length, room?.roomId, isHost, myPeerId, addChannel, setActiveChannel]);

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

    // 1. Add to store
    addChannel(newChannel);
    // 2. Persist to DB
    createChannel(newChannel);
    // 3. Broadcast
    broadcastChannelCreate(newChannel);
    // 4. Set as active
    setActiveChannel(newChannel.id);

    // Reset input
    setNewChannelName('');
    setIsAdding(false);
  };

  const handleDeleteChannel = (e: React.MouseEvent, channel: Channel) => {
    e.stopPropagation();
    if (channel.name === 'general') return;

    // 1. Remove from store
    removeChannel(channel.id);
    // 2. Delete from DB
    deleteChannel(channel.id);
    // 3. Broadcast
    broadcastChannelDelete(channel.id);
  };

  return (
    <aside className="w-60 flex-shrink-0 bg-surface border-r border-border h-full flex flex-col justify-between p-4 select-none">
      <div className="flex-1 overflow-y-auto">
        <div className="font-mono text-[11px] text-text-muted uppercase tracking-widest mb-3">
          CHANNELS
        </div>

        <div className="space-y-1">
          {channels.map((ch) => {
            const isActive = ch.id === activeChannelId;

            return (
              <div
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                  isActive
                    ? 'border-l-2 border-accent bg-elevated text-primary font-medium'
                    : 'text-text-secondary hover:bg-elevated'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-text-muted font-mono">#</span>
                  <span className="truncate">{ch.name}</span>
                </div>

                {isHost && ch.name !== 'general' && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChannel(e, ch)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent p-0.5 transition-all focus:outline-none"
                    title="Delete channel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add channel button / inline input */}
      <div className="pt-3 border-t border-border">
        {isAdding ? (
          <div className="flex items-center gap-1">
            <span className="text-text-muted font-mono text-sm pl-1">#</span>
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
              className="w-full bg-elevated border border-border focus:border-accent text-primary text-xs px-2 py-1 rounded outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleCreateChannel}
              className="text-text-muted hover:text-primary p-1 focus:outline-none"
            >
              <Check className="w-4 h-4 text-accent" />
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-text-muted hover:text-primary p-1 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-mono text-text-muted hover:text-text-primary hover:bg-elevated rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Channel</span>
          </button>
        )}
      </div>
    </aside>
  );
};
