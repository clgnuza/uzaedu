import { toast } from 'sonner';
import { UzaeduAppIcon } from '@/components/brand/uzaedu-app-icon';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { hapticSuccess } from '@/lib/pwa-haptic';

export const PWA_INSTALL_THANKS_TOAST_ID = 'pwa-install-thanks';
let lastInstalledAt = 0;

/** Kurulum tamamlandığında: teşekkür toast + sonraki açılışta onboarding */
export function onPwaAppInstalled(source?: string): void {
  const now = Date.now();
  if (now - lastInstalledAt < 2500) return;
  lastInstalledAt = now;
  markPwaOnboardingPending();
  trackPwaEvent('pwa_app_installed', source ? { source } : undefined);
  hapticSuccess();
  showPwaInstallThanksToast();
}

export function showPwaInstallThanksToast(): void {
  toast.custom(
    () => (
      <div className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] gap-3 rounded-2xl border border-teal-500/35 bg-linear-to-br from-teal-950 via-zinc-900 to-zinc-950 p-3.5 shadow-2xl shadow-teal-950/40">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-2xl bg-teal-400/25 blur-md" aria-hidden />
          <UzaeduAppIcon size={52} className="relative" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-bold text-white">Teşekkürler!</p>
          <p className="mt-1 text-xs leading-snug text-teal-100/85">
            Kurulum tamam — Uzaedu ana ekranınızda. Uygulamayı açınca bildirimleri birlikte ayarlayabilirsiniz.
          </p>
        </div>
      </div>
    ),
    {
      id: PWA_INSTALL_THANKS_TOAST_ID,
      duration: 6500,
      position: 'top-center',
      unstyled: true,
      classNames: {
        toast: 'bg-transparent border-0 shadow-none p-0',
      },
    },
  );
}
