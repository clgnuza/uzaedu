'use client';

import { useMemo } from 'react';
import { DoorOpen } from 'lucide-react';
import { DdEntityTableShell, ddEntityRowClass } from '@/components/ders-dagit/dd-entity-table-shell';
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
    <DdEntityTableShell placeholder="Bul: derslik…" query={query} onQueryChange={onQueryChange}>
      <table className="dd-entity-table min-w-[22rem]">
        <thead className="dd-entity-thead">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="px-2 py-2">Adı</th>
            <th className="px-2 py-2 text-right">Atama</th>
            <th className="hidden px-2 py-2 text-right sm:table-cell">Kapasite</th>
            <th className="px-2 py-2">Bina</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const active = r.id === activeId;
            return (
              <tr
                key={r.id}
                className={ddEntityRowClass(active)}
                onClick={() => onSelect(r.id)}
              >
                <td>
                  <span className="dd-entity-row-icon dd-entity-row-icon-orange">
                    <DoorOpen className="size-3.5" aria-hidden />
                  </span>
                </td>
                <td className="px-2 py-1.5 font-medium">{r.name}</td>
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
    </DdEntityTableShell>
  );
}
