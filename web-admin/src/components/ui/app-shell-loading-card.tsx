import type { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLoadingBrand } from '@/components/ui/page-loading-brand';

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
      className={cn(
        'flex w-full justify-center px-3 py-8 sm:px-4 sm:py-12',
        // Mobil: daha yumuşak tam genişlik hissi; web: nötr zemin
        'bg-gradient-to-b from-slate-50/95 via-muted/25 to-muted/40 dark:from-slate-950/80 dark:via-slate-950/50 dark:to-background',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={subtitle}
    >
      <div
        className={cn(
          'w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-background/90 shadow-xl shadow-slate-900/8 ring-1 ring-slate-900/5 backdrop-blur-md sm:max-w-md',
          'dark:border-slate-700/90 dark:bg-slate-950/85 dark:shadow-black/40 dark:ring-white/8',
        )}
      >
        <div className="border-b border-sky-200/50 bg-gradient-to-r from-sky-500/14 via-teal-500/10 to-emerald-500/12 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-sky-800/45 dark:from-sky-500/18 dark:via-teal-500/12 dark:to-emerald-500/12">
          <div className="flex items-center gap-3">
            {leading ?? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-md ring-2 ring-white/35 dark:ring-white/10 sm:size-11">
                <LayoutDashboard className="size-[1.15rem] sm:size-5" aria-hidden />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-[0.95rem] font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                {title}
              </p>
              <p className="text-sm font-medium text-sky-700 dark:text-sky-300/95">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 px-4 py-7 sm:gap-2 sm:px-6 sm:py-9">
          <PageLoadingBrand density="shell" />
          {hint ? (
            <p className="mt-2 max-w-[18rem] text-center text-[0.7rem] leading-relaxed text-muted-foreground sm:text-xs">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
