'use client';

import { useEffect } from 'react';
import { SerwistProvider } from '@serwist/next/react';
import { PwaInstallHint } from '@/components/pwa-install-hint';
import { PwaPushRegister } from '@/components/pwa-push-register';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { PwaSplashScreen } from '@/components/pwa-splash-screen';
import { PwaStandaloneEnhance } from '@/components/pwa-standalone-enhance';
import { PwaOnboarding } from '@/components/pwa-onboarding';
import { PwaAppBadgeSync } from '@/components/pwa-app-badge-sync';
import { PwaOfflineSync } from '@/components/pwa-offline-sync';
import { PwaInstallThanksListener } from '@/components/pwa-install-thanks-listener';

const PWA_DEV = process.env.NODE_ENV === 'development';

export function PwaShell() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        Promise.all(
          regs
            .filter((r) => (r.active?.scriptURL ?? '').includes('sw-smart-board'))
            .map((r) => r.unregister()),
        ),
      )
      .catch(() => undefined);
    if (PWA_DEV) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(
            regs
              .filter((r) => {
                const url = r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? '';
                return !url.includes('sw-push.js');
              })
              .map((r) => r.unregister()),
          ),
        )
        .then(() =>
          navigator.serviceWorker.register('/sw-push.js', { scope: '/', updateViaCache: 'none' }),
        )
        .catch(() => undefined);
    }
  }, []);

  const chrome = (
    <>
      <PwaInstallThanksListener />
      <PwaStandaloneEnhance />
      <PwaSplashScreen />
      <PwaAppBadgeSync />
      <PwaOfflineSync />
      <PwaOnboarding />
      <PwaInstallHint />
    </>
  );

  if (PWA_DEV) return chrome;

  return (
    <SerwistProvider swUrl="/sw.js" register cacheOnNavigation reloadOnOnline>
      <PwaPushRegister />
      <PwaUpdatePrompt />
      {chrome}
    </SerwistProvider>
  );
}
