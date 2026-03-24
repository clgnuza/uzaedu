'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { memo, useEffect } from 'react';
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import {
  ScanLine,
  Sigma,
  Calendar,
  Shield,
  Sparkles,
  Newspaper,
  Monitor,
  ClipboardList,
  Layers,
  CalendarClock,
  Target,
  School,
  type LucideIcon,
} from 'lucide-react';

type HubItem = { label: string; href: string; icon: LucideIcon };

const ITEMS: HubItem[] = [
  { label: 'Haberler',    href: '/login?redirect=%2Fhaberler',          icon: Newspaper },
  { label: 'Ek ders',     href: '/login?redirect=%2Fextra-lesson-calc', icon: Sigma },
  { label: 'Ders Prog.',  href: '/login?redirect=%2Fders-programi',     icon: Calendar },
  { label: 'Nöbet',       href: '/login?redirect=%2Fduty',              icon: Shield },
  { label: 'Bilsem',      href: '/login?redirect=%2Fbilsem%2Ftakvim',  icon: Sparkles },
  { label: 'Optik okuma', href: '/login?redirect=%2Foptik-formlar',      icon: ScanLine },
  { label: 'Akıllı tahta', href: '/login?redirect=%2Fakilli-tahta',      icon: Monitor },
  { label: 'Sınav görev.', href: '/login?redirect=%2Fsinav-gorevlerim', icon: ClipboardList },
  { label: 'Planlar',     href: '/login?redirect=%2Fduty%2Fplanlar',    icon: Layers },
  { label: 'Ajanda',      href: '/login?redirect=%2Fogretmen-ajandasi', icon: CalendarClock },
  { label: 'Kazanım',     href: '/login?redirect=%2Fkazanim-takip',     icon: Target },
  { label: 'Okullar',     href: '/login?redirect=%2Fschools',           icon: School },
];

const OUTER_R = 46.5;
const STAR_R  = 40.5;
const NODE_R  = 34;
const INNER_R = 24;

/** Sabit yüzdeler — SSR / istemci kayan nokta farkı hidrasyon hatası vermesin */
const NODE_POSITIONS: { left: string; top: string }[] = (() => {
  const n = ITEMS.length;
  const r = NODE_R;
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    return { left: `${x.toFixed(4)}%`, top: `${y.toFixed(4)}%` };
  });
})();

const Node3D = memo(function Node3D({ item, sm }: { item: HubItem; sm?: boolean }) {
  const Icon = item.icon;
  return (
    <AuthTransitionLink
      href={item.href}
      className="group flex flex-col items-center gap-[5px] outline-none focus-visible:ring-2 focus-visible:ring-red-500/70"
    >
      <span
        className={
          sm
            ? 'relative flex size-11 items-center justify-center overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-110'
            : 'relative flex h-[clamp(36px,6.5vmin,52px)] w-[clamp(36px,6.5vmin,52px)] items-center justify-center overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-110'
        }
      >
        {/* Metallic base */}
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 38% 30%, #3f3f46 0%, #09090b 72%)' }}
        />
        {/* Top glass highlight */}
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.13) 0%, transparent 45%)' }}
        />
        {/* Inner rim shadow */}
        <span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 -2px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)' }}
        />
        {/* Red glow border */}
        <span
          className="absolute inset-0 rounded-full border border-red-700/65 transition-all duration-200 group-hover:border-red-400/90 group-hover:shadow-[0_0_22px_-2px_rgba(220,38,38,0.65)]"
        />
        {/* Icon */}
        <Icon
          className={
            sm
              ? 'relative z-10 size-[18px] text-red-400 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)] transition-colors duration-200 group-hover:text-red-200'
              : 'relative z-10 h-[clamp(15px,2.8vmin,22px)] w-[clamp(15px,2.8vmin,22px)] text-red-400 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)] transition-colors duration-200 group-hover:text-red-200'
          }
          strokeWidth={1.6}
        />
      </span>
      <span
        className={
          sm
            ? 'block w-[60px] max-w-[72px] text-center text-[10px] font-semibold leading-tight text-zinc-200 [text-shadow:0_1px_6px_rgba(0,0,0,0.95)] transition-colors duration-200 group-hover:text-white'
            : 'block max-w-[72px] text-center text-[clamp(9px,1.4vmin,11px)] font-semibold leading-tight text-zinc-200 [text-shadow:0_1px_6px_rgba(0,0,0,0.95)] transition-colors duration-200 group-hover:text-white'
        }
      >
        {item.label}
      </span>
    </AuthTransitionLink>
  );
});

