'use client';

import { useEffect } from 'react';

/**
 * Tarayıcı eklentileri, iframe veya gizlilik ayarları nedeniyle localStorage
 * erişimi engellendiğinde "Access to storage is not allowed" hatası konsola
 * düşebilir. Bu bileşen yakalanmamış promise rejection'ları dinler ve
 * sadece bilinen storage hatalarını susturur (gürültü azaltma).
 */
export function StorageGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg = (event.reason?.message ?? String(event.reason ?? '')).toLowerCase();
      if (
        typeof msg === 'string' &&
        (msg.includes('access to storage') ||
          msg.includes('storage is not allowed') ||
          msg.includes('not allowed from this context') ||
          (msg.includes('storage') && msg.includes('not allowed')) ||
          (msg.includes('storage') && (msg.includes('denied') || msg.includes('blocked'))))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return <>{children}</>;
}
