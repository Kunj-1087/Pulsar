'use client';

import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { Toast } from './Toast';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 right-0 z-50 p-4 w-full md:max-w-sm flex flex-col gap-2.5 pointer-events-none max-h-[85vh] overflow-y-auto scrollbar-none"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)',
      }}
    >
      <div className="flex flex-col gap-2.5 pointer-events-auto">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
};
