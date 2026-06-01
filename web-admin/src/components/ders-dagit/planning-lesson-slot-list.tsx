'use client';

import { cn } from '@/lib/utils';
import { PLANNING_LESSON_SLOT_ITEMS } from '@/lib/planning-rule-list-copy';

type Variant = 'start' | 'end';

const VARIANT_COPY: Record<Variant, { section: string; active: string }> = {
  start: {
    section: 'Bu dilimlerde ders başlangıcı kurulmaz',
    active: 'Seçili',
  },
  end: {
    section: 'Bu dilimlerde ders bloğu sona eremez',
    active: 'Seçili',
  },
};

type Props = {
  variant: Variant;
  selected: number[];
  onChange: (lessons: number[]) => void;
  maxSlots?: number;
  className?: string;
};

export function PlanningLessonSlotList({
  variant,
  selected,
  onChange,
  maxSlots = 8,
  className,
}: Props) {
  const set = new Set(selected);
  const items = PLANNING_LESSON_SLOT_ITEMS.filter((i) => i.num <= maxSlots);
  const copy = VARIANT_COPY[variant];

  function toggle(num: number) {
    const next = new Set(set);
    if (next.has(num)) next.delete(num);
    else next.add(num);
    onChange([...next].sort((a, b) => a - b));
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-foreground">{copy.section}</p>
      <ul className="m-0 space-y-1.5 p-0" role="listbox" aria-multiselectable>
        {items.map((item) => {
          const on = set.has(item.num);
          return (
            <li key={item.num}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                  on
                    ? 'border-[rgb(var(--dd-accent))]/40 bg-[rgb(var(--dd-accent))]/8'
                    : 'border-border/70 hover:bg-muted/50',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-border accent-[rgb(var(--dd-accent))]"
                  checked={on}
                  onChange={() => toggle(item.num)}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium leading-snug">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {selected.length === 0 && (
        <p className="text-[11px] text-amber-800 dark:text-amber-200">En az bir dilim işaretleyin.</p>
      )}
    </div>
  );
}
