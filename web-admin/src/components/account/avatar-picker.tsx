'use client';

import { cn } from '@/lib/utils';
import { AVATAR_PRESETS, AvatarPresetSvg } from '@/lib/avatar-presets';

export function AvatarPickerField({
  value,
  onChange,
  disabled,
  idPrefix = 'av',
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Profil görseli</p>
      <p className="text-xs text-muted-foreground">
        Öğretmen temalı hazır ikonlar (vektör); ek görsel indirilmez.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          id={`${idPrefix}-none`}
          onClick={() => onChange(null)}
          className={cn(
            'flex size-11 items-center justify-center rounded-xl border-2 text-[10px] font-medium transition-all',
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
                'relative overflow-hidden rounded-xl border-2 p-0.5 transition-all',
                active ? 'border-primary ring-2 ring-primary/25' : 'border-transparent hover:border-border',
                disabled && 'pointer-events-none opacity-50',
              )}
              aria-label={p.label}
              aria-pressed={active}
            >
              <AvatarPresetSvg id={p.id} className="size-10 rounded-lg" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
