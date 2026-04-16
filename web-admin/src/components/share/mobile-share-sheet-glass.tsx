'use client';

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Copy, Image as ImageIcon, Share2, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const variantStyles = {
  emerald: {
    primary:
      'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.99] hover:bg-emerald-700 dark:bg-emerald-600',
    ring: 'ring-emerald-500/20',
    accent: 'text-emerald-600 dark:text-emerald-400',
    hintBorder: 'border-emerald-200/70 dark:border-emerald-800/45',
    wash: 'from-emerald-500/10 via-transparent to-transparent',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
  },
  violet: {
    primary:
      'bg-violet-600 text-white shadow-lg shadow-violet-500/25 active:scale-[0.99] hover:bg-violet-700 dark:bg-violet-600',
    ring: 'ring-violet-500/20',
    accent: 'text-violet-600 dark:text-violet-400',
    hintBorder: 'border-violet-200/70 dark:border-violet-800/45',
    wash: 'from-violet-500/10 via-transparent to-transparent',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
  },
} as const;

export type MobileShareSheetGlassVariant = keyof typeof variantStyles;

export type MobileShareSheetHint = {
  title: string;
  text: string;
  icon?: LucideIcon;
};

type Props = {
  titleId: string;
  previewUrl: string | null;
  previewAlt: string;
  loadingLabel?: string;
  description: ReactNode;
  variant: MobileShareSheetGlassVariant;
  hints: MobileShareSheetHint[];
  onShare: () => void | Promise<void>;
  onCopyImage: () => void | Promise<void>;
  onCopyText: () => void | Promise<void>;
  onClose: () => void;
};

export function MobileShareSheetGlass({
  titleId,
  previewUrl,
  previewAlt,
  loadingLabel = 'Önizleme hazırlanıyor…',
  description,
  variant,
  hints,
  onShare,
  onCopyImage,
  onCopyText,
  onClose,
}: Props) {
  const v = variantStyles[variant];

  const inner = (
    <div className="fixed inset-0 z-[100] sm:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-md"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-[1.75rem]',
          'border border-white/40 bg-gradient-to-b from-white/[0.93] via-white/[0.88] to-zinc-50/[0.92]',
          'shadow-[0_-20px_60px_-16px_rgba(0,0,0,0.22)] backdrop-blur-2xl',
          'dark:border-zinc-700/50 dark:from-zinc-950/[0.94] dark:via-zinc-950/[0.9] dark:to-zinc-950/[0.96]',
          'ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]',
          v.ring,
        )}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-36 rounded-t-[1.75rem] bg-gradient-to-b',
            v.wash,
          )}
        />
        <div className="relative mx-auto mt-3 h-1.5 w-12 rounded-full bg-zinc-300/90 shadow-inner dark:bg-zinc-600" />
        <div className="relative px-5 pt-3 pb-4">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Paylaş
          </h2>
          <div className="mt-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</div>

          {previewUrl ? (
            <div
              className={cn(
                'mt-4 overflow-hidden rounded-2xl border border-white/60 bg-white/45 p-1 shadow-inner backdrop-blur-md',
                'dark:border-zinc-600/45 dark:bg-zinc-900/45',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={previewAlt}
                className="w-full rounded-[0.875rem] object-top shadow-sm"
              />
            </div>
          ) : (
            <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-zinc-300/80 bg-white/35 text-xs text-zinc-500 backdrop-blur-md dark:border-zinc-600/60 dark:bg-zinc-900/35 dark:text-zinc-400">
              {loadingLabel}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-3">
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-2xl shadow-sm backdrop-blur-md',
                  v.iconBg,
                  v.accent,
                )}
              >
                <Sparkles className="size-[1.15rem]" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Metin paylaşımı
                </p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">İpuçları</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {hints.map((h, i) => {
                const Icon = h.icon ?? Sparkles;
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex gap-3 rounded-2xl border bg-white/60 p-3.5 shadow-sm backdrop-blur-md',
                      'dark:bg-zinc-900/55',
                      v.hintBorder,
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/75 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800/80',
                        v.accent,
                      )}
                    >
                      <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                        {h.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {h.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            type="button"
            className={cn('mt-6 flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold', v.primary)}
            onClick={onShare}
          >
            <Share2 className="size-5" strokeWidth={2} aria-hidden />
            Paylaşımı aç
          </button>
          <button
            type="button"
            className="mt-2 flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/50 py-3 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur-md transition hover:bg-white/70 dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-900/70"
            onClick={() => void onCopyImage()}
          >
            <ImageIcon className="size-4" strokeWidth={2} aria-hidden />
            Sadece kart görselini kopyala
          </button>
          <button
            type="button"
            className="mt-2 flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/50 py-3 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur-md transition hover:bg-white/70 dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-900/70"
            onClick={() => void onCopyText()}
          >
            <Copy className="size-4" strokeWidth={2} aria-hidden />
            Tüm metni kopyala
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-xl py-3 text-sm font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={onClose}
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(inner, document.body);
}
