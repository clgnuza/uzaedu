'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const CRITERION_PRESET_GRID =
  'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';

type GlassTheme = {
  card: string;
  icon: string;
  badge: string;
  text: string;
  footer: string;
  taken: string;
};

const PALETTE: GlassTheme[] = [
  {
    card: 'border-sky-300/45 bg-linear-to-br from-sky-400/28 via-sky-200/12 to-cyan-300/22 shadow-[0_6px_22px_-6px_rgba(14,165,233,0.45)]',
    icon: 'bg-linear-to-br from-sky-300/55 to-cyan-200/35 text-sky-900 ring-1 ring-sky-200/60',
    badge: 'bg-sky-500/90 shadow-[0_0_12px_rgba(14,165,233,0.55)]',
    text: 'text-sky-950 dark:text-sky-50',
    footer: 'border-sky-300/35 hover:bg-sky-400/15',
    taken: 'border-sky-400/55 bg-sky-400/22',
  },
  {
    card: 'border-violet-300/45 bg-linear-to-br from-violet-400/28 via-violet-200/12 to-fuchsia-300/22 shadow-[0_6px_22px_-6px_rgba(139,92,246,0.45)]',
    icon: 'bg-linear-to-br from-violet-300/55 to-fuchsia-200/35 text-violet-900 ring-1 ring-violet-200/60',
    badge: 'bg-violet-500/90 shadow-[0_0_12px_rgba(139,92,246,0.55)]',
    text: 'text-violet-950 dark:text-violet-50',
    footer: 'border-violet-300/35 hover:bg-violet-400/15',
    taken: 'border-violet-400/55 bg-violet-400/22',
  },
  {
    card: 'border-emerald-300/45 bg-linear-to-br from-emerald-400/28 via-emerald-200/12 to-teal-300/22 shadow-[0_6px_22px_-6px_rgba(16,185,129,0.45)]',
    icon: 'bg-linear-to-br from-emerald-300/55 to-teal-200/35 text-emerald-900 ring-1 ring-emerald-200/60',
    badge: 'bg-emerald-500/90 shadow-[0_0_12px_rgba(16,185,129,0.55)]',
    text: 'text-emerald-950 dark:text-emerald-50',
    footer: 'border-emerald-300/35 hover:bg-emerald-400/15',
    taken: 'border-emerald-400/55 bg-emerald-400/22',
  },
  {
    card: 'border-amber-300/45 bg-linear-to-br from-amber-400/28 via-amber-200/12 to-orange-300/22 shadow-[0_6px_22px_-6px_rgba(245,158,11,0.45)]',
    icon: 'bg-linear-to-br from-amber-300/55 to-orange-200/35 text-amber-950 ring-1 ring-amber-200/60',
    badge: 'bg-amber-500/90 shadow-[0_0_12px_rgba(245,158,11,0.55)]',
    text: 'text-amber-950 dark:text-amber-50',
    footer: 'border-amber-300/35 hover:bg-amber-400/15',
    taken: 'border-amber-400/55 bg-amber-400/22',
  },
  {
    card: 'border-rose-300/45 bg-linear-to-br from-rose-400/28 via-rose-200/12 to-pink-300/22 shadow-[0_6px_22px_-6px_rgba(244,63,94,0.45)]',
    icon: 'bg-linear-to-br from-rose-300/55 to-pink-200/35 text-rose-900 ring-1 ring-rose-200/60',
    badge: 'bg-rose-500/90 shadow-[0_0_12px_rgba(244,63,94,0.55)]',
    text: 'text-rose-950 dark:text-rose-50',
    footer: 'border-rose-300/35 hover:bg-rose-400/15',
    taken: 'border-rose-400/55 bg-rose-400/22',
  },
  {
    card: 'border-cyan-300/45 bg-linear-to-br from-cyan-400/28 via-cyan-200/12 to-blue-300/22 shadow-[0_6px_22px_-6px_rgba(6,182,212,0.45)]',
    icon: 'bg-linear-to-br from-cyan-300/55 to-blue-200/35 text-cyan-950 ring-1 ring-cyan-200/60',
    badge: 'bg-cyan-500/90 shadow-[0_0_12px_rgba(6,182,212,0.55)]',
    text: 'text-cyan-950 dark:text-cyan-50',
    footer: 'border-cyan-300/35 hover:bg-cyan-400/15',
    taken: 'border-cyan-400/55 bg-cyan-400/22',
  },
  {
    card: 'border-fuchsia-300/45 bg-linear-to-br from-fuchsia-400/28 via-fuchsia-200/12 to-purple-300/22 shadow-[0_6px_22px_-6px_rgba(217,70,239,0.45)]',
    icon: 'bg-linear-to-br from-fuchsia-300/55 to-purple-200/35 text-fuchsia-900 ring-1 ring-fuchsia-200/60',
    badge: 'bg-fuchsia-500/90 shadow-[0_0_12px_rgba(217,70,239,0.55)]',
    text: 'text-fuchsia-950 dark:text-fuchsia-50',
    footer: 'border-fuchsia-300/35 hover:bg-fuchsia-400/15',
    taken: 'border-fuchsia-400/55 bg-fuchsia-400/22',
  },
  {
    card: 'border-indigo-300/45 bg-linear-to-br from-indigo-400/28 via-indigo-200/12 to-blue-300/22 shadow-[0_6px_22px_-6px_rgba(99,102,241,0.45)]',
    icon: 'bg-linear-to-br from-indigo-300/55 to-blue-200/35 text-indigo-900 ring-1 ring-indigo-200/60',
    badge: 'bg-indigo-500/90 shadow-[0_0_12px_rgba(99,102,241,0.55)]',
    text: 'text-indigo-950 dark:text-indigo-50',
    footer: 'border-indigo-300/35 hover:bg-indigo-400/15',
    taken: 'border-indigo-400/55 bg-indigo-400/22',
  },
  {
    card: 'border-teal-300/45 bg-linear-to-br from-teal-400/28 via-teal-200/12 to-emerald-300/22 shadow-[0_6px_22px_-6px_rgba(20,184,166,0.45)]',
    icon: 'bg-linear-to-br from-teal-300/55 to-emerald-200/35 text-teal-900 ring-1 ring-teal-200/60',
    badge: 'bg-teal-500/90 shadow-[0_0_12px_rgba(20,184,166,0.55)]',
    text: 'text-teal-950 dark:text-teal-50',
    footer: 'border-teal-300/35 hover:bg-teal-400/15',
    taken: 'border-teal-400/55 bg-teal-400/22',
  },
  {
    card: 'border-orange-300/45 bg-linear-to-br from-orange-400/28 via-orange-200/12 to-amber-300/22 shadow-[0_6px_22px_-6px_rgba(249,115,22,0.45)]',
    icon: 'bg-linear-to-br from-orange-300/55 to-amber-200/35 text-orange-950 ring-1 ring-orange-200/60',
    badge: 'bg-orange-500/90 shadow-[0_0_12px_rgba(249,115,22,0.55)]',
    text: 'text-orange-950 dark:text-orange-50',
    footer: 'border-orange-300/35 hover:bg-orange-400/15',
    taken: 'border-orange-400/55 bg-orange-400/22',
  },
];

