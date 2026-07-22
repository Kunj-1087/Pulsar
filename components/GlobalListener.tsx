'use client';

import React, { useEffect, useRef } from 'react';
import { toast } from '../store/toastStore';

export const GlobalListener: React.FC = () => {
  const lastToastTimeRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleError = (event: ErrorEvent) => {
      console.error('[Quark Global Error]', event.error || event);
      const now = Date.now();
      if (now - lastToastTimeRef.current > 3000) {
        lastToastTimeRef.current = now;
        const msg = event.message && !event.message.includes('[object ') ? event.message : 'Unexpected client error.';
        toast.error(msg);
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[Quark Global Rejection]', event.reason);
      const now = Date.now();
      if (now - lastToastTimeRef.current > 3000) {
        lastToastTimeRef.current = now;
        let msg = event.reason?.message || (typeof event.reason === 'string' ? event.reason : null);
        if (!msg || msg.includes('[object ')) {
          msg = 'Async connection operation issue.';
        }
        toast.error(msg);
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