function RopeRing({
  r, sw, dash, gap, speed, dir = 'cw',
}: {
  r: number; sw: number; dash: number; gap: number;
  speed: number; dir?: 'cw' | 'ccw';
}) {
  const da = `${dash} ${gap}`;
  const anim = `${dir === 'cw' ? 'orbit-cw' : 'orbit-ccw'} ${speed}s linear infinite`;
  return (
    <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: anim }}>
      <circle cx="50" cy="50" r={r} fill="none"
        stroke="rgba(60,0,0,0.75)" strokeWidth={sw + 1.4}
        strokeDasharray={da} strokeLinecap="round"
        strokeDashoffset={dash * 0.55}
      />
      <circle cx="50" cy="50" r={r} fill="none"
        stroke="url(#rope-grad)" strokeWidth={sw}
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

  useEffect(() => {
    router.prefetch('/login');
    router.prefetch('/register');
  }, [router]);

  return (
    <div className="w-full min-w-0 max-w-[100vw]">

      {/* ── Mobile ── */}
      <div className="flex flex-col items-center gap-5 pb-1 sm:gap-7 md:hidden">
        <div
          className="relative aspect-square w-[min(13.5rem,72vw)] max-w-[280px] sm:w-44 sm:max-w-none"
          style={{ animation: 'logo-breathe 3.5s ease-in-out infinite' }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 40% 35%, #3f3f46, #09090b)',
              boxShadow: '0 0 0 1.5px rgba(220,38,38,0.55), 0 0 40px -8px rgba(220,38,38,0.5)',
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.09) 0%, transparent 40%)' }}
          />
          <div className="relative size-full overflow-hidden rounded-full p-[12%] sm:p-4">
            <Image
              src="/landing/pza-logo.png"
              alt="Öğretmen Pro"
              fill
              sizes="(max-width:640px) 72vw, 176px"
              className="object-contain"
              priority
              decoding="async"
            />
          </div>
        </div>
        <div className="grid w-full max-w-[min(100%,22rem)] grid-cols-3 gap-x-2 gap-y-4 px-0.5 min-[400px]:max-w-[340px] min-[400px]:grid-cols-4 min-[400px]:gap-x-3 min-[400px]:gap-y-5 sm:px-1">
          {ITEMS.map((item) => (
            <div key={item.href} className="flex justify-center">
              <Node3D item={item} sm />
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop seal ── */}
      <div className="relative isolate mx-auto hidden aspect-square w-full min-h-0 max-w-[min(94vw,520px)] md:block lg:max-w-[min(90vw,600px)] xl:max-w-[min(85vw,680px)]">
        {/* Ambient bloom */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(185,28,28,0.22) 0%, transparent 58%)' }}
          aria-hidden
        />

        {/* SVG rings */}
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <linearGradient id="rope-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#f87171" stopOpacity="0.95" />
              <stop offset="30%"  stopColor="#dc2626" />
              <stop offset="65%"  stopColor="#991b1b" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0.9" />
            </linearGradient>
            <radialGradient id="c-bloom" cx="50%" cy="50%">
              <stop offset="0%"   stopColor="rgba(185,28,28,0.22)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <filter id="rope-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="0.75" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="45" fill="url(#c-bloom)" />

          <g filter="url(#rope-glow)">
            <RopeRing r={OUTER_R} sw={4.2} dash={3.6} gap={1.9} speed={52} dir="cw" />
          </g>
          <circle cx="50" cy="50" r={OUTER_R - 5.8} fill="none" stroke="rgba(220,38,38,0.18)" strokeWidth="0.14" />

          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
            return (
              <text key={i}
                x={50 + STAR_R * Math.cos(a)} y={50 + STAR_R * Math.sin(a)}
                textAnchor="middle" dominantBaseline="central"
                fill="#dc2626" fontSize="2.2"
                style={{ animation: `star-twinkle ${2.2 + (i % 4) * 0.55}s ease-in-out ${i * 0.22}s infinite` }}
              >★</text>
            );
          })}

          <circle cx="50" cy="50" r={INNER_R + 5.5} fill="none" stroke="rgba(220,38,38,0.14)" strokeWidth="0.13" />
          <g filter="url(#rope-glow)">
            <RopeRing r={INNER_R} sw={3.2} dash={3} gap={1.6} speed={38} dir="ccw" />
          </g>
        </svg>

        {/* Module nodes */}
        <div className="absolute inset-0">
          {ITEMS.map((item, i) => (
            <div
              key={item.href}
              className="absolute flex w-[18%] -translate-x-1/2 -translate-y-1/2 justify-center"
              style={NODE_POSITIONS[i]}
            >
              <Node3D item={item} />
            </div>
          ))}
        </div>

        {/* Center logo */}
        <div className="pointer-events-none absolute inset-[27%]">
          <div
            className="relative size-full rounded-full"
            style={{ animation: 'logo-breathe 3.5s ease-in-out infinite' }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle at 40% 35%, #3f3f46, #09090b)' }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.09) 0%, transparent 40%)' }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 10px rgba(0,0,0,0.55)' }}
            />
            <div className="absolute inset-0 rounded-full ring-1 ring-red-700/45 ring-inset" />
            <div className="relative size-full overflow-hidden rounded-full p-[8%]">
              <Image
                src="/landing/pza-logo.png"
                alt="Öğretmen Pro"
                fill
                sizes="(max-width:768px) 0px, (max-width:1280px) 28vw, 240px"
                className="object-contain object-center"
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
