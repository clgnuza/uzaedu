'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

export type UseWelcomeMotivationQuoteResult = {
  data: WelcomeTodayResponse | null;
  bannerDismissed: boolean;
  /** Öğretmen hero: kapatıldıktan sonra şerit gizli; üst ikonla tekrar açılabilir */
  manualOpen: boolean;
  dismissBanner: () => void;
  reopenBanner: () => void;
  showEmbeddedPanel: boolean;
  showReopenTrigger: boolean;
  isTeacherPopup: boolean;
  popupOpen: boolean;
  handlePopupOpenChange: (open: boolean) => void;
  dateLabel: string;
};

export function useWelcomeMotivationQuote(): UseWelcomeMotivationQuoteResult {
  const { me } = useAuth();
  const [data, setData] = useState<WelcomeTodayResponse | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
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
      setManualOpen(false);
    } catch {
      setPopupOpen(Boolean(isTeacherPopup));
      setBannerDismissed(false);
      setManualOpen(false);
    }
  }, [data?.date_key, isTeacherPopup]);

  const dateLabel = data?.date_key ? formatDateKeyTr(data.date_key) : '';

  const dismissBanner = useCallback(() => {
    if (!data?.date_key) return;
    try {
      localStorage.setItem(`${BANNER_DISMISS_KEY}${data.date_key}`, '1');
    } catch {
      /* ignore */
    }
    setBannerDismissed(true);
    setManualOpen(false);
  }, [data?.date_key]);

  const reopenBanner = useCallback(() => {
    setManualOpen(true);
  }, []);

  const handlePopupOpenChange = useCallback(
    (open: boolean) => {
      if (!data?.date_key) return;
      if (!open) {
        try {
          localStorage.setItem(`${POPUP_SEEN_KEY}${data.date_key}`, '1');
          // İlk popup kapanınca hero’daki “Bugünün sözü” şeridi de kapalı kalsın (dashboard ile aynı durum)
          localStorage.setItem(`${BANNER_DISMISS_KEY}${data.date_key}`, '1');
        } catch {
          /* ignore */
        }
        setBannerDismissed(true);
        setManualOpen(false);
      }
      setPopupOpen(open);
    },
    [data?.date_key],
  );

  const hasMessage = Boolean(data?.enabled && data?.message);
  const showEmbeddedPanel = hasMessage && (!bannerDismissed || manualOpen);
  const showReopenTrigger = hasMessage && bannerDismissed && !manualOpen;

  return {
    data,
    bannerDismissed,
    manualOpen,
    dismissBanner,
    reopenBanner,
    showEmbeddedPanel,
    showReopenTrigger,
    isTeacherPopup,
    popupOpen,
    handlePopupOpenChange,
    dateLabel,
  };
}

type WelcomeMotivationQuoteEmbeddedProps = {
  message: string;
  dateLabel: string;
  onDismiss: () => void;
  embeddedClassName?: string;
};

export function WelcomeMotivationQuoteEmbedded({
  message,
  dateLabel,
  onDismiss,
  embeddedClassName,
}: WelcomeMotivationQuoteEmbeddedProps) {
  return (
    <div
      className={cn(
        'border-t border-border/45 px-3 pb-3 pt-3 sm:px-6 sm:pb-5 sm:pt-4',
        embeddedClassName,
      )}
    >
      <div className="flex gap-2 sm:gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-violet-600 sm:size-9 sm:rounded-xl dark:bg-muted/50 dark:text-violet-300">
          <Quote className="size-[15px] sm:size-4" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-semibold leading-tight text-foreground sm:text-xs">Bugünün sözü</span>
            {dateLabel ? (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground sm:text-[11px]">{dateLabel}</span>
            ) : null}
          </div>
          <WelcomeMessageDisplay
            text={message}
            className="text-pretty text-[12px] font-normal leading-snug tracking-tight text-foreground/90 sm:text-[0.9375rem] sm:leading-relaxed"
          />
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 self-start rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Bugünün sözünü gizle"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function WelcomeMotivationBanner() {
  const q = useWelcomeMotivationQuote();
  const { data, bannerDismissed, dismissBanner, isTeacherPopup, popupOpen, handlePopupOpenChange, dateLabel } = q;

  if (!data?.enabled || !data.message) return null;
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
            'group relative overflow-hidden rounded-xl border border-violet-500/15 sm:rounded-2xl',
            'bg-linear-to-br from-violet-500/12 via-fuchsia-500/5 to-amber-500/10',
            'shadow-md shadow-violet-500/5 ring-1 ring-white/40 backdrop-blur-md',
            'dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-amber-950/15 dark:ring-white/5',
            'px-3 py-2.5 sm:px-4 sm:py-3.5',
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25 max-sm:opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h1v1H0z' fill='%238b5cf6' fill-opacity='0.08'/%3E%3C/svg%3E")`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 -top-28 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10 max-sm:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl max-sm:hidden"
            aria-hidden
          />

          <div className="relative flex gap-2 sm:gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-700 shadow-inner ring-1 ring-violet-500/20 sm:size-10 sm:rounded-xl dark:text-violet-200">
              <Sparkles className="size-[15px] sm:size-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:gap-1.5">
                <span className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-500/15 dark:bg-background/20 dark:text-violet-300 sm:gap-1 sm:px-2 sm:text-[10px]">
                  <Quote className="size-2.5 shrink-0 opacity-70" aria-hidden />
                  Bugünün mesajı
                </span>
                {dateLabel && (
                  <span className="shrink-0 text-[9px] font-medium text-muted-foreground sm:text-[10px]">{dateLabel}</span>
                )}
              </div>
              <WelcomeMessageDisplay
                text={data.message}
                className="text-pretty text-[12px] font-normal leading-snug tracking-tight text-foreground/95 sm:text-[0.9375rem] sm:leading-relaxed"
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
