'use client';

import * as React from 'react';
import { CalendarClock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateTimeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value'
> & {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
  /** Format hint shown below input (e.g. "gg.aa.yyyy ss:dd") */
  hint?: string;
};

/**
 * Kullanılabilir tarih/saat seçici. Takvim ikonu tıklanabilir; değer varken temizle butonu görünür.
 */
const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  (
    {
      value,
      onValueChange,
      onClear,
      hint,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const hasValue = Boolean(value?.trim());

    const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onValueChange('');
      onClear?.();
      inputRef.current?.focus();
    };

    return (
      <div className="relative w-full min-w-[11rem]">
        <div
          className={cn(
            'flex h-11 w-full min-w-0 items-center rounded-lg border border-input bg-background transition-all duration-200',
            'hover:border-muted-foreground/30',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:border-primary/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <button
            type="button"
            onClick={() => {
              inputRef.current?.focus();
              inputRef.current?.showPicker?.();
            }}
            className="flex shrink-0 items-center justify-center pl-3 pr-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset rounded"
            title="Takvim aç"
            aria-label="Takvim aç"
          >
            <CalendarClock className="size-4" />
          </button>
          <input
            ref={(el) => {
              inputRef.current = el;
              if (typeof ref === 'function') ref(el);
              else if (ref) ref.current = el;
            }}
            type="datetime-local"
            id={id}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={cn(
              'min-w-[10.5rem] flex-1 rounded-r-lg border-0 bg-transparent px-3 py-2 text-foreground text-sm tabular-nums',
              'focus:outline-none focus:ring-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            step="300"
            {...props}
          />
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="flex shrink-0 items-center justify-center pr-2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              title="Temizle"
              aria-label="Temizle"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  },
);
DateTimeInput.displayName = 'DateTimeInput';

export { DateTimeInput };
