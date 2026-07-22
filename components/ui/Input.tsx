import React from 'react';
import { cn } from '../../lib/utils';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex w-full h-11 px-3.5 bg-surface border border-dim text-fg-primary placeholder:text-fg-subtle font-mono text-sm rounded-md transition-colors duration-150 focus:outline-none focus:border-pulsar focus:ring-1 focus:ring-pulsar/40 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
