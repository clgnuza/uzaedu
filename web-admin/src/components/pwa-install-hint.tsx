'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, X } from 'lucide-react';
import { isIosSafari, isPwaDisplayMode } from '@/lib/pwa-display';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';
import { trackPwaEvent } from '@/lib/pwa-analytics';

const HIDE_PREFIXES = ['/tv', '/bakim', '/login', '/register'];

export function PwaInstallHint() {
  const pathname = usePathname();
  const { token } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInstalled(isPwaDisplayMode());
    try {
      if (localStorage.getItem('pwa-hint-dismissed') === '1') setDismissed(true);
    } catch {
      /* ignore */
    }
    setIos(isIosSafari());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred({ prompt: () => (e as BeforeInstallPromptEvent).prompt() });
    };
    const onInstalled = () => {
      setInstalled(true);
      markPwaOnboardingPending();
      trackPwaEvent('pwa_app_installed');
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!token || dismissed || installed) return null;
  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('pwa-hint-dismissed', '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9998] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border border-sky-500/25 bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug">Uygulama gibi kullanın</p>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            {ios
              ? 'Safari → Paylaş → Ana Ekrana Ekle. Tam ekran, splash ve bildirimler.'
              : deferred
                ? 'Ana ekrana ekleyin — tam ekran, splash, push bildirimleri.'
                : 'Menü → Ana ekrana ekle veya Uygulamayı yükle (Chrome/Edge).'}
          </p>
          {deferred ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-1.5 h-7 gap-1 text-[10px]"
              onClick={() => {
                void deferred.prompt().then(() => markPwaOnboardingPending());
                trackPwaEvent('pwa_install_prompt');
                dismiss();
              }}
            >
              <Download className="size-3" aria-hidden />
              Ana ekrana ekle
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={dismiss} aria-label="Kapat">
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
