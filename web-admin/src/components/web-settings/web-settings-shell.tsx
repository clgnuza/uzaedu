'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Ortak input — minimal, yumuşak köşe */
export const WEB_SETTINGS_INPUT =
  'h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25';

export const WEB_SETTINGS_TEXTAREA =
  'min-h-[72px] w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25';

export function WebSettingsPanel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border/40 bg-card p-6 shadow-sm', className)}>
      <header className="mb-6 border-b border-border/30 pb-4">
        <div className="flex items-start gap-3">
          {Icon && <Icon className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />}
          <div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Site / GDPR gibi alt panellerde ortak kart başlığı (Kamuya açık site ile aynı dil). */
export function WebSettingsSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/45 bg-card/40 shadow-sm ring-1 ring-border/15 dark:bg-card/25',
        className,
      )}
    >
      <div className="flex gap-3 border-b border-border/35 bg-muted/25 px-4 py-3.5 sm:px-5 dark:bg-muted/15">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/80 text-primary shadow-sm ring-1 ring-border/40 dark:bg-background/50">
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold leading-tight tracking-tight text-foreground">{title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function WebSettingsField({
  label,
  hint,
  hintPosition = 'after',
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  /** `before`: referans / açıklama girişten önce (uzun listeler için) */
  hintPosition?: 'before' | 'after';
  children: React.ReactNode;
  htmlFor?: string;
}) {
  const hintEl =
    hint != null && hint !== false ? (
      <div className={hintPosition === 'before' ? 'mb-1.5' : 'mt-0.5'}>
        {typeof hint === 'string' || typeof hint === 'number' ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
        ) : (
          hint
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/90">
        {label}
      </label>
      {hintPosition === 'before' && hintEl}
      {children}
      {hintPosition === 'after' && hintEl}
    </div>
  );
}
