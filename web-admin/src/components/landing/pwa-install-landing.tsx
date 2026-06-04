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
  if (id.startsWith('ios')) return <Smartphone className="size-4 text-zinc-200" />;
  if (id.startsWith('android')) return <Smartphone className="size-4 text-emerald-400" />;
  return <Monitor className="size-4 text-sky-400" />;
}

function GuideSteps({ guide, highlighted }: { guide: PwaInstallGuide; highlighted: boolean }) {
  return (
    <ol className="space-y-2">
      {guide.steps.map((step, i) => (
        <li
          key={step.title}
          className={cn(
            'flex gap-3 rounded-xl border px-3.5 py-3 transition',
            highlighted
              ? 'border-teal-500/25 bg-teal-950/30'
              : 'border-white/6 bg-zinc-900/50',
          )}
        >
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
              highlighted ? 'bg-teal-500 text-white' : 'bg-zinc-800 text-zinc-400',
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-100">{step.title}</p>
            {step.detail ? (
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{step.detail}</p>
            ) : null}
          </div>
          {i < guide.steps.length - 1 ? (
            <ChevronRight className="mt-1 size-4 shrink-0 text-zinc-700" aria-hidden />
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
        variant === 'page' && 'relative mx-auto max-w-2xl px-4 pb-10 pt-2 sm:px-6 sm:pb-14 sm:pt-4',
      )}
    >
      {variant === 'page' ? (
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5" />
          Anasayfa
        </Link>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <div className="border-b border-white/8 bg-linear-to-br from-teal-600/20 via-zinc-950 to-zinc-950 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="relative mx-auto shrink-0 sm:mx-0">
              <div className="absolute -inset-4 rounded-3xl bg-teal-500/25 blur-2xl" aria-hidden />
              <UzaeduAppIcon size={96} className="relative" />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Uygulamayı yükle
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Uzaedu Öğretmen&apos;i ana ekrana ekleyin; tam ekran, bildirim ve hızlı erişim.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {installed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                    <Check className="size-3.5" />
                    Bu cihazda kurulu
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-white/10">
                    <Globe className="size-3.5 text-teal-400" />
                    {detectedGuide.label} · {detectedGuide.browserLabel}
                  </span>
                )}
              </div>
              {!installed && canInstall ? (
                <Button
                  type="button"
                  size="lg"
                  className="mt-4 h-11 w-full gap-2 bg-teal-600 text-sm font-semibold hover:bg-teal-500 sm:w-auto sm:min-w-[200px]"
                  onClick={runInstall}
                >
                  <Download className="size-4" />
                  Şimdi yükle
                </Button>
              ) : null}
              {!installed && iosHint && !canInstall ? (
                <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-left text-[11px] leading-snug text-amber-100/90">
                  iPhone: Safari ile açın → Paylaş → Ana Ekrana Ekle (iOS 16.4+).
                </p>
              ) : null}
              {!installed && !canInstall && isFirefoxBrowser() ? (
                <p className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-left text-[11px] leading-snug text-orange-100/95">
                  Firefox: “Şimdi yükle” yok — Labs’ta görev çubuğu özelliğini açın, adres çubuğundaki
                  ekle simgesini kullanın (yalnızca Windows, FF 143+). Tam deneyim için Chrome veya Edge.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1 bg-zinc-950/90 px-3 py-3 text-center"
            >
              <f.icon className="size-4 text-teal-400" aria-hidden />
              <span className="text-[11px] font-semibold text-zinc-200">{f.label}</span>
              <span className="text-[10px] text-zinc-500">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid className="size-4 text-teal-500" aria-hidden />
          <h2 className="text-sm font-bold text-white">Kurulum adımları</h2>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PWA_INSTALL_GUIDE_LIST.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              className={cn(
                'flex shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition',
                selected === g.id
                  ? 'border-teal-500/50 bg-teal-500/10 ring-1 ring-teal-500/20'
                  : 'border-zinc-800 bg-zinc-950/90 hover:border-zinc-700',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                <PlatformTabIcon id={g.id} />
                {g.label}
              </span>
              <span className="text-[10px] text-zinc-500">{g.browserLabel}</span>
            </button>
          ))}
        </div>

        <GuideSteps guide={activeGuide} highlighted={stepsHighlighted} />

        {selected !== platform && platform !== 'unknown' ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
            <Shield className="mt-0.5 size-4 shrink-0" aria-hidden />
            Bu cihaz: <strong className="font-semibold">{detectedGuide.browserLabel}</strong> — otomatik
            seçim için ilk sekmeye dönün veya adımları takip edin.
          </p>
        ) : null}
      </section>

      <div className="mt-8 flex flex-col gap-2 rounded-xl border border-white/8 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-400">
          Kurulumdan sonra giriş yapın; push bildirimlerini panelden açın.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            Giriş yap
          </Link>
          <Link
            href="/bildirimler"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/15 px-4 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
          >
            Bildirim ayarları
          </Link>
        </div>
      </div>
    </div>
  );
}
