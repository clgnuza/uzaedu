'use client';

import { useMemo } from 'react';
import { GraduationCap, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { entryCellColor } from '@/lib/timetable-colors';
import {
  MATRIX_CLASS_CELL,
  MATRIX_CLASS_ROW_ACCENT,
  MATRIX_CLASS_ROW_BG,
  MATRIX_TEACHER_AVATAR,
  MATRIX_TEACHER_CELL,
  MATRIX_TEACHER_ROW_ACCENT,
  MATRIX_TEACHER_ROW_BG,
  matrixToneIndex,
} from '@/lib/timetable-matrix-tones';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export type MatrixAxis = 'teacher' | 'class' | 'room';

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

function teacherRowKey(e: EditorEntry): string {
  if (e.user_id) return `u:${e.user_id}`;
  const lb = (e.teacher_label ?? '').trim();
  return lb ? `l:${lb}` : 'l:?';
}

function displayRowName(raw: string): string {
  const s = raw.trim();
  if (!s) return '—';
  if (s.includes('@')) return s.split('@')[0]!.replace(/[._]/g, ' ').trim() || s;
  return s;
}

function rowInitials(name: string): string {
  const parts = displayRowName(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return displayRowName(name).slice(0, 2).toUpperCase();
}

function lessonNumsForRow(
  rowKey: string,
  lessonNums: number[],
  cellMap: Map<string, EditorEntry[]>,
  days: number[],
  hideEmpty: boolean,
): number[] {
  if (!hideEmpty) return lessonNums;
  const used = lessonNums.filter((ln) =>
    days.some((d) => (cellMap.get(`${rowKey}|${d}|${ln}`)?.length ?? 0) > 0),
  );
  return used.length > 0 ? used : lessonNums.slice(0, 1);
}

function MatrixMiniCell({
  entry,
  axis,
  toneIdx,
}: {
  entry: EditorEntry;
  axis: MatrixAxis;
  toneIdx: number;
}) {
  const line1 =
    axis === 'teacher'
      ? entry.class_section
      : axis === 'class'
        ? (entry.teacher_label?.trim() || '—')
        : entry.class_section;
  const line2 = entry.subject;
  const subShort = line2.replace(/\s+/g, ' ').trim();
  const sub = subShort.length > 16 ? `${subShort.slice(0, 14)}…` : subShort;

  const teacherTone = MATRIX_TEACHER_CELL[matrixToneIndex(toneIdx, MATRIX_TEACHER_CELL.length)];
  const classTone = MATRIX_CLASS_CELL[matrixToneIndex(toneIdx, MATRIX_CLASS_CELL.length)];
  const fallback = entryCellColor(entry, axis === 'teacher' ? 'teacher' : axis === 'room' ? 'room' : 'class');

  const useToneClass = axis === 'teacher' || axis === 'class';
  const toneClass = axis === 'teacher' ? teacherTone : classTone;

  return (
    <div
      className={cn(
        'min-w-[4rem] rounded-md border px-1 py-0.5 leading-tight',
        useToneClass ? toneClass : 'shadow-sm',
      )}
      style={
        useToneClass
          ? undefined
          : {
              borderLeftWidth: 3,
              borderLeftColor: fallback.border,
              backgroundColor: fallback.bg,
              color: fallback.text,
            }
      }
      title={`${line1} · ${line2}${entry.room_name ? ` · ${entry.room_name}` : ''}`}
    >
      <div className="truncate text-[10px] font-bold leading-tight">{line1}</div>
      {sub ? <div className="truncate text-[9px] leading-tight opacity-90">{sub}</div> : null}
    </div>
  );
}

function MatrixRowLabel({
  name,
  rowIdx,
  axis,
}: {
  name: string;
  rowIdx: number;
  axis: MatrixAxis;
}) {
  const label = displayRowName(name);
  const ti = matrixToneIndex(rowIdx, MATRIX_TEACHER_ROW_ACCENT.length);

  if (axis === 'class') {
    const cti = matrixToneIndex(rowIdx, MATRIX_CLASS_ROW_ACCENT.length);
    return (
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 border-l-[4px] py-0.5 pl-2',
          MATRIX_CLASS_ROW_ACCENT[cti],
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-800 dark:text-orange-200">
          <GraduationCap className="size-3.5" aria-hidden />
        </span>
        <span className="line-clamp-2 text-[11px] font-bold leading-snug text-foreground" title={label}>
          {label}
        </span>
      </div>
    );
  }

  if (axis === 'room') {
    return (
      <div className="flex min-w-0 items-center gap-2 border-l-[4px] border-l-emerald-500 py-0.5 pl-2">
        <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground" title={label}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 border-l-[4px] py-0.5 pl-2',
        MATRIX_TEACHER_ROW_ACCENT[ti],
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold shadow-sm',
          MATRIX_TEACHER_AVATAR[ti],
        )}
      >
        {rowInitials(label)}
      </span>
      <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground" title={label}>
        {label}
      </span>
    </div>
  );
}

export function TimetableMatrixGrid({
  entries,
  workDays,
  maxLesson,
  axis,
  teachers = [],
  classSections = [],
  rooms = [],
  clashIds = new Set<string>(),
  zoom = 100,
  hideEmptyLessonRows = true,
}: {
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
  axis: MatrixAxis;
  teachers?: Array<{ id: string; label: string }>;
  classSections?: string[];
  rooms?: Array<{ id: string; name: string }>;
  clashIds?: Set<string>;
  zoom?: number;
  hideEmptyLessonRows?: boolean;
}) {
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  const lessonNums = useMemo(
    () => Array.from({ length: Math.max(1, maxLesson) }, (_, i) => i + 1),
    [maxLesson],
  );

  const { rowKeys, rowLabel } = useMemo(() => {
    const labelOf = new Map<string, string>();
    const keys = new Set<string>();

    if (axis === 'teacher') {
      for (const t of teachers) {
        const k = `u:${t.id}`;
        keys.add(k);
        labelOf.set(k, t.label);
      }
      for (const e of entries) {
        const k = teacherRowKey(e);
        keys.add(k);
        if (!labelOf.has(k)) labelOf.set(k, e.teacher_label?.trim() || '—');
      }
    } else if (axis === 'class') {
      for (const s of classSections) keys.add(`c:${s}`);
      for (const e of entries) {
        const s = e.class_section.trim();
        if (s) keys.add(`c:${s}`);
      }
      for (const k of keys) labelOf.set(k, k.slice(2));
    } else {
      for (const r of rooms) {
        keys.add(`r:${r.id}`);
        labelOf.set(`r:${r.id}`, r.name);
      }
      if (entries.some((e) => !e.room_id)) {
        keys.add('r:__none__');
        labelOf.set('r:__none__', '(Derslik yok)');
      }
      for (const e of entries) {
        if (e.room_id) keys.add(`r:${e.room_id}`);
      }
    }

    const sorted = [...keys].sort((a, b) =>
      (labelOf.get(a) ?? a).localeCompare(labelOf.get(b) ?? b, 'tr', { numeric: true }),
    );
    return { rowKeys: sorted, rowLabel: labelOf };
  }, [axis, entries, teachers, classSections, rooms]);

  const cellMap = useMemo(() => {
    const m = new Map<string, EditorEntry[]>();
    for (const e of entries) {
      let rk: string;
      if (axis === 'teacher') rk = teacherRowKey(e);
      else if (axis === 'class') rk = `c:${e.class_section.trim()}`;
      else rk = e.room_id ? `r:${e.room_id}` : 'r:__none__';
      const ck = `${rk}|${e.day_of_week}|${e.lesson_num}`;
      const arr = m.get(ck) ?? [];
      arr.push(e);
      m.set(ck, arr);
    }
    return m;
  }, [entries, axis]);

  const axisLabel = axis === 'teacher' ? 'Öğretmen' : axis === 'class' ? 'Sınıf' : 'Derslik';
  const countLabel =
    axis === 'teacher'
      ? `${rowKeys.length} öğretmen`
      : axis === 'class'
        ? `${rowKeys.length} sınıf`
        : `${rowKeys.length} derslik`;

  if (rowKeys.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Görüntülenecek {axisLabel.toLowerCase()} yok.
      </div>
    );
  }

  return (
    <div
      className="timetable-print-root overflow-auto rounded-xl border border-border bg-card shadow-sm"
      style={{ zoom: zoom / 100 }}
      data-timetable-view={`matrix-${axis}`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {axis === 'teacher' ? (
          <UserRound className="size-3.5 shrink-0 text-violet-600" aria-hidden />
        ) : (
          <GraduationCap className="size-3.5 shrink-0 text-orange-600" aria-hidden />
        )}
        <span className="font-semibold text-foreground">{countLabel}</span>
        <span>·</span>
        <span>{entries.length} ders</span>
        {axis === 'teacher' && (
          <span className="hidden sm:inline">· her öğretmen farklı renk</span>
        )}
      </div>
      <table className="w-full min-w-[600px] border-collapse text-[10px]">
        <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm">
          <tr>
            <th className="sticky left-0 z-30 min-w-[8.5rem] max-w-[10rem] border-b border-r border-border bg-muted/95 px-2 py-1.5 text-left text-[11px] font-semibold">
              {axisLabel}
            </th>
            <th className="w-6 border-b border-r border-border bg-muted/95 px-0.5 py-1.5 text-center text-[10px] font-semibold text-muted-foreground">
              #
            </th>
            {days.map((d, i) => (
              <th
                key={d}
                className={cn(
                  'min-w-[4.5rem] border-b border-r border-border px-0.5 py-1.5 text-center text-[10px] font-semibold',
                  i % 2 === 1 && 'bg-muted/50',
                )}
              >
                {DAY_SHORT[d - 1] ?? d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.flatMap((rowKey, rowIdx) => {
            const name = rowLabel.get(rowKey) ?? rowKey;
            const rows = lessonNumsForRow(rowKey, lessonNums, cellMap, days, hideEmptyLessonRows);
            const rowBg =
              axis === 'teacher'
                ? MATRIX_TEACHER_ROW_BG[matrixToneIndex(rowIdx, MATRIX_TEACHER_ROW_BG.length)]
                : axis === 'class'
                  ? MATRIX_CLASS_ROW_BG[matrixToneIndex(rowIdx, MATRIX_CLASS_ROW_BG.length)]
                  : rowIdx % 2 === 0
                    ? 'bg-card'
                    : 'bg-muted/15';
            return rows.map((ln, lessonIdx) => (
              <tr
                key={`${rowKey}-${ln}`}
                className={cn(
                  rowBg,
                  lessonIdx === 0 && rowIdx > 0 && 'border-t-2 border-border/80',
                )}
              >
                <td
                  className={cn(
                    'sticky left-0 z-10 border-b border-r border-border bg-inherit px-1 py-1 align-middle',
                    lessonIdx > 0 && 'border-l-4 border-l-transparent',
                  )}
                >
                  {lessonIdx === 0 ? (
                    <MatrixRowLabel name={name} rowIdx={rowIdx} axis={axis} />
                  ) : (
                    <span className="block pl-9 text-[9px] tabular-nums text-muted-foreground/50" aria-hidden>
                      ·
                    </span>
                  )}
                </td>
                <td className="border-b border-r border-border px-0.5 py-1 text-center text-[10px] font-medium tabular-nums text-muted-foreground">
                  {ln}
                </td>
                {days.map((day) => {
                  const cells = cellMap.get(`${rowKey}|${day}|${ln}`) ?? [];
                  const hasClash = cells.some((c) => clashIds.has(c.id));
                  return (
                    <td key={day} className="border-b border-r border-border px-0.5 py-0.5 align-top">
                      {cells.length === 0 ? (
                        <span className="block py-2 text-center text-[8px] text-muted-foreground/30">·</span>
                      ) : (
                        <div className={cn('flex flex-col gap-0.5', hasClash && 'rounded-md ring-2 ring-destructive/80')}>
                          {cells.map((c) => (
                            <MatrixMiniCell key={c.id} entry={c} axis={axis} toneIdx={rowIdx} />
                          ))}
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
  );
}
