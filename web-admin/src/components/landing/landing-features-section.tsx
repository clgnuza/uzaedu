'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Layers3,
  LayoutGrid,
  LogIn,
  Shield,
  Sparkle,
  Sparkles,
  UserPlus,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { LANDING_HUB_ITEMS, type LandingHubItem } from '@/components/landing/landing-hub-items';
import {
  landingCardFrame,
  landingCardFrameFromSize,
  type LandingCardFrameRect,
} from '@/components/landing/landing-feature-ring-geometry';
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import { modulePublicPath } from '@/lib/landing-modules-seo';
import { cn } from '@/lib/utils';

type ModuleCategory = 'sinav' | 'plan' | 'iletisim' | 'gunluk';

const CATEGORY_LABELS: { id: 'all' | ModuleCategory; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'sinav', label: 'Sınav & ölçme' },
  { id: 'plan', label: 'Planlama' },
  { id: 'iletisim', label: 'İletişim' },
  { id: 'gunluk', label: 'Günlük işler' },
];

const MODULE_CATEGORY: Record<string, ModuleCategory> = {
  Nöbet: 'plan',
  'Duyuru TV': 'iletisim',
  'Ek Ders': 'gunluk',
  'Evrak & Plan': 'plan',
  'Doğrudan temin': 'plan',
  Kazanım: 'plan',
  'Optik Okuma': 'sinav',
  'Akıllı Tahta': 'gunluk',
  Ajanda: 'gunluk',
  'Ders Dağıt': 'plan',
  Bilsem: 'plan',
  'Okul Değerl.': 'iletisim',
  Kertenkele: 'sinav',
  Sorumluluk: 'sinav',
  'Mesaj Merkezi': 'iletisim',
};

type PillarAccent = 'crimson' | 'violet' | 'amber';

const PILLARS: { accent: PillarAccent; icon: LucideIcon; title: string; body: string }[] = [
  {
    accent: 'crimson',
    icon: Layers3,
    title: 'Tek ekosistem',
    body: 'Halkadaki her simge burada da aynı modül — dağınık araçlar yerine tek panel.',
  },
  {
    accent: 'violet',
    icon: Shield,
    title: 'Kurum sınırları',
    body: 'Yetki katmanları; yalnızca ilgili kişi kendi okul verisini görür.',
  },
  {
    accent: 'amber',
    icon: Zap,
    title: 'Hızlı erişim',
    body: 'Kayıt sonrası modüle doğrudan geçiş; nöbetten mesaja aynı dil.',
  },
];

function categoryFor(item: LandingHubItem): ModuleCategory {
  return MODULE_CATEGORY[item.label] ?? 'gunluk';
}

function HubNodeIcon({ icon: Icon, size = 'md' }: { icon: LucideIcon; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'size-14' : 'size-11';
  const iconDim = size === 'lg' ? 'size-6' : 'size-[18px]';
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-full', dim)}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle at 38% 30%, #3f3f46 0%, #09090b 72%)' }}
      />
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.13) 0%, transparent 45%)' }}
      />
      <span
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: 'inset 0 -2px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)' }}
      />
      <span className="absolute inset-0 rounded-full border border-red-700/65 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] transition group-hover:border-red-400/90 group-hover:shadow-[0_0_22px_-2px_rgba(220,38,38,0.65)]" />
      <Icon
        className={cn('relative z-10 text-red-400 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]', iconDim)}
        strokeWidth={1.6}
        aria-hidden
      />
    </span>
  );
}

