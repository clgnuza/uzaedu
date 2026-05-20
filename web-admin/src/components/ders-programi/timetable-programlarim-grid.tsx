'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { displayNameForTimetableRowKey, shortTeacherColumnLabel } from '@/lib/timetable-teacher-key';
import { resolveSchoolSubjectDisplay } from '@/lib/school-subject-display';
import type { SchoolSubject } from '@/hooks/use-school-classes-subjects';
import { displayTimetableClass } from '@/lib/timetable-class-display';
import { TimetableClassGrid } from '@/components/ders-programi/timetable-class-grid';

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'] as const;
const WEEK_DAYS = [1, 2, 3, 4, 5] as const;

/** Öğretmen başına ayırt edici kart rengi */
const TEACHER_TONES = [
  'border-sky-300/80 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/55 dark:text-sky-50',
  'border-emerald-300/80 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-50',
  'border-violet-300/80 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/55 dark:text-violet-50',
  'border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/55 dark:text-amber-50',
  'border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/55 dark:text-rose-50',
  'border-cyan-300/80 bg-cyan-50 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950/55 dark:text-cyan-50',
  'border-orange-300/80 bg-orange-50 text-orange-950 dark:border-orange-700 dark:bg-orange-950/55 dark:text-orange-50',
  'border-fuchsia-300/80 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-700 dark:bg-fuchsia-950/55 dark:text-fuchsia-50',
] as const;

const TEACHER_COL_TINT = [
  'bg-sky-50/80 dark:bg-sky-950/35',
  'bg-emerald-50/80 dark:bg-emerald-950/35',
  'bg-violet-50/80 dark:bg-violet-950/35',
  'bg-amber-50/80 dark:bg-amber-950/35',
  'bg-rose-50/80 dark:bg-rose-950/35',
  'bg-cyan-50/80 dark:bg-cyan-950/35',
  'bg-orange-50/80 dark:bg-orange-950/35',
  'bg-fuchsia-50/80 dark:bg-fuchsia-950/35',
] as const;

const TEACHER_NAME_ACCENT = [
  'border-l-sky-500',
  'border-l-emerald-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-orange-500',
  'border-l-fuchsia-500',
] as const;

const TEACHER_TOP_ACCENT = [
  'border-t-sky-500',
  'border-t-emerald-500',
  'border-t-violet-500',
  'border-t-amber-500',
  'border-t-rose-500',
  'border-t-cyan-500',
  'border-t-orange-500',
  'border-t-fuchsia-500',
] as const;

type TeacherLookup = { id: string; display_name: string | null; email: string; duty_exempt?: boolean };

type CellData = { class_section: string; subject: string };

