'use client';

import type { LucideIcon } from 'lucide-react';
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
