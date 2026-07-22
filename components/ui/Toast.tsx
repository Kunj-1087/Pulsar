'use client';

import React, { useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { ToastItem, useToastStore } from '../../store/toastStore';
import { cn } from '../../lib/utils';

interface ToastProps {
  toast: ToastItem;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  const { id, type, title, message, duration, action } = toast;
  const dismissToast = useToastStore((state) => state.dismissToast);

  const defaultDuration = type === 'error' ? 0 : type === 'warning' ? 6000 : type === 'success' ? 3000 : 4000;
  const activeDuration = duration !== undefined ? duration : defaultDuration;

  useEffect(() => {
    if (activeDuration > 0) {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, activeDuration);
      return () => clearTimeout(timer);
    }
  }, [id, activeDuration, dismissToast]);

  const Icon = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
  }[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        "w-full max-w-sm bg-bg-elevated border border-border/80 font-mono text-caption text-fg-primary shadow-xl rounded overflow-hidden select-none p-3.5 flex items-start gap-3 transition-all duration-300 relative border-l-4 animate-[quark-toast-in_250ms_cubic-bezier(0.16,1,0.3,1)_forwards]",
        {
          "border-l-photon": type === 'success',
          "border-l-pulse": type === 'warning',
          "border-l-decay": type === 'error',
          "border-l-fg-muted": type === 'info',
        }
      )}
    >
      <Icon
        className={cn("w-4 h-4 shrink-0 mt-0.5", {
          "text-photon": type === 'success',
          "text-pulse": type === 'warning',
          "text-decay": type === 'error',
          "text-fg-muted": type === 'info',
        })}
      />

      <div className="flex-1 min-w-0 pr-4">
        {title && (
          <p className="font-bold text-fg-primary mb-0.5 tracking-wider uppercase text-micro">
            {title}
          </p>
        )}
        <p className="leading-relaxed font-sans text-fg-primary text-small">{message}</p>
        
        {action && (
          <button
            onClick={() => {
              action.onClick();
              dismissToast(id);
            }}
            className="mt-2 text-micro font-bold text-fg-primary hover:underline uppercase bg-bg-hover hover:bg-bg-active border border-border px-2 py-1 rounded-sm"
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => dismissToast(id)}
        className="absolute top-3 right-3 text-fg-muted hover:text-fg-primary transition-colors focus:outline-none"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
