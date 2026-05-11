'use client';

import { cn } from '@/lib/utils';

export function AgendaTaskPriorityGlyph({ priority }: { priority: string }) {
  const p = priority || 'medium';
  if (p === 'high') {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-rose-500 sm:size-4" fill="currentColor" aria-hidden>
        <path d="M12 2L22 20H2L12 2zm0 4.5L6.5 17h11L12 6.5z" />
      </svg>
    );
  }
  if (p === 'low') {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-sky-500 sm:size-4" fill="currentColor" aria-hidden>
        <path d="M6 18h12v2H6v-2zm2-5h8v2H8v-2zm2-5h4v2h-4V8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-amber-500 sm:size-4" fill="currentColor" aria-hidden>
      <path d="M12 3L2 19h20L12 3zm0 4.2L17.5 17h-11L12 7.2z" />
    </svg>
  );
}

export function AgendaTaskRepeatGlyph({ repeat }: { repeat?: string | null }) {
  const r = repeat ?? 'none';
  if (r === 'none') return null;
  if (r === 'daily') {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-orange-400 sm:size-4" aria-hidden>
        <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.9" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }
  if (r === 'weekly') {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-violet-500 sm:size-4" fill="none" aria-hidden>
        <path
          d="M5.5 9a6.5 6.5 0 0112.6-2M18.5 15a6.5 6.5 0 01-12.6 2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path d="M17 3v4h-4M7 21v-4h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-indigo-500 sm:size-4" fill="currentColor" aria-hidden>
      <path d="M5 5h14v3H5V5zm0 5h10v3H5v-3zm0 5h14v3H5v-3z" opacity="0.92" />
    </svg>
  );
}

export function AgendaTaskReminderGlyph({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-teal-500 sm:size-4" fill="currentColor" aria-hidden>
      <path d="M12 22a2.5 2.5 0 002.45-2H9.55A2.5 2.5 0 0012 22zm7-6V11a7 7 0 10-14 0v5l-2 2v1h18v-1l-2-2z" />
    </svg>
  );
}

export function AgendaTaskMetaIcons({
  priority,
  repeat,
  hasPendingReminder,
  className,
}: {
  priority: string;
  repeat?: string | null;
  hasPendingReminder: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-md bg-muted/60 px-1 py-0.5 ring-1 ring-border/50', className)}>
      <AgendaTaskPriorityGlyph priority={priority} />
      <AgendaTaskRepeatGlyph repeat={repeat} />
      <AgendaTaskReminderGlyph active={hasPendingReminder} />
    </span>
  );
}