type Props = {
  viewMode: 'teacher' | 'day' | 'class';
  map: Map<string, Map<string, CellData>>;
  lessonNums: number[];
  teacherRowKeys: string[];
  teachers: TeacherLookup[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  classGridEntries: Parameters<typeof TimetableClassGrid>[0]['entries'];
  schoolSubjects?: SchoolSubject[];
  hideEmptyLessonRows?: boolean;
};

function lessonNumsForTeacher(
  rowKey: string,
  lessonNums: number[],
  map: Map<string, Map<string, CellData>>,
  hideEmpty: boolean,
): number[] {
  if (!hideEmpty) return lessonNums;
  const used = lessonNums.filter((ln) =>
    WEEK_DAYS.some((d) => map.get(`${rowKey}-${d}`)?.get(String(ln))),
  );
  return used.length > 0 ? used : lessonNums.slice(0, 1);
}

function CompactCell({
  class_section,
  subject,
  toneIdx,
}: CellData & { toneIdx: number }) {
  const cls = displayTimetableClass(class_section, subject) || '—';
  const sub = (subject || '').trim();
  const tone = TEACHER_TONES[toneIdx % TEACHER_TONES.length];
  return (
    <div
      className={cn('min-w-[4.25rem] rounded border px-1 py-0.5 shadow-sm', tone)}
      title={sub ? `${cls} · ${sub}` : cls}
    >
      <div className="whitespace-nowrap text-[10px] font-bold leading-tight">{cls}</div>
      {sub ? <div className="truncate text-[9px] leading-tight opacity-90">{sub}</div> : null}
    </div>
  );
}

function EmptyCell() {
  return <span className="text-[9px] text-muted-foreground/40">·</span>;
}

export function TimetableProgramlarimGrid({
  viewMode,
  map,
  lessonNums,
  teacherRowKeys,
  teachers,
  selectedDay,
  onSelectDay,
  classGridEntries,
  schoolSubjects,
  hideEmptyLessonRows = true,
}: Props) {
  const resolveRowLabel = (rowKey: string) =>
    displayNameForTimetableRowKey(rowKey, (id) => {
      const t = teachers.find((x) => x.id === id);
      return t?.display_name ?? t?.email;
    });

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  if (viewMode === 'class') {
    return (
      <TimetableClassGrid
        entries={classGridEntries}
        teachers={teachers}
        lessonNums={lessonNums}
        schoolSubjects={schoolSubjects}
        compact
      />
    );
  }

  if (teacherRowKeys.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-xs text-muted-foreground">
        Filtreye uyan kayıt yok.
      </div>
    );
  }

  if (viewMode === 'teacher') {
    return (
      <div className="table-x-scroll max-h-[min(72vh,720px)] overflow-auto bg-muted/20">
        <table className="w-full min-w-[520px] border-collapse text-[10px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/95 backdrop-blur-sm">
              <th className="sticky left-0 z-30 min-w-[72px] border-b border-r border-border/80 bg-muted/95 px-1.5 py-1 text-left font-semibold text-muted-foreground">
                Öğr.
              </th>
              <th className="w-5 border-b border-r border-border/80 px-0.5 py-1 text-center font-semibold text-muted-foreground">
                #
              </th>
              {DAY_SHORT.map((d, i) => (
                <th
                  key={d}
                  className={cn(
                    'min-w-[76px] border-b border-r border-border/80 px-0.5 py-1 text-center font-semibold text-muted-foreground',
                    i % 2 === 1 && 'bg-muted/70',
                    i === 4 && 'border-r-0',
                  )}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teacherRowKeys.flatMap((rowKey, teacherIdx) => {
              const t = rowKey.startsWith('raw:') ? undefined : teacherMap.get(rowKey);
              const name = resolveRowLabel(rowKey);
              const rows = lessonNumsForTeacher(rowKey, lessonNums, map, hideEmptyLessonRows);
              const nameAccent = TEACHER_NAME_ACCENT[teacherIdx % TEACHER_NAME_ACCENT.length];
              const rowTint = TEACHER_COL_TINT[teacherIdx % TEACHER_COL_TINT.length];
              return rows.map((ln, lessonIdx) => (
                <tr
                  key={`${rowKey}-${ln}`}
                  className={cn(lessonIdx === 0 && teacherIdx > 0 && 'border-t-2 border-border', rowTint)}
                >
                  <td
                    className={cn(
                      'sticky left-0 z-10 border-b border-r border-border/60 border-l-[3px] bg-inherit px-1.5 py-0.5',
                      nameAccent,
                      lessonIdx === 0 ? 'font-medium' : 'text-transparent select-none',
                    )}
                  >
                    {lessonIdx === 0 ? (
                      <span className="flex max-w-[72px] items-center gap-0.5" title={name}>
                        <span className="truncate">{name}</span>
                        {t?.duty_exempt ? (
                          <span className="shrink-0 rounded bg-amber-500/20 px-0.5 text-[8px] text-amber-800 dark:text-amber-200">
                            M
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      '·'
                    )}
                  </td>
                  <td className="border-b border-r border-border/60 px-0.5 py-0.5 text-center tabular-nums text-muted-foreground">
                    {ln}
                  </td>
                  {WEEK_DAYS.map((dayNum, dayIdx) => {
                    const entry = map.get(`${rowKey}-${dayNum}`)?.get(String(ln));
                    return (
                      <td
                        key={dayNum}
                        className={cn(
                          'border-b border-r border-border/60 px-0.5 py-0.5 align-top',
                          dayIdx === 4 && 'border-r-0',
                        )}
                      >
                        {entry ? (
                          <CompactCell
                            class_section={entry.class_section}
                            subject={resolveSchoolSubjectDisplay(entry.subject, schoolSubjects ?? [])}
                            toneIdx={teacherIdx}
                          />
                        ) : (
                          <EmptyCell />
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
    );
  }

  return (
    <div>
      <div className="flex border-b border-border bg-muted/40">
        {DAY_SHORT.map((d, i) => {
          const dayNum = i + 1;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDay(dayNum)}
              className={cn(
                'flex-1 px-1 py-1 text-[10px] font-semibold',
                selectedDay === dayNum
                  ? 'border-b-2 border-primary bg-card text-primary'
                  : 'text-muted-foreground hover:bg-muted/60',
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="table-x-scroll max-h-[min(72vh,720px)] overflow-auto bg-muted/20">
        <table className="w-full min-w-[480px] border-collapse text-[10px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/95 backdrop-blur-sm">
              <th className="sticky left-0 z-30 w-5 border-b border-r border-border/80 bg-muted/95 px-0.5 py-1 text-center font-semibold text-muted-foreground">
                #
              </th>
              {teacherRowKeys.map((rowKey, colIdx) => {
                const t = rowKey.startsWith('raw:') ? undefined : teacherMap.get(rowKey);
                const name = resolveRowLabel(rowKey);
                const colTint = TEACHER_COL_TINT[colIdx % TEACHER_COL_TINT.length];
                const topAccent = TEACHER_TOP_ACCENT[colIdx % TEACHER_TOP_ACCENT.length];
                return (
                  <th
                    key={rowKey}
                    className={cn(
                      'min-w-[76px] border-b border-r border-border/80 border-t-[3px] px-0.5 py-1 text-center font-semibold text-foreground',
                      colTint,
                      topAccent,
                      colIdx === teacherRowKeys.length - 1 && 'border-r-0',
                    )}
                  >
                    <span className="mx-auto block truncate" title={name}>
                      {shortTeacherColumnLabel(rowKey, (id) => {
                        const t = teachers.find((x) => x.id === id);
                        return t?.display_name ?? t?.email;
                      })}
                    </span>
                    {t?.duty_exempt ? (
                      <span className="text-[8px] font-normal text-amber-600">M</span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lessonNums.map((ln, rowIdx) => (
              <tr key={ln} className={rowIdx % 2 === 0 ? 'bg-card' : 'bg-muted/25'}>
                <td className="sticky left-0 z-10 border-b border-r border-border/60 bg-inherit px-0.5 py-0.5 text-center text-muted-foreground">
                  {ln}
                </td>
                {teacherRowKeys.map((rowKey, colIdx) => {
                  const entry = map.get(`${rowKey}-${selectedDay}`)?.get(String(ln));
                  const colTint = TEACHER_COL_TINT[colIdx % TEACHER_COL_TINT.length];
                  return (
                    <td
                      key={rowKey}
                      className={cn(
                        'border-b border-r border-border/60 px-0.5 py-0.5 align-top',
                        colTint,
                        colIdx === teacherRowKeys.length - 1 && 'border-r-0',
                      )}
                    >
                      {entry ? (
                        <CompactCell
                          class_section={entry.class_section}
                          subject={resolveSchoolSubjectDisplay(entry.subject, schoolSubjects ?? [])}
                          toneIdx={colIdx}
                        />
                      ) : (
                        <EmptyCell />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
