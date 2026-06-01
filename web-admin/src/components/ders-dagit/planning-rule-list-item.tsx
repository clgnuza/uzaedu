'use client';

import { CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanningRuleListCopy, PlanningRuleListTone } from '@/lib/planning-rule-list-copy';

type Props = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  copy: PlanningRuleListCopy;
  schoolRule?: string | null;
  supported: boolean;
};

const TONE_LABEL: Record<PlanningRuleListTone, string> = {
  slot: 'Saat',
  week: 'Hafta',
  cards: 'Kart',
  teacher: 'Öğretmen',
  group: 'Grup',
  pedagogy: 'Pedagoji',
};

const TONE_CHIP: Record<PlanningRuleListTone, string> = {
  slot: 'bg-teal-500/12 text-teal-800 dark:text-teal-200',
  week: 'bg-violet-500/12 text-violet-800 dark:text-violet-200',
  cards: 'bg-fuchsia-500/12 text-fuchsia-800 dark:text-fuchsia-200',
  teacher: 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
  group: 'bg-blue-500/12 text-blue-800 dark:text-blue-200',
  pedagogy: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
};

export function PlanningRuleListItem({
  selected,
  onSelect,
  title,
  copy,
  schoolRule,
  supported,
}: Props) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          'flex w-full cursor-pointer gap-2.5 border-b border-border/50 p-3 text-left transition-colors',
          'hover:bg-muted/60',
          selected &&
            'border-l-[3px] border-l-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/8 ring-1 ring-[rgb(var(--dd-accent))]/20',
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-lg leading-none',
            selected && 'bg-[rgb(var(--dd-accent))]/15 ring-1 ring-[rgb(var(--dd-accent))]/30',
          )}
          aria-hidden
        >
          {copy.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE_CHIP[copy.tone])}>
              {TONE_LABEL[copy.tone]}
            </span>
            {supported ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="size-3" />
                Dağıtım
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100">
                <Clock className="size-3" />
                Yakında
              </span>
            )}
          </span>
          <span className="mt-1 block text-sm font-semibold leading-snug text-foreground">{copy.lead}</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{copy.detail}</span>
          <span className="mt-1 block text-xs text-foreground/75">{title}</span>
          {schoolRule && (
            <span className="mt-1 block text-[11px]">
              <span className="text-muted-foreground">Okul kuralı: </span>
              <span className="font-medium">{schoolRule}</span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
