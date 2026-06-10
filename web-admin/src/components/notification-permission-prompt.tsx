'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Globe,
  Megaphone,
  MessageSquare,
  Shield,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getNotificationPermission } from '@/lib/web-push';
import {
  detectAndroidBatteryOem,
  evaluatePushDeviceSupport,
  pushBatteryOemLabel,
  pushBatteryOptimizationSteps,
  pushBlockMessage,
  pushPermissionDeniedSteps,
  pushSetupTips,
} from '@/lib/push-platform-guide';
import { detectPwaInstallPlatform } from '@/lib/pwa-install-platform';

const BENEFITS = [
  { icon: Megaphone, label: 'Nöbet ve duyuru uyarıları' },
  { icon: MessageSquare, label: 'Mesaj merkezi bildirimleri' },
  { icon: Shield, label: 'Kritik uyarılar (sessiz saatte bile)' },
] as const;

function browserLabel(): string {
  if (typeof navigator === 'undefined') return 'Tarayıcı';
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Chrome/i.test(ua)) return 'Google Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return 'Tarayıcı';
}

function siteHostLabel(): string {
  if (typeof window === 'undefined') return 'uzaedu.com';
  return window.location.host || 'uzaedu.com';
}

function BrowserPermissionPreview() {
  const host = siteHostLabel();
  const platform = detectPwaInstallPlatform();
  const isIosSafari = platform === 'ios-safari' || platform === 'ios-other';

  return (
    <div
      className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] dark:border-zinc-700 dark:bg-zinc-900"
      aria-hidden
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-600 to-cyan-600 text-white shadow-md">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[15px] font-medium leading-snug text-zinc-900 dark:text-zinc-50">
            {isIosSafari ? (
              <>
                <span className="font-semibold">“Uzaedu”</span> size bildirimler göndermek istiyor
              </>
            ) : (
              <>
                <span className="font-semibold">{host}</span> bildirim gönderebilsin mi?
              </>
            )}
          </p>
          <button type="button" tabIndex={-1} className="mt-1 text-left text-xs text-blue-600 dark:text-blue-400">
            {isIosSafari ? 'Bildirimlere izin ver' : 'Daha fazla bilgi alın'}
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
        <span className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {isIosSafari ? 'İzin Verme' : 'Engelle'}
        </span>
        <span className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
          {isIosSafari ? 'İzin Ver' : 'İzin ver'}
        </span>
      </div>
    </div>
  );
}

