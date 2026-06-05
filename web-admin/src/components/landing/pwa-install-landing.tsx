'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  Download,
  Globe,
  LayoutGrid,
  Monitor,
  Share2,
  Shield,
  Smartphone,
  WifiOff,
  Zap,
} from 'lucide-react';
import { UzaeduAppIcon } from '@/components/brand/uzaedu-app-icon';
import { usePwaDeferredInstall } from '@/hooks/use-pwa-deferred-install';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isIosSafari, isPwaDisplayMode } from '@/lib/pwa-display';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import {
  detectPwaInstallPlatform,
  getPwaInstallGuide,
  isFirefoxBrowser,
  PWA_INSTALL_GUIDE_LIST,
  type PwaInstallGuide,
  type PwaInstallPlatformId,
} from '@/lib/pwa-install-platform';

const FEATURES = [
  { icon: Zap, label: 'Tam ekran', desc: 'Uygulama deneyimi' },
  { icon: BellRing, label: 'Bildirimler', desc: 'Anlık uyarılar' },
  { icon: Share2, label: 'Paylaşım', desc: 'Dosya / metin' },
  { icon: WifiOff, label: 'Çevrimdışı', desc: 'Senkron kuyruk' },
] as const;

function PlatformTabIcon({ id }: { id: PwaInstallPlatformId }) {
  if (id.startsWith('ios')) return <Smartphone className="size-4 text-red-200" />;
  if (id.startsWith('android')) return <Smartphone className="size-4 text-red-400" />;
  return <Monitor className="size-4 text-zinc-300" />;
}

