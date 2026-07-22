'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, File, FileImage, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn, formatBytes } from '../../lib/utils';
import { toast } from '../../store/toastStore';
import { useChatStore } from '../../store/chatStore';

interface MessageInputProps {
  onSendMessage: (text: string, disappearAfterMs?: number) => void;
  onSendFile: (file: File) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  roomId: string;
}

const MAX_CHAR_LIMIT = 64000;
const WARNING_THRESHOLD = MAX_CHAR_LIMIT * 0.9; // 90% threshold to show counter

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendFile,
  onTyping,
  disabled = false,
  roomId,
}) => {
  const { replyingTo, setReplyingTo, peers } = useChatStore();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Resolve replying handle
  let replyingHandle = replyingTo?.sender || '';
  if (replyingTo && !replyingTo.isOwn) {
    const peer = peers.get(replyingTo.senderId);
    if (peer) {
      replyingHandle = peer.handle || peer.displayName || replyingTo.sender;
    }
  }

  // Load draft text on mount/room change, and autofocus input
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = sessionStorage.getItem(`quark_draft_${roomId}`);
      if (savedDraft) {
        setText(savedDraft);
      }
    }
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [roomId, disabled]);

  // Auto-resize the text input box based on content lines
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
    textarea.style.height = `${nextHeight}px`;
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHAR_LIMIT) {
      setText(val);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`quark_draft_${roomId}`, val);
      }

      if (val === '') {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          onTyping(false);
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      } else {
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          onTyping(true);
        }

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          isTypingRef.current = false;
          onTyping(false);
        }, 1500);
      }
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();

    // 1. Send file if selected
    if (selectedFile && !disabled) {
      onSendFile(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // 2. Send text message if non-empty
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setText('');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`quark_draft_${roomId}`);
      }

      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 100);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isTypingRef.current = false;
      onTyping(false);

      textareaRef.current?.focus();
    }

    // Clear reply state after send
    if (replyingTo) {
      setReplyingTo(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 100;
    const maxBytes = maxMb * 1024 * 1024;

    if (file.size > maxBytes) {
      toast.error(`File too large. Maximum size is ${maxMb}MB.`, { title: 'File Limit' });
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

  const handleBlur = () => {
    setIsFocused(false);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  const characterCount = text.length;
  const showCounter = characterCount >= WARNING_THRESHOLD;
  const canSend = !disabled && (!!text.trim() || !!selectedFile);

  return (
    <div className="border-t border-dim bg-void flex flex-col relative select-none">
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="bg-accent-muted border-t border-accent px-4 py-2 flex items-center justify-between text-xs font-sans">
          <span className="text-text-secondary truncate pr-2">
            Replying to @{replyingHandle}: {replyingTo.text?.substring(0, 60)}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-text-muted hover:text-accent focus:outline-none p-0.5"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* File Preview Chip */}
      {selectedFile && (
        <div className="px-4 pt-2">
          <div className="bg-elevated border border-border rounded px-3 py-2 flex items-center justify-between text-xs">
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
              className="text-text-muted hover:text-accent focus:outline-none p-0.5"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] flex items-end gap-3.5">
        {/* Attachment Button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <Button
          variant="ghost"
          onClick={triggerFileSelect}
          disabled={disabled}
          className="w-11 h-11 md:w-10 md:h-10 p-0 rounded-full shrink-0 border border-dim hover:bg-surface-hover hover:border-border-strong flex items-center justify-center"
          title="Attach file (Max 100MB)"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5 text-text-muted hover:text-accent transition-colors" />
        </Button>

        {/* Text Area Input */}
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder={disabled ? "waiting for peers..." : "type a message"}
            disabled={disabled}
            className={cn(
              "w-full bg-surface border border-dim text-fg-primary placeholder:text-fg-subtle font-sans text-body rounded px-3 py-2 resize-none max-h-[120px] focus:outline-none focus:border-pulsar focus:ring-1 focus:ring-pulsar/40 disabled:opacity-50 disabled:cursor-not-allowed leading-normal transition-opacity duration-100",
              isFlashing && "opacity-60"
            )}
            style={{ height: '40px' }}
          />
          {isFocused && !text && !disabled && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body font-mono text-pulsar pointer-events-none animate-cursor-blink">
              █
            </span>
          )}
          <span
            className={cn(
              "absolute bottom-0 left-0 w-full h-[1.5px] bg-pulsar origin-center transition-transform duration-150 ease-standard pointer-events-none",
              isFocused ? "scale-x-100" : "scale-x-0"
            )}
          />
          {showCounter && (
            <span className="absolute bottom-2.5 right-3.5 text-micro font-mono text-accretion select-none bg-void/80 px-1 rounded border border-dim">
              {characterCount} / {MAX_CHAR_LIMIT}
            </span>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "w-11 h-11 md:w-10 md:h-10 p-0 rounded-full shrink-0 transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] border border-transparent flex items-center justify-center",
            canSend
              ? "bg-accent text-white hover:bg-accent-hover shadow-[0_0_16px_rgba(229,9,20,0.3)] font-bold"
              : "bg-surface text-fg-subtle border-dim cursor-not-allowed"
          )}
          title="Send message"
          aria-label="Send message"
        >
          <Send
            className="w-4 h-4 transition-transform duration-150 ease-standard"
            style={canSend ? { transform: 'rotate(15deg)' } : undefined}
          />
        </Button>
      </div>
    </div>
  );
};
