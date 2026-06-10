'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Clock, GraduationCap, History, Sparkles, Target, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { splitStudentNameForCard } from '../lib/student-avatar';
import { StudentMascotIcon } from '../lib/student-mascot-icon';
import { StudentEvalQuickCards, type EvalQuickKind } from './student-eval-quick-cards';

type Student = { id: string; name: string };
type StudentNote = {
  id: string;
  noteType: string;
  noteDate: string;
  description?: string | null;
  createdAt?: string;
};
type Score = {
  id: string;
  noteDate: string;
  score: number;
  note?: string | null;
  createdAt?: string;
  criterion?: {
    name: string;
    scoreType?: 'numeric' | 'sign';
    maxScore?: number;
    criterionCategory?: 'lesson' | 'behavior';
  };
};

type Tab = 'all' | 'notes' | 'scores';

type TimelineItem =
  | {
      kind: 'note';
      id: string;
      sortKey: string;
      date: string;
      noteType: string;
      description?: string;
    }
  | {
      kind: 'score';
      id: string;
      sortKey: string;
      date: string;
      criterionName: string;
      score: number;
      scoreType?: 'numeric' | 'sign';
      maxScore?: number;
      criterionCategory?: 'lesson' | 'behavior';
      note?: string;
    };

function scoreLabel(scoreType: 'numeric' | 'sign' | undefined, score: number): string {
  if (scoreType === 'sign') {
    if (score === 1) return '+';
    if (score === -1) return '−';
    return '·';
  }
  return String(score);
}

function scoreStatus(scoreType: 'numeric' | 'sign' | undefined, score: number, maxScore?: number): string {
  if (scoreType === 'sign') {
    if (score === 1) return 'Olumlu';
    if (score === -1) return 'Olumsuz';
    return 'Nötr';
  }
  return `${score} / ${maxScore ?? '?'}`;
}

function formatDayLabel(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd || '—';
  return format(d, 'd MMMM yyyy, EEEE', { locale: tr });
}

