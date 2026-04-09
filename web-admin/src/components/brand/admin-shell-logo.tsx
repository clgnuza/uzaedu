import { cn } from '@/lib/utils';

/** Mühür içi uZa — ortadaki Z vurgulu */
function UzaMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <span
      className={cn(
        'relative z-10 inline-flex select-none items-baseline justify-center leading-none tracking-tight',
        sm ? 'gap-px' : 'gap-0.5',
      )}
      aria-hidden
    >
      <span
        className={cn(
          'font-semibold text-zinc-100/95',
          sm ? 'translate-y-[0.5px] text-[8px]' : 'translate-y-px text-[9px]',
        )}
      >
        u
      </span>
      <span
        className={cn(
          'bg-linear-to-b from-rose-300 via-red-500 to-rose-700 bg-clip-text font-black text-transparent',
          'drop-shadow-[0_0_8px_rgba(251,113,133,0.95),0_0_18px_rgba(239,68,68,0.45),0_0_28px_rgba(244,63,94,0.2)]',
          sm ? 'text-[13px]' : 'text-[15px]',
        )}
      >
        Z
      </span>
      <span
        className={cn(
          'font-semibold text-zinc-100/95',
          sm ? '-translate-y-[0.5px] text-[8px]' : '-translate-y-px text-[9px]',
        )}
      >
        a
      </span>
    </span>
  );
}

/** Anasayfa SealHub ile uyumlu: koyu mühür + neon kenar + cam yansıması */
function BrandSeal({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 32 : 40;
  const sm = size === 'sm';
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: dim, height: dim }}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-full bg-[radial-gradient(circle,rgba(251,113,133,0.55)_0%,rgba(239,68,68,0.18)_50%,transparent_72%)] blur-[10px]',
          sm ? '-inset-2' : '-inset-2.5',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-full bg-[radial-gradient(circle_at_72%_78%,rgba(34,211,238,0.45)_0%,transparent_58%)] blur-md',
          sm ? '-inset-1.5' : '-inset-2',
        )}
      />
      <span
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-full',
          'bg-[radial-gradient(circle_at_40%_35%,#3f3f46,#09090b)]',
          'shadow-[0_0_0_1px_rgba(253,164,175,0.55),0_0_16px_-2px_rgba(239,68,68,0.5),0_0_28px_-8px_rgba(244,114,182,0.32),inset_0_1px_0_rgba(255,255,255,0.14)]',
          'ring-1 ring-rose-400/45 ring-inset',
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 32%, transparent 52%), linear-gradient(215deg, transparent 58%, rgba(34,211,238,0.12) 100%)',
          }}
          aria-hidden
        />
        <UzaMark size={size} />
      </span>
    </span>
  );
}

export function AdminShellLogoExpanded({ className }: { className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <BrandSeal size="md" />
      <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
        <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">Öğretmen Pro</span>
        <span className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Web yönetim
        </span>
      </span>
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
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <BrandSeal size="sm" />
      <span className="flex min-w-0 flex-col justify-center gap-1 leading-none">
        <span className="truncate text-[0.9375rem] font-semibold tracking-tight">
          <span className="text-foreground">Öğretmen </span>
          <span className="bg-linear-to-r from-sky-300 via-cyan-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]">
            Pro
          </span>
        </span>
        <span
          className="max-w-full truncate rounded-full border border-primary/25 bg-primary/6 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground shadow-[0_0_14px_-6px_color-mix(in_srgb,var(--primary)_55%,transparent)] dark:border-primary/30 dark:bg-primary/10"
          title={sub}
        >
          {sub}
        </span>
      </span>
    </span>
  );
}
