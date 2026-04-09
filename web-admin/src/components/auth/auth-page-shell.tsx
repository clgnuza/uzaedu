import Link from 'next/link';
import { UzaEduLogo } from '@/components/auth/uza-edu-logo';
import { AuthLegalFooter } from '@/components/auth/auth-legal-footer';

type AuthPageShellProps = {
  children: React.ReactNode;
  /** Ana başlık altı kısa metin */
  eyebrow?: string;
};

export function AuthPageShell({ children, eyebrow = 'Web Admin' }: AuthPageShellProps) {
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
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-3 py-4 sm:px-6 sm:py-10">
        <header className="mb-4 flex flex-col items-center text-center sm:mb-8">
          <Link
            href="/"
            className="group flex flex-col items-center rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {/* Brand logo */}
            <div className="relative mb-3 sm:mb-5">
              <div
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-blue-500/18 blur-2xl sm:-inset-6 dark:bg-blue-500/14"
                aria-hidden
              />
              <UzaEduLogo className="relative h-8 w-auto drop-shadow-sm sm:h-10 dark:[&_text:first-of-type]:fill-white/90" />
            </div>

            {/* App title */}
            <h1 className="flex flex-wrap items-baseline justify-center gap-x-1 leading-none tracking-tight">
              <span className="text-[1.35rem] font-extrabold text-foreground sm:text-[1.75rem]">
                Öğretmen
              </span>
              <span className="bg-linear-to-r from-indigo-500 via-blue-500 to-sky-400 bg-clip-text text-[1.35rem] font-extrabold text-transparent sm:text-[1.75rem]">
                Pro
              </span>
            </h1>
          </Link>

          {/* Eyebrow badge */}
          <span className="mt-2 inline-flex items-center rounded-full border border-border/50 bg-background/60 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-md sm:mt-2.5 sm:px-3 sm:text-[10px] dark:bg-zinc-900/50">
            {eyebrow}
          </span>
        </header>

        <div className="mx-auto w-full max-w-[min(100%,20rem)] sm:max-w-[360px]">{children}</div>

        <AuthLegalFooter className="mt-5 sm:mt-10" />
      </div>
    </div>
  );
}
