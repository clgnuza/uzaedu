import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DutyPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** Arka plan vurgu rengi — primary | blue | emerald | amber | rose | purple */
  color?: 'primary' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  className?: string;
}

const COLOR_MAP = {
  primary: {
    wrap: 'from-primary/8 to-transparent border-primary/15',
    icon: 'bg-primary/10 text-primary',
  },
  blue: {
    wrap: 'from-blue-500/8 to-transparent border-blue-500/15',
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  emerald: {
    wrap: 'from-emerald-500/8 to-transparent border-emerald-500/15',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    wrap: 'from-amber-500/8 to-transparent border-amber-500/15',
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  rose: {
    wrap: 'from-rose-500/8 to-transparent border-rose-500/15',
    icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  purple: {
    wrap: 'from-purple-500/8 to-transparent border-purple-500/15',
    icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
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
        'rounded-2xl border bg-gradient-to-br p-5 mb-6',
        c.wrap,
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={cn('flex items-center justify-center size-10 rounded-xl shrink-0', c.icon)}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:mt-0.5">{actions}</div>
        )}
      </div>
    </div>
  );
}
