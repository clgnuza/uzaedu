'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import { cn } from '@/lib/utils';
import { isPublicAdminPath } from '@/lib/public-admin-paths';
import {
  LogIn,
  ArrowRight,
  CheckCircle2,
  Layers3,
  Sparkle,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { LANDING_HUB_ITEMS, type LandingHubItem } from '@/components/landing/landing-hub-items';

type HubItem = LandingHubItem;

const ITEMS = LANDING_HUB_ITEMS;

const OUTER_R = 45.2;
const STAR_R  = 39.4;
const ICON_R  = 35.6;
const LABEL_R = 41.4;
const INNER_R = 20.8;

/** Sabit id — landing’de tek SealHub; useId + Turbopack/SSR gradient id uyuşmazlığı olmasın */
const SEAL_HUB_ROPE_GRAD_ID = 'seal-hub-rope-grad';
const SEAL_HUB_C_BLOOM_ID = 'seal-hub-c-bloom';

function hubRingPositions(r: number, n: number): { left: string; top: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    return { left: `${x.toFixed(4)}%`, top: `${y.toFixed(4)}%` };
  });
}

/** Sabit yüzdeler — SSR / istemci kayan nokta farkı hidrasyon hatası vermesin */
const ICON_POSITIONS = hubRingPositions(ICON_R, ITEMS.length);
const LABEL_POSITIONS = hubRingPositions(LABEL_R, ITEMS.length);

function hubItemTargetPath(href: string): string {
  if (href.startsWith('/login')) {
    const m = href.match(/[?&]redirect=([^&]+)/);
    if (m?.[1]) {
      try {
        const raw = decodeURIComponent(m[1]);
        return (raw.split('?')[0] || '/').replace(/\/$/, '') || '/';
      } catch {
        return '/';
      }
    }
    return '/';
  }
  const p = href.split('?')[0] || '/';
  return p.replace(/\/$/, '') || '/';
}

