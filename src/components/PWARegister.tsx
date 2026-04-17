'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail - SW registration is optional
      });
    }
  }, []);

  return null;
}
