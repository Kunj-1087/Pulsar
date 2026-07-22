import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'connected' | 'connecting' | 'disconnected' | 'lan' | 'default';
  label: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', label, className, ...props }) => {
  const isPulsing = variant === 'connecting';
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-mono border",
        {
          // Connected: photon green
          "border-photon/30 bg-photon/10 text-photon": variant === 'connected',
          // Connecting: pulse amber
          "border-pulse/30 bg-pulse/10 text-pulse": variant === 'connecting',
          // Disconnected: decay red
          "border-decay/30 bg-decay/10 text-decay": variant === 'disconnected',
          // LAN: flux cyan
          "border-flux/30 bg-flux/10 text-flux": variant === 'lan',
          // Default
          "border-border bg-bg-surface text-fg-primary": variant === 'default',
        },
        className
      )}
      {...props}
    >
      {/* Dot indicator */}
      {['connected', 'connecting', 'disconnected'].includes(variant) && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            {
              "bg-photon": variant === 'connected',
              "bg-pulse": variant === 'connecting',
              "bg-decay": variant === 'disconnected',
              "animate-pulse": isPulsing,
            }
          )}
        />
      )}
      <span>{label}</span>
    </span>
  );
};
