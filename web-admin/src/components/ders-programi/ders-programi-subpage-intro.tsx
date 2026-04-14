'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DersProgramiWeekIllustration } from '@/components/ders-programi/ders-programi-week-illustration';

type Accent = 'violet' | 'emerald' | 'sky';

const SHELL: Record<Accent, string> = {
  violet:
    'border-violet-200/45 bg-linear-to-br from-violet-500/[0.07] via-background to-sky-500/[0.05] dark:border-violet-900/40',
  emerald:
    'border-emerald-200/45 bg-linear-to-br from-emerald-500/[0.08] via-background to-teal-500/[0.05] dark:border-emerald-900/40',
  sky: 'border-sky-200/45 bg-linear-to-br from-sky-500/[0.08] via-background to-violet-500/[0.04] dark:border-sky-900/40',
};

export function DersProgramiSubpageIntro({
  title,
  subtitle,
  accent = 'violet',
  backHref = '/ders-programi',
  backLabel = 'Ders Programı',
  className,
}: {
  title: string;
  subtitle?: string;
  accent?: Accent;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/5 sm:rounded-2xl sm:p-4',
        SHELL[accent],
        className,
      )}
    >
      <div className="flex items-start gap-2 sm:items-center sm:gap-4">
        <DersProgramiWeekIllustration className="size-[52px] shrink-0 sm:size-[76px]" />
        <div className="min-w-0 flex-1">
          <Link
            href={backHref}
            className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:gap-1.5 sm:text-xs"
          >
            <ArrowLeft className="size-3 shrink-0 sm:size-3.5" />
            <span className="truncate">{backLabel}</span>
          </Link>
          <h1 className="mt-1 text-[15px] font-bold leading-tight tracking-tight text-foreground sm:mt-1.5 sm:text-lg">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-xs">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