function ActionButton({
  href,
  children,
  compact,
  className,
}: {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const base = compact
    ? 'inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200'
    : 'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200';
  const shell =
    'border-red-400/40 bg-red-500/15 text-red-50 hover:border-red-300/70 hover:bg-red-500/25 hover:shadow-[0_0_24px_-8px_rgba(248,113,113,0.7)]';
  const merged = cn(base, shell, className);
  if (href.startsWith('/login')) {
    return (
      <AuthTransitionLink href={href} className={merged}>
        {children}
      </AuthTransitionLink>
    );
  }
  return (
    <Link href={href} className={merged}>
      {children}
    </Link>
  );
}

function HubDetailModal({ item, onClose, hubRect }: { item: HubItem; onClose: () => void; hubRect: DOMRect }) {
  const sid = useId().replace(/:/g, '');
  const CardIcon = item.icon;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const gidGlow = `hub-${sid}-glow`;
  const gidGlow2 = `hub-${sid}-glow2`;
  const gidArc = `hub-${sid}-arc`;
  const gidRing = `hub-${sid}-ring-grad`;

  const loginHref = item.href.startsWith('/login')
    ? item.href
    : `/login?redirect=${encodeURIComponent(item.href)}`;

  const targetPath = hubItemTargetPath(item.href);
  const publicTarget = isPublicAdminPath(targetPath);
  const ctaHref = publicTarget ? targetPath : loginHref;

  /** Kırmızı halka = hub container × (OUTER_R/50) = %90.4; kartı tam oraya sabitle */
  const ringRatio = (OUTER_R * 2) / 100;          // 0.904
  const padFrac   = (1 - ringRatio) / 2;           // 0.048
  const cardSize  = hubRect.width * ringRatio;
  const cardLeft  = hubRect.left  + hubRect.width  * padFrac;
  const cardTop   = hubRect.top   + hubRect.height * padFrac;

  return createPortal(
    <div
      className="fixed inset-0 z-80"
      style={{ animation: 'hub-modal-backdrop 0.32s ease-out both' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(167,139,250,0.22)_0%,rgba(30,27,75,0.4)_42%,rgba(0,0,0,0.82)_100%)] backdrop-blur-[3px]"
        aria-hidden
      />
      <div
        className="relative flex min-h-0 flex-col overflow-hidden rounded-full border border-white/14 text-center shadow-[0_28px_90px_-24px_rgba(139,92,246,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          position: 'fixed',
          left: cardLeft,
          top: cardTop,
          width: cardSize,
          height: cardSize,
          animation: 'hub-modal-card 0.48s cubic-bezier(0.22, 1, 0.32, 1) both',
          background:
            'linear-gradient(152deg, rgba(49,46,129,0.98) 0%, rgba(91,33,182,0.95) 36%, rgba(30,27,75,0.98) 64%, rgba(15,23,42,0.99) 100%)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-detail-title"
      >
        <svg className="pointer-events-none absolute inset-0 z-0 size-full opacity-[0.38]" viewBox="0 0 200 200" aria-hidden>
          <defs>
            <radialGradient id={gidGlow} cx="28%" cy="22%">
              <stop offset="0%" stopColor="#fda4af" stopOpacity="0.55" />
              <stop offset="42%" stopColor="#c084fc" stopOpacity="0.22" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id={gidGlow2} cx="78%" cy="82%">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.28" />
              <stop offset="55%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id={gidArc} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="98" fill={`url(#${gidGlow2})`} />
          <circle cx="54" cy="46" r="76" fill={`url(#${gidGlow})`} />
          <circle cx="100" cy="100" r="90" fill="none" stroke={`url(#${gidArc})`} strokeWidth="0.45" />
          <path
            d="M100 16 A84 84 0 0 1 184 96"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
            strokeLinecap="round"
          />
          <path
            d="M22 124 A78 78 0 0 0 100 178"
            fill="none"
            stroke="rgba(244,114,182,0.14)"
            strokeWidth="0.4"
            strokeLinecap="round"
          />
        </svg>

        <svg className="pointer-events-none absolute inset-0 z-1 size-full" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <linearGradient id={gidRing} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#d8b4fe" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.92" />
            </linearGradient>
            <filter id={`hub-${sid}-ring-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.35" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g
            filter={`url(#hub-${sid}-ring-soft)`}
            style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'orbit-cw 22s linear infinite' }}
          >
            <circle
              cx="50"
              cy="50"
              r="49.35"
              fill="none"
              stroke="rgba(15,23,42,0.55)"
              strokeWidth="2.2"
              strokeDasharray="9 5"
              strokeLinecap="round"
            />
            <circle
              cx="50"
              cy="50"
              r="49.35"
              fill="none"
              stroke={`url(#${gidRing})`}
              strokeWidth="1.25"
              strokeDasharray="9 5"
              strokeLinecap="round"
            />
          </g>
        </svg>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-[4%] top-[3%] z-20 inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/35 text-zinc-200 backdrop-blur-sm transition hover:border-rose-300/40 hover:bg-black/45 hover:text-white sm:right-[5%] sm:top-[4%] sm:size-9"
          aria-label="Kapat"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>

        <div className="relative z-2 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-1 pt-[14%] [-webkit-overflow-scrolling:touch] sm:px-6 sm:pt-[13%]">
            <div className="flex flex-col items-center">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(160deg,rgba(255,255,255,0.12)_0%,rgba(15,23,42,0.5)_100%)] shadow-[0_0_20px_-8px_rgba(244,114,182,0.4)] sm:size-12">
                <CardIcon className="size-4.5 text-rose-100 sm:size-6" strokeWidth={1.85} aria-hidden />
              </span>

              <p className="relative mt-1 text-[8.5px] font-bold uppercase tracking-[0.2em] text-violet-200/90">
                Modül
              </p>
              <h3
                id="hub-detail-title"
                className="relative mt-0.5 max-w-[22ch] bg-linear-to-r from-rose-100 via-amber-50 to-violet-200 bg-clip-text text-[14px] font-bold leading-tight text-transparent sm:text-base md:text-lg"
              >
                {item.label}
              </h3>

              <span className="relative mt-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[8.5px] font-medium text-zinc-200/95">
                <Sparkle className="size-2.5 shrink-0 text-amber-200/90" aria-hidden />
                Okul akışı
              </span>

              <p className="relative mt-1.5 max-w-[34ch] text-pretty text-[10.5px] leading-relaxed text-zinc-200/95 sm:text-xs">
                {item.description}
              </p>
              <p className="relative mt-1 max-w-[36ch] text-pretty text-[9.5px] leading-relaxed text-zinc-400 sm:text-[11px]">
                {item.detail}
              </p>

              <ul className="relative mt-1.5 flex w-full max-w-md flex-wrap justify-center gap-1 px-1">
                {item.tags.map((tag) => (
                  <li
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9.5px] font-medium text-zinc-100/90"
                  >
                    <Sparkles className="size-2.5 shrink-0 text-fuchsia-300/80" aria-hidden />
                    {tag}
                  </li>
                ))}
              </ul>

              <ul className="relative mt-1.5 w-full max-w-sm space-y-0.5 px-2 text-left text-[9px] leading-snug text-zinc-400 sm:text-[10px]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3 shrink-0 text-emerald-400/90" aria-hidden />
                  <span>Sade, anlaşılır akış</span>
                </li>
                <li className="flex items-center gap-2">
                  <Layers3 className="size-3 shrink-0 text-violet-300/90" aria-hidden />
                  <span>Düzenli iş adımları</span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="size-3 shrink-0 text-sky-300/90" aria-hidden />
                  <span>Öğretmen ve yönetici</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="size-3 shrink-0 text-amber-300/90" aria-hidden />
                  <span>Hızlı erişim</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 justify-center border-t border-white/10 bg-black/25 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:py-2.5">
            <ActionButton
              href={ctaHref}
              compact
              className="border-white/25 bg-linear-to-r from-rose-500/30 via-fuchsia-500/20 to-violet-600/30 px-4 py-1.5 text-[11px] text-white shadow-[0_0_20px_-8px_rgba(244,114,182,0.5)] hover:border-white/35 hover:from-rose-500/40 hover:via-fuchsia-500/30 hover:to-violet-600/40"
            >
              {publicTarget ? (
                <ArrowRight className="size-3.5 shrink-0 opacity-95" />
              ) : (
                <LogIn className="size-3.5 shrink-0 opacity-95" />
              )}
              {publicTarget ? 'Sayfaya git' : 'Giriş'}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function hubNodeAngle(index: number, total: number): number {
  return -Math.PI / 2 + (index / total) * Math.PI * 2;
}

function HubNodeLabel({
  text,
  className,
  isTopHalf,
}: {
  text: string;
  className?: string;
  isTopHalf: boolean;
}) {
  const arcD = isTopHalf ? 'M 3 11 Q 40 5 77 11' : 'M 3 3 Q 40 9 77 3';
  return (
    <span className={cn('flex flex-col items-center gap-0.5', isTopHalf && 'flex-col-reverse', className)}>
      <span className="landing-seal-hub-node-label whitespace-nowrap text-center font-semibold leading-none text-zinc-100">
        {text}
      </span>
      <svg className="h-[6px] w-[clamp(36px,8vmin,72px)] overflow-visible opacity-75" viewBox="0 0 80 14" aria-hidden>
        <path d={arcD} fill="none" stroke="rgba(228,228,231,0.5)" strokeWidth="1.15" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const Node3D = memo(function Node3D({
  item,
  onSelect,
  index,
  total,
}: {
  item: HubItem;
  onSelect: (item: HubItem) => void;
  index: number;
  total: number;
}) {
  const Icon = item.icon;
  const isTopHalf = Math.sin(hubNodeAngle(index, total)) < 0;

  return (
    <div className="absolute inset-0">
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`${item.label} bilgi kartını aç`}
        className="group absolute -translate-x-1/2 -translate-y-1/2 appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-red-500/70"
        style={ICON_POSITIONS[index]}
      >
      <span className="relative z-10 flex h-[clamp(34px,7.2vmin,60px)] w-[clamp(34px,7.2vmin,60px)] items-center justify-center overflow-visible rounded-full transition-transform duration-200 group-hover:scale-[1.07] sm:h-[clamp(48px,9.2vmin,66px)] sm:w-[clamp(48px,9.2vmin,66px)] sm:group-hover:scale-110">
        <span
          className="absolute -inset-[7%] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.22)_0%,transparent_68%)] opacity-80 blur-[2px] transition group-hover:opacity-100"
          aria-hidden
        />
        <span
          className="absolute inset-0 rounded-full shadow-[0_5px_18px_-4px_rgba(0,0,0,0.88),0_3px_10px_-2px_rgba(185,28,28,0.35)]"
          aria-hidden
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 36% 28%, #52525b 0%, #18181b 38%, #09090b 78%)' }}
        />
        <span
          className="absolute inset-[6%] rounded-full"
          style={{ background: 'radial-gradient(circle at 38% 26%, rgba(255,255,255,0.2) 0%, transparent 48%)' }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(168deg, rgba(255,255,255,0.16) 0%, transparent 42%)' }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.62), inset 0 2px 0 rgba(255,255,255,0.1)' }}
        />
        <span className="absolute inset-0 rounded-full border border-red-600/70 transition-all duration-200 group-hover:border-red-400/95 group-hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)]" />
        <Icon
          className="relative z-10 h-[clamp(14px,2.9vmin,24px)] w-[clamp(14px,2.9vmin,24px)] text-red-400 drop-shadow-[0_1px_6px_rgba(220,38,38,0.85)] transition-colors duration-200 group-hover:text-red-100 sm:h-[clamp(19px,3.7vmin,28px)] sm:w-[clamp(19px,3.7vmin,28px)]"
          strokeWidth={1.65}
        />
      </span>
      </button>
      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={LABEL_POSITIONS[index]}
      >
        <HubNodeLabel isTopHalf={isTopHalf} text={item.shortLabel ?? item.label} className="2xl:hidden" />
        <HubNodeLabel isTopHalf={isTopHalf} text={item.label} className="hidden 2xl:block" />
      </div>
    </div>
  );
});

function RopeRing({
  r, sw, dash, gap, speed, dir = 'cw', ropeGradId,
}: {
  r: number; sw: number; dash: number; gap: number;
  speed: number; dir?: 'cw' | 'ccw';
  ropeGradId: string;
}) {
  const da = `${dash} ${gap}`;
  const anim = `${dir === 'cw' ? 'orbit-cw' : 'orbit-ccw'} ${speed}s linear infinite`;
  const ropeUrl = `url(#${ropeGradId})`;
  return (
    <g
      style={{
        transformBox: 'fill-box',
        transformOrigin: 'center',
        animation: anim,
        willChange: 'transform',
      }}
    >
      <circle cx="50" cy="50" r={r} fill="none"
        stroke="rgba(60,0,0,0.75)" strokeWidth={sw + 1.4}
        strokeDasharray={da} strokeLinecap="round"
        strokeDashoffset={dash * 0.55}
      />
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={ropeUrl} strokeWidth={sw}
        strokeDasharray={da} strokeLinecap="round"
      />
      <circle cx="50" cy="50" r={r} fill="none"
        stroke="rgba(255,130,130,0.42)" strokeWidth={sw * 0.28}
        strokeDasharray={da} strokeLinecap="round"
        strokeDashoffset={dash * 0.4}
      />
    </g>
  );
}

export function SealHub() {
  const router = useRouter();
  const hubRef = useRef<HTMLDivElement>(null);
  const [activeItem, setActiveItem] = useState<HubItem | null>(null);
  const [hubRect, setHubRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    router.prefetch('/login');
    router.prefetch('/register');
    const seen = new Set<string>();
    for (const it of ITEMS) {
      const t = hubItemTargetPath(it.href);
      if (isPublicAdminPath(t) && !seen.has(t)) {
        seen.add(t);
        router.prefetch(t);
      }
    }
  }, [router]);

  const handleSelect = useCallback((item: HubItem) => {
    if (hubRef.current) setHubRect(hubRef.current.getBoundingClientRect());
    setActiveItem(item);
  }, []);

  return (
    <div className="w-full min-w-0 max-w-[100vw]">
      {/* Yuvarlak logo + çevrede simgeler — tüm ekranlar */}
      <div
        ref={hubRef}
        className="landing-seal-hub relative isolate mx-auto aspect-square w-full min-h-0 max-w-[min(94vw,380px)] overflow-visible sm:max-w-[min(94vw,520px)] md:max-w-[min(92vw,560px)] lg:max-w-[min(90vw,640px)] xl:max-w-[min(88vw,720px)]"
      >
        {/* Ambient bloom */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(185,28,28,0.22) 0%, transparent 58%)' }}
          aria-hidden
        />

        {/* SVG rings */}
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <linearGradient id={SEAL_HUB_ROPE_GRAD_ID} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#f87171" stopOpacity="0.95" />
              <stop offset="30%"  stopColor="#dc2626" />
              <stop offset="65%"  stopColor="#991b1b" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0.9" />
            </linearGradient>
            <radialGradient id={SEAL_HUB_C_BLOOM_ID} cx="50%" cy="50%">
              <stop offset="0%"   stopColor="rgba(185,28,28,0.22)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          <circle cx="50" cy="50" r="45" fill={`url(#${SEAL_HUB_C_BLOOM_ID})`} />

          <g>
            <RopeRing r={OUTER_R} sw={3.3} dash={3.1} gap={1.8} speed={52} dir="cw" ropeGradId={SEAL_HUB_ROPE_GRAD_ID} />
          </g>
          <circle cx="50" cy="50" r={OUTER_R - 5.8} fill="none" stroke="rgba(220,38,38,0.18)" strokeWidth="0.14" />

          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
            return (
              <text key={i}
                x={50 + STAR_R * Math.cos(a)} y={50 + STAR_R * Math.sin(a)}
                textAnchor="middle" dominantBaseline="central"
                fill="#dc2626" fontSize="2.2" opacity={0.55 + (i % 5) * 0.06}
              >★</text>
            );
          })}

          <circle cx="50" cy="50" r={INNER_R + 4.1} fill="none" stroke="rgba(220,38,38,0.14)" strokeWidth="0.11" />
          <g>
            <RopeRing r={INNER_R} sw={2.2} dash={2.4} gap={1.4} speed={38} dir="ccw" ropeGradId={SEAL_HUB_ROPE_GRAD_ID} />
          </g>
        </svg>

        {/* Module nodes — z-10: kenar etiketleri orta logonun altında kalmasın */}
        <div className="landing-seal-hub-nodes absolute inset-[1.5%] z-10 overflow-visible sm:inset-[3%] md:inset-[2.5%]">
          <div className="landing-seal-hub-nodes-ring relative h-full min-h-0 w-full min-w-0 origin-center overflow-visible">
            {ITEMS.map((item, i) => (
              <Node3D key={item.href} item={item} onSelect={handleSelect} index={i} total={ITEMS.length} />
            ))}
          </div>
        </div>

        {mounted && activeItem && hubRect && (
          <HubDetailModal item={activeItem} hubRect={hubRect} onClose={() => { setActiveItem(null); setHubRect(null); }} />
        )}

        {/* Orta logo */}
        <div className="landing-seal-hub-center pointer-events-none absolute inset-[30%] z-1 flex items-center justify-center max-sm:inset-[36%]">
          <div className="seal-hub-logo-breathe relative flex h-[84%] w-[84%] items-center justify-center overflow-hidden rounded-full">
            <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.78)_30%,rgba(255,255,255,0.24)_52%,rgba(255,255,255,0)_72%)] blur-md" />
            <Image
              src="/landing/uza-logo.png"
              alt="uZa Logo"
              fill
              priority
              sizes="(max-width: 640px) 180px, (max-width: 1024px) 240px, 320px"
              className="relative z-10 scale-[1.03] object-contain drop-shadow-[0_10px_28px_rgba(220,38,38,0.28)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
