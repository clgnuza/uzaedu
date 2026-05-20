'use client';

import { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { displayNameForTimetableRowKey, timetableTeacherRowKey } from '@/lib/timetable-teacher-key';
import { resolveSchoolSubjectDisplay } from '@/lib/school-subject-display';
import type { SchoolSubject } from '@/hooks/use-school-classes-subjects';

export type ClassGridEntry = {
  user_id: string | null;
  teacher_name_raw?: string | null;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

type TeacherLookup = { id: string; display_name: string | null; email: string };

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'] as const;
const WEEK_DAYS = [1, 2, 3, 4, 5] as const;

const CLASS_ACCENT = [
  'border-l-orange-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-fuchsia-500',
  'border-l-violet-500',
  'border-l-sky-500',
  'border-l-teal-500',
  'border-l-emerald-500',
] as const;

type Props = {
  entries: ClassGridEntry[];
  teachers: TeacherLookup[];
  lessonNums: number[];
  schoolSubjects?: SchoolSubject[];
  compact?: boolean;
};

export function TimetableClassGrid({ entries, teachers, lessonNums, schoolSubjects, compact }: Props) {
  const classSections = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) {
      const cls = (e.class_section || '').trim();
      if (cls) s.add(cls);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  }, [entries]);

  const cellMap = useMemo(() => {
    const m = new Map<string, { teacher: string; subject: string }>();
    for (const e of entries) {
      const cls = (e.class_section || '').trim();
      if (!cls) continue;
      const key = `${cls}|${e.day_of_week}|${e.lesson_num}`;
      const teacher = displayNameForTimetableRowKey(timetableTeacherRowKey(e), (id) => {
        const t = teachers.find((x) => x.id === id);
        return t?.display_name ?? t?.email;
      });
      m.set(key, {
        teacher,
        subject: resolveSchoolSubjectDisplay(e.subject, schoolSubjects ?? []),
      });
    }
    return m;
  }, [entries, teachers, schoolSubjects]);

  if (classSections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-orange-300/60 bg-orange-50/50 px-4 py-10 text-center text-sm text-muted-foreground dark:border-orange-800/50 dark:bg-orange-950/20">
        Sınıf bilgisi olan ders kaydı yok.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-orange-200/70 bg-linear-to-b from-orange-500/5 via-background to-background shadow-sm dark:border-orange-900/45 dark:from-orange-950/25">
      <div className="flex items-center gap-2 border-b border-orange-200/50 bg-orange-500/8 px-3 py-2.5 dark:border-orange-900/40">
        <GraduationCap className="size-4 text-orange-600 dark:text-orange-400" />
        <span className="text-xs font-semibold text-orange-900 dark:text-orange-100">
          {classSections.length} sınıf · {entries.length} ders hücresi
        </span>
      </div>
      <div className="table-x-scroll bg-orange-50/30 dark:bg-orange-950/10">
        <table className={cn('w-full text-xs', compact ? 'min-w-[720px]' : 'min-w-[900px]')}>
          <thead>
            <tr className="bg-orange-100/80 dark:bg-orange-950/40">
              <th className="sticky left-0 z-10 min-w-[5.5rem] border-b border-r border-orange-200/80 bg-orange-100/90 px-2 py-2 text-left font-semibold text-orange-900/80 dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-200/90">
                Sınıf
              </th>
              <th className="w-8 border-b border-r border-orange-200/80 px-1 py-2 text-center font-semibold text-orange-900/70 dark:border-orange-900/50">
                #
              </th>
              {DAY_SHORT.map((d, i) => (
                <th
                  key={d}
                  className={cn(
                    'min-w-[96px] border-b border-r border-orange-200/80 px-2 py-2 text-center font-semibold text-orange-900/70 dark:border-orange-900/50',
                    i % 2 === 1 && 'bg-orange-200/40 dark:bg-orange-900/25',
                    i === 4 && 'border-r-0',
                  )}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classSections.flatMap((cls, classIdx) => {
              const accent = CLASS_ACCENT[classIdx % CLASS_ACCENT.length];
              const rowBg = classIdx % 2 === 0 ? 'bg-white/90 dark:bg-zinc-900/50' : 'bg-orange-50/40 dark:bg-orange-950/15';
              return lessonNums.map((ln, lessonIdx) => (
                <tr
                  key={`${cls}-${ln}`}
                  className={cn(
                    lessonIdx === 0 && classIdx > 0 && 'border-t-2 border-t-orange-300/80 dark:border-t-orange-800/60',
                    rowBg,
                  )}
                >
                  <td
                    className={cn(
                      'sticky left-0 z-10 border-b border-r border-orange-200/70 border-l-4 bg-inherit px-3 py-1.5 dark:border-orange-900/40',
                      accent,
                      lessonIdx === 0 ? 'font-semibold' : 'pl-4 text-muted-foreground',
                    )}
                  >
                    {lessonIdx === 0 ? (
                      <span
                        className="inline-flex max-w-[5rem] whitespace-nowrap rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-bold text-orange-900 dark:text-orange-100"
                        title={cls}
                      >
                        {cls}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-r border-orange-200/60 px-1 py-1.5 text-center tabular-nums text-muted-foreground dark:border-orange-900/35">
                    {ln}
                  </td>
                  {WEEK_DAYS.map((day, dayIdx) => {
                    const cell = cellMap.get(`${cls}|${day}|${ln}`);
                    return (
                      <td
                        key={day}
                        className={cn(
                          'min-w-[76px] border-b border-r border-orange-200/60 px-1 py-1 align-top dark:border-orange-900/35',
                          dayIdx === 4 && 'border-r-0',
                        )}
                      >
                        {cell ? (
                          <div className="rounded-lg border border-orange-300/35 bg-white/90 px-2 py-1.5 shadow-sm dark:border-orange-800/40 dark:bg-orange-950/30">
                            <p className="truncate text-[11px] font-semibold leading-tight text-foreground" title={cell.teacher}>
                              {cell.teacher}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground" title={cell.subject}>
                              {cell.subject}
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-9 items-center justify-center rounded-md border border-dashed border-orange-200/50 bg-orange-50/30 dark:border-orange-900/30 dark:bg-orange-950/20">
                            <span className="text-[10px] text-muted-foreground/70">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
