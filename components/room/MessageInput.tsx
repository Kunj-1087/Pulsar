'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, File, FileImage, FileText } from 'lucide-react';
import { formatBytes } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useChatStore } from '../../store/chatStore';
import { broadcastTyping } from '../../lib/webrtc';

interface MessageInputProps {
  onSendMessage: (text: string, disappearAfterMs?: number) => void;
  onSendFile: (file: File) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  roomId: string;
}

const MAX_CHAR_LIMIT = 64000;

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendFile,
  onTyping,
  disabled = false,
  roomId,
}) => {
  const { replyingTo, setReplyingTo, peers, channels, activeChannelId } = useChatStore();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeChannelName = activeChannel ? activeChannel.name : 'general';

  // Resolve replying handle
  let replyingHandle = replyingTo?.sender || '';
  if (replyingTo && !replyingTo.isOwn) {
    const peer = peers.get(replyingTo.senderId);
    if (peer) {
      replyingHandle = peer.handle || peer.displayName || replyingTo.sender;
    }
  }

  // Auto-focus input on mount
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [roomId, disabled]);

  // Auto-resize textarea (max 5 lines ~ 120px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 24), 120);
    textarea.style.height = `${nextHeight}px`;
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHAR_LIMIT) {
      setText(val);

      if (val.trim() !== '') {
        const now = Date.now();
        if (now - lastTypingBroadcastRef.current >= 1500) {
          lastTypingBroadcastRef.current = now;
          broadcastTyping(activeChannelId || '');
        }
      }
    }
  };

  const canSend = !disabled && (!!text.trim() || !!selectedFile);

  const handleSend = () => {
    if (!canSend) return;

    const trimmed = text.trim();

    if (selectedFile && !disabled) {
      onSendFile(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setText('');
      textareaRef.current?.focus();
    }

    if (replyingTo) {
      setReplyingTo(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSend();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 100;
    const maxBytes = maxMb * 1024 * 1024;

    if (file.size > maxBytes) {
      toast.error(`File too large. Maximum size is ${maxMb}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const triggerFileSelect = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-surface border-t border-border flex flex-col font-sans select-none shrink-0">
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="bg-accent-muted border-l-2 border-accent px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-text-secondary truncate pr-2">
            Replying to @{replyingHandle}: {replyingTo.text?.substring(0, 80)}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-text-muted hover:text-text-primary focus:outline-none p-0.5"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File Preview Chip */}
      {selectedFile && (
        <div className="px-4 pt-2">
          <div className="bg-elevated border border-border rounded px-2.5 py-1.5 flex items-center justify-between text-[13px] text-text-secondary">
            <div className="flex items-center gap-2 truncate">
              {selectedFile.type.startsWith('image/') ? (
                <FileImage className="w-4 h-4 text-accent shrink-0" />
              ) : selectedFile.type.startsWith('text/') ? (
                <FileText className="w-4 h-4 text-accent shrink-0" />
              ) : (
                <File className="w-4 h-4 text-accent shrink-0" />
              )}
              <span className="text-text-primary font-medium truncate">{selectedFile.name}</span>
              <span className="text-text-muted font-mono shrink-0">({formatBytes(selectedFile.size)})</span>
            </div>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="text-text-muted hover:text-text-primary focus:outline-none p-0.5"
              title="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Inner Input Row */}
      <div className="px-4 py-3">
        <div className="bg-elevated border border-border focus-within:border-accent rounded px-3 py-2 flex items-center gap-2 transition-colors">
          {/* File Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={disabled}
            className="text-text-muted hover:text-text-primary transition-colors focus:outline-none shrink-0 p-0.5"
            title="Attach file (Max 100MB)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Waiting for peers..." : `Message #${activeChannelName}`}
            disabled={disabled}
            className="w-full bg-transparent text-text-primary placeholder:text-text-muted text-[14px] font-sans resize-none max-h-[120px] focus:outline-none leading-normal"
            style={{ height: '24px' }}
          />

          {/* Send Button (32px x 32px rounded 4px) */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors ${
              canSend
                ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer'
                : 'bg-overlay text-text-muted cursor-not-allowed'
            }`}
            title="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
