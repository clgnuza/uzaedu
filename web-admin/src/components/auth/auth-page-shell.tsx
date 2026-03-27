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
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-col items-center text-center sm:mb-8">
          {/* Brand logo */}
          <div className="relative mb-5">
            <div
              className="pointer-events-none absolute -inset-6 rounded-3xl bg-blue-500/18 blur-2xl dark:bg-blue-500/14"
              aria-hidden
            />
            <UzaEduLogo className="relative h-10 w-auto drop-shadow-sm dark:[&_text:first-of-type]:fill-white/90" />
          </div>

          {/* App title */}
          <h1 className="flex flex-wrap items-baseline justify-center gap-x-1.5 leading-none tracking-tight">
            <span className="text-[1.55rem] font-extrabold text-foreground sm:text-[1.75rem]">
              Öğretmen
            </span>
            <span className="bg-linear-to-r from-indigo-500 via-blue-500 to-sky-400 bg-clip-text text-[1.55rem] font-extrabold text-transparent sm:text-[1.75rem]">
              Pro
            </span>
          </h1>

          {/* Eyebrow badge */}
          <span className="mt-2.5 inline-flex items-center rounded-full border border-border/50 bg-background/60 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-sm backdrop-blur-md dark:bg-zinc-900/50">
            {eyebrow}
          </span>
        </header>

        <div className="mx-auto w-full max-w-[360px]">{children}</div>

        <AuthLegalFooter className="mt-8 sm:mt-10" />
      </div>
    </div>
  );
}
