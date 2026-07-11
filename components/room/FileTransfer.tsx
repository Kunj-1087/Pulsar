'use client';

import React, { useState, useEffect } from 'react';
import { File, Download, Image as ImageIcon, AlertTriangle, Eye } from 'lucide-react';
import { FileRef } from '../../types';
import { formatBytes, cn } from '../../lib/utils';
import { Button } from '../ui/Button';

interface FileTransferProps {
  fileRef: FileRef;
  isOwn: boolean;
}

export const FileTransfer: React.FC<FileTransferProps> = ({ fileRef }) => {
  const { name, size, mimeType, blob, progress = 0, status } = fileRef;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const [localStatus, setLocalStatus] = useState(status);
  const [localProgress, setLocalProgress] = useState(progress);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (status === 'complete') {
      setLocalProgress(100);
      setHasCompleted(true);
      const timer = setTimeout(() => {
        setLocalStatus('complete');
      }, 200); // 200ms delay for completion visual flash
      return () => clearTimeout(timer);
    } else {
      setLocalStatus(status);
      setLocalProgress(progress);
      setHasCompleted(false);
    }
  }, [status, progress]);

  // Setup preview URL for images when blob becomes available
  useEffect(() => {
    if (blob && mimeType.startsWith('image/')) {
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [blob, mimeType]);

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isImage = mimeType.startsWith('image/');

  return (
    <div className="w-full max-w-[280px] p-2 rounded bg-black/20 border border-border-default/50 font-mono text-xs">
      {/* File info header */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="p-2 bg-bg-surface border border-border-default rounded text-text-bright shrink-0">
          {isImage ? (
            <ImageIcon className="w-4 h-4 text-text-primary" />
          ) : (
            <File className="w-4 h-4 text-text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans font-medium text-text-bright truncate" title={name}>
            {name}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">{formatBytes(size)}</p>
        </div>
      </div>

      {/* Progress & Actions */}
      {localStatus === 'complete' && blob && (
        <div className="space-y-2 mt-2">
          {isImage && imageUrl && (
            <div className="relative group cursor-zoom-in rounded overflow-hidden border border-border-default/30 max-h-[160px] bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={name}
                className="w-full object-cover max-h-[160px]"
                onClick={() => setShowLightbox(true)}
              />
              <button
                onClick={() => setShowLightbox(true)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-text-bright transition-opacity duration-150"
              >
                <Eye className="w-4 h-4" />
                <span>View Fullscreen</span>
              </button>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="w-full h-8 flex items-center justify-center gap-1.5 pulsar-download-in"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </Button>
        </div>
      )}

      {/* Sending/Receiving Progress Bar */}
      {(localStatus === 'sending' || localStatus === 'receiving') && (
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between text-[9px] text-text-muted">
            <span className="capitalize">{localStatus}...</span>
            <span>{localProgress}%</span>
          </div>
          <div className="w-full h-1 bg-border-default rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                hasCompleted ? "bg-[#e6e8e6]" : "bg-text-primary"
              )}
              style={{
                width: `${localProgress}%`,
                transitionProperty: 'width, background-color',
                transitionDuration: hasCompleted ? '200ms' : '80ms',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-status-red mt-2 py-1 px-2 border border-status-red/20 bg-status-red/10 rounded">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Transfer failed</span>
        </div>
      )}

      {/* Lightbox full-size image overlay */}
      {showLightbox && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-[#0c0c0c]/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={name}
              className="max-w-[95vw] max-h-[85vh] object-contain border border-border-default rounded bg-black"
            />
            <div className="mt-4 flex gap-4 text-xs font-mono text-text-muted select-none">
              <span>{name} ({formatBytes(size)})</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="text-text-bright hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
