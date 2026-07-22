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
          "flex w-full h-10 px-3 bg-bg-elevated border border-border text-fg-primary placeholder:text-fg-subtle font-sans text-sm rounded transition-colors duration-150 focus:outline-none focus:border-fg-primary/60 focus:ring-1 focus:ring-fg-primary/40 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
