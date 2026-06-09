'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Heart, Search, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SrTone = 'sky' | 'amber' | 'emerald' | 'violet' | 'rose' | 'teal';

const ICON_TONE: Record<SrTone, string> = {
  sky: 'sr-icon--sky',
  amber: 'sr-icon--amber',
  emerald: 'sr-icon--emerald',
  violet: 'sr-icon--violet',
  rose: 'sr-icon--rose',
  teal: 'sr-icon--teal',
};

export function SrPage({ children }: { children: ReactNode }) {
  return <div className="sr-page min-h-screen w-full min-w-0 overflow-x-clip">{children}</div>;
}

export function SrHero({
  title,
  eyebrow = 'Topluluk',
  description,
  actions,
  stats,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
}) {
  return (
    <header className="sr-hero relative overflow-hidden">
      <div className="sr-hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start gap-3">
          <span className="sr-hero-icon relative flex size-11 shrink-0 items-center justify-center sm:size-12">
            <span
              className="pointer-events-none absolute -inset-1 rounded-[1.1rem] border border-sky-400/30 bg-gradient-to-br from-violet-500/10 to-emerald-500/10"
              aria-hidden
            />
            <svg viewBox="0 0 24 24" className="relative size-5 sm:size-6" aria-hidden>
              <defs>
                <linearGradient id="sr-hero-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <path
                fill="url(#sr-hero-grad)"
                d="M12 3L2 8.5v7L12 21l10-5.5v-7L12 3zm0 2.2l7.2 3.96v5.68L12 18.8l-7.2-3.96V9.16L12 5.2z"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="sr-eyebrow">{eyebrow}</p>
            <div className="mt-0.5 flex items-start gap-1.5">
              <h1 className="sr-hero-title">{title}</h1>
              {actions}
            </div>
            {description ? <div className="sr-hero-desc mt-1.5">{description}</div> : null}
          </div>
        </div>
        {stats ? <div className="mt-3 sm:mt-4">{stats}</div> : null}
      </div>
    </header>
  );
}

export function SrStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 sm:gap-2.5">{children}</div>;
}

export function SrStat({
  icon: Icon,
  value,
  label,
  tone = 'sky',
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: SrTone;
}) {
  return (
    <div className={cn('sr-stat', `sr-stat--${tone}`)}>
      <span className={cn('sr-icon sr-icon--sm mx-auto', ICON_TONE[tone])}>
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      <p className="sr-stat-value tabular-nums">{value}</p>
      <p className="sr-stat-label">{label}</p>
    </div>
  );
}

export function SrIcon({
  icon: Icon,
  tone = 'sky',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone?: SrTone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span className={cn('sr-icon', size === 'sm' ? 'sr-icon--sm' : 'sr-icon--md', ICON_TONE[tone], className)}>
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} aria-hidden />
    </span>
  );
}

export function SrSectionLabel({
  icon: Icon,
  children,
  tone = 'sky',
  badge,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  tone?: SrTone;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="sr-section-label">
        {Icon ? <SrIcon icon={Icon} tone={tone} size="sm" /> : null}
        <span>{children}</span>
      </h3>
      {badge}
    </div>
  );
}

export function SrPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('sr-panel', className)}>{children}</div>;
}

export function SrTabBar({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.ComponentProps<'div'>) {
  return (
    <div role="tablist" className={cn('sr-tabbar', className)} {...rest}>
      {children}
    </div>
  );
}

export function SrTab({
  active,
  onClick,
  label,
  count,
  id,
  controls,
  tone = 'sky',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  id: string;
  controls: string;
  tone?: SrTone;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn('sr-tab', active && 'sr-tab--active', active && `sr-tab--${tone}`)}
    >
      <span className="leading-tight">{label}</span>
      {count != null ? <span className="sr-tab-count tabular-nums">{count}</span> : null}
    </button>
  );
}

export function SrChip({
  children,
  tone = 'sky',
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: SrTone;
  className?: string;
} & React.ComponentProps<'span'>) {
  return (
    <span className={cn('sr-chip', `sr-chip--${tone}`, className)} {...rest}>
      {children}
    </span>
  );
}

