'use client';

import type { MouseEvent } from 'react';
import { BookOpen, Heart, ThumbsDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EvalQuickKind = 'lesson_pos' | 'lesson_neg' | 'behavior_pos' | 'behavior_neg';

type StudentNote = { studentId: string; noteType: string; noteDate: string; tags?: string[] | null };

const QUICK_TAG = 'eval_quick' as const;

export function evalQuickKindTags(kind: EvalQuickKind): string[] {
  return [QUICK_TAG, kind];
}

export function noteMatchesEvalQuick(n: StudentNote, kind: EvalQuickKind): boolean {
  const t = n.tags ?? [];
  return t.includes(QUICK_TAG) && t.includes(kind);
}

function dayKey(d: string) {
  return String(d).slice(0, 10);
}

export function countEvalQuickToday(notes: StudentNote[], studentId: string, today: string, kind: EvalQuickKind): number {
  const t = dayKey(today);
  return notes.filter(
    (n) =>
      n.studentId === studentId &&
      dayKey(n.noteDate) === t &&
      n.noteType === (kind.endsWith('_pos') ? 'positive' : 'negative') &&
      noteMatchesEvalQuick(n, kind),
  ).length;
}

const CELLS: {
  kind: EvalQuickKind;
  category: string;
  polarity: 'Olumlu' | 'Olumsuz';
  fullTitle: string;
  Icon: LucideIcon;
  card: string;
  iconWrap: string;
  /** Olumlu / olumsuz şeridi — kart rengiyle uyumlu */
  polarityBar: string;
}[] = [
  {
    kind: 'lesson_pos',
    category: 'Ders',
    polarity: 'Olumlu',
    fullTitle: 'Ders · olumlu',
    Icon: BookOpen,
    card: 'border-indigo-200/90 bg-linear-to-b from-indigo-50/95 to-white text-indigo-950 shadow-sm hover:border-indigo-400/70 active:scale-[0.98] dark:border-indigo-800/60 dark:from-indigo-950/50 dark:to-zinc-900 dark:text-indigo-100',
    iconWrap: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-200',
    polarityBar: 'border border-indigo-300/40 bg-indigo-500/12 text-indigo-900 dark:border-indigo-700/50 dark:bg-indigo-500/20 dark:text-indigo-100',
  },
  {
    kind: 'lesson_neg',
    category: 'Ders',
    polarity: 'Olumsuz',
    fullTitle: 'Ders · olumsuz',
    Icon: ThumbsDown,
    card: 'border-amber-200/90 bg-linear-to-b from-amber-50/90 to-white text-amber-950 shadow-sm hover:border-amber-400/70 active:scale-[0.98] dark:border-amber-800/55 dark:from-amber-950/35 dark:to-zinc-900 dark:text-amber-100',
    iconWrap: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
    polarityBar: 'border border-amber-400/35 bg-amber-500/15 text-amber-950 dark:border-amber-700/40 dark:bg-amber-500/20 dark:text-amber-100',
  },
  {
    kind: 'behavior_pos',
    category: 'Davranış',
    polarity: 'Olumlu',
    fullTitle: 'Davranış · olumlu',
    Icon: Heart,
    card: 'border-emerald-200/90 bg-linear-to-b from-emerald-50/95 to-white text-emerald-950 shadow-sm hover:border-emerald-400/70 active:scale-[0.98] dark:border-emerald-800/55 dark:from-emerald-950/40 dark:to-zinc-900 dark:text-emerald-100',
    iconWrap: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
    polarityBar: 'border border-emerald-400/35 bg-emerald-500/15 text-emerald-950 dark:border-emerald-700/45 dark:bg-emerald-500/20 dark:text-emerald-100',
  },
  {
    kind: 'behavior_neg',
    category: 'Davranış',
    polarity: 'Olumsuz',
    fullTitle: 'Davranış · olumsuz',
    Icon: ThumbsDown,
    card: 'border-rose-200/90 bg-linear-to-b from-rose-50/95 to-white text-rose-950 shadow-sm hover:border-rose-400/70 active:scale-[0.98] dark:border-rose-800/55 dark:from-rose-950/40 dark:to-zinc-900 dark:text-rose-100',
    iconWrap: 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
    polarityBar: 'border border-rose-400/35 bg-rose-500/12 text-rose-950 dark:border-rose-700/45 dark:bg-rose-500/20 dark:text-rose-100',
  },
];

export function StudentEvalQuickCards({
  studentId,
  studentName,
  today,
  notes,
  onAdd,
  onOpenNotes,
  compact,
  variant = 'default',
  hideNotesLink,
  className,
}: {
  studentId: string;
  studentName: string;
  today: string;
  notes: StudentNote[];
  onAdd: (kind: EvalQuickKind, e?: MouseEvent) => void;
  onOpenNotes?: () => void;
  compact?: boolean;
  variant?: 'default' | 'sheet';
  hideNotesLink?: boolean;
  className?: string;
}) {
  const sheet = variant === 'sheet';
  const dense = compact || sheet;
  const rowNotes = notes.filter((n) => n.studentId === studentId);
  const t = dayKey(today);
  const hasAnyQuickToday = rowNotes.some((n) => dayKey(n.noteDate) === t && (n.tags ?? []).includes(QUICK_TAG));
  const hasAnyNote = rowNotes.length > 0;
  const showNotesLink = !hideNotesLink && onOpenNotes && (hasAnyQuickToday || hasAnyNote);

  return (
    <div
      className={cn(
        'space-y-1.5',
        sheet &&
          'rounded-2xl border border-border/60 bg-linear-to-b from-muted/40 to-muted/10 p-1.5 shadow-sm dark:from-zinc-900/80 dark:to-zinc-950/60',
        className,
      )}
    >
      <div className={cn('grid grid-cols-2', dense ? 'gap-1' : 'gap-1.5')}>
        {CELLS.map(({ kind, category, polarity, fullTitle, Icon, card, iconWrap, polarityBar }) => {
          const c = countEvalQuickToday(notes, studentId, today, kind);
          const isPos = polarity === 'Olumlu';
          return (
            <button
              key={kind}
              type="button"
              title={`${studentName}: ${fullTitle} — dokunarak ekle`}
              onClick={(e) => onAdd(kind, e)}
              className={cn(
                'flex min-w-0 flex-col gap-1 text-left transition-all active:scale-[0.98]',
                sheet
                  ? 'min-h-[4.25rem] rounded-xl border p-1.5 shadow-sm'
                  : cn('rounded-xl border-2', dense ? 'min-h-[4.5rem] p-1.5 sm:min-h-[4.75rem]' : 'min-h-[5rem] p-2 sm:min-h-[5.25rem] sm:p-2.5'),
                card,
              )}
            >
              <div className="flex min-h-0 min-w-0 items-center gap-1">
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-md',
                    sheet ? 'size-6' : dense ? 'size-6' : 'size-7 rounded-lg sm:size-8',
                    iconWrap,
                  )}
                >
                  <Icon className={cn('opacity-90', sheet || dense ? 'size-3' : 'size-3.5')} aria-hidden />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-bold leading-tight tracking-tight',
                    sheet ? 'text-[10px]' : dense ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs',
                  )}
                >
                  {category}
                </span>
              </div>
              <div
                className={cn(
                  'flex w-full items-center justify-center gap-0.5 rounded-md px-0.5 py-0.5 font-bold leading-none',
                  sheet ? 'text-[9px]' : 'text-[9px] sm:text-[10px]',
                  polarityBar,
                )}
              >
                <span className="tabular-nums" aria-hidden>
                  {isPos ? '+' : '−'}
                </span>
                <span className="truncate">{polarity}</span>
              </div>
              <p
                className={cn(
                  'mt-auto text-center font-black tabular-nums leading-none tracking-tight',
                  sheet ? 'text-base' : dense ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl',
                )}
              >
                {c}
              </p>
            </button>
          );
        })}
      </div>
      {showNotesLink ? (
        <button
          type="button"
          onClick={onOpenNotes}
          className="w-full rounded-lg py-1 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:bg-muted/60 hover:text-foreground hover:underline"
        >
          Notlar
        </button>
      ) : null}
    </div>
  );
}
