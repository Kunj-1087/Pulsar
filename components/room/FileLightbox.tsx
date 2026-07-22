'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { FileRef, Message } from '../../types';
import { formatBytes } from '../../lib/utils';

interface FileLightboxProps {
  initialFileRef: FileRef;
  messages: Message[];
  onClose: () => void;
  onDownload: (fileRef: FileRef) => void;
}

export const FileLightbox: React.FC<FileLightboxProps> = ({
  initialFileRef,
  messages,
  onClose,
  onDownload,
}) => {
  const [activeImageId, setActiveImageId] = useState<string>(initialFileRef.id);

  // Get complete image messages in room
  const imageMessages = useMemo(() => {
    return messages.filter(
      (m) => m.type === 'file' && m.fileRef?.status === 'complete' && m.fileRef?.mimeType?.startsWith('image/')
    );
  }, [messages]);

  // Locate current active image context inside the lightbox
  const activeMsg = useMemo(() => {
    return (
      imageMessages.find((m) => m.fileRef?.id === activeImageId) ||
      (activeImageId === initialFileRef.id ? { fileRef: initialFileRef } : null)
    );
  }, [imageMessages, activeImageId, initialFileRef]);

  const activeFileRef = activeMsg?.fileRef || initialFileRef;
  const activeBlob = activeFileRef.blob;
  const activeName = activeFileRef.name;
  const activeSize = activeFileRef.size;

  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeBlob && activeFileRef.mimeType?.startsWith('image/')) {
      const url = URL.createObjectURL(activeBlob);
      setActiveUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [activeBlob, activeFileRef]);

  // Keyboard navigation for image lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && imageMessages.length > 1) {
        const currentIdx = imageMessages.findIndex((m) => m.fileRef?.id === activeImageId);
        if (currentIdx !== -1) {
          const nextIdx = (currentIdx + 1) % imageMessages.length;
          setActiveImageId(imageMessages[nextIdx].fileRef!.id);
        }
      } else if (e.key === 'ArrowLeft' && imageMessages.length > 1) {
        const currentIdx = imageMessages.findIndex((m) => m.fileRef?.id === activeImageId);
        if (currentIdx !== -1) {
          const prevIdx = (currentIdx - 1 + imageMessages.length) % imageMessages.length;
          setActiveImageId(imageMessages[prevIdx].fileRef!.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeImageId, imageMessages]);

  if (!activeUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-base/95 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeUrl}
          alt={activeName}
          className="max-w-[95vw] max-h-[85vh] object-contain border border-border rounded bg-bg-base"
        />

        <div className="mt-4 flex gap-4 text-caption font-mono text-fg-muted select-none items-center bg-bg-base/60 px-4 py-2 rounded border border-border/30">
          <span className="truncate max-w-[200px]">
            {activeName} ({formatBytes(activeSize)})
          </span>
          {imageMessages.length > 1 && (
            <span className="text-micro text-fg-muted">Use ← and → to browse</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(activeFileRef);
            }}
            className="text-fg-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none cursor-pointer p-1 bg-bg-base/60 border border-border/40 rounded-full"
          aria-label="Close Lightbox"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
