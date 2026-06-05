'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BellRing, Check, Fingerprint, PartyPopper, X } from 'lucide-react';
import { UzaeduAppIcon } from '@/components/brand/uzaedu-app-icon';
import { useAuthOptional } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { isPwaDisplayMode } from '@/lib/pwa-display';
import { getNotificationPermission, pushSupported, subscribeWebPush } from '@/lib/web-push';
import { NotificationPermissionPrompt } from '@/components/notification-permission-prompt';
import { fetchWebAuthnSupported, registerPasskey } from '@/lib/webauthn';
import { suggestPasskeyDeviceName } from '@/lib/passkey-device-label';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { hapticSuccess } from '@/lib/pwa-haptic';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STORAGE_KEY = 'pwa-onboarding-v1-done';
const PENDING_KEY = 'pwa-onboarding-pending';

const HIDE_PREFIXES = ['/tv', '/bakim', '/login', '/register'];

export function markPwaOnboardingPending(): void {
  try {
    localStorage.setItem(PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

type StepId = 'welcome' | 'push' | 'passkey' | 'done';

export function PwaOnboarding() {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthOptional()?.token ?? null;
  const [open, setOpen] = useState(false);
  const [passkeyAvail, setPasskeyAvail] = useState(false);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pushOk, setPushOk] = useState(false);
  const [passkeyOk, setPasskeyOk] = useState(false);
  const [pushPermOpen, setPushPermOpen] = useState(false);

  const steps = useMemo((): StepId[] => {
    const s: StepId[] = ['welcome'];
    if (pushSupported()) s.push('push');
    if (passkeyAvail) s.push('passkey');
    s.push('done');
    return s;
  }, [passkeyAvail]);

  const step = steps[idx] ?? 'done';

  useEffect(() => {
    if (!token || !isPwaDisplayMode()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
      if (localStorage.getItem(PENDING_KEY) !== '1') return;
    } catch {
      return;
    }
    setOpen(true);
    trackPwaEvent('pwa_onboarding_start');
    void fetchWebAuthnSupported().then(setPasskeyAvail);
  }, [token]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    trackPwaEvent('pwa_onboarding_complete', { push: pushOk, passkey: passkeyOk });
    hapticSuccess();
    toast.success('Hazırsınız', {
      description: 'İyi çalışmalar — bildirimleri istediğiniz zaman değiştirebilirsiniz.',
      duration: 4000,
    });
    setOpen(false);
  }, [pushOk, passkeyOk]);

  const next = () => setIdx((i) => Math.min(i + 1, steps.length - 1));

  const enablePush = async (skipPermissionRequest = false) => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await subscribeWebPush(token, { skipPermissionRequest });
      if (r.ok) {
        setPushOk(true);
        setPushPermOpen(false);
        toast.success('Bildirimler açıldı');
        next();
      } else if (r.reason === 'denied') toast.error('Bildirim izni reddedildi');
      else toast.error('Bildirim açılamadı');
    } finally {
      setBusy(false);
    }
  };

  const startPushFlow = () => {
    const perm = getNotificationPermission();
    if (perm === 'granted') {
      void enablePush(true);
      return;
    }
    setPushPermOpen(true);
  };

  const enablePasskey = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await registerPasskey(token, suggestPasskeyDeviceName());
      setPasskeyOk(true);
      toast.success('Biyometrik giriş eklendi');
      next();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  if (!open || !token) return null;
  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const meta: Record<
    StepId,
    { title: string; body: string; icon: typeof BellRing; accent?: string }
  > = {
    welcome: {
      title: 'Teşekkürler!',
      body: 'Uygulama ana ekranınıza eklendi. Bir dakikada bildirim ve hızlı girişi ayarlayalım.',
      icon: PartyPopper,
      accent: 'teal',
    },
    push: {
      title: 'Bildirimler',
      body: 'Nöbet, program ve mesajlar kilit ekranında görünsün.',
      icon: BellRing,
      accent: 'sky',
    },
    passkey: {
      title: 'Biyometrik giriş',
      body: 'Parmak izi veya yüz ile hızlı oturum (isteğe bağlı).',
      icon: Fingerprint,
      accent: 'violet',
    },
    done: {
      title: 'Tamamdır',
      body: 'Ayarları Bildirimler ve profil güvenlikten dilediğiniz zaman güncelleyebilirsiniz.',
      icon: Check,
      accent: 'emerald',
    },
  };

  const { title, body, icon: Icon, accent = 'teal' } = meta[step];
  const accentRing =
    accent === 'teal'
      ? 'ring-teal-500/30'
      : accent === 'sky'
        ? 'ring-sky-500/30'
        : accent === 'violet'
          ? 'ring-violet-500/30'
          : 'ring-emerald-500/30';

  return (
    <>
      <NotificationPermissionPrompt
        open={pushPermOpen}
        onOpenChange={setPushPermOpen}
        onConfirm={() => enablePush(false)}
        busy={busy}
      />
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        className={cn(
          'w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-2xl',
          'bg-linear-to-b from-zinc-900 via-card to-card',
        )}
        style={{ marginBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-labelledby="pwa-onboard-title"
      >
        {step === 'welcome' ? (
          <div className="flex flex-col items-center border-b border-white/8 bg-linear-to-br from-teal-600/15 via-transparent to-transparent px-5 pb-4 pt-6 text-center">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-teal-400/20 blur-2xl" aria-hidden />
              <UzaeduAppIcon size={72} className="relative" />
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-teal-400/90">
              Kurulum tamam
            </p>
          </div>
        ) : null}

        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            {step !== 'welcome' ? (
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl bg-muted/50 ring-2',
                  accentRing,
                )}
              >
                <Icon className="size-5 text-foreground" aria-hidden />
              </div>
            ) : (
              <div className="flex size-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-500 ring-2 ring-teal-500/25">
                <Icon className="size-5" aria-hidden />
              </div>
            )}
            <button
              type="button"
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              aria-label="Kapat"
              onClick={finish}
            >
              <X className="size-4" />
            </button>
          </div>
          <h2 id="pwa-onboard-title" className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>

          <div className="mt-4 flex gap-1">
            {steps.map((s, i) => (
              <div
                key={s}
                className={cn('h-1 flex-1 rounded-full transition-colors', i <= idx ? 'bg-teal-500' : 'bg-muted')}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {step === 'welcome' ? (
              <Button type="button" className="flex-1 bg-teal-600 hover:bg-teal-500" onClick={next}>
                Devam et
              </Button>
            ) : null}
            {step === 'push' ? (
              <>
                <Button type="button" className="flex-1" disabled={busy} onClick={startPushFlow}>
                  Bildirimleri aç
                </Button>
                <Button type="button" variant="outline" onClick={next}>
                  Sonra
                </Button>
              </>
            ) : null}
            {step === 'passkey' ? (
              <>
                <Button type="button" className="flex-1" disabled={busy} onClick={() => void enablePasskey()}>
                  Biyometrik ekle
                </Button>
                <Button type="button" variant="outline" onClick={next}>
                  Atla
                </Button>
              </>
            ) : null}
            {step === 'done' ? (
              <Button
                type="button"
                className="flex-1 bg-teal-600 hover:bg-teal-500"
                onClick={() => {
                  finish();
                  router.push('/bildirimler');
                }}
              >
                Bitir
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
