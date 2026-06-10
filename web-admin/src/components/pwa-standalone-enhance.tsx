'use client';

import { useEffect } from 'react';
import { isPwaDisplayMode } from '@/lib/pwa-display';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';
import { PWA_ONBOARDING_DONE_KEY, PWA_ONBOARDING_PENDING_KEY } from '@/lib/pwa-push-permission';

/** Ana ekran / tam ekran modunda html sınıfı ve dokunma davranışı */
export function PwaStandaloneEnhance() {
  useEffect(() => {
    const root = document.documentElement;
    let tracked = false;
    const apply = () => {
      const on = isPwaDisplayMode();
      root.classList.toggle('pwa-app', on);
      if (on && !tracked) {
        tracked = true;
        trackPwaEvent('pwa_display_mode');
        try {
          if (
            localStorage.getItem(PWA_ONBOARDING_DONE_KEY) !== '1' &&
            !localStorage.getItem(PWA_ONBOARDING_PENDING_KEY)
          ) {
            markPwaOnboardingPending();
          }
        } catch {
          markPwaOnboardingPending();
        }
      }
    };
    apply();
    const mq = window.matchMedia('(display-mode: standalone)');
    const mqFull = window.matchMedia('(display-mode: fullscreen)');
    mq.addEventListener('change', apply);
    mqFull.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      mqFull.removeEventListener('change', apply);
      root.classList.remove('pwa-app');
    };
  }, []);
  return null;
}
