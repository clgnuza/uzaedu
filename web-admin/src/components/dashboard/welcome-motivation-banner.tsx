'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { WELCOME_TODAY_API_PATH, type WelcomeTodayResponse } from '@/lib/welcome-public';
import { Quote, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WelcomeMessageDisplay } from '@/components/web-settings/welcome-message-display';

function formatDateKeyTr(dateKey: string): string {
  const [m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  if (!m || !d) return dateKey;
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Istanbul',
    }).format(new Date(2024, m - 1, d));
  } catch {
    return dateKey;
  }
}

export function WelcomeMotivationBanner() {
  const [data, setData] = useState<WelcomeTodayResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<WelcomeTodayResponse>(WELCOME_TODAY_API_PATH, {})
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data?.date_key) return;
    try {
      setDismissed(localStorage.getItem(`ogretmenpro_welcome_dismiss_${data.date_key}`) === '1');
    } catch {
      setDismissed(false);
    }
  }, [data?.date_key]);

  if (!data?.enabled || !data.message || dismissed) return null;

  const dateLabel = data.date_key ? formatDateKeyTr(data.date_key) : '';

  const dismiss = () => {
    try {
      localStorage.setItem(`ogretmenpro_welcome_dismiss_${data.date_key}`, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-violet-500/15',
        'bg-linear-to-br from-violet-500/12 via-fuchsia-500/5 to-amber-500/10',
        'shadow-lg shadow-violet-500/5 ring-1 ring-white/40 backdrop-blur-md',
        'dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-amber-950/15 dark:ring-white/5',
        'px-4 py-4 sm:px-6 sm:py-5',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h1v1H0z' fill='%238b5cf6' fill-opacity='0.08'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-700 shadow-inner ring-1 ring-violet-500/20 dark:text-violet-200">
          <Sparkles className="size-6" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-500/15 dark:bg-background/20 dark:text-violet-300">
              <Quote className="size-3 opacity-70" aria-hidden />
              Bugünün mesajı
            </span>
            {dateLabel && (
              <span className="text-[11px] font-medium text-muted-foreground">{dateLabel}</span>
            )}
          </div>
          <WelcomeMessageDisplay
            text={data.message}
            className="text-pretty text-base font-normal leading-relaxed tracking-tight sm:text-lg"
          />
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label="Bugünü gizle"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
