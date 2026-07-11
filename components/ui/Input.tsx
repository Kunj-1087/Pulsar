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
          "flex w-full h-10 px-3 bg-[#1a1a1a] border border-border-default text-text-primary placeholder:text-text-muted font-sans text-sm rounded transition-colors duration-150 focus:outline-none focus:border-text-primary/60 focus:ring-1 focus:ring-text-primary/40 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
