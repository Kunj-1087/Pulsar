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
          // Connected: green dot
          "border-[#2e2e2e] bg-[#1d271e] text-[#4caf50]": variant === 'connected',
          // Connecting: yellow pulsing dot
          "border-[#2e2e2e] bg-[#2d281a] text-[#ffc107]": variant === 'connecting',
          // Disconnected: red dot
          "border-[#2e2e2e] bg-[#2d1d1d] text-[#ef5350]": variant === 'disconnected',
          // LAN: subtle
          "border-border-default bg-bg-surface text-text-muted": variant === 'lan',
          // Default
          "border-border-default bg-bg-surface text-text-primary": variant === 'default',
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
              "bg-status-green": variant === 'connected',
              "bg-status-yellow": variant === 'connecting',
              "bg-status-red": variant === 'disconnected',
              "animate-pulse": isPulsing,
            }
          )}
        />
      )}
      <span>{label}</span>
    </span>
  );
};
