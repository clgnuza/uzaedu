import { cn } from '@/lib/utils';

/** Tek kamu çerez şeridi teması (ana sayfa kırmızı–siyah). */
export const GDPR_BANNER_FRAME_CN = cn(
  'pointer-events-auto w-full max-w-[min(100%,19.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-300',
  'sm:max-w-md md:max-w-lg',
);

export const GDPR_BANNER_FRAME_CN_PREVIEW = 'w-full max-w-md';

export const GDPR_BANNER_ACCENT_CN =
  'pointer-events-none absolute inset-x-0 top-0 z-[1] h-0.5 bg-linear-to-r from-transparent via-red-600/90 to-transparent';

export const GDPR_BANNER_ICON_CN =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-950/80 text-red-400 ring-1 ring-red-800/50';

export const GDPR_BANNER_CARD_CN = cn(
  'pointer-events-auto w-full overflow-hidden rounded-xl border border-red-950/60 bg-[#0a0a0a]/96 shadow-lg shadow-black/50 ring-1 ring-red-900/25 backdrop-blur-md',
);

export const GDPR_BANNER_BODY_PROSE_CN = cn(
  'text-[10px] leading-snug text-zinc-400 sm:text-[11px]',
  '[&_p]:mb-0 [&_strong]:font-medium [&_strong]:text-zinc-200',
  '[&_a]:font-medium [&_a]:text-red-400 [&_a]:underline-offset-2 [&_a]:hover:text-red-300',
);

/** Eski kayıtlar; her zaman landing. */
export function normalizeGdprBannerVisual(_v?: string | null): 'landing' {
  return 'landing';
}