export function SrFilterChip({
  children,
  onClick,
  className,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
} & React.ComponentProps<'button'>) {
  return (
    <button type="button" onClick={onClick} className={cn('sr-filter-chip', className)} {...rest}>
      {children}
    </button>
  );
}

export function SrListItem({
  selected,
  focused,
  onClick,
  children,
  className,
  ...rest
}: {
  selected?: boolean;
  focused?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
} & React.ComponentProps<'li'>) {
  return (
    <li
      role="option"
      onClick={onClick}
      className={cn(
        'sr-list-item',
        selected && 'sr-list-item--selected',
        focused && !selected && 'sr-list-item--focused',
        className,
      )}
      {...rest}
    >
      {children}
    </li>
  );
}

export function SrFeedItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('sr-feed-item', className)}>{children}</div>;
}

const AUTHOR_TONES: SrTone[] = ['sky', 'violet', 'teal', 'amber', 'emerald', 'rose'];

/** Aynı yazar aynı renk; farklı yazarlar kolay ayırt edilir. */
export function srAuthorTone(seed: string): SrTone {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AUTHOR_TONES[h % AUTHOR_TONES.length]!;
}

export function srAuthorInitials(name: string, anonymous?: boolean): string {
  if (anonymous) return '?';
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0] ?? ''}${p[p.length - 1]![0] ?? ''}`.toUpperCase();
  const s = name.trim();
  return (s.length >= 2 ? s.slice(0, 2) : s.slice(0, 1) || '?').toUpperCase();
}

export function SrAuthorBadge({
  name,
  anonymous,
  tone,
}: {
  name: string;
  anonymous?: boolean;
  tone: SrTone;
}) {
  return (
    <span className={cn('sr-author-badge', `sr-author-badge--${tone}`)} aria-hidden>
      {srAuthorInitials(name, anonymous)}
    </span>
  );
}

export type SrThreadKind = 'review' | 'question' | 'answer';

export function SrThreadCard({
  kind,
  tone,
  children,
  className,
}: {
  kind: SrThreadKind;
  tone: SrTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('sr-thread-card', `sr-thread-card--${tone}`, `sr-thread-card--${kind}`, className)}>
      {children}
    </div>
  );
}

export function SrThreadKindLabel({ kind }: { kind: SrThreadKind }) {
  const label = kind === 'review' ? 'Yorum' : kind === 'question' ? 'Soru' : 'Yanıt';
  return <span className={cn('sr-thread-kind', `sr-thread-kind--${kind}`)}>{label}</span>;
}

/** @deprecated SrThreadCard kullanın */
export function SrReviewCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('sr-review-card', className)}>{children}</div>;
}

const SR_TEACHER_NAV_ITEMS = [
  { href: '/okul-degerlendirmeleri', label: 'Okul listesi', icon: Search },
  { href: '/favoriler', label: 'Favorilerim', icon: Heart, needsModule: true },
] as const;

export function SrTeacherModuleNav({
  activePath,
  showFavorites = true,
}: {
  activePath: string;
  showFavorites?: boolean;
}) {
  const items = SR_TEACHER_NAV_ITEMS.filter((item) => !item.needsModule || showFavorites);

  return (
    <nav className="sr-teacher-module-nav mb-2 lg:mb-2.5" aria-label="Okul değerlendirme menüsü">
      <div className="sr-teacher-module-nav-card">
        <div className="sr-teacher-module-nav-head">
          <span className="sr-teacher-module-nav-icon" aria-hidden>
            <Star className="size-3.5" fill="currentColor" strokeWidth={1.5} />
          </span>
          <span className="sr-teacher-module-nav-title">Okul değerlendirme</span>
        </div>
        <ul className="sr-teacher-module-nav-list">
          {items.map((item) => {
            const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-nav-active={active ? 'true' : undefined}
                  className={cn('sr-teacher-module-nav-link', active && 'sr-teacher-module-nav-link--active')}
                >
                  <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
