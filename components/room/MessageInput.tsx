'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

const MAX_CHAR_LIMIT = 64000;
const WARNING_THRESHOLD = MAX_CHAR_LIMIT * 0.9; // 90% threshold to show counter

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendFile,
  onTyping,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

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
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setText('');
      
      // Cancel typing immediately upon sending
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
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
      setFileError(`File too large. Max ${maxMb}MB.`);
      setTimeout(() => setFileError(null), 4000);
      
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

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const characterCount = text.length;
  const showCounter = characterCount >= WARNING_THRESHOLD;

  return (
    <div className="border-t border-border-default bg-bg-primary px-4 py-3 flex flex-col gap-2 relative">
      {/* File Size Error Alert overlay */}
      {fileError && (
        <div className="absolute top-0 left-4 right-4 -translate-y-full bg-status-red/10 border border-status-red/30 px-3 py-2 rounded-t text-xs font-mono text-status-red flex items-center gap-2 select-none">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

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
            placeholder={disabled ? "Waiting for peers to join..." : "Write a message..."}
            disabled={disabled}
            className="w-full bg-[#1a1a1a] border border-border-default text-text-primary placeholder:text-text-muted font-sans text-[15px] rounded px-3 py-2 resize-none max-h-[120px] focus:outline-none focus:border-text-primary/60 focus:ring-1 focus:ring-text-primary/40 disabled:opacity-50 disabled:cursor-not-allowed leading-normal"
            style={{ height: '40px' }}
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
          className="w-10 h-10 p-0 rounded-full shrink-0"
          title="Send message"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
