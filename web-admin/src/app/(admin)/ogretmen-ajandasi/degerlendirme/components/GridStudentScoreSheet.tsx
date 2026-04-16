'use client';

import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Info, Search, StickyNote, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { splitStudentNameForCard } from '../lib/student-avatar';
import { StudentMascotIcon } from '../lib/student-mascot-icon';
import { StudentEvalQuickCards, type EvalQuickKind } from './student-eval-quick-cards';

type Student = { id: string; name: string };
type Criterion = {
  id: string;
  name: string;
  maxScore: number;
  scoreType?: 'numeric' | 'sign';
  criterionCategory?: 'lesson' | 'behavior';
};
type Score = { score: number };

export type GridSheetEvalNote = { studentId: string; noteType: string; noteDate: string; tags?: string[] | null };

export function GridStudentScoreSheet({
  student,
  lessonCriteria,
  behaviorCriteria,
  today,
  evalNotes,
  onClose,
  getScore,
  isSaving,
  onQuickScore,
  onOpenScoreModal,
  onOpenDetail,
  onEvalQuickNote,
  onOpenNotesDetail,
}: {
  student: Student | null;
  lessonCriteria: Criterion[];
  behaviorCriteria: Criterion[];
  today: string;
  evalNotes: GridSheetEvalNote[];
  onClose: () => void;
  getScore: (studentId: string, criterionId: string) => Score | undefined;
  isSaving: (studentId: string, criterionId: string) => boolean;
  onQuickScore: (studentId: string, criterionId: string, score: number) => void;
  onOpenScoreModal: (student: Student, criterion: Criterion) => void;
  onOpenDetail: (student: Student) => void;
  onEvalQuickNote: (kind: EvalQuickKind, e?: MouseEvent) => void;
  onOpenNotesDetail?: (student: Student) => void;
}) {
  const [q, setQ] = useState('');
  const norm = (s: string) => s.trim().toLocaleLowerCase('tr');

  useEffect(() => {
    if (student?.id) setQ('');
  }, [student?.id]);

  const lessonF = useMemo(() => {
    if (!q.trim()) return lessonCriteria;
    const n = norm(q);
    return lessonCriteria.filter((c) => norm(c.name).includes(n));
  }, [lessonCriteria, q]);

  const behaviorF = useMemo(() => {
    if (!q.trim()) return behaviorCriteria;
    const n = norm(q);
    return behaviorCriteria.filter((c) => norm(c.name).includes(n));
  }, [behaviorCriteria, q]);

  if (!student) return null;

  const sk = student.id;
  const { given, familyUpper } = splitStudentNameForCard(student.name);
  const total = lessonCriteria.length + behaviorCriteria.length;

  const row = (c: Criterion, isBeh: boolean) => {
    const sc = getScore(sk, c.id);
    const isSign = (c.scoreType ?? 'numeric') === 'sign';
    const busy = isSaving(sk, c.id);
    return (
      <div
        key={c.id}
        className={cn(
          'rounded-xl border px-2 py-1 shadow-sm',
          isBeh ? 'border-emerald-200/60 bg-emerald-500/4 dark:border-emerald-900/45 dark:bg-emerald-950/25' : 'border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950/35',
        )}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[11px] font-semibold leading-snug sm:text-xs',
              isBeh ? 'text-emerald-950 dark:text-emerald-100' : 'text-foreground',
            )}
          >
            {c.name}
          </span>
          <button
            type="button"
            onClick={() => onOpenScoreModal(student, c)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97]"
            title="Not / detaylı puan"
          >
            <StickyNote className="size-3.5" />
          </button>
        </div>
        {isSign ? (
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { v: 1 as const, label: '+', cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' },
                { v: 0 as const, label: '·', cls: 'bg-muted/90 text-muted-foreground' },
                { v: -1 as const, label: '−', cls: 'bg-rose-500/15 text-rose-800 dark:text-rose-200' },
              ] as const
            ).map(({ v, label, cls }) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                onClick={() => onQuickScore(sk, c.id, v)}
                className={cn(
                  'min-h-8 rounded-lg text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-45 sm:min-h-9 sm:text-base',
                  cls,
                  sc?.score === v && 'ring-2 ring-primary ring-offset-1 ring-offset-background dark:ring-offset-card',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:thin]">
            {Array.from({ length: c.maxScore + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => onQuickScore(sk, c.id, i)}
                className={cn(
                  'flex size-8 shrink-0 snap-start items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-[0.96] disabled:opacity-45 sm:size-9 sm:text-sm',
                  sc?.score === i ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/80 hover:bg-muted',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(88dvh,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.35rem] border border-border bg-card shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-start gap-2 border-b border-border/80 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10 sm:size-11">
            <StudentMascotIcon studentId={student.id} className="size-10 sm:size-11" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-sm font-bold leading-tight tracking-tight">{given}</p>
            {familyUpper ? <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{familyUpper}</p> : null}
            <p className="mt-0.5 text-[10px] text-muted-foreground">{total} kriter · bugün</p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg sm:size-9" title="Özet ve geçmiş" onClick={() => onOpenDetail(student)}>
              <Info className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg sm:size-9" onClick={onClose} aria-label="Kapat">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="border-b border-border/60 bg-muted/5 px-3 py-2 sm:px-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Bugün · hızlı not</p>
            <p className="text-[10px] font-medium tabular-nums text-muted-foreground/90">
              {format(new Date(`${today}T12:00:00`), 'd MMM', { locale: tr })}
            </p>
          </div>
          <StudentEvalQuickCards
            variant="sheet"
            studentId={student.id}
            studentName={student.name}
            today={today}
            notes={evalNotes}
            onAdd={onEvalQuickNote}
            onOpenNotes={onOpenNotesDetail ? () => onOpenNotesDetail(student) : undefined}
          />
        </div>

        <div className="border-b border-border/80 px-3 py-1.5 sm:px-4 sm:py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kriter filtrele…"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-2.5 text-xs sm:h-9"
            />
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 sm:px-4"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {lessonF.length === 0 && behaviorF.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Eşleşen kriter yok.</p>
          ) : (
            <div className="space-y-2.5 pb-2">
              {lessonF.length > 0 && (
                <section>
                  <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Ders</p>
                  <div className="space-y-1.5">{lessonF.map((c) => row(c, false))}</div>
                </section>
              )}
              {behaviorF.length > 0 && (
                <section>
                  <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Davranış</p>
                  <div className="space-y-1.5">{behaviorF.map((c) => row(c, true))}</div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
