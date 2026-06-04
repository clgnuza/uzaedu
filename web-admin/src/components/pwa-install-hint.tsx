'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthOptional } from '@/providers/auth-provider';
import { usePwaDeferredInstall } from '@/hooks/use-pwa-deferred-install';
import { Button } from '@/components/ui/button';
import { UzaeduAppIcon } from '@/components/brand/uzaedu-app-icon';
import { Download, X } from 'lucide-react';
import { isIosSafari, isPwaDisplayMode } from '@/lib/pwa-display';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { isFirefoxBrowser } from '@/lib/pwa-install-platform';

const HIDE_PREFIXES = ['/tv', '/bakim', '/login', '/register', '/uygulama'];

export function PwaInstallHint() {
  const pathname = usePathname();
  const token = useAuthOptional()?.token ?? null;
  const { canInstall, promptInstall } = usePwaDeferredInstall();
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);
  const [firefox, setFirefox] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInstalled(isPwaDisplayMode());
    setFirefox(isFirefoxBrowser());
    try {
      if (localStorage.getItem('pwa-hint-dismissed') === '1') setDismissed(true);
    } catch {
      /* ignore */
    }
    setIos(isIosSafari());
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

  const hint = ios
    ? 'Safari → Paylaş → Ana Ekrana Ekle'
    : firefox
      ? 'Firefox: kurulum rehberi (Windows)'
      : canInstall
        ? 'Tek tıkla yükle — bildirim ve tam ekran'
        : 'Chrome veya Edge ile en iyi deneyim';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9998] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 overflow-hidden rounded-2xl border border-teal-500/35 bg-linear-to-br from-teal-950/95 via-zinc-900/98 to-zinc-950 px-3 py-2.5 shadow-xl shadow-teal-950/30 backdrop-blur-md">
        <UzaeduAppIcon size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">Uygulamayı yükle</p>
          <p className="mt-0.5 text-[10px] leading-snug text-teal-100/75">{hint}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canInstall ? (
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 bg-teal-600 px-2.5 text-[10px] font-semibold hover:bg-teal-500"
                onClick={() => {
                  void promptInstall().then(() => markPwaOnboardingPending());
                  trackPwaEvent('pwa_install_prompt');
                  dismiss();
                }}
              >
                <Download className="size-3" aria-hidden />
                Yükle
              </Button>
            ) : (
              <Link
                href="/uygulama"
                className="inline-flex h-7 items-center gap-1 rounded-md bg-teal-600 px-2.5 text-[10px] font-semibold text-white hover:bg-teal-500"
                onClick={() => trackPwaEvent('pwa_install_hint_rehber')}
              >
                Kurulum rehberi
              </Link>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-zinc-400 hover:bg-white/10 hover:text-white"
          onClick={dismiss}
          aria-label="Kapat"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
