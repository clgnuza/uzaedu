import { cn } from '@/lib/utils';

export type BrandSealSize = 'sm' | 'md' | 'lg' | 'xl';

/** uZa — ortadaki Z çok renkli gradient */
function UzaMark({ size = 'md' }: { size?: BrandSealSize }) {
  const sm = size === 'sm';
  return (
    <span
      className={cn(
        'relative z-10 inline-flex select-none items-baseline justify-center leading-none tracking-tight',
        sm ? 'gap-px' : size === 'xl' ? 'gap-1' : 'gap-0.5',
      )}
      aria-hidden
    >
      <span
        className={cn(
          'bg-linear-to-b from-zinc-200 to-zinc-500 bg-clip-text font-semibold text-transparent',
          sm && 'translate-y-[0.5px] text-[8px]',
          size === 'md' && 'translate-y-px text-[9px]',
          size === 'lg' && 'translate-y-0.5 text-[11px]',
          size === 'xl' && 'translate-y-1 text-[13px]',
        )}
      >
        u
      </span>
      <span
        className={cn(
          'bg-linear-to-br from-amber-300 via-fuchsia-500 to-cyan-400 bg-clip-text font-black text-transparent',
          'drop-shadow-[0_0_10px_rgba(217,70,239,0.55)]',
          sm && 'text-[12px]',
          size === 'md' && 'text-[14px]',
          size === 'lg' && 'text-[20px] drop-shadow-[0_0_14px_rgba(217,70,239,0.65)]',
          size === 'xl' && 'text-[28px] drop-shadow-[0_0_18px_rgba(217,70,239,0.7)]',
        )}
      >
        Z
      </span>
      <span
        className={cn(
          'bg-linear-to-b from-zinc-200 to-zinc-500 bg-clip-text font-semibold text-transparent',
          sm && '-translate-y-[0.5px] text-[8px]',
          size === 'md' && '-translate-y-px text-[9px]',
          size === 'lg' && '-translate-y-0.5 text-[11px]',
          size === 'xl' && '-translate-y-1 text-[13px]',
        )}
      >
        a
      </span>
    </span>
  );
}

/** Gradient halka + koyu iç yüzey — üst bar / kenar çubuğu / landing / giriş */
export function BrandSeal({ className, size = 'md' }: { className?: string; size?: BrandSealSize }) {
  const sm = size === 'sm';
  const box =
    size === 'sm'
      ? 'size-8'
      : size === 'md'
        ? 'size-10'
        : size === 'lg'
          ? 'size-16'
          : 'size-28 sm:size-32';
  return (
    <span className={cn('relative inline-flex shrink-0', box, className)}>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-full bg-linear-to-br from-violet-500/50 via-fuchsia-500/35 to-cyan-400/45 opacity-80 blur-lg',
          sm ? '-inset-1.5' : size === 'md' ? '-inset-2' : size === 'lg' ? '-inset-3' : '-inset-4',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_55%)]',
          'inset-[2px]',
        )}
      />
      <span
        className={cn(
          'relative flex size-full items-center justify-center rounded-full',
          size === 'xl' ? 'p-[3px]' : 'p-[2.5px]',
          'bg-linear-to-br from-violet-500 via-fuchsia-500 to-cyan-400',
          size === 'xl'
            ? 'shadow-[0_8px_40px_-8px_rgba(168,85,247,0.55)]'
            : 'shadow-[0_4px_20px_-4px_rgba(168,85,247,0.45)]',
        )}
      >
        <span
          className={cn(
            'flex size-full items-center justify-center overflow-hidden rounded-full',
            'bg-[radial-gradient(ellipse_120%_100%_at_50%_-10%,#27272a_0%,#0c0c0e_48%,#030303_100%)]',
            'ring-1 ring-white/15 ring-inset',
          )}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full opacity-90"
            style={{
              background:
                'linear-gradient(155deg, rgba(255,255,255,0.18) 0%, transparent 42%), linear-gradient(320deg, transparent 55%, rgba(34,211,238,0.12) 100%)',
            }}
            aria-hidden
          />
          <UzaMark size={size} />
        </span>
      </span>
    </span>
  );
}

function BrandTitleLines() {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
      <span className="truncate text-[13px] font-semibold tracking-tight">
        <span className="text-foreground">Uzaedu </span>
        <span className="bg-linear-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent dark:from-violet-400 dark:via-fuchsia-400 dark:to-cyan-400">
          Öğretmen
        </span>
      </span>
      <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Web yönetim
      </span>
    </span>
  );
}

export function AdminShellLogoExpanded({ className }: { className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <BrandSeal size="md" />
      <BrandTitleLines />
    </span>
  );
}

export function AdminShellLogoCollapsed({ className }: { className?: string }) {
  return (
    <span className={cn('flex justify-center', className)}>
      <BrandSeal size="md" />
    </span>
  );
}

export function AdminShellLogoHeaderMobile({
  className,
  /** Alt satır; misafir herkese açık sayfalarda sayfa bağlamı (varsayılan: Panel) */
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  const sub = subtitle ?? 'Panel';
  return (
    <span className={cn('flex min-w-0 items-center gap-2 sm:gap-3', className)}>
      <BrandSeal size="sm" />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 leading-none sm:gap-1">
        <span className="w-full min-w-0 text-pretty text-[0.8125rem] font-semibold tracking-tight leading-snug sm:text-[0.9375rem] sm:leading-tight">
          <span className="text-foreground">Uzaedu </span>
          <span className="bg-linear-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(168,85,247,0.35)] dark:from-violet-400 dark:via-fuchsia-400 dark:to-cyan-400">
            Öğretmen
          </span>
        </span>
        <span
          className="w-fit max-w-full self-start truncate rounded-full border border-primary/25 bg-primary/6 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground shadow-[0_0_14px_-6px_color-mix(in_srgb,var(--primary)_55%,transparent)] dark:border-primary/30 dark:bg-primary/10"
          title={sub}
        >
          {sub}
        </span>
      </span>
    </span>
  );
}
