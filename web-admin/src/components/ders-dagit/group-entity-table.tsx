'use client';

import { useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatClassSectionsList } from '@/lib/class-section-sort';
import { groupModeLabel } from '@/lib/ders-dagit-labels';

export type GroupRow = {
  id: string;
  name: string;
  abbreviation: string;
  parallel_mode: string | null;
  member_sections: string[];
};

type Props = {
  groups: GroupRow[];
  activeId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
};

export function GroupEntityTable({ groups, activeId, query, onQueryChange, onSelect }: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLocaleLowerCase('tr').includes(q) ||
        g.abbreviation.toLocaleLowerCase('tr').includes(q) ||
        g.member_sections?.some((s) => s.toLocaleLowerCase('tr').includes(q)),
    );
  }, [groups, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <input
          type="search"
          placeholder="Bul: grup…"
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
              <th className="px-2 py-2">Ad</th>
              <th className="hidden px-2 py-2 sm:table-cell">Mod</th>
              <th className="px-2 py-2">Alt şubeler</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => {
              const active = g.id === activeId;
              return (
                <tr
                  key={g.id}
                  className={cn('cursor-pointer border-t hover:bg-muted/40', active && 'bg-primary/10')}
                  onClick={() => onSelect(g.id)}
                >
                  <td className="px-2 py-1.5">
                    <GitBranch className="size-4 text-violet-600" aria-hidden />
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({g.abbreviation})</span>
                  </td>
                  <td className="hidden px-2 py-1.5 text-xs text-muted-foreground sm:table-cell">
                    {groupModeLabel(g.parallel_mode)}
                  </td>
                  <td className="max-w-[14rem] truncate px-2 py-1.5 text-xs text-muted-foreground">
                    {formatClassSectionsList(g.member_sections) || '—'}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Kayıt yok — verilerden öner veya elle ekleyin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
