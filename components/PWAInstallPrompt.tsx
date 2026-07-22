'use client';

import React, { useEffect, useRef } from 'react';
import { toast } from '../store/toastStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;

      if (sessionStorage.getItem('quark_install_prompt_dismissed') === 'true') {
        return;
      }

      const timer = setTimeout(() => {
        if (!deferredPromptRef.current) return;

        toast.info(
          'Install Quark on your home screen for a standalone experience.',
          {
            title: 'Install Quark',
            duration: 15000,
            action: {
              label: 'Install',
              onClick: async () => {
                const promptEvent = deferredPromptRef.current;
                if (!promptEvent) return;
                
                promptEvent.prompt();
                const choiceResult = await promptEvent.userChoice;
                console.log(`[Quark PWA] User prompt choice: ${choiceResult.outcome}`);
                
                deferredPromptRef.current = null;
              },
            },
          }
        );
        
        sessionStorage.setItem('quark_install_prompt_dismissed', 'true');
      }, 60000); // 60 seconds

      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return null;
};
