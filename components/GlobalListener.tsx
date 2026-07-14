'use client';

import React, { useEffect, useRef } from 'react';
import { toast } from '../store/toastStore';

export const GlobalListener: React.FC = () => {
  const lastToastTimeRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleError = (event: ErrorEvent) => {
      console.error('[Pulsar Global Error]', event.error);
      const now = Date.now();
      if (now - lastToastTimeRef.current > 3000) {
        lastToastTimeRef.current = now;
        toast.error(event.message || 'An unexpected client error occurred.', { title: 'System Alert' });
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[Pulsar Global Rejection]', event.reason);
      const now = Date.now();
      if (now - lastToastTimeRef.current > 3000) {
        lastToastTimeRef.current = now;
        const msg = event.reason?.message || String(event.reason);
        toast.error(msg || 'An asynchronous operation failed.', { title: 'Asynchronous Error' });
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
};
