'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Yalnızca /akilli-tahta rotasında hafif service worker kaydı. */
export function SmartBoardPwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/akilli-tahta') return;
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw-smart-board.js', { scope: '/akilli-tahta/' }).catch(() => undefined);
  }, [pathname]);

  return null;
}
