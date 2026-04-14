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
          {/* Neon / mesh — logo arkası (mobilde daha kısa; blur formu kaplamasın) */}
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 z-0 w-[min(100%,20rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-violet-400/20 bg-linear-to-b from-violet-500/[0.07] via-fuchsia-500/5 to-transparent shadow-[0_0_40px_-8px_rgba(139,92,246,0.35)] dark:border-violet-500/25 dark:from-violet-600/20 dark:via-fuchsia-600/12 dark:shadow-[0_0_48px_-6px_rgba(167,139,250,0.45)] sm:w-[min(100%,24rem)] sm:rounded-4xl',
              compact
                ? '-top-1 max-sm:h-28 sm:-top-2 sm:h-40'
                : '-top-1 max-sm:h-31 sm:-top-3 sm:h-50',
            )}
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(168,85,247,0.22),transparent_55%)] dark:bg-[radial-gradient(ellipse_90%_65%_at_50%_-5%,rgba(192,132,252,0.35),transparent_50%)]" />
            <div
              className={cn(
                'auth-shell-neon-drift absolute rounded-full bg-cyan-400/25 blur-2xl dark:bg-cyan-400/30 max-sm:blur-xl',
                compact ? '-left-3 top-0 size-24 sm:-left-4 sm:size-36' : '-left-4 top-1 size-28 max-sm:size-24 sm:-left-6 sm:top-2 sm:size-40',
              )}
            />
            <div
              className={cn(
                'auth-shell-neon-drift-delayed absolute rounded-full bg-fuchsia-500/30 blur-2xl dark:bg-fuchsia-400/35 max-sm:blur-xl',
                compact ? '-right-1 top-5 size-20 sm:-right-2 sm:size-32' : '-right-2 top-6 size-24 max-sm:size-20 sm:-right-4 sm:top-8 sm:size-36',
              )}
            />
            <div
              className={cn(
                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-2xl dark:bg-violet-400/25 max-sm:size-32 max-sm:blur-xl',
                compact ? 'size-36 sm:size-44' : 'size-44 sm:size-52',
              )}
            />
            <div
              className={cn(
                'auth-shell-neon-drift absolute rounded-full bg-amber-400/20 blur-xl dark:bg-amber-400/25 max-sm:size-16',
                compact ? 'bottom-2 left-1/4 size-20' : 'bottom-2 left-[22%] size-22 max-sm:bottom-1 sm:bottom-3 sm:size-24',
              )}
            />
            {/* Üst neon çizgi */}
            <div className="absolute inset-x-6 top-0 h-[2px] rounded-full bg-linear-to-r from-transparent via-violet-400 to-transparent opacity-80 shadow-[0_0_14px_3px_rgba(167,139,250,0.45)] dark:via-fuchsia-400 dark:shadow-[0_0_18px_4px_rgba(232,121,249,0.4)]" />
            <div className="auth-shell-neon-line absolute inset-x-8 top-0 h-px bg-linear-to-r from-cyan-400/0 via-cyan-300/70 to-cyan-400/0 dark:via-cyan-200/50" />
            {/* Alt yumuşak ayırıcı */}
            <div className="absolute inset-x-4 bottom-0 h-px bg-linear-to-r from-transparent via-violet-300/40 to-transparent dark:via-violet-400/35" />
          </div>

          {/* Logo halkası — neon ring */}
          <Link
            href="/"
            className={cn(
              'group relative z-10 flex flex-col items-center rounded-2xl outline-none',
              'transition-transform duration-300 hover:scale-[1.02] active:scale-[0.99]',
              'focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <div className={cn('relative', compact ? 'mb-1.5 sm:mb-4' : 'mb-2.5 sm:mb-5')}>
              <div
                className={cn(
                  'auth-shell-neon-ring pointer-events-none absolute rounded-[1.35rem] bg-linear-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/25 blur-md dark:from-violet-400/40 dark:via-fuchsia-500/30 dark:to-cyan-400/30 max-sm:-inset-1.5 max-sm:blur-sm',
                  compact ? '-inset-2 sm:-inset-3' : '-inset-2 sm:-inset-4 max-sm:-inset-1.5',
                )}
                aria-hidden
              />
              <div
                className={cn(
                  'pointer-events-none absolute rounded-2xl ring-2 ring-violet-400/35 ring-offset-1 ring-offset-background/80 dark:ring-fuchsia-400/40 dark:ring-offset-zinc-950/80 max-sm:ring-1 max-sm:ring-offset-1',
                  'shadow-[0_0_16px_-2px_rgba(139,92,246,0.45),0_0_28px_-12px_rgba(34,211,238,0.2)]',
                  'dark:shadow-[0_0_22px_-2px_rgba(192,132,252,0.45),0_0_40px_-14px_rgba(34,211,238,0.15)] max-sm:shadow-[0_0_12px_-2px_rgba(139,92,246,0.35)]',
                  compact ? '-inset-1 sm:-inset-2' : '-inset-1 max-sm:-inset-1 sm:-inset-2.5',
                )}
                aria-hidden
              />
              <div
                className={cn(
                  'relative rounded-2xl bg-background/40 px-3 py-2 backdrop-blur-md dark:bg-zinc-950/50',
                  compact ? 'px-2.5 py-1.5 sm:px-4 sm:py-2.5' : 'px-3 py-2 sm:px-5 sm:py-3',
                )}
              >
                <UzaEduLogo
                  className={cn(
                    'relative w-auto drop-shadow-[0_0_12px_rgba(99,102,241,0.35)] dark:drop-shadow-[0_0_16px_rgba(167,139,250,0.45)] dark:[&_text:first-of-type]:fill-white/90',
                    compact ? 'h-7 sm:h-9' : 'h-7 sm:h-10',
                  )}
                />
              </div>
            </div>

            <h1 className="relative z-10 flex flex-wrap items-baseline justify-center gap-x-1 leading-none tracking-tight">
              <span
                className={cn(
                  'font-extrabold text-foreground drop-shadow-[0_0_24px_rgba(255,255,255,0.35)] dark:drop-shadow-[0_0_20px_rgba(167,139,250,0.15)]',
                  compact ? 'text-[1.2rem] sm:text-[1.6rem]' : 'text-[1.2rem] sm:text-[1.75rem]',
                )}
              >
                Öğretmen
              </span>
              <span
                className={cn(
                  'bg-linear-to-r from-violet-500 via-fuchsia-500 to-cyan-400 bg-clip-text font-extrabold text-transparent',
                  'drop-shadow-[0_0_20px_rgba(139,92,246,0.35)] dark:drop-shadow-[0_0_24px_rgba(192,132,252,0.4)]',
                  compact ? 'text-[1.2rem] sm:text-[1.6rem]' : 'text-[1.2rem] sm:text-[1.75rem]',
                )}
              >
                Pro
              </span>
            </h1>
          </Link>

          <span
            className={cn(
              'relative z-10 mt-2 inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.12em] backdrop-blur-md',
              'border-violet-400/35 bg-background/55 text-muted-foreground shadow-[0_0_20px_-4px_rgba(139,92,246,0.35)]',
              'dark:border-fuchsia-500/40 dark:bg-zinc-900/65 dark:text-zinc-300 dark:shadow-[0_0_24px_-4px_rgba(192,132,252,0.3)]',
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