export function NotificationPermissionDeniedHelp({
  className,
  onRetry,
}: {
  className?: string;
  onRetry?: () => void;
}) {
  const platform = detectPwaInstallPlatform();
  const steps = pushPermissionDeniedSteps(platform);
  const batteryOem = detectAndroidBatteryOem();
  const batterySteps = batteryOem ? pushBatteryOptimizationSteps(batteryOem) : [];

  return (
    <div
      className={cn(
        'rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3.5 text-sm leading-relaxed text-amber-950 dark:text-amber-100',
        className,
      )}
    >
      <p className="font-semibold">Bildirim izni verilemedi</p>
      <p className="mt-1 text-xs opacity-90">{browserLabel()} · {platform.replace(/-/g, ' ')}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs opacity-95">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {batterySteps.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-xs font-semibold">{pushBatteryOemLabel(batteryOem!)} pil ayarı</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] opacity-95">
            {batterySteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={onRetry}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}

export function PushPlatformSetupTips({
  className,
  mode = 'full',
}: {
  className?: string;
  mode?: 'full' | 'battery-only';
}) {
  const platform = detectPwaInstallPlatform();
  const eval_ = evaluatePushDeviceSupport();
  const tips = mode === 'full' ? pushSetupTips(platform) : [];
  const batteryOem = eval_.batteryOem;
  const batterySteps = batteryOem ? pushBatteryOptimizationSteps(batteryOem) : [];

  if (mode === 'full' && !eval_.canSubscribe && eval_.blockReason) {
    return (
      <div
        className={cn(
          'rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100',
          className,
        )}
      >
        <p className="font-semibold">Bu cihazda önce kurulum gerekli</p>
        <p className="mt-1">{pushBlockMessage(eval_.blockReason)}</p>
      </div>
    );
  }

  if (mode === 'battery-only' && batterySteps.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {tips.length > 0 ? (
      <ul className="space-y-1.5">
        {tips.map((tip) => (
          <li
            key={tip.title}
            className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-[11px] leading-snug"
          >
            <span className="font-semibold text-foreground">{tip.title}</span>
            {tip.detail ? <span className="text-muted-foreground"> — {tip.detail}</span> : null}
          </li>
        ))}
      </ul>
      ) : null}
      {batterySteps.length > 0 ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/8 px-3 py-2.5 text-[11px] leading-relaxed text-sky-950 dark:text-sky-100">
          <p className="font-semibold">{pushBatteryOemLabel(batteryOem!)}: pil / arka plan</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 opacity-95">
            {batterySteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationPermissionPrompt({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
  showDeniedHelp = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  showDeniedHelp?: boolean;
}) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const platform = useMemo(() => detectPwaInstallPlatform(), []);
  const eval_ = useMemo(() => evaluatePushDeviceSupport(), []);
  const isChromeFamily = /Chrome|Edg\//i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  useEffect(() => {
    if (open) setPermission(getNotificationPermission());
  }, [open, busy]);

  const denied = permission === 'denied' || showDeniedHelp;
  const blocked = !eval_.canSubscribe && !!eval_.blockReason;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={denied ? 'Bildirim izni gerekli' : blocked ? 'Kurulum gerekli' : 'Telefon bildirimleri'}
        descriptionId="notif-perm-desc"
        scrollBody={false}
        priority
        className="max-w-md border-teal-500/15"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
            <p id="notif-perm-desc" className="text-center text-sm text-muted-foreground">
              {blocked
                ? pushBlockMessage(eval_.blockReason!)
                : denied
                  ? 'Daha önce engellediyseniz telefon ve tarayıcı ayarından açmanız gerekir.'
                  : 'Önemli okul uyarılarını kaçırmayın — bir sonraki adımda izin penceresi açılır.'}
            </p>

            {blocked ? (
              <div className="mt-4">
                <PushPlatformSetupTips />
              </div>
            ) : null}

            {!denied && !blocked && isChromeFamily && platform.startsWith('android') ? (
              <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                Chrome’da üstte <strong>“Bildirimler engellendi”</strong> görürseniz önce{' '}
                <strong>“Bu site için izin ver”</strong> deyin; ardından aşağıdaki düğmeye basın.
              </div>
            ) : null}

            {!denied && !blocked ? (
              <>
                <div className="relative mt-5">
                  <div
                    className="pointer-events-none absolute -inset-3 rounded-3xl bg-teal-500/10 blur-xl"
                    aria-hidden
                  />
                  <BrowserPermissionPreview />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Smartphone className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  {browserLabel()} · önizleme
                </p>
                <div className="mt-4">
                  <PushPlatformSetupTips />
                </div>
              </>
            ) : denied ? (
              <div className="mt-4">
                <NotificationPermissionDeniedHelp />
              </div>
            ) : null}

            <ul className="mt-5 space-y-2">
              {BENEFITS.map((b) => (
                <li
                  key={b.label}
                  className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300">
                    <b.icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-xs font-medium text-foreground sm:text-[13px]">{b.label}</span>
                </li>
              ))}
            </ul>

            {!denied && !blocked ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <Globe className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                İzin verdiğinizde yalnızca bu site bildirim gönderir; istediğiniz zaman Bildirimler sayfasından
                kapatabilirsiniz.
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border/60 bg-muted/10 px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-10 order-2 sm:order-1"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Şimdi değil
              </Button>
              {!denied && !blocked ? (
                <Button
                  type="button"
                  className="h-10 gap-2 bg-linear-to-r from-teal-600 to-cyan-600 order-1 sm:order-2 hover:from-teal-500 hover:to-cyan-500"
                  disabled={busy}
                  onClick={() => void onConfirm()}
                >
                  {busy ? (
                    <Sparkles className="size-4 animate-pulse" aria-hidden />
                  ) : (
                    <Smartphone className="size-4" aria-hidden />
                  )}
                  {busy ? 'Açılıyor…' : 'Tarayıcıda izin ver'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 order-1 sm:order-2"
                  onClick={() => onOpenChange(false)}
                >
                  Tamam
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