function GuideSteps({ guide, highlighted }: { guide: PwaInstallGuide; highlighted: boolean }) {
  return (
    <ol className="mx-auto flex w-full max-w-lg flex-col gap-2.5">
      {guide.steps.map((step, i) => (
        <li
          key={step.title}
          className={cn(
            'flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition',
            highlighted
              ? 'border-red-500/30 bg-red-950/25 shadow-[0_0_24px_-8px_rgba(220,38,38,0.35)]'
              : 'border-white/8 bg-zinc-900/55',
          )}
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums',
              highlighted ? 'bg-red-600 text-white shadow-md shadow-red-950/50' : 'bg-zinc-800 text-zinc-400',
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-semibold leading-snug text-zinc-50">{step.title}</p>
            {step.detail ? (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{step.detail}</p>
            ) : null}
          </div>
          {i < guide.steps.length - 1 ? (
            <ChevronRight className="mt-1.5 size-4 shrink-0 text-zinc-700" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function PwaInstallLanding({ variant = 'page' }: { variant?: 'page' | 'embed' }) {
  const { canInstall, promptInstall } = usePwaDeferredInstall();
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [platform, setPlatform] = useState<PwaInstallPlatformId>('unknown');
  const [selected, setSelected] = useState<PwaInstallPlatformId>('unknown');

  useEffect(() => {
    const p = detectPwaInstallPlatform();
    setPlatform(p);
    setSelected(p);
    setInstalled(isPwaDisplayMode());
    setIosHint(isIosSafari());
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const activeGuide = useMemo(() => getPwaInstallGuide(selected), [selected]);
  const detectedGuide = useMemo(() => getPwaInstallGuide(platform), [platform]);
  const stepsHighlighted = selected === platform;

  const runInstall = () => {
    if (!canInstall) return;
    void promptInstall().then(() => {
      markPwaOnboardingPending();
      trackPwaEvent('pwa_install_prompt', { source: 'install_page' });
      setInstalled(isPwaDisplayMode());
    });
  };

  return (
    <div
      className={cn(
        'w-full',
        variant === 'page' && 'relative mx-auto max-w-xl px-4 pb-10 pt-1 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-3',
      )}
    >
      {variant === 'page' ? (
        <div className="mb-6 flex justify-center sm:justify-start">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/70 px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-red-500/25 hover:text-zinc-200"
          >
            <ArrowLeft className="size-3.5" />
            Anasayfa
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-red-900/35 bg-zinc-950/90 shadow-2xl shadow-black/50 backdrop-blur-sm">
        <div className="relative border-b border-white/8 px-5 py-8 sm:px-10 sm:py-10">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(185,28,28,0.28),transparent)]"
            aria-hidden
          />

          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <div
                className="absolute -inset-5 rounded-full bg-red-600/25 blur-2xl sm:-inset-6"
                aria-hidden
              />
              <UzaeduAppIcon size={108} className="relative" />
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.32em] text-red-400/90">
              Uzaedu Öğretmen
            </p>
            <h1 className="mt-2 text-[clamp(1.65rem,5.5vw,2.35rem)] font-bold leading-[1.1] tracking-tight text-white">
              Uygulamayı yükle
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-zinc-400">
              Ana ekrana ekleyin — tam ekran, bildirim ve hızlı modül erişimi.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {installed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  <Check className="size-3.5" />
                  Bu cihazda kurulu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
                  <Globe className="size-3.5 text-red-400" />
                  {detectedGuide.label} · {detectedGuide.browserLabel}
                </span>
              )}
            </div>

            {!installed && canInstall ? (
              <Button
                type="button"
                size="lg"
                className="mt-5 h-12 min-w-[min(100%,240px)] gap-2 rounded-2xl bg-linear-to-r from-red-700 to-red-800 px-8 text-sm font-semibold shadow-lg shadow-red-950/45 hover:from-red-600 hover:to-red-700"
                onClick={runInstall}
              >
                <Download className="size-4" />
                Şimdi yükle
              </Button>
            ) : null}

            {!installed && iosHint && !canInstall ? (
              <p className="mt-4 max-w-md rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-left text-xs leading-relaxed text-amber-100/90">
                iPhone: Safari ile açın → Paylaş → Ana Ekrana Ekle (iOS 16.4+).
              </p>
            ) : null}
            {!installed && !canInstall && isFirefoxBrowser() ? (
              <p className="mt-4 max-w-md rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-left text-xs leading-relaxed text-orange-100/95">
                Firefox: “Şimdi yükle” yok — Labs’ta görev çubuğu özelliğini açın, adres çubuğundaki ekle
                simgesini kullanın (yalnızca Windows, FF 143+). Tam deneyim için Chrome veya Edge.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:gap-2.5 sm:p-4">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/6 bg-zinc-900/50 px-2 py-3.5 text-center sm:py-4"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-red-950/60 ring-1 ring-red-800/40">
                <f.icon className="size-4 text-red-400" aria-hidden />
              </span>
              <span className="text-[11px] font-semibold text-zinc-100">{f.label}</span>
              <span className="text-[10px] leading-snug text-zinc-500">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-8 text-center">
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <span className="flex size-9 items-center justify-center rounded-xl border border-red-900/45 bg-zinc-950/80 text-red-400">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">Kurulum adımları</h2>
          <p className="max-w-sm text-xs text-zinc-500">Cihazınıza göre rehberi seçin</p>
        </div>

        <div className="mx-auto mb-5 flex max-w-lg justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PWA_INSTALL_GUIDE_LIST.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3.5 py-2.5 text-center transition min-w-[5.5rem]',
                selected === g.id
                  ? 'border-red-500/45 bg-red-500/10 ring-1 ring-red-500/25'
                  : 'border-zinc-800 bg-zinc-950/90 hover:border-zinc-700',
              )}
            >
              <PlatformTabIcon id={g.id} />
              <span className="text-[11px] font-semibold text-zinc-100">{g.label}</span>
              <span className="text-[9px] text-zinc-500">{g.browserLabel}</span>
            </button>
          ))}
        </div>

        <GuideSteps guide={activeGuide} highlighted={stepsHighlighted} />

        {selected !== platform && platform !== 'unknown' ? (
          <p className="mx-auto mt-4 flex max-w-lg items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-left text-xs text-amber-100/90">
            <Shield className="mt-0.5 size-4 shrink-0" aria-hidden />
            Bu cihaz: <strong className="font-semibold">{detectedGuide.browserLabel}</strong> — otomatik seçim
            için ilk sekmeye dönün veya adımları takip edin.
          </p>
        ) : null}
      </section>

      <div className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/8 bg-zinc-900/45 px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm leading-relaxed text-zinc-400">
          Kurulumdan sonra giriş yapın; push bildirimlerini panelden açın.
        </p>
        <div className="flex shrink-0 flex-wrap justify-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            Giriş yap
          </Link>
          <Link
            href="/bildirimler"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 px-5 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
          >
            Bildirim ayarları
          </Link>
        </div>
      </div>
    </div>
  );
}
