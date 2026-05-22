'use client';

import { useMemo } from 'react';
import { DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RoomRow = {
  id: string;
  name: string;
  capacity: number | null;
  building_id: string | null;
  allowed_subjects?: string[] | null;
};

type Props = {
  rooms: RoomRow[];
  buildingName: (id: string | null) => string;
  activeId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  /** roomId → bu derslikteki atama sayısı */
  assignmentCount?: (roomId: string) => number;
};

export function RoomEntityTable({
  rooms,
  buildingName,
  activeId,
  query,
  onQueryChange,
  onSelect,
  assignmentCount,
}: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rooms;
    return rooms.filter((r) => r.name.toLocaleLowerCase('tr').includes(q));
  }, [rooms, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <input
          type="search"
          placeholder="Bul: derslik…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full max-w-xs rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <table className="w-full min-w-[22rem] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-sm">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="px-2 py-2">Adı</th>
            <th className="hidden px-2 py-2 sm:table-cell">Kısa</th>
            <th className="px-2 py-2 text-right">Atama</th>
            <th className="hidden px-2 py-2 text-right sm:table-cell">Kapasite</th>
            <th className="px-2 py-2">Bina</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const active = r.id === activeId;
            const short = r.name.length > 8 ? r.name.slice(0, 6) + '…' : r.name;
            return (
              <tr
                key={r.id}
                className={cn('cursor-pointer border-t hover:bg-muted/40', active && 'bg-primary/10')}
                onClick={() => onSelect(r.id)}
              >
                <td className="px-2 py-1.5">
                  <DoorOpen className="size-4 text-orange-600" aria-hidden />
                </td>
                <td className="px-2 py-1.5 font-medium">{r.name}</td>
                <td className="hidden px-2 py-1.5 text-muted-foreground sm:table-cell">{short}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                  {assignmentCount ? assignmentCount(r.id) : '—'}
                </td>
                <td className="hidden px-2 py-1.5 text-right tabular-nums sm:table-cell">{r.capacity ?? '—'}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{buildingName(r.building_id)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
