import Link from 'next/link';
import { UzaEduLogo } from '@/components/auth/uza-edu-logo';
import { AuthLegalFooter } from '@/components/auth/auth-legal-footer';
import { cn } from '@/lib/utils';

type AuthPageShellProps = {
  children: React.ReactNode;
  /** Ana başlık altı kısa metin */
  eyebrow?: string;
  /** Şifre akışları: daha az boşluk, dar sütun (mobil) */
  compact?: boolean;
};

export function AuthPageShell({ children, eyebrow = 'Web Admin', compact = false }: AuthPageShellProps) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden supports-[min-height:100dvh]:min-h-dvh">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/8 via-muted/30 to-background dark:from-primary/12 dark:via-zinc-950/90 dark:to-zinc-950"
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
          'relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center',
          compact ? 'px-2.5 py-3 sm:px-6 sm:py-10' : 'px-3 py-4 sm:px-6 sm:py-10',
        )}
      >
        <header
          className={cn(
            'flex flex-col items-center text-center',
            compact ? 'mb-2 sm:mb-6' : 'mb-4 sm:mb-8',
          )}
        >
          <Link
            href="/"
            className="group flex flex-col items-center rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {/* Brand logo */}
            <div className={cn('relative', compact ? 'mb-1.5 sm:mb-4' : 'mb-3 sm:mb-5')}>
              <div
                className={cn(
                  'pointer-events-none absolute rounded-3xl bg-blue-500/18 blur-2xl dark:bg-blue-500/14',
                  compact ? '-inset-3 sm:-inset-5' : '-inset-4 sm:-inset-6',
                )}
                aria-hidden
              />
              <UzaEduLogo
                className={cn(
                  'relative w-auto drop-shadow-sm dark:[&_text:first-of-type]:fill-white/90',
                  compact ? 'h-7 sm:h-9' : 'h-8 sm:h-10',
                )}
              />
            </div>

            {/* App title */}
            <h1 className="flex flex-wrap items-baseline justify-center gap-x-1 leading-none tracking-tight">
              <span
                className={cn(
                  'font-extrabold text-foreground',
                  compact ? 'text-[1.2rem] sm:text-[1.6rem]' : 'text-[1.35rem] sm:text-[1.75rem]',
                )}
              >
                Öğretmen
              </span>
              <span
                className={cn(
                  'bg-linear-to-r from-indigo-500 via-blue-500 to-sky-400 bg-clip-text font-extrabold text-transparent',
                  compact ? 'text-[1.2rem] sm:text-[1.6rem]' : 'text-[1.35rem] sm:text-[1.75rem]',
                )}
              >
                Pro
              </span>
            </h1>
          </Link>

          {/* Eyebrow badge */}
          <span
            className={cn(
              'inline-flex items-center rounded-full border border-border/50 bg-background/60 font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-md dark:bg-zinc-900/50',
              compact
                ? 'mt-1.5 px-2 py-0.5 text-[8px] sm:mt-2 sm:px-3 sm:text-[10px]'
                : 'mt-2 px-2.5 py-0.5 text-[9px] sm:mt-2.5 sm:px-3 sm:text-[10px]',
            )}
          >
            {eyebrow}
          </span>
        </header>

        <div
          className={cn(
            'mx-auto w-full',
            compact ? 'max-w-[min(100%,17.5rem)] sm:max-w-[320px]' : 'max-w-[min(100%,20rem)] sm:max-w-[360px]',
          )}
        >
          {children}
        </div>

        <AuthLegalFooter className={cn(compact ? 'mt-3 sm:mt-8' : 'mt-5 sm:mt-10')} />
      </div>
    </div>
  );
}
