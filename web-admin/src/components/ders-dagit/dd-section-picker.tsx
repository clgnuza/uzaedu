'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DdMultiSelect, DdSelect, DdSelectField, type DdSelectOption } from '@/components/ders-dagit/dd-select';
import { useDersDagitSections } from '@/hooks/use-ders-dagit-sections';

export function DdSectionMultiField({
  label,
  value,
  onValueChange,
  extraSections,
  className,
  rows = 5,
}: {
  label: string;
  value: string[];
  onValueChange: (value: string[]) => void;
  extraSections?: string[];
  className?: string;
  rows?: number;
}) {
  const { options } = useDersDagitSections(extraSections);
  if (!options.length) {
    return (
      <div className={cn('space-y-1', className)}>
        <Label className="text-xs sm:text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">Önce kurulumda sınıf profili ekleyin.</p>
      </div>
    );
  }
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs sm:text-sm">{label}</Label>
      <DdMultiSelect value={value} onValueChange={onValueChange} options={options} rows={rows} placeholder={label} />
      <p className="text-[11px] text-muted-foreground">Ctrl/Cmd ile birden fazla şube seçin.</p>
    </div>
  );
}

export function DdSectionField({
  label,
  value,
  onValueChange,
  extraSections,
  className,
  allowEmpty,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  extraSections?: string[];
  className?: string;
  allowEmpty?: boolean;
}) {
  const { options } = useDersDagitSections(extraSections);
  const opts: DdSelectOption[] = allowEmpty ? [{ value: '', label: '—' }, ...options] : options;
  return (
    <DdSelectField
      label={label}
      className={className}
      value={value}
      onValueChange={onValueChange}
      options={opts.length ? opts : [{ value: value || '5A', label: value || '5A' }]}
      placeholder="Şube seçin"
    />
  );
}