export function StudentDetailModal({
  student,
  notes,
  scores,
  today,
  onClose,
  onAddEvalQuick,
}: {
  student: Student;
  notes: StudentNote[];
  scores: Score[];
  today: string;
  onClose: () => void;
  onAddEvalQuick: (kind: EvalQuickKind, e?: MouseEvent) => void;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const { given, familyUpper } = splitStudentNameForCard(student.name);

  const pos = notes.filter((n) => n.noteType === 'positive').length;
  const neg = notes.filter((n) => n.noteType === 'negative').length;

  const items = useMemo(() => {
    const list: TimelineItem[] = [
      ...notes.map((n) => ({
        kind: 'note' as const,
        id: n.id,
        date: n.noteDate,
        sortKey: `${n.noteDate ?? ''}\t${n.createdAt ?? ''}\tnote`,
        noteType: n.noteType,
        description: n.description ?? undefined,
      })),
      ...scores.map((s) => ({
        kind: 'score' as const,
        id: s.id,
        date: s.noteDate,
        sortKey: `${s.noteDate ?? ''}\t${s.createdAt ?? ''}\tscore`,
        criterionName: s.criterion?.name ?? 'Kriter',
        score: s.score,
        scoreType: s.criterion?.scoreType,
        maxScore: s.criterion?.maxScore,
        criterionCategory: s.criterion?.criterionCategory,
        note: s.note ?? undefined,
      })),
    ];
    return list.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [notes, scores]);

  const filtered = useMemo(() => {
    if (tab === 'notes') return items.filter((i) => i.kind === 'note');
    if (tab === 'scores') return items.filter((i) => i.kind === 'score');
    return items;
  }, [items, tab]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const it of filtered) {
      const key = it.date?.slice(0, 10) ?? '—';
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'Tümü', count: items.length },
    { id: 'notes', label: 'Notlar', count: notes.length },
    { id: 'scores', label: 'Kriterler', count: scores.length },
  ];

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.35rem] border border-border bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-detail-title"
      >
        <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />

        <div className="relative overflow-hidden border-b border-border/60 bg-linear-to-br from-teal-500/12 via-cyan-500/6 to-violet-500/10 px-3 pb-3 pt-2.5 dark:from-teal-950/40 dark:via-cyan-950/20 dark:to-violet-950/25 sm:px-4 sm:pb-4 sm:pt-3">
          <span className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-teal-400/20 blur-2xl" aria-hidden />
          <div className="relative flex items-start gap-2.5">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-2 ring-white/80 dark:bg-zinc-800 dark:ring-white/10 sm:size-14">
              <StudentMascotIcon studentId={student.id} className="size-12 sm:size-14" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p id="student-detail-title" className="truncate text-sm font-extrabold tracking-tight sm:text-base">
                {given}
              </p>
              {familyUpper ? (
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                  {familyUpper}
                </p>
              ) : null}
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground sm:text-xs">
                <History className="size-3 shrink-0 opacity-70" aria-hidden />
                Özet ve geçmiş
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-xl sm:size-9" onClick={onClose} aria-label="Kapat">
              <X className="size-4" />
            </Button>
          </div>

          <div className="relative mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
            {[
              { label: 'Olumlu', value: pos, cls: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' },
              { label: 'Olumsuz', value: neg, cls: 'border-rose-300/50 bg-rose-500/10 text-rose-800 dark:text-rose-200' },
              { label: 'Kriter', value: scores.length, cls: 'border-violet-300/50 bg-violet-500/10 text-violet-800 dark:text-violet-200' },
              { label: 'Toplam', value: items.length, cls: 'border-teal-300/50 bg-teal-500/10 text-teal-800 dark:text-teal-200' },
            ].map((k) => (
              <div key={k.label} className={cn('rounded-xl border px-1.5 py-1.5 text-center shadow-xs sm:px-2 sm:py-2', k.cls)}>
                <p className="text-[8px] font-bold uppercase tracking-wide opacity-80 sm:text-[9px]">{k.label}</p>
                <p className="text-base font-black tabular-nums leading-none sm:text-lg">{k.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-b border-border/60 bg-muted/5 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Bugün · hızlı</p>
            <p className="text-[10px] font-medium tabular-nums text-muted-foreground/90">
              {format(new Date(`${today}T12:00:00`), 'd MMM', { locale: tr })}
            </p>
          </div>
          <StudentEvalQuickCards
            variant="sheet"
            hideNotesLink
            studentId={student.id}
            studentName={student.name}
            today={today}
            notes={notes.map((n) => ({ ...n, studentId: student.id }))}
            onAdd={onAddEvalQuick}
          />
        </div>

        <div className="border-b border-border/70 px-3 py-2 sm:px-4">
          <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/20 p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'min-h-8 flex-1 rounded-lg px-2 text-[11px] font-semibold transition-colors sm:text-xs',
                  tab === t.id
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-teal-500/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                <span className="ml-1 tabular-nums opacity-70">({t.count})</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Clock className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-sm font-medium text-muted-foreground">
                {tab === 'all' ? 'Henüz kayıt yok.' : tab === 'notes' ? 'Not kaydı yok.' : 'Kriter puanı yok.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([day, dayItems]) => (
                <section key={day}>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-teal-500" aria-hidden />
                    {formatDayLabel(day)}
                  </p>
                  <ul className="relative space-y-2 pl-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border/80">
                    {dayItems.map((it) => (
                      <li key={`${it.kind}-${it.id}`} className="relative pl-4">
                        <span
                          className={cn(
                            'absolute left-0 top-3.5 size-2.5 -translate-x-[3px] rounded-full ring-2 ring-card',
                            it.kind === 'note'
                              ? it.noteType === 'positive'
                                ? 'bg-emerald-500'
                                : 'bg-rose-500'
                              : it.criterionCategory === 'behavior'
                                ? 'bg-emerald-600'
                                : 'bg-violet-500',
                          )}
                          aria-hidden
                        />
                        {it.kind === 'note' ? (
                          <div
                            className={cn(
                              'rounded-2xl border p-3 shadow-xs backdrop-blur-sm',
                              it.noteType === 'positive'
                                ? 'border-emerald-200/60 bg-emerald-500/6 dark:border-emerald-900/40'
                                : 'border-rose-200/60 bg-rose-500/6 dark:border-rose-900/40',
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={cn(
                                  'flex size-8 shrink-0 items-center justify-center rounded-xl',
                                  it.noteType === 'positive'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                                )}
                              >
                                {it.noteType === 'positive' ? (
                                  <ThumbsUp className="size-4" aria-hidden />
                                ) : (
                                  <ThumbsDown className="size-4" aria-hidden />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-foreground">
                                  {it.noteType === 'positive' ? 'Olumlu not' : 'Olumsuz not'}
                                </p>
                                {it.description ? (
                                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{it.description}</p>
                                ) : (
                                  <p className="mt-0.5 text-[10px] italic text-muted-foreground/80">Açıklama yok</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'rounded-2xl border p-3 shadow-xs backdrop-blur-sm',
                              it.criterionCategory === 'behavior'
                                ? 'border-emerald-200/60 bg-emerald-500/5 dark:border-emerald-900/40'
                                : 'border-violet-200/60 bg-violet-500/5 dark:border-violet-900/40',
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={cn(
                                  'flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-black',
                                  it.criterionCategory === 'behavior'
                                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                                    : 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
                                )}
                              >
                                {scoreLabel(it.scoreType, it.score)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-xs font-bold leading-snug text-foreground">{it.criterionName}</p>
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase',
                                      it.criterionCategory === 'behavior'
                                        ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                                        : 'bg-violet-500/12 text-violet-800 dark:text-violet-200',
                                    )}
                                  >
                                    {it.criterionCategory === 'behavior' ? (
                                      <Sparkles className="size-2.5" aria-hidden />
                                    ) : (
                                      <GraduationCap className="size-2.5" aria-hidden />
                                    )}
                                    {it.criterionCategory === 'behavior' ? 'Davranış' : 'Ders'}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                                  {scoreStatus(it.scoreType, it.score, it.maxScore)}
                                </p>
                                {it.note ? (
                                  <p className="mt-1.5 rounded-lg border border-border/50 bg-background/60 px-2 py-1 text-[10px] leading-snug text-muted-foreground">
                                    {it.note}
                                  </p>
                                ) : null}
                              </div>
                              <Target className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