export function getCriterionGlassTheme(index: number): GlassTheme {
  return PALETTE[index % PALETTE.length]!;
}

export function CriterionPresetCard({
  colorIndex,
  scoreLabel,
  name,
  icon,
  taken,
  onPrimaryClick,
  onAddClick,
  footerLabel,
  addDisabled,
  primaryTitle,
}: {
  colorIndex: number;
  scoreLabel: string;
  name: string;
  icon: ReactNode;
  taken: boolean;
  onPrimaryClick?: () => void;
  onAddClick?: () => void;
  footerLabel?: string;
  addDisabled?: boolean;
  primaryTitle?: string;
}) {
  const t = getCriterionGlassTheme(colorIndex);
  const hasFooter = Boolean(footerLabel);

  return (
    <div
      className={cn(
        'relative flex h-[7.75rem] flex-col overflow-hidden rounded-2xl border backdrop-blur-md transition-all',
        taken ? t.taken : t.card,
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/45 via-white/10 to-transparent opacity-80"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -right-4 -top-4 size-16 rounded-full bg-white/35 blur-xl"
        aria-hidden
      />

      {hasFooter ? (
        <>
          <div
            role="button"
            tabIndex={0}
            title={primaryTitle}
            onClick={onPrimaryClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPrimaryClick?.();
              }
            }}
            className={cn(
              'relative flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 px-1.5 py-2 outline-none transition-colors hover:bg-white/10',
              t.text,
            )}
          >
            <span
              className={cn(
                'absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white backdrop-blur-sm',
                t.badge,
              )}
            >
              {scoreLabel}
            </span>
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm shadow-inner',
                t.icon,
              )}
            >
              {icon}
            </span>
            <span className="line-clamp-2 px-1 text-center text-[10px] font-semibold leading-tight">{name}</span>
          </div>
          <button
            type="button"
            disabled={addDisabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddClick?.();
            }}
            className={cn(
              'relative shrink-0 border-t py-1 text-[9px] font-semibold backdrop-blur-sm transition-colors',
              t.footer,
              taken ? 'cursor-default text-muted-foreground' : 'text-foreground/90 hover:text-foreground',
            )}
          >
            {footerLabel}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={addDisabled}
          onClick={onAddClick}
          title={primaryTitle}
          className={cn(
            'relative flex h-full w-full flex-col items-center justify-center gap-1.5 px-1.5 py-2 transition-all',
            !taken && !addDisabled && 'hover:bg-white/10 active:scale-[0.98]',
            taken && 'cursor-default',
            t.text,
          )}
        >
          <span
            className={cn(
              'absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full text-[9px] font-bold tabular-nums text-white backdrop-blur-sm',
              t.badge,
            )}
          >
            {scoreLabel}
          </span>
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm shadow-inner',
              t.icon,
            )}
          >
            {icon}
          </span>
          <span className="line-clamp-2 px-1 text-center text-[10px] font-semibold leading-tight">{name}</span>
        </button>
      )}
    </div>
  );
}
