'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BellRing, Check, Fingerprint, Smartphone, X } from 'lucide-react';
import { useAuthOptional } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { isPwaDisplayMode } from '@/lib/pwa-display';
import { pushSupported, subscribeWebPush } from '@/lib/web-push';
import { fetchWebAuthnSupported, registerPasskey } from '@/lib/webauthn';
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
    setOpen(false);
  }, [pushOk, passkeyOk]);

  const next = () => setIdx((i) => Math.min(i + 1, steps.length - 1));

  const enablePush = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await subscribeWebPush(token);
      if (r.ok) {
        setPushOk(true);
        toast.success('Bildirimler açıldı');
        next();
      } else if (r.reason === 'denied') toast.error('Bildirim izni reddedildi');
      else toast.error('Bildirim açılamadı');
    } finally {
      setBusy(false);
    }
  };

  const enablePasskey = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await registerPasskey(token, 'PWA — bu cihaz');
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

  const meta: Record<StepId, { title: string; body: string; icon: typeof Smartphone }> = {
    welcome: {
      title: 'Hoş geldiniz',
      body: 'Uzaedu ana ekranınızda. Bildirim ve hızlı girişi bir kez ayarlayın.',
      icon: Smartphone,
    },
    push: {
      title: 'Bildirimler',
      body: 'Nöbet, program ve mesajlar kilit ekranında görünsün.',
      icon: BellRing,
    },
    passkey: {
      title: 'Biyometrik giriş',
      body: 'Parmak izi veya yüz ile hızlı oturum (isteğe bağlı).',
      icon: Fingerprint,
    },
    done: {
      title: 'Hazırsınız',
      body: 'Ayarları Bildirimler ve Profil güvenlikten değiştirebilirsiniz.',
      icon: Check,
    },
  };

  const { title, body, icon: Icon } = meta[step];

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-5 shadow-2xl"
        style={{ marginBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-labelledby="pwa-onboard-title"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600">
            <Icon className="size-5" aria-hidden />
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Kapat"
            onClick={finish}
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 id="pwa-onboard-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>

        <div className="mt-4 flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn('h-1 flex-1 rounded-full', i <= idx ? 'bg-teal-500' : 'bg-muted')}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {step === 'welcome' ? (
            <Button type="button" className="flex-1" onClick={next}>
              Başla
            </Button>
          ) : null}
          {step === 'push' ? (
            <>
              <Button type="button" className="flex-1" disabled={busy} onClick={() => void enablePush()}>
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
              className="flex-1"
              onClick={() => {
                finish();
                router.push('/bildirimler');
              }}
            >
              Tamam
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
