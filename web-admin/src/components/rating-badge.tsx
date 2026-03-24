'use client';

import { StarIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type RatingBadgeProps = {
  rating: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showCircle?: boolean;
  className?: string;
};

/** Renk: yeşil ≥4, sarı 3–4, turuncu <3 */
function getRatingColor(rating: number, max: number) {
  const pct = rating / max;
  if (pct >= 0.8) return { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', star: 'text-emerald-600' };
  if (pct >= 0.6) return { bg: 'bg-amber-500/12', text: 'text-amber-700 dark:text-amber-400', star: 'text-amber-600' };
  return { bg: 'bg-orange-500/12', text: 'text-orange-700 dark:text-orange-400', star: 'text-orange-600' };
}

export function RatingBadge({
  rating,
  max = 5,
  size = 'md',
  showCircle = false,
  className,
}: RatingBadgeProps) {
  const colors = getRatingColor(rating, max);
  const pct = (rating / max) * 100;
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };
  const iconSizes = { sm: 'size-3', md: 'size-4', lg: 'size-5' };

  if (showCircle) {
    const r = 16;
    const circ = 2 * Math.PI * r;
    const strokeDash = (pct / 100) * circ;
    const cx = 24;
    return (
      <div className={cn('relative inline-flex size-12 items-center justify-center', className)} title={`${rating.toFixed(1)} / ${max}`} aria-label={`${rating.toFixed(1)} ortalama puan`}>
        <svg className="size-12 -rotate-90" aria-hidden>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={circ - strokeDash}
            strokeLinecap="round"
            className={cn('transition-[stroke-dashoffset] duration-700 motion-reduce:duration-0', colors.star)}
          />
        </svg>
        <span className={cn('absolute text-sm font-bold', colors.text)}>{rating.toFixed(1)}</span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full font-semibold',
        colors.bg,
        colors.text,
        sizeClasses[size],
        className
      )}
    >
      <StarIcon size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} filled className={cn(iconSizes[size], colors.star)} />
      {rating.toFixed(1)}
      {max !== 5 && <span className="opacity-70">/ {max}</span>}
    </span>
  );
}
