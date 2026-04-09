'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DutySubTabItem = { id: string; label: ReactNode; icon?: LucideIcon };

/** Nöbet üst sekmesiyle aynı pastel dil; indeksle döner */
const SUB_TAB_PALETTE = [
  {
    icon: 'bg-sky-500/12 text-sky-700 dark:bg-sky-500/14 dark:text-sky-300',
    iconActive: 'bg-sky-500/22 text-sky-800 shadow-sm dark:bg-sky-500/30 dark:text-sky-100',
    idleHover: 'hover:bg-sky-500/[0.07] dark:hover:bg-sky-500/10',
    activeExtra: 'ring-1 ring-sky-400/35 dark:ring-sky-400/25',
  },
  {
    icon: 'bg-indigo-500/12 text-indigo-700 dark:bg-indigo-500/14 dark:text-indigo-300',
    iconActive: 'bg-indigo-500/22 text-indigo-800 shadow-sm dark:bg-indigo-500/30 dark:text-indigo-100',
    idleHover: 'hover:bg-indigo-500/[0.07] dark:hover:bg-indigo-500/10',
    activeExtra: 'ring-1 ring-indigo-400/35 dark:ring-indigo-400/25',
  },
  {
    icon: 'bg-cyan-500/12 text-cyan-800 dark:bg-cyan-500/14 dark:text-cyan-300',
    iconActive: 'bg-cyan-500/22 text-cyan-900 shadow-sm dark:bg-cyan-500/30 dark:text-cyan-100',
    idleHover: 'hover:bg-cyan-500/[0.07] dark:hover:bg-cyan-500/10',
    activeExtra: 'ring-1 ring-cyan-400/35 dark:ring-cyan-400/25',
  },
  {
    icon: 'bg-amber-500/14 text-amber-800 dark:bg-amber-500/14 dark:text-amber-300',
    iconActive: 'bg-amber-500/24 text-amber-900 shadow-sm dark:bg-amber-500/30 dark:text-amber-100',
    idleHover: 'hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/10',
    activeExtra: 'ring-1 ring-amber-400/40 dark:ring-amber-400/25',
  },
  {
    icon: 'bg-rose-500/12 text-rose-700 dark:bg-rose-500/14 dark:text-rose-300',
    iconActive: 'bg-rose-500/22 text-rose-800 shadow-sm dark:bg-rose-500/30 dark:text-rose-100',
    idleHover: 'hover:bg-rose-500/[0.07] dark:hover:bg-rose-500/10',
    activeExtra: 'ring-1 ring-rose-400/35 dark:ring-rose-400/25',
  },
  {
    icon: 'bg-violet-500/12 text-violet-700 dark:bg-violet-500/14 dark:text-violet-300',
    iconActive: 'bg-violet-500/22 text-violet-800 shadow-sm dark:bg-violet-500/30 dark:text-violet-100',
    idleHover: 'hover:bg-violet-500/[0.07] dark:hover:bg-violet-500/10',
    activeExtra: 'ring-1 ring-violet-400/35 dark:ring-violet-400/25',
  },
  {
    icon: 'bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/14 dark:text-emerald-300',
    iconActive: 'bg-emerald-500/22 text-emerald-900 shadow-sm dark:bg-emerald-500/30 dark:text-emerald-100',
    idleHover: 'hover:bg-emerald-500/[0.07] dark:hover:bg-emerald-500/10',
    activeExtra: 'ring-1 ring-emerald-400/35 dark:ring-emerald-400/25',
  },
  {
    icon: 'bg-teal-500/12 text-teal-800 dark:bg-teal-500/14 dark:text-teal-300',
    iconActive: 'bg-teal-500/22 text-teal-900 shadow-sm dark:bg-teal-500/30 dark:text-teal-100',
    idleHover: 'hover:bg-teal-500/[0.07] dark:hover:bg-teal-500/10',
    activeExtra: 'ring-1 ring-teal-400/35 dark:ring-teal-400/25',
  },
] as const;

const tabBase =
  'group/tab inline-flex min-h-[40px] shrink-0 snap-start items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap select-none transition-all duration-200 sm:min-h-9 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm active:scale-[0.98]';
const tabInactive = 'text-muted-foreground';
const tabActive =
  'bg-background text-foreground shadow-[0_2px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-border/70 dark:bg-card dark:shadow-[0_2px_16px_-4px_rgba(0,0,0,0.45)] dark:ring-border/60';
const iconWrap =
  'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 sm:size-8 sm:rounded-lg';

type DutySubTabsProps = {
  items: DutySubTabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
};

export function DutySubTabs({ items, value, onValueChange, className, 'aria-label': ariaLabel }: DutySubTabsProps) {
  return (
    <div className={cn('-mx-1 touch-pan-x snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] sm:snap-none sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden', className)}>
      <div
        className={cn(
          'inline-flex w-max min-w-full flex-nowrap items-center gap-0.5 rounded-xl border border-border/50 bg-muted/35 p-1 shadow-sm backdrop-blur-sm dark:border-border/40 dark:bg-muted/25 sm:gap-1 sm:rounded-2xl sm:p-1.5 sm:shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] dark:sm:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]',
          'sm:inline-flex sm:w-auto sm:min-w-0 sm:flex-wrap',
        )}
        role="tablist"
        aria-label={ariaLabel ?? 'Alt bölümler'}
      >
        {items.map((item, i) => {
          const active = value === item.id;
          const p = SUB_TAB_PALETTE[i % SUB_TAB_PALETTE.length]!;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`duty-subtab-${item.id}`}
              onClick={() => onValueChange(item.id)}
              className={cn(tabBase, active ? cn(tabActive, p.activeExtra) : cn(tabInactive, p.idleHover))}
            >
              {Icon ? (
                <span className={cn(iconWrap, active ? p.iconActive : p.icon)}>
                  <Icon className="size-3.5 sm:size-4" aria-hidden />
                </span>
              ) : null}
              <span className="max-w-[min(100vw-8rem,280px)] truncate text-left sm:max-w-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
