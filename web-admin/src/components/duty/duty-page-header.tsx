import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DutyPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** Arka plan vurgu rengi */
  color?: 'primary' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'sky' | 'indigo';
  className?: string;
}

const COLOR_MAP = {
  primary: {
    wrap: 'from-primary/14 via-cyan-500/6 to-transparent border-primary/20 ring-primary/10',
    icon: 'bg-linear-to-br from-primary to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-primary/15',
  },
  blue: {
    wrap: 'from-blue-500/14 via-sky-500/6 to-transparent border-blue-400/25 ring-blue-500/10',
    icon: 'bg-linear-to-br from-blue-600 to-sky-500 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-blue-400/20',
  },
  emerald: {
    wrap: 'from-emerald-500/14 via-teal-500/6 to-transparent border-emerald-400/25 ring-emerald-500/10',
    icon: 'bg-linear-to-br from-emerald-600 to-teal-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-emerald-400/18',
  },
  amber: {
    wrap: 'from-amber-500/14 via-orange-500/6 to-transparent border-amber-400/30 ring-amber-500/10',
    icon: 'bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-amber-400/20',
  },
  rose: {
    wrap: 'from-rose-500/14 via-fuchsia-500/5 to-transparent border-rose-400/25 ring-rose-500/10',
    icon: 'bg-linear-to-br from-rose-600 to-fuchsia-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-rose-400/18',
  },
  purple: {
    wrap: 'from-violet-500/14 via-purple-500/6 to-transparent border-violet-400/25 ring-violet-500/10',
    icon: 'bg-linear-to-br from-violet-600 to-purple-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-violet-400/18',
  },
  sky: {
    wrap: 'from-sky-500/14 via-cyan-500/6 to-transparent border-sky-400/25 ring-sky-500/10',
    icon: 'bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-cyan-400/20',
  },
  indigo: {
    wrap: 'from-indigo-500/14 via-violet-500/6 to-transparent border-indigo-400/25 ring-indigo-500/10',
    icon: 'bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10',
    blob: 'bg-indigo-400/18',
  },
};

export function DutyPageHeader({
  icon: Icon,
  title,
  description,
  badge,
  actions,
  color = 'primary',
  className,
}: DutyPageHeaderProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      className={cn(
        'relative mb-3 overflow-hidden rounded-xl border bg-linear-to-br p-3 shadow-sm ring-1 sm:mb-4 sm:rounded-2xl sm:p-4',
        c.wrap,
        className,
      )}
    >
      <div className={cn('pointer-events-none absolute -right-8 -top-10 size-32 rounded-full blur-3xl', c.blob)} aria-hidden />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 sm:rounded-xl', c.icon)}>
            <Icon className="size-[1.1rem] sm:size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">{title}</h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-sm">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
