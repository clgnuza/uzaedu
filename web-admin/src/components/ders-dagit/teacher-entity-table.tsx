'use client';

import { useMemo } from 'react';
import { DdMiniWeekGrid } from '@/components/ders-dagit/dd-mini-week-grid';
import { ddVariantAt, type CardPastelVariant } from '@/components/ders-dagit/dd-ui';

const DOT: Record<CardPastelVariant, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  sky: 'bg-sky-500',
  lavender: 'bg-purple-500',
  mint: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  peach: 'bg-orange-500',
  default: 'bg-primary',
};
import type { TeacherConfig } from '@/components/ders-dagit/teacher-config-types';
import { cn } from '@/lib/utils';

function shortName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '—';
  if (p.length === 1) return p[0]!.slice(0, 6).toUpperCase();
  return (p[0]!.slice(0, 3) + p[p.length - 1]!.slice(0, 3)).toUpperCase();
}

function totalHours(t: TeacherConfig): string {
  const m = t.mandatory_weekly_hours;
  const e = t.max_extra_weekly_hours;
  if (m == null && e == null) return '—';
  if (e != null && e > 0) return `${m ?? 0}+${e}`;
  return String(m ?? 0);
}

type Props = {
  teachers: TeacherConfig[];
  colorIndex: Map<string, number>;
  activeId: string | null;
  workDays: number[];
  maxLessons: number;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  onTimeTableClick?: (id: string) => void;
};

export function TeacherEntityTable({
  teachers,
  colorIndex,
  activeId,
  workDays,
  maxLessons,
  query,
  onQueryChange,
  onSelect,
  onDoubleClick,
  onTimeTableClick,
}: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return teachers;
    return teachers.filter((t) => (t.display_name ?? t.user_id).toLocaleLowerCase('tr').includes(q));
  }, [teachers, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <input
          type="search"
          placeholder="Bul…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full max-w-xs rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <table className="w-full min-w-[24rem] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-sm">
          <tr>
            <th className="px-2 py-2 w-8" />
            <th className="px-2 py-2">Adı</th>
            <th className="px-2 py-2 hidden sm:table-cell">Kısa</th>
            <th className="px-2 py-2 text-right">Toplam</th>
            <th className="px-2 py-2">Zaman</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => {
            const name = t.display_name ?? t.user_id;
            const active = t.id === activeId;
            const variant = ddVariantAt(colorIndex.get(t.id) ?? 0);
            return (
              <tr
                key={t.id}
                className={cn(
                  'cursor-pointer border-t transition-colors hover:bg-muted/40',
                  active && 'bg-primary/10',
                )}
                onClick={() => onSelect(t.id)}
                onDoubleClick={() => onDoubleClick?.(t.id)}
              >
                <td className="px-2 py-1.5">
                  <span className={cn('inline-block size-3 rounded-sm', DOT[variant])} aria-hidden />
                </td>
                <td className="px-2 py-1.5 font-medium">{name}</td>
                <td className="px-2 py-1.5 hidden sm:table-cell text-muted-foreground">{shortName(name)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{totalHours(t)}</td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    className="rounded border border-transparent p-0.5 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                    title="Zaman tablosu"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimeTableClick?.(t.id);
                    }}
                  >
                    <DdMiniWeekGrid
                      mode="teacher"
                      workDays={workDays}
                      maxLessons={maxLessons}
                      periods={t.unavailable_periods}
                    />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
