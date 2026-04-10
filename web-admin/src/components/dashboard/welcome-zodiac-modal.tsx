'use client';

import { MoonStar, Quote, Sparkles, Stars, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { WelcomeMessageDisplay } from '@/components/web-settings/welcome-message-display';
import { formatDateKeyTr, getWelcomeZodiacTheme } from '@/lib/welcome-zodiac';
import type { WelcomeZodiacKey } from '@/lib/welcome-public';

type PopupBodyProps = {
  dateKey: string;
  message: string;
  zodiacKey: WelcomeZodiacKey;
  onClose?: () => void;
  preview?: boolean;
  className?: string;
};

export function WelcomeZodiacPopupCard({
  dateKey,
  message,
  zodiacKey,
  onClose,
  preview = false,
  className,
}: PopupBodyProps) {
  const theme = getWelcomeZodiacTheme(zodiacKey);
  const heroTitle = `${theme.name} enerjisiyle başla`;
  const heroMeta = `${formatDateKeyTr(dateKey)} · ${theme.accentLabel} odağı`;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 shadow-xl sm:max-w-none sm:p-5',
        theme.shellClassName,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.14),transparent_42%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className={cn('absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl', theme.orbClassName)} />
        <div className={cn('absolute -bottom-12 -left-8 h-28 w-28 rounded-full blur-2xl opacity-80', theme.orbClassName)} />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Cg fill=\'%23FFFFFF\' fill-opacity=\'0.06\'%3E%3Ccircle cx=\'10\' cy=\'12\' r=\'0.9\'/%3E%3Ccircle cx=\'44\' cy=\'18\' r=\'0.8\'/%3E%3Ccircle cx=\'62\' cy=\'36\' r=\'1\'/%3E%3Ccircle cx=\'24\' cy=\'58\' r=\'0.85\'/%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      <div className="relative flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  theme.badgeClassName,
                )}
              >
                <MoonStar className="size-3" />
                {theme.name}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  theme.badgeClassName,
                )}
              >
                <Stars className="size-3" />
                {theme.accentLabel}
              </span>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Günlük hoş geldin</p>
            <h2 className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">{heroTitle}</h2>
            <p className={cn('text-xs leading-relaxed', theme.textClassName)}>{heroMeta}</p>
            <p className="text-[10px] leading-tight text-white/40">
              {theme.rangeLabel} · {theme.element}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-1.5">
            <span className="text-3xl leading-none drop-shadow-sm select-none sm:text-4xl" aria-hidden>
              {theme.heroEmoji}
            </span>
            {!preview && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/12 hover:text-white"
                aria-label="Kapat"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/12 bg-white/10 p-3 shadow-sm ring-1 ring-white/5 backdrop-blur-md sm:p-3.5">
          <div className="mb-2 flex items-center gap-2 text-white/85">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/10">
              <Sparkles className="size-3.5" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Sana özel not</span>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-white/8 bg-black/15 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-3.5 sm:py-3.5">
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute -left-1 top-1 text-white/[0.07]">
                <Quote className="size-12" strokeWidth={1.25} />
              </div>
              <div className="absolute right-2 top-2 h-10 w-10 rounded-full bg-white/5 blur-xl" />
            </div>
            <WelcomeMessageDisplay
              text={message}
              className={cn(
                'relative text-pretty text-[12px] font-normal leading-relaxed tracking-normal text-white/92 sm:text-[0.9375rem]',
                '[&_p+p]:mt-2',
                '[&_strong]:font-semibold [&_strong]:text-white',
                '[&_em]:italic [&_em]:text-white/85',
              )}
            />
          </div>
          <p className="mt-2.5 text-[10px] leading-snug text-white/45">
            Bugün bir kez gösterilir; kapatınca tekrar açılmaz.
          </p>
        </div>

        {preview && <div className={cn('text-[10px]', theme.textClassName)}>{theme.heroName} odaklı canlı önizleme</div>}
      </div>
    </div>
  );
}

export function WelcomeZodiacModal({
  open,
  onOpenChange,
  dateKey,
  message,
  zodiacKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateKey: string;
  message: string;
  zodiacKey: WelcomeZodiacKey;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(94vw,24rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[min(92vw,26rem)]">
        <WelcomeZodiacPopupCard dateKey={dateKey} message={message} zodiacKey={zodiacKey} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
