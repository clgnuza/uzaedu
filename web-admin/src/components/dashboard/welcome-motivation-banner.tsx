'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { WELCOME_TODAY_API_PATH, type WelcomeTodayResponse } from '@/lib/welcome-public';
import { Quote, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WelcomeMessageDisplay } from '@/components/web-settings/welcome-message-display';
import { useAuth } from '@/hooks/use-auth';
import { formatDateKeyTr } from '@/lib/welcome-zodiac';
import { WelcomeZodiacModal } from '@/components/dashboard/welcome-zodiac-modal';

const BANNER_DISMISS_KEY = 'ogretmenpro_welcome_dismiss_';
const POPUP_SEEN_KEY = 'ogretmenpro_welcome_popup_seen_';

export function WelcomeMotivationBanner() {
  const { me } = useAuth();
  const [data, setData] = useState<WelcomeTodayResponse | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

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

  const isTeacherPopup = useMemo(
    () => me?.role === 'teacher' && !!data?.popup_enabled && data?.popup_mode === 'zodiac_auto',
    [me?.role, data?.popup_enabled, data?.popup_mode],
  );

  useEffect(() => {
    if (!data?.date_key) return;
    try {
      if (isTeacherPopup) {
        setPopupOpen(localStorage.getItem(`${POPUP_SEEN_KEY}${data.date_key}`) !== '1');
      }
      setBannerDismissed(localStorage.getItem(`${BANNER_DISMISS_KEY}${data.date_key}`) === '1');
    } catch {
      setPopupOpen(Boolean(isTeacherPopup));
      setBannerDismissed(false);
    }
  }, [data?.date_key, isTeacherPopup]);

  if (!data?.enabled || !data.message) return null;

  const dateLabel = data.date_key ? formatDateKeyTr(data.date_key) : '';

  const dismissBanner = () => {
    try {
      localStorage.setItem(`${BANNER_DISMISS_KEY}${data.date_key}`, '1');
    } catch {
      /* ignore */
    }
    setBannerDismissed(true);
  };

  const handlePopupOpenChange = (open: boolean) => {
    if (!data?.date_key) return;
    if (!open) {
      try {
        localStorage.setItem(`${POPUP_SEEN_KEY}${data.date_key}`, '1');
      } catch {
        /* ignore */
      }
    }
    setPopupOpen(open);
  };

  if (bannerDismissed && !(isTeacherPopup && popupOpen)) return null;

  return (
    <>
      {isTeacherPopup && popupOpen && (
        <WelcomeZodiacModal
          open={popupOpen}
          onOpenChange={handlePopupOpenChange}
          dateKey={data.date_key}
          message={data.message}
          zodiacKey={data.zodiac_key}
        />
      )}
      {!bannerDismissed && (
        <div
          className={cn(
            'group relative overflow-hidden rounded-2xl border border-violet-500/15',
            'bg-linear-to-br from-violet-500/12 via-fuchsia-500/5 to-amber-500/10',
            'shadow-md shadow-violet-500/5 ring-1 ring-white/40 backdrop-blur-md',
            'dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-amber-950/15 dark:ring-white/5',
            'px-3 py-3 sm:px-4 sm:py-3.5',
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

        <div className="relative flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-700 shadow-inner ring-1 ring-violet-500/20 dark:text-violet-200">
            <Sparkles className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-500/15 dark:bg-background/20 dark:text-violet-300">
                <Quote className="size-2.5 opacity-70" aria-hidden />
                Bugünün mesajı
              </span>
              {dateLabel && (
                <span className="text-[10px] font-medium text-muted-foreground">{dateLabel}</span>
              )}
            </div>
            <WelcomeMessageDisplay
              text={data.message}
              className="text-pretty text-sm font-normal leading-relaxed tracking-tight text-foreground/95 sm:text-[0.9375rem]"
            />
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            className="shrink-0 self-start rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            aria-label="Bugünü gizle"
          >
            <X className="size-3.5" />
          </button>
        </div>
        </div>
      )}
    </>
  );
}
