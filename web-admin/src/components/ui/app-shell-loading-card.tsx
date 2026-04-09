import type { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppShellLoadingCardProps = {
  title: string;
  subtitle?: string;
  hint?: string;
  /** Üst şerit ikonu */
  leading?: ReactNode;
  className?: string;
};

/**
 * Auth / route guard veya sayfa Suspense fallback: layout içinde kartlı yükleme (boş beyaz ekran + gri spinner yerine).
 */
export function AppShellLoadingCard({
  title,
  subtitle = 'Yükleniyor…',
  hint = 'Birkaç saniye içinde hazır olacak.',
  leading,
  className,
}: AppShellLoadingCardProps) {
  return (
    <div
      className={cn('flex w-full justify-center px-2 py-8 sm:px-4 sm:py-12', className)}
      role="status"
      aria-live="polite"
      aria-label={subtitle}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-background/95 shadow-lg shadow-slate-900/6 ring-1 ring-slate-900/4 backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-950/90 dark:shadow-black/30 dark:ring-white/6">
        <div className="border-b border-sky-200/60 bg-gradient-to-r from-sky-500/12 via-teal-500/10 to-emerald-500/12 px-5 py-4 dark:border-sky-800/50 dark:from-sky-500/15 dark:via-teal-500/10 dark:to-emerald-500/10">
          <div className="flex items-center gap-3">
            {leading ?? (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-md ring-2 ring-white/40 dark:ring-white/10">
                <LayoutDashboard className="size-5" aria-hidden />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">{title}</p>
              <p className="text-sm font-medium text-sky-700 dark:text-sky-300/95">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-5 px-5 py-8 sm:py-9">
          <div
            className="size-10 rounded-full border-[3px] border-slate-200 border-t-sky-600 motion-safe:animate-spin motion-reduce:border-slate-300 motion-reduce:animate-none dark:border-slate-600 dark:border-t-sky-400"
            aria-hidden
          />
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 rounded-full bg-sky-500/80 motion-safe:animate-bounce motion-reduce:animate-none dark:bg-sky-400/90"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>
          {hint ? (
            <p className="text-center text-xs leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
