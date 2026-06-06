'use client';

import { Toaster } from 'sonner';
import { CookieBanner } from '@/components/cookie-banner';
import { PwaShell } from '@/components/pwa-shell';

export function ClientShellWidgets() {
  return (
    <>
      <PwaShell />
      <CookieBanner />
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={3500}
        toastOptions={{ duration: 3500 }}
        style={{ zIndex: 9999 }}
      />
    </>
  );
}