function HubMiniRopeFrame({ children, className }: { children: ReactNode; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<LandingCardFrameRect>(() => landingCardFrame());
  const [ropeEnabled, setRopeEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRopeEnabled(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const measureFrame = useCallback(() => {
    if (!ropeEnabled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rings = wrap.querySelector<SVGSVGElement>('.landing-feature-hub-rings');
    const innerEl = wrap.querySelector('.landing-feature-inner');
    if (!rings || !innerEl) return;
    const innerCs = getComputedStyle(innerEl);
    const innerR = Number.parseFloat(innerCs.borderTopLeftRadius) || 10;
    const ringW = rings.clientWidth;
    const ringH = rings.clientHeight;
    if (ringW < 8 || ringH < 8) return;
    setRect(landingCardFrameFromSize(ringW, ringH, innerR));
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const run = () => measureFrame();
    run();
    const raf = requestAnimationFrame(run);
    const ro = new ResizeObserver(run);
    ro.observe(wrap);
    const inner = wrap.querySelector('.landing-feature-inner');
    if (inner) ro.observe(inner);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measureFrame, ropeEnabled]);

  const rectProps = { ...rect, fill: 'none' as const };

  if (!ropeEnabled) {
    return (
      <div className={cn('landing-feature-hub-wrap flex h-auto min-h-0 w-full flex-col sm:flex-1', className)}>
        <div className="landing-feature-inner flex h-auto min-h-0 flex-col sm:flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cn('landing-feature-hub-wrap flex h-auto min-h-0 w-full flex-col sm:flex-1', className)}
    >
      <div className="landing-feature-inner flex h-auto min-h-0 flex-col sm:flex-1">{children}</div>

      <svg
        className="landing-feature-hub-rings"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <rect {...rectProps} className="landing-feature-hub-rope-aura" />
        <rect {...rectProps} className="landing-feature-hub-rope-glow" />
        <rect {...rectProps} className="landing-feature-hub-rope-shadow landing-feature-hub-rope-snake" />
        <rect {...rectProps} className="landing-feature-hub-rope-main landing-feature-hub-rope-snake" />
      </svg>
    </div>
  );
}

function PillarCard({ pillar }: { pillar: (typeof PILLARS)[number] }) {
  const Icon = pillar.icon;
  return (
    <li
      className={cn(
        'landing-pillar-card group flex min-h-[200px] items-stretch',
        `landing-pillar-card--${pillar.accent}`,
      )}
    >
      <HubMiniRopeFrame className="h-auto w-full sm:min-h-full sm:flex-1">
        <div className="landing-pillar-inner relative z-[1] flex flex-col p-5 sm:flex-1 sm:p-6">
          <div className="landing-pillar-icon-ring flex size-12 items-center justify-center rounded-2xl">
            <Icon className="size-6 text-current" strokeWidth={1.65} aria-hidden />
          </div>
          <h3 className="mt-4 text-base font-bold tracking-tight text-zinc-50 sm:text-[17px]">{pillar.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-300">{pillar.body}</p>
        </div>
      </HubMiniRopeFrame>
    </li>
  );
}

function ModuleCard({ item }: { item: LandingHubItem }) {
  const cat = categoryFor(item);
  const catLabel = CATEGORY_LABELS.find((c) => c.id === cat)?.label ?? 'Modül';

  const body = (
    <HubMiniRopeFrame className="h-auto w-full sm:min-h-full sm:flex-1">
      <div className="landing-feature-card-body relative z-[1] flex min-h-0 flex-col p-4 sm:flex-1 sm:p-5">
        <div className="flex items-start gap-3">
          <HubNodeIcon icon={item.icon} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-pretty text-base font-bold leading-snug text-zinc-50 sm:text-[17px]">
              {item.label}
            </h3>
            <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-red-800/60 bg-zinc-950/90 px-2.5 py-0.5 text-[10px] font-bold uppercase leading-snug tracking-[0.1em] text-red-200">
              <Sparkle className="size-2.5 shrink-0 text-amber-200/90" aria-hidden />
              {catLabel}
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex min-w-0 flex-col">
          <p className="text-sm leading-relaxed text-zinc-200">{item.description}</p>
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-zinc-400">{item.detail}</p>

          <ul className="mt-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-2.5 py-0.5 text-xs font-medium text-zinc-200"
              >
                <Sparkles className="size-2.5 shrink-0 text-fuchsia-300/75" aria-hidden />
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative z-[1] mt-auto shrink-0 border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3 sm:px-5">
        <span className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-zinc-100 transition group-hover:text-white sm:justify-start">
          <LogIn className="size-3.5 opacity-85" aria-hidden />
          Modüle git
          <ArrowRight className="size-3.5 opacity-70 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </HubMiniRopeFrame>
  );

  const shell = cn(
    'landing-feature-card group flex h-full w-full min-h-0 flex-col focus-visible:outline-none',
    'focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]',
  );

  return (
    <Link href={modulePublicPath(item)} className={shell}>
      {body}
    </Link>
  );
}

export function LandingFeaturesSection() {
  const [category, setCategory] = useState<'all' | ModuleCategory>('all');

  const filtered = useMemo(() => {
    if (category === 'all') return LANDING_HUB_ITEMS;
    return LANDING_HUB_ITEMS.filter((item) => categoryFor(item) === category);
  }, [category]);

  return (
    <section
      id="ozellikler"
      className="landing-features relative w-full"
      aria-labelledby="landing-features-heading"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-x-0 top-0 h-[min(55vh,520px)]"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(185,28,28,0.2) 0%, rgba(153,27,27,0.08) 40%, transparent 72%)',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-900/40 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-2 sm:px-8 sm:pb-28 sm:pt-8 lg:px-10">
        <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
          <defs>
            <linearGradient id="landing-feature-card-rope-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fecaca" />
              <stop offset="22%" stopColor="#f87171" />
              <stop offset="48%" stopColor="#ef4444" />
              <stop offset="72%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#fda4af" />
            </linearGradient>
            <linearGradient id="landing-feature-card-rope-grad-soft" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#dc2626" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="landing-pillar-rope-violet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ddd6fe" />
              <stop offset="35%" stopColor="#a78bfa" />
              <stop offset="65%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
            <linearGradient id="landing-pillar-rope-violet-soft" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#5b21b6" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="landing-pillar-rope-amber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="35%" stopColor="#fbbf24" />
              <stop offset="65%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#fcd34d" />
            </linearGradient>
            <linearGradient id="landing-pillar-rope-amber-soft" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#92400e" stopOpacity="0.45" />
            </linearGradient>
          </defs>
        </svg>

        <header className="landing-features-intro mb-6 sm:mb-10 lg:mb-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="landing-features-intro-copy relative max-w-lg text-center lg:text-left">
              <span
                className="landing-features-intro-accent pointer-events-none absolute top-2 bottom-2 left-0 hidden w-px lg:block"
                aria-hidden
              />
              <div className="flex flex-col items-center gap-1 lg:items-start">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-red-900/50 bg-zinc-950/80 text-red-400">
                    <LayoutGrid className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-zinc-300 sm:text-sm">
                    <span className="text-base font-bold text-red-400 sm:text-lg">{LANDING_HUB_ITEMS.length}</span>
                    <span className="ml-1.5 text-zinc-500">modül</span>
                  </span>
                </div>
              </div>
              <h2
                id="landing-features-heading"
                className="mt-3 text-[clamp(1.125rem,3.2vw,2.5rem)] font-bold leading-[1.18] tracking-tight text-zinc-50 sm:mt-5 sm:leading-[1.12]"
              >
                Uzaedu Öğretmen&apos;de
                <span className="mt-0.5 block text-zinc-400 sm:mt-1">okul modülleriniz burada.</span>
              </h2>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-zinc-400 sm:mt-3 sm:text-sm sm:text-[15px]">
                Halkadaki her simge gerçek bir modüldür — kelebek sınav, nöbet, mesaj merkezi, ek ders ve daha
                fazlası. Kategoriye göre süzün; giriş yaptıktan sonra ilgili panele tek tıkla geçin.
              </p>
            </div>

            <div className="landing-features-filters w-full lg:min-w-0 lg:flex-1 lg:max-w-2xl">
              <p className="landing-features-filters-label">Süz</p>
              <ul className="landing-features-filters-row" role="tablist" aria-label="Modül kategorisi">
                {CATEGORY_LABELS.map((c) => {
                  const active = category === c.id;
                  return (
                    <li key={c.id} className="shrink-0">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setCategory(c.id)}
                        className={cn('landing-filter-chip', active && 'landing-filter-chip--active')}
                      >
                        {c.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </header>

        <ul
          className="landing-features-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4"
          key={category}
        >
          {filtered.map((item) => (
            <li key={item.href} className="flex min-h-[272px] items-stretch">
              <ModuleCard item={item} />
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-500">Bu kategoride modül yok.</p>
        )}

        <div className="landing-pillars-block mt-16 sm:mt-20">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-red-400/90">
            Platform omurgası
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {PILLARS.map((p) => (
              <PillarCard key={p.title} pillar={p} />
            ))}
          </ul>
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 text-center sm:mt-16">
          <p className="max-w-md text-sm text-zinc-500">Kurumunuzu açın; halkadaki modüllere aynı hesapla devam edin.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <AuthTransitionLink
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-red-700 to-red-800 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/50 transition hover:from-red-600 hover:to-red-700"
            >
              <UserPlus className="size-4" aria-hidden />
              Kayıt ol
            </AuthTransitionLink>
            <AuthTransitionLink
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-6 py-2.5 text-sm font-semibold text-red-50 transition hover:border-red-300/60 hover:bg-red-500/20"
            >
              <LogIn className="size-4" aria-hidden />
              Giriş yap
            </AuthTransitionLink>
          </div>
        </div>
      </div>
    </section>
  );
}
