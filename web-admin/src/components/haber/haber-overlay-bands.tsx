'use client';

import { cn } from '@/lib/utils';
import {
  overlayBandsForSource,
  overlayUpper,
  splitTitleForOverlay,
} from '@/lib/haber-news-overlay';

type Item = {
  title: string;
  source_key?: string;
  source_label?: string;
};

/** feed = Haberler listesi; broadcast / broadcastHero = Yayın */
type Density = 'feed' | 'broadcast' | 'broadcastHero';

export function HaberOverlayBands({
  item,
  density = 'feed',
  compact = false,
  /** Kart içi alt bilgi şeridi varsa başlığı yukarı taşır (örn. bottom-9) */
  bottomOffsetClass,
  className,
}: {
  item: Item;
  density?: Density;
  /** Küçük kart: feed veya yayın grid (broadcast) */
  compact?: boolean;
  bottomOffsetClass?: string;
  className?: string;
}) {
  const overlayParts = splitTitleForOverlay(item.title);
  const bandCls = overlayBandsForSource(item.source_key, item.source_label);

  const isHero = density === 'broadcastHero';
  const isBroadcast = density === 'broadcast' || isHero;

  const isCompactLayout =
    (density === 'feed' && compact) || (density === 'broadcast' && compact);

  const textClass = (() => {
    if (isCompactLayout && !isHero) {
      return density === 'broadcast'
        ? 'text-[10px] leading-tight sm:text-[11px] sm:leading-snug'
        : 'text-[10px] leading-snug sm:text-[11px]';
    }
    if (density === 'feed') {
      return 'text-[11px] sm:text-sm';
    }
    if (isHero) return 'text-sm sm:text-base md:text-lg';
    return 'text-[11px] sm:text-sm';
  })();

  const lineClampClass = (() => {
    if (isCompactLayout && !isHero) return 'line-clamp-2';
    if (density === 'feed') return 'line-clamp-10';
    if (isHero) return 'line-clamp-12';
    return 'line-clamp-8';
  })();

  if (!overlayParts.line1 && !overlayParts.line2) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 z-3',
        bottomOffsetClass ?? 'bottom-0',
        isCompactLayout
          ? 'flex max-h-[50%] min-h-0 flex-col justify-end px-1.5 pb-1.5 pt-3 sm:max-h-[52%] sm:px-2'
          : 'flex justify-center',
        !isCompactLayout && !isHero && 'px-2 pb-3 pt-10 sm:px-4 sm:pb-4 sm:pt-14',
        isHero && 'pb-4 pt-12 sm:pb-6 sm:pt-20',
        isBroadcast && !isHero && !isCompactLayout && 'sm:pt-16',
        className,
      )}
    >
      <div
        className={cn(
          'flex w-full max-w-[min(100%,36rem)] min-h-0 flex-col items-center gap-0 overflow-hidden motion-safe:transition-transform motion-safe:duration-300 group-hover/card:-translate-y-0.5 motion-reduce:transform-none',
          isHero && 'max-w-[min(100%,44rem)]',
          isCompactLayout && 'max-h-full max-w-full',
        )}
      >
        <div
          className={cn(
            'inline-block w-fit max-w-full rounded-none px-3 py-1.5 text-center font-black leading-snug tracking-tight antialiased shadow-[0_4px_16px_rgba(0,0,0,0.45),0_12px_32px_rgba(0,0,0,0.28)] ring-1 ring-black/15 sm:px-3.5 sm:py-2',
            isCompactLayout && 'max-w-full px-2 py-1 shadow-md sm:px-2.5',
            bandCls.top,
            textClass,
          )}
        >
          <span
            className={cn(
              'inline-block min-w-0 max-w-full hyphens-auto wrap-anywhere text-balance [text-rendering:optimizeLegibility]',
              lineClampClass,
            )}
          >
            {overlayUpper(overlayParts.line1 || item.title)}
          </span>
        </div>
        {overlayParts.line2 ? (
          <div
            className={cn(
              'inline-block w-fit max-w-full rounded-none px-3 py-1.5 text-center font-black leading-snug tracking-tight antialiased shadow-[0_6px_20px_rgba(0,0,0,0.48),0_14px_36px_rgba(0,0,0,0.3)] ring-1 ring-black/20 sm:px-3.5 sm:py-2',
              isCompactLayout && 'max-w-full px-2 py-1 shadow-md sm:px-2.5',
              bandCls.bottom,
              textClass,
            )}
          >
            <span
              className={cn(
                'inline-block min-w-0 max-w-full hyphens-auto wrap-anywhere text-balance [text-rendering:optimizeLegibility]',
                lineClampClass,
              )}
            >
              {overlayUpper(overlayParts.line2)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
