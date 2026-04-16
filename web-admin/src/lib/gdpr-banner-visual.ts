import { cn } from '@/lib/utils';

export type GdprBannerVisual = 'gradient' | 'minimal' | 'brand';

export const GDPR_BANNER_VISUALS: { id: GdprBannerVisual; label: string; hint: string }[] = [
  { id: 'gradient', label: 'Renkli geçiş', hint: 'Mobilde mor–fuşya–cyan çerçeve ve renkli üst şerit.' },
  { id: 'brand', label: 'Marka rengi', hint: 'Primary tonlarında çerçeve ve şerit.' },
  { id: 'minimal', label: 'Sade', hint: 'Gradient yok; nötr çerçeve ve ince üst çizgi.' },
];

export function normalizeGdprBannerVisual(v: string | null | undefined): GdprBannerVisual {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'minimal' || s === 'brand') return s;
  return 'gradient';
}

/** Dış gradient sarmalayıcı (mobil); masaüstünde şeffaf. */
export function gdprGradientFrameCn(visual: GdprBannerVisual): string {
  if (visual === 'minimal') {
    return cn(
      'pointer-events-auto w-full max-w-[min(100%,18.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-300',
      'sm:max-w-xl md:max-w-2xl lg:max-w-5xl',
    );
  }
  if (visual === 'brand') {
    return cn(
      'pointer-events-auto w-full max-w-[min(100%,18.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-300',
      'max-sm:rounded-2xl max-sm:bg-linear-to-br max-sm:from-primary/50 max-sm:via-primary/28 max-sm:to-primary/40 max-sm:p-[2px] max-sm:shadow-lg max-sm:shadow-primary/20',
      'sm:max-w-xl sm:bg-transparent sm:p-0 sm:shadow-none md:max-w-2xl lg:max-w-5xl',
    );
  }
  return cn(
    'pointer-events-auto w-full max-w-[min(100%,18.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-300',
    'max-sm:rounded-2xl max-sm:bg-linear-to-br max-sm:from-violet-500/50 max-sm:via-fuchsia-500/28 max-sm:to-cyan-400/45 max-sm:p-[2px] max-sm:shadow-lg max-sm:shadow-violet-500/15',
    'sm:max-w-xl sm:bg-transparent sm:p-0 sm:shadow-none md:max-w-2xl lg:max-w-5xl',
  );
}

export function gdprGradientFrameCnPreview(visual: GdprBannerVisual): string {
  if (visual === 'minimal') return 'w-full';
  if (visual === 'brand') {
    return 'max-sm:rounded-2xl max-sm:bg-linear-to-br max-sm:from-primary/50 max-sm:via-primary/28 max-sm:to-primary/40 max-sm:p-[2px] max-sm:shadow-lg max-sm:shadow-primary/20 sm:p-0 sm:shadow-none sm:bg-transparent';
  }
  return 'max-sm:rounded-2xl max-sm:bg-linear-to-br max-sm:from-violet-500/50 max-sm:via-fuchsia-500/28 max-sm:to-cyan-400/45 max-sm:p-[2px] max-sm:shadow-lg max-sm:shadow-violet-500/15 sm:p-0 sm:shadow-none sm:bg-transparent';
}

export function gdprAccentStripCn(visual: GdprBannerVisual): string {
  const base = 'pointer-events-none absolute inset-x-0 top-0 z-[1]';
  if (visual === 'minimal') {
    return cn(base, 'h-px bg-border/70 sm:h-px');
  }
  if (visual === 'brand') {
    return cn(
      base,
      'h-0.5 max-sm:h-1 bg-linear-to-r from-primary/30 via-primary to-primary/30 sm:h-px sm:from-primary/0 sm:via-primary/70 sm:to-primary/0',
    );
  }
  return cn(
    base,
    'h-0.5 max-sm:h-1 bg-linear-to-r from-violet-500/85 via-primary/65 to-cyan-500/75 sm:h-px sm:from-primary/0 sm:via-primary/60 sm:to-primary/0',
  );
}

export function gdprMobileIconShellCn(visual: GdprBannerVisual): string {
  if (visual === 'minimal') {
    return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-primary ring-1 ring-border/45';
  }
  if (visual === 'brand') {
    return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/22';
  }
  return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-cyan-500/20 text-primary ring-1 ring-primary/15';
}
