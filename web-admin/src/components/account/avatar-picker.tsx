'use client';

import { cn } from '@/lib/utils';
import { AVATAR_PRESETS, AvatarPresetSvg } from '@/lib/avatar-presets';

export function AvatarPickerField({
  value,
  onChange,
  disabled,
  idPrefix = 'av',
  compact,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  disabled?: boolean;
  idPrefix?: string;
  /** Profil sayfası mobil: daha küçük önizlemeler */
  compact?: boolean;
}) {
  return (
    <div className={cn('w-full min-w-0 space-y-1 sm:space-y-2', compact && 'max-sm:space-y-0.5')}>
      <p className={cn('font-medium text-foreground', compact ? 'text-xs sm:text-sm' : 'text-sm')}>Profil görseli</p>
      <p className={cn('text-muted-foreground', compact ? 'text-[11px] leading-snug sm:text-xs' : 'text-xs')}>
        Hazır ikonlar; ayrı dosya yüklenmez.
      </p>
      <div className={cn('flex w-full min-w-0 flex-wrap', compact ? 'gap-1.5 sm:gap-2' : 'gap-2')}>
        <button
          type="button"
          disabled={disabled}
          id={`${idPrefix}-none`}
          onClick={() => onChange(null)}
          className={cn(
            'flex items-center justify-center rounded-lg border-2 text-[10px] font-medium transition-all sm:rounded-xl',
            compact ? 'size-9 sm:size-11' : 'size-11',
            !value
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
            disabled && 'pointer-events-none opacity-50',
          )}
          aria-pressed={!value}
        >
          Yok
        </button>
        {AVATAR_PRESETS.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              id={`${idPrefix}-${p.id}`}
              title={p.label}
              onClick={() => onChange(p.id)}
              className={cn(
                'relative overflow-hidden rounded-lg border-2 p-0.5 transition-all sm:rounded-xl',
                active ? 'border-primary ring-2 ring-primary/25' : 'border-transparent hover:border-border',
                disabled && 'pointer-events-none opacity-50',
              )}
              aria-label={p.label}
              aria-pressed={active}
            >
              <AvatarPresetSvg id={p.id} className={cn('rounded-md sm:rounded-lg', compact ? 'size-8 sm:size-10' : 'size-10')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
