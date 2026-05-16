'use client';

import { Toaster } from 'sonner';
import { CookieBanner } from '@/components/cookie-banner';

export function ClientShellWidgets() {
  return (
    <>
      <CookieBanner />
      <Toaster position="top-right" richColors closeButton style={{ zIndex: 9999 }} />
    </>
  );
}
