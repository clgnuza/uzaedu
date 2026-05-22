'use client';

import { Button } from '@/components/ui/button';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { cn } from '@/lib/utils';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type Props = {
  value: number[];
  onChange: (days: number[]) => void;
  /** En az bu kadar gün seçili kalmalı */
  minSelected?: number;
  className?: string;
};

export function DdWeekdayPicker({ value, onChange, minSelected = 1, className }: Props) {
  function toggle(d: number) {
    if (value.includes(d)) {
      if (value.length <= minSelected) return;
      onChange(
        value
          .filter((x) => x !== d)
          .sort((a, b) => a - b),
      );
    } else {
      onChange([...value, d].sort((a, b) => a - b));
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {ALL_DAYS.map((d) => {
          const on = value.includes(d);
          return (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={on ? 'default' : 'outline'}
              className={cn('min-w-[3.25rem]', d >= 6 && !on && 'opacity-70')}
              onClick={() => toggle(d)}
            >
              {dayLabel(d).slice(0, 3)}
            </Button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Seçili: {value.length ? value.map((d) => dayLabel(d)).join(', ') : '—'}
      </p>
    </div>
  );
}
