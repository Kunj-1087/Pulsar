import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { File, Download, Image as ImageIcon, AlertTriangle, Eye } from 'lucide-react';
import { FileRef } from '../../types';
import { formatBytes, cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { useChatStore } from '../../store/chatStore';

const FileLightbox = dynamic(
  () => import('./FileLightbox').then((m) => m.FileLightbox),
  { ssr: false }
);

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

  const { messages } = useChatStore();
  const [activeImageId, setActiveImageId] = useState(fileRef.id);

  const [speed, setSpeed] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const lastUpdateRef = useRef<{ ts: number; progress: number }>({ ts: Date.now(), progress: 0 });

  const [startTime] = useState(() => Date.now());
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'complete') {
      setLocalProgress(100);
      setHasCompleted(true);
      const timer = setTimeout(() => {
        setLocalStatus('complete');
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setLocalStatus(status);
      setLocalProgress(progress);
      setHasCompleted(false);
    }
  }, [status, progress]);

  // Track total duration upon completion
  useEffect(() => {
    if (status === 'complete' && !duration) {
      setDuration(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
    }
  }, [status, startTime, duration]);

  // Calculate speed and ETA
  useEffect(() => {
    if (status === 'sending' || status === 'receiving') {
      const now = Date.now();
      const durationSec = (now - lastUpdateRef.current.ts) / 1000;
      
      if (durationSec >= 0.5) {
        const progressDiff = progress - lastUpdateRef.current.progress;
        const bytesDiff = (size * progressDiff) / 100;
        const currentSpeed = bytesDiff / durationSec;
        
        setSpeed(currentSpeed);
        
        if (currentSpeed > 0) {
          const bytesRemaining = (size * (100 - progress)) / 100;
          const currentEta = bytesRemaining / currentSpeed;
          setEta(currentEta);
        } else {
          setEta(null);
        }
        
        lastUpdateRef.current = { ts: now, progress };
      }
    } else {
      setSpeed(null);
      setEta(null);
      lastUpdateRef.current = { ts: Date.now(), progress: 0 };
    }
  }, [progress, status, size]);

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  const formatEta = (seconds: number) => {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Sync activeImageId when lightbox opens
  useEffect(() => {
    if (showLightbox) {
      setActiveImageId(fileRef.id);
    }
  }, [showLightbox, fileRef.id]);

  // Get complete images in room
  const imageMessages = useMemo(() => {
    return messages.filter(
      (m) => m.type === 'file' && m.fileRef?.status === 'complete' && m.fileRef?.mimeType?.startsWith('image/')
    );
  }, [messages]);

  // Locate current active image context inside the lightbox
  const activeMsg = useMemo(() => {
    return imageMessages.find((m) => m.fileRef?.id === activeImageId) || (activeImageId === fileRef.id ? { fileRef } : null);
  }, [imageMessages, activeImageId, fileRef]);

  const activeBlob = activeMsg?.fileRef?.blob;
  const activeName = activeMsg?.fileRef?.name || name;
  const activeSize = activeMsg?.fileRef?.size || size;

  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeBlob && activeMsg?.fileRef?.mimeType?.startsWith('image/')) {
      const url = URL.createObjectURL(activeBlob);
      setActiveUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [activeBlob, activeMsg]);

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (!showLightbox) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLightbox(false);
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
  }, [showLightbox, activeImageId, imageMessages]);

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
    const activeToDownload = activeBlob || blob;
    const nameToDownload = activeName || name;
    if (!activeToDownload) return;

    const url = URL.createObjectURL(activeToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = nameToDownload;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent('quark-cancel-transfer', {
      detail: { fileId: fileRef.id }
    }));
  };

  const isImage = mimeType.startsWith('image/');

  return (
    <div className="w-full max-w-[280px] p-2 rounded bg-bg-base/20 border border-border/50 font-mono text-caption">
      {/* File info header */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="p-2 bg-bg-surface border border-border rounded text-fg-primary shrink-0">
          {isImage ? (
            <ImageIcon className="w-4 h-4 text-fg-primary" />
          ) : (
            <File className="w-4 h-4 text-fg-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans font-medium text-fg-primary truncate" title={name}>
            {name}
          </p>
          <p className="text-micro text-fg-muted mt-0.5">{formatBytes(size)}</p>
        </div>
      </div>

      {/* Progress & Actions */}
      {localStatus === 'complete' && blob && (
        <div className="space-y-2 mt-2">
          {isImage && imageUrl && (
            <div className="relative group cursor-zoom-in rounded overflow-hidden border border-border/30 max-h-[160px] bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={name}
                className="w-full object-cover max-h-[160px]"
                onClick={() => setShowLightbox(true)}
              />
              <button
                onClick={() => setShowLightbox(true)}
                className="absolute inset-0 bg-bg-base/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-fg-primary transition-opacity duration-150"
              >
                <Eye className="w-4 h-4" />
                <span>View</span>
              </button>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="w-full h-8 flex items-center justify-center gap-1.5 quark-download-in"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </Button>

          {duration !== null && (
            <p className="text-micro text-fg-muted text-center pt-0.5 select-none">
              transferred in {duration}s
            </p>
          )}
        </div>
      )}

      {/* Sending/Receiving Progress Bar */}
      {(localStatus === 'sending' || localStatus === 'receiving') && (
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between items-center text-micro text-fg-muted">
            <span className="capitalize">{localStatus}...</span>
            <span>{localProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-elevated border border-dim rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                hasCompleted ? "bg-nebula shadow-[0_0_12px_rgba(204,204,204,0.4)]" : "bg-pulsar shadow-[0_0_12px_rgba(229,9,20,0.4)]"
              )}
              style={{
                width: `${localProgress}%`,
                transitionProperty: 'width, background-color',
                transitionDuration: hasCompleted ? '200ms' : '80ms',
                transitionTimingFunction: 'var(--ease-standard)',
              }}
            />
          </div>
          
          <div className="flex justify-between items-center text-micro text-fg-muted mt-1 select-none">
            <div>
              {speed !== null && speed > 0 && (
                <span>{formatSpeed(speed)}</span>
              )}
            </div>
            <div>
              {eta !== null && eta > 0 && (
                <span>{formatEta(eta)} left</span>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-1.5 border-t border-dim/50 pt-1">
            <button
              onClick={handleCancel}
              className="text-micro text-redshift hover:underline font-mono transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-decay mt-2 py-1 px-2 border border-decay/20 bg-decay/10 rounded">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Failed</span>
        </div>
      )}

      {/* Cancelled state */}
      {status === 'cancelled' && (
        <div className="flex items-center gap-1.5 text-pulse mt-2 py-1 px-2 border border-pulse/20 bg-pulse/10 rounded">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Cancelled</span>
        </div>
      )}

      {/* Lightbox full-size image overlay */}
      {showLightbox && (
        <FileLightbox
          initialFileRef={fileRef}
          messages={messages}
          onClose={() => setShowLightbox(false)}
          onDownload={(targetRef) => {
            if (targetRef.blob) {
              const url = URL.createObjectURL(targetRef.blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = targetRef.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          }}
        />
      )}
    </div>
  );
};
