'use client';

import { useMemo } from 'react';
import { DdMiniWeekGrid } from '@/components/ders-dagit/dd-mini-week-grid';
import { DdEntityTableShell, ddEntityRowClass } from '@/components/ders-dagit/dd-entity-table-shell';
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

function weeklyLimitCell(t: TeacherConfig): { text: string; title: string; unset: boolean } {
  const m = t.mandatory_weekly_hours;
  const e = t.max_extra_weekly_hours;
  if (m == null && e == null) {
    return {
      text: 'Girilmedi',
      title: 'Haftalık yük limiti yok — öğretmeni seçip Saat limitleri sekmesinden girin.',
      unset: true,
    };
  }
  const mandatory = m ?? 0;
  if (e != null && e > 0) {
    const max = mandatory + e;
    return {
      text: `${mandatory}+${e}`,
      title: `Zorunlu ${mandatory} saat/hafta, üst sınır ${max} (ek ders en fazla ${e})`,
      unset: false,
    };
  }
  return {
    text: String(mandatory),
    title: `Zorunlu ${mandatory} saat/hafta`,
    unset: false,
  };
}

export type TeacherAssignmentStats = { count: number; hours: number };

type Props = {
  teachers: TeacherConfig[];
  colorIndex: Map<string, number>;
  activeId: string | null;
  workDays: number[];
  maxLessons: number;
  query: string;
  onQueryChange: (q: string) => void;
  /** user_id → atama sayısı ve haftalık saat */
  assignmentStats?: (userId: string) => TeacherAssignmentStats | undefined;
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
  assignmentStats,
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
    <DdEntityTableShell placeholder="Bul: öğretmen…" query={query} onQueryChange={onQueryChange}>
      <table className="dd-entity-table min-w-[24rem]">
        <thead className="dd-entity-thead">
          <tr>
            <th className="px-2 py-2 w-8" />
            <th className="px-2 py-2">Adı</th>
            <th className="px-2 py-2 hidden sm:table-cell">Kısa</th>
            <th className="px-2 py-2 text-right whitespace-nowrap" title="Haftalık zorunlu ve ek ders üst sınırı">
              Limit
            </th>
            <th className="px-2 py-2 whitespace-nowrap" title="Stüdyodaki ders atamaları (sayı ve saat/hafta)">
              Atanan
            </th>
            <th className="px-2 py-2 whitespace-nowrap" title="Haftalık uygunluk özeti">
              Uygunluk
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => {
            const name = t.display_name ?? t.user_id;
            const active = t.id === activeId;
            const variant = ddVariantAt(colorIndex.get(t.id) ?? 0);
            const asn = assignmentStats?.(t.user_id);
            const limit = weeklyLimitCell(t);
            return (
              <tr
                key={t.id}
                className={ddEntityRowClass(active)}
                onClick={() => onSelect(t.id)}
                onDoubleClick={() => onDoubleClick?.(t.id)}
              >
                <td>
                  <span className={cn('dd-entity-row-icon', DOT[variant])} aria-hidden>
                    <span className="size-2 rounded-sm bg-white/90" />
                  </span>
                </td>
                <td className="px-2 py-1.5 font-medium">{name}</td>
                <td className="px-2 py-1.5 hidden sm:table-cell text-muted-foreground">{shortName(name)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" title={limit.title}>
                  <span
                    className={cn(
                      limit.unset && 'text-[11px] font-normal italic text-muted-foreground',
                    )}
                  >
                    {limit.text}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  {asn && asn.count > 0 ? (
                    <span
                      className="dd-entity-status bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                      title={`${asn.count} ders ataması · ${asn.hours} saat/hafta`}
                    >
                      {asn.count} ders · {asn.hours} s/hf
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground" title="Henüz ders ataması yok">
                      Yok
                    </span>
                  )}
                </td>
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
      <p className="mt-2 px-1 text-[10px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground/80">Limit</span> = program üretiminde haftalık yük kotası.{' '}
        <span className="font-medium text-foreground/80">Atanan</span> = bu stüdyodaki gerçek ders atamaları.
      </p>
    </DdEntityTableShell>
  );
}
