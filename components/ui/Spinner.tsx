import React from 'react';
import { cn } from '../../lib/utils';

type SpinnerProps = React.HTMLAttributes<HTMLDivElement>;

export const Spinner: React.FC<SpinnerProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-transparent border-t-current border-r-current h-4 w-4",
        className
      )}
      {...props}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
