import { cn } from '@/lib/utils';
import { PageLoadingBrand } from '@/components/ui/page-loading-brand';

interface LoadingSpinnerProps {
  className?: string;
  /** Erişilebilirlik için açıklama */
  label?: string;
  /**
   * auto: className'da `size-*` yoksa video + çubuk (sayfa yüklemesi), varsa klasik spinner.
   * default: her zaman klasik spinner.
   * page: her zaman video varyantı.
   */
  variant?: 'auto' | 'default' | 'page';
}

function isInlineSpinnerClass(className?: string) {
  if (!className) return false;
  return /\bsize-/.test(className);
}

export function LoadingSpinner({
  className,
  label = 'Yükleniyor',
  variant = 'auto',
}: LoadingSpinnerProps) {
  const useBrand =
    variant === 'page' || (variant === 'auto' && !isInlineSpinnerClass(className));

  if (useBrand) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center gap-3 py-10 sm:gap-4 sm:py-12', className)}
        role="status"
        aria-label={label}
      >
        <PageLoadingBrand density="page" />
        <p className="text-center text-sm font-medium tracking-tight text-muted-foreground">{label}</p>
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}
      role="status"
      aria-label={label}
    >
      <svg
        className="size-8 animate-spin text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Inline küçük spinner (buton içi vb.) */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex gap-1', className)} role="status" aria-label="Yükleniyor">
      <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  );
}
