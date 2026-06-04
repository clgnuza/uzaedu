'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { pushSupported, subscribeWebPush } from '@/lib/web-push';

const STORAGE_KEY = 'pwa-push-auto-requested';

/** Giriş sonrası bir kez push izni dener (PWA / mobil kilit ekranı). */
export function PwaPushRegister() {
  const { token } = useAuth();
  const tried = useRef(false);

  useEffect(() => {
    if (!token || tried.current || process.env.NODE_ENV === 'development') return;
    if (!pushSupported()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') {
      void subscribeWebPush(token).catch(() => undefined);
      return;
    }

    tried.current = true;
    const t = window.setTimeout(() => {
      void subscribeWebPush(token)
        .then((r) => {
          try {
            localStorage.setItem(STORAGE_KEY, '1');
          } catch {
            /* ignore */
          }
          if (!r.ok && r.reason === 'denied') {
            try {
              localStorage.setItem(STORAGE_KEY, '1');
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [token]);

  return null;
}
