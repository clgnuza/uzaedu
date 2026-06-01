'use client';

import { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { sortClassSections } from '@/lib/class-section-sort';
import { subjectTotalHours, type DerslerSubject } from '@/lib/dersler-studio';
import { DdEntityTableShell, ddEntityRowClass } from '@/components/ders-dagit/dd-entity-table-shell';
import { ddVariantAt, type CardPastelVariant } from '@/components/ders-dagit/dd-ui';
import { cn } from '@/lib/utils';

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

type Props = {
  subjects: DerslerSubject[];
  activeId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onDoubleClick?: (id: string) => void;
};

export function SubjectEntityTable({
  subjects,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onDoubleClick,
}: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.short_code ?? '').toLowerCase().includes(q),
    );
  }, [subjects, query]);

  return (
    <DdEntityTableShell placeholder="Bul: ders…" query={query} onQueryChange={onQueryChange}>
      <table className="dd-entity-table min-w-[28rem]">
        <thead className="dd-entity-thead">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="px-2 py-2">Adı</th>
            <th className="hidden px-2 py-2 sm:table-cell">Kısa</th>
            <th className="px-2 py-2 text-right">Toplam</th>
            <th className="px-2 py-2">Şube</th>
            <th className="px-2 py-2">Dağılım</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s, i) => {
            const active = s.id === activeId;
            const variant = ddVariantAt(i);
            const sectionKeys = sortClassSections(Object.keys(s.class_hours ?? {}));
            const secCount = sectionKeys.length;
            return (
              <tr
                key={s.id}
                className={ddEntityRowClass(active)}
                onClick={() => onSelect(s.id)}
                onDoubleClick={() => onDoubleClick?.(s.id)}
              >
                <td>
                  <span className={cn('dd-entity-row-icon', DOT[variant])}>
                    <BookOpen className="size-3.5 text-white" aria-hidden />
                  </span>
                </td>
                <td className="px-2 py-1.5 font-medium">
                  {s.name}
                  {s.is_elective ? <span className="ml-1 text-[10px] text-muted-foreground">(S)</span> : null}
                </td>
                <td className="hidden px-2 py-1.5 text-muted-foreground sm:table-cell">{s.short_code ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{subjectTotalHours(s.class_hours)}</td>
                <td className="max-w-[10rem] px-2 py-1.5 text-xs text-muted-foreground" title={sectionKeys.join(', ')}>
                  {secCount}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">İdeal</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DdEntityTableShell>
  );
}
