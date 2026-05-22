'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type DdSelectOption = { value: string; label: string };

export const DD_SELECT_TRIGGER =
  'h-9 min-h-9 w-full min-w-0 text-sm sm:h-10';

export type DdSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: DdSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function DdSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  id,
}: DdSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn(DD_SELECT_TRIGGER, className)} id={id} />
      <SelectValue placeholder={placeholder} />
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || '__empty'} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DdSelectField({
  label,
  labelClassName,
  className,
  ...props
}: DdSelectProps & { label: string; labelClassName?: string }) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <Label className={cn('text-xs sm:text-sm', labelClassName)}>{label}</Label>
      <DdSelect {...props} />
    </div>
  );
}

export function DdMultiSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  rows = 4,
}: {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: DdSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
}) {
  return (
    <select
      multiple
      disabled={disabled}
      value={value}
      size={rows}
      onChange={(e) => onValueChange(Array.from(e.target.selectedOptions, (o) => o.value))}
      className={cn(
        'w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      aria-label={placeholder}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
