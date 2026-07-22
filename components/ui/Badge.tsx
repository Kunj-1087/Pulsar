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
          // Connected: nebula teal
          "border-nebula/30 bg-nebula/10 text-nebula": variant === 'connected',
          // Connecting: accretion amber
          "border-accretion/30 bg-accretion/10 text-accretion": variant === 'connecting',
          // Disconnected: redshift red
          "border-redshift/30 bg-redshift/10 text-redshift": variant === 'disconnected',
          // LAN: pulsar cyan
          "border-pulsar/30 bg-pulsar/10 text-pulsar": variant === 'lan',
          // Default
          "border-dim bg-surface text-fg-primary": variant === 'default',
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
              "bg-nebula": variant === 'connected',
              "bg-accretion": variant === 'connecting',
              "bg-redshift": variant === 'disconnected',
              "animate-pulse": isPulsing,
            }
          )}
        />
      )}
      <span>{label}</span>
    </span>
  );
};
