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
        "w-full max-w-sm bg-[#161616] border border-border-default/80 font-mono text-xs text-text-primary shadow-xl rounded overflow-hidden select-none p-3.5 flex items-start gap-3 transition-all duration-300 relative border-l-4 animate-[pulsar-toast-in_250ms_cubic-bezier(0.16,1,0.3,1)_forwards]",
        {
          "border-l-status-green": type === 'success',
          "border-l-status-yellow": type === 'warning',
          "border-l-status-red": type === 'error',
          "border-l-text-muted": type === 'info',
        }
      )}
    >
      <Icon
        className={cn("w-4 h-4 shrink-0 mt-0.5", {
          "text-status-green": type === 'success',
          "text-status-yellow": type === 'warning',
          "text-status-red": type === 'error',
          "text-text-muted": type === 'info',
        })}
      />

      <div className="flex-1 min-w-0 pr-4">
        {title && (
          <p className="font-bold text-text-bright mb-0.5 tracking-wider uppercase text-[10px]">
            {title}
          </p>
        )}
        <p className="leading-relaxed font-sans text-text-primary text-[13px]">{message}</p>
        
        {action && (
          <button
            onClick={() => {
              action.onClick();
              dismissToast(id);
            }}
            className="mt-2 text-[10px] font-bold text-text-bright hover:underline uppercase bg-[#242424] hover:bg-[#2d2d2d] border border-border-default px-2 py-1 rounded-sm"
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => dismissToast(id)}
        className="absolute top-3 right-3 text-text-muted hover:text-text-bright transition-colors focus:outline-none"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
