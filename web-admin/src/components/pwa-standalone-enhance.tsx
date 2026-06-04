'use client';

import { useEffect } from 'react';
import { isPwaDisplayMode } from '@/lib/pwa-display';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';

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
          if (localStorage.getItem('pwa-onboarding-v1-done') !== '1' && !localStorage.getItem('pwa-onboarding-pending')) {
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
