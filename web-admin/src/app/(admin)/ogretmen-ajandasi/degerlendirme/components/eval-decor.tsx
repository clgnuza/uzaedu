'use client';

import { cn } from '@/lib/utils';

/** Arka plan: telifsiz geometrik nokta + yıldız (inline SVG). */
export function EvalHeroBackdrop({ className }: { className?: string }) {
  return (
    <svg
      className={cn('pointer-events-none absolute inset-0 h-full w-full text-indigo-500/25 dark:text-indigo-400/18', className)}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <pattern id="eval-grid-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.25" fill="currentColor" opacity="0.45" />
          <circle cx="14" cy="14" r="0.85" fill="currentColor" opacity="0.3" />
        </pattern>
        <linearGradient id="eval-sun-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.09" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#eval-grid-dots)" />
      <circle cx="92%" cy="8%" r="48" fill="url(#eval-sun-glow)" />
      <circle cx="4%" cy="78%" r="36" fill="url(#eval-sun-glow)" className="rotate-180" />
    </svg>
  );
}

/** Özgün “sınıf arkadaşı” blob — ClassDojo maskotu değil; basit geometri. */
export function EvalBlobMascot({ className, size = 56 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="blob-body" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="0.55" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="blob-cheek" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fda4af" stopOpacity="0.65" />
          <stop offset="1" stopColor="#fb7185" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M32 6c8.5 0 15.5 3.2 19.8 9.2 2.4 3.3 3.8 7.2 4.2 11.4.2 2.1.1 4.3-.4 6.4 4.8 2.6 8.4 7.4 8.4 13.5 0 8.2-6.8 14.5-15.5 14.5-3.4 0-6.5-1-9-2.7-3.2 2.4-7.2 3.7-11.5 3.7-4.2 0-8.1-1.3-11.3-3.6-2.5 1.7-5.6 2.6-9 2.6C8.8 56.4 2 50.1 2 41.9c0-6 3.5-10.8 8.2-13.4-.5-2.1-.7-4.3-.4-6.5.4-4.2 1.8-8.1 4.2-11.4C18.5 9.2 25.5 6 34 6z"
        fill="url(#blob-body)"
      />
      <ellipse cx="22" cy="40" rx="4" ry="2.5" fill="url(#blob-cheek)" />
      <ellipse cx="42" cy="40" rx="4" ry="2.5" fill="url(#blob-cheek)" />
      <circle cx="24" cy="30" r="4.5" fill="white" fillOpacity="0.95" />
      <circle cx="40" cy="30" r="4.5" fill="white" fillOpacity="0.95" />
      <circle cx="25" cy="31" r="2" fill="#312e81" />
      <circle cx="39" cy="31" r="2" fill="#312e81" />
      <path
        d="M26 44c2.5 3 5.8 4.5 9.5 4.5 3.7 0 7-1.5 9.5-4.5"
        stroke="#312e81"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path d="M14 18c2-4 6-6 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />
      <path d="M48 16c-2-3.5-6-5.5-10-4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />
    </svg>
  );
}

export function EvalSparkleCluster({ className }: { className?: string }) {
  return (
    <svg className={cn('text-amber-400/90 dark:text-amber-300/80', className)} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M20 2l1.8 6.2L28 10l-6.2 1.8L20 18l-1.8-6.2L12 10l6.2-1.8L20 2z" fill="currentColor" opacity="0.9" />
      <path d="M32 22l1 3.4L36.5 27l-3.5 1L32 31.5l-1-3.5L27.5 27l3.5-1L32 22z" fill="currentColor" opacity="0.55" />
      <path d="M8 24l0.9 3L12 28.2l-3.1 0.9L8 32l-0.9-3.1L4 28.2l3.1-0.9L8 24z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function EvalRibbonBadge({ className }: { className?: string }) {
  return (
    <svg className={cn('text-emerald-500/85 dark:text-emerald-400/75', className)} viewBox="0 0 48 24" fill="none" aria-hidden>
      <path
        d="M4 6h28c2 0 4 1.5 4 3.5v5c0 2-2 3.5-4 3.5H18l-6 5v-5H4c-2 0-4-1.5-4-3.5v-5C0 7.5 2 6 4 6z"
        fill="currentColor"
        opacity="0.25"
      />
      <path d="M8 10h20M8 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function EvalEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg className={cn('mx-auto max-w-[200px] text-muted-foreground/40', className)} viewBox="0 0 120 100" fill="none" aria-hidden>
      <rect x="18" y="28" width="84" height="56" rx="14" className="stroke-violet-400/50" strokeWidth="2" fill="currentColor" fillOpacity="0.06" />
      <path d="M38 48h44M38 58h28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
      <circle cx="60" cy="18" r="10" className="fill-amber-400/40" />
      <path d="M56 18l2.5 2.5L66 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

/** Kart köşesi süsü */
export function EvalCardCornerArt({ className }: { className?: string }) {
  return (
    <svg
      className={cn('pointer-events-none absolute -right-1 -top-1 h-14 w-14 text-violet-400/30 dark:text-violet-300/22', className)}
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden
    >
      <circle cx="40" cy="16" r="10" fill="currentColor" />
      <circle cx="22" cy="10" r="5" fill="currentColor" opacity="0.55" />
      <path d="M44 36l4 10-9-5-9 5 4-10-8-7h10l4-10 4 10h10l-8 7z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
