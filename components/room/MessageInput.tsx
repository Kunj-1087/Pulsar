'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { toast } from '../../store/toastStore';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
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
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Load draft text on mount/room change, and autofocus input
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = sessionStorage.getItem(`pulsar_draft_${roomId}`);
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
    
    // Reset height
    textarea.style.height = 'auto';
    // Set to scrollHeight (bounded between 40px and 120px)
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
    textarea.style.height = `${nextHeight}px`;
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHAR_LIMIT) {
      setText(val);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`pulsar_draft_${roomId}`, val);
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
        // Handle typing notifications
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          onTyping(true);
        }
        
        // Reset typing timeout on new keystrokes
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
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setText('');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`pulsar_draft_${roomId}`);
      }
      
      // Trigger temporary opacity flash
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 100);

      // Cancel typing immediately upon sending
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isTypingRef.current = false;
      onTyping(false);

      // Focus back on textarea
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 100;
    const maxBytes = maxMb * 1024 * 1024;

    if (selectedFile.size > maxBytes) {
      toast.error(`File too large. Maximum size is ${maxMb}MB.`, { title: 'File Limit' });
      
      // Clear value
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    onSendFile(selectedFile);
    
    // Clear value so the same file can be sent again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileSelect = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
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

  // Clean up typing timeout on unmount
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

  return (
    <div className="border-t border-border-default bg-bg-primary px-4 py-3 flex flex-col gap-2 relative">

      <div className="flex items-end gap-3.5">
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
          className="w-10 h-10 p-0 rounded-full shrink-0 border border-border-default/80 hover:bg-bg-surface"
          title="Attach file (Max 100MB)"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5 text-text-primary" />
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
            placeholder={disabled ? "Waiting for peers to join..." : "Write a message..."}
            disabled={disabled}
            className={cn(
              "w-full bg-[#1a1a1a] border border-border-default text-text-primary placeholder:text-text-muted font-sans text-[15px] rounded px-3 py-2 resize-none max-h-[120px] focus:outline-none focus:border-text-primary/60 focus:ring-1 focus:ring-text-primary/40 disabled:opacity-50 disabled:cursor-not-allowed leading-normal transition-opacity duration-100",
              isFlashing && "opacity-60"
            )}
            style={{ height: '40px' }}
          />
          <span
            className={cn(
              "absolute bottom-0 left-0 w-full h-[1px] bg-[#ced0ce]/60 origin-center transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none",
              isFocused ? "scale-x-100" : "scale-x-0"
            )}
          />
          {showCounter && (
            <span className="absolute bottom-2.5 right-3.5 text-[10px] font-mono text-status-yellow select-none bg-black/60 px-1 rounded">
              {characterCount} / {MAX_CHAR_LIMIT}
            </span>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className={cn(
            "w-10 h-10 p-0 rounded-full shrink-0 transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] border border-transparent",
            text.trim()
              ? "bg-[#e6e8e6] text-[#191919] hover:bg-[#e6e8e6]/90"
              : "bg-bg-surface text-text-muted border-border-default cursor-not-allowed"
          )}
          title="Send message"
          aria-label="Send message"
        >
          <Send
            className="w-4 h-4 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={text.trim() ? { transform: 'rotate(15deg)' } : undefined}
          />
        </Button>
      </div>
    </div>
  );
};
