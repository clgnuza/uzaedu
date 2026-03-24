'use client';

import {
  CircleDot,
  Loader2,
  Clock,
  CheckCircle2,
  CircleSlash,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; className: string; dotClass?: string }
> = {
  OPEN: {
    label: 'Açık',
    icon: CircleDot,
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  },
  IN_PROGRESS: {
    label: 'İşlemde',
    icon: Loader2,
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  },
  WAITING_REQUESTER: {
    label: 'Bilgi bekleniyor',
    icon: Clock,
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  },
  RESOLVED: {
    label: 'Çözüldü',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  CLOSED: {
    label: 'Kapatıldı',
    icon: CircleSlash,
    className: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700',
  },
};

export function SupportStatusBadge({
  status,
  size = 'sm',
}: {
  status: string;
  size?: 'sm' | 'xs';
}) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    icon: CircleDot,
    className: 'bg-muted text-muted-foreground border-border',
  };
  const Icon = config.icon;
  const iconSize = size === 'xs' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-medium',
        config.className,
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      )}
      title={config.label}
    >
      <Icon
        className={cn('shrink-0', status === 'IN_PROGRESS' && 'animate-spin')}
        size={iconSize}
      />
      <span>{config.label}</span>
    </span>
  );
}

export const SUPPORT_STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label]),
);
