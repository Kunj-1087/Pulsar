import React from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-mono font-medium rounded transition-all duration-150 active:scale-[0.98] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 tracking-wide';
  
  const variants = {
    primary: 'bg-pulsar text-void hover:bg-pulsar-hover border border-transparent shadow-sm font-semibold',
    ghost: 'bg-transparent border border-dim text-fg-primary hover:bg-surface-hover hover:border-border-strong',
    danger: 'bg-redshift text-fg-primary hover:bg-redshift-hover border border-transparent font-semibold',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 h-8',
    md: 'text-sm px-4 py-2.5 h-10',
    lg: 'text-sm px-4 py-3 h-11',
  };

  return (
    <button
      className={cn(baseStyle, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Spinner className="w-4 h-4 text-current" />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
