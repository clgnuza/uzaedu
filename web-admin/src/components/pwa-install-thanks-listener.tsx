'use client';

import { useEffect } from 'react';
import { onPwaAppInstalled } from '@/lib/pwa-install-complete';

/** `appinstalled` — merkezi teşekkür toast */
export function PwaInstallThanksListener() {
  useEffect(() => {
    const onInstalled = () => onPwaAppInstalled('browser');
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);
  return null;
}
