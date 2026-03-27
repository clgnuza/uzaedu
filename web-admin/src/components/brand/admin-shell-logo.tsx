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
          'bg-gradient-to-b from-red-400 to-red-600 bg-clip-text font-black text-transparent drop-shadow-[0_0_8px_rgba(248,113,113,0.35)]',
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

/** Anasayfa SealHub ile uyumlu: koyu mühür + kırmızı halka; panel sol üst için ölçekli */
function BrandSeal({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 32 : 40;
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[radial-gradient(circle_at_40%_35%,#3f3f46,#09090b)]',
        'shadow-[0_0_0_1px_rgba(220,38,38,0.5),0_6px_16px_-6px_rgba(0,0,0,0.35)]',
        'ring-1 ring-red-700/40 ring-inset',
        className,
      )}
      style={{ width: dim, height: dim }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.1) 0%, transparent 42%)' }}
        aria-hidden
      />
      <UzaMark size={size} />
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
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandSeal size="sm" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight text-foreground">Öğretmen Pro</span>
        <span className="truncate text-[10px] text-muted-foreground">{subtitle ?? 'Panel'}</span>
      </span>
    </span>
  );
}
