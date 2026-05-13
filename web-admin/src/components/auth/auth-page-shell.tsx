'use client';

import Link from 'next/link';
import { AuthLegalFooter } from '@/components/auth/auth-legal-footer';
import { cn } from '@/lib/utils';

type AuthPageShellProps = {
  children: React.ReactNode;
  /** Ana başlık altı kısa metin */
  eyebrow?: string;
  /** Şifre akışları: daha az boşluk, dar sütun (mobil) */
  compact?: boolean;
};

export function AuthPageShell({ children, eyebrow = 'WEB ADMİN', compact = false }: AuthPageShellProps) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden supports-[min-height:100dvh]:min-h-dvh">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-sky-100/40 via-violet-50/50 to-rose-50/30 dark:from-zinc-950 dark:via-violet-950/40 dark:to-zinc-950"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.45) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div
        className={cn(
          'relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-start pt-3 sm:justify-center sm:pt-0',
          compact ? 'px-2 py-2.5 sm:px-6 sm:py-10' : 'px-2.5 py-3 sm:px-6 sm:py-10',
        )}
      >
        <header
          className={cn(
            'relative isolate z-0 flex flex-col items-center text-center',
            compact ? 'mb-3 sm:mb-6' : 'mb-6 max-sm:mb-7 sm:mb-8',
          )}
        >
          <Link
            href="/"
            className={cn(
              'group relative z-10 flex w-full max-w-[min(100%,22rem)] flex-col items-center rounded-2xl border border-white/55 outline-none sm:max-w-[24rem]',
              'bg-linear-to-r from-sky-200/35 via-fuchsia-100/25 to-rose-200/35 shadow-[0_28px_64px_-28px_rgba(100,70,160,0.35)] backdrop-blur-xl',
              'transition-transform duration-300 hover:scale-[1.01] active:scale-[0.995]',
              'focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'dark:border-white/10 dark:from-sky-950/35 dark:via-fuchsia-950/20 dark:to-violet-950/35 dark:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.5)]',
              compact ? 'px-4 py-3 sm:px-5 sm:py-4' : 'px-5 py-4 sm:px-6 sm:py-5',
            )}
          >
            <h1
              className={cn(
                'relative z-10 flex max-w-full flex-wrap items-baseline justify-center gap-x-0.5 px-1 leading-none tracking-tight',
              )}
            >
              <span
                className={cn(
                  'font-extrabold text-zinc-900 dark:text-zinc-50',
                  compact ? 'text-[1.05rem] sm:text-[1.45rem]' : 'text-[1.1rem] sm:text-[1.6rem]',
                )}
              >
                Uzaedu{' '}
              </span>
              <span
                className={cn(
                  'bg-linear-to-r from-violet-600 via-fuchsia-500 to-cyan-400 bg-clip-text font-extrabold text-transparent',
                  compact ? 'text-[1.05rem] sm:text-[1.45rem]' : 'text-[1.1rem] sm:text-[1.6rem]',
                )}
              >
                Öğretmen
              </span>
            </h1>

            <span
              className={cn(
                'relative z-10 mt-2 inline-flex items-center rounded-full border border-white/50 bg-white/45 font-semibold uppercase tracking-[0.18em] text-zinc-600 backdrop-blur-md',
                'dark:border-white/10 dark:bg-zinc-900/55 dark:text-zinc-300',
                compact
                  ? 'px-2 py-0.5 text-[8px] sm:px-2.5 sm:text-[9px]'
                  : 'px-2.5 py-0.5 text-[8px] sm:px-3 sm:text-[9px]',
              )}
            >
              {eyebrow}
            </span>
          </Link>
        </header>

        <div
          className={cn(
            'relative z-10 mx-auto w-full max-sm:max-w-[min(100%,22.5rem)]',
            compact ? 'max-w-[min(100%,17.5rem)] sm:max-w-[320px]' : 'max-w-[min(100%,21rem)] sm:max-w-[380px]',
          )}
        >
          {children}
        </div>

        <AuthLegalFooter className={cn(compact ? 'mt-3 sm:mt-8' : 'mt-5 max-sm:mt-6 sm:mt-10')} />
      </div>
    </div>
  );
}
