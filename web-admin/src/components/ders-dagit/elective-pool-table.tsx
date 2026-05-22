'use client';

import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatClassSectionsList } from '@/lib/class-section-sort';

export type ElectivePoolRow = {
  id: string;
  name: string;
  base_section: string;
  member_sections: string[];
  subject_names: string[];
  group_id: string | null;
  weekly_hours_per_track: number;
};

type Props = {
  pools: ElectivePoolRow[];
  activeId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
};

export function ElectivePoolTable({ pools, activeId, query, onQueryChange, onSelect }: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return pools;
    return pools.filter(
      (p) =>
        p.name.toLocaleLowerCase('tr').includes(q) ||
        p.base_section.toLocaleLowerCase('tr').includes(q) ||
        p.subject_names.some((s) => s.toLocaleLowerCase('tr').includes(q)),
    );
  }, [pools, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <input
          type="search"
          placeholder="Bul: seçmeli havuz…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full max-w-xs rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[24rem] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-sm">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2">Havuz</th>
              <th className="hidden px-2 py-2 sm:table-cell">Kollar</th>
              <th className="px-2 py-2 text-right">Saat/kol</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const active = p.id === activeId;
              return (
                <tr
                  key={p.id}
                  className={cn('cursor-pointer border-t hover:bg-muted/40', active && 'bg-primary/10')}
                  onClick={() => onSelect(p.id)}
                >
                  <td className="px-2 py-1.5">
                    <Layers className="size-4 text-amber-600" aria-hidden />
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({p.base_section})</span>
                    {p.group_id ? (
                      <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] text-primary">grup</span>
                    ) : null}
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-2 py-1.5 text-xs text-muted-foreground sm:table-cell">
                    {formatClassSectionsList(p.member_sections)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.weekly_hours_per_track}</td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Havuz yok — atamalardan öner veya elle ekleyin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
