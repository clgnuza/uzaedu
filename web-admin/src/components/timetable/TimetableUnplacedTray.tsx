'use client';

import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorContext } from '@/lib/ders-dagit-timetable-api';
import { classSectionColor, entryCellInlineStyle } from '@/lib/timetable-colors';
import { TimetableUnplacedMenu } from './TimetableUnplacedMenu';

export type UnplacedRow = EditorContext['unplaced'][number];

export type UnplacedTrayActions = {
  onSelect: (row: UnplacedRow) => void;
  onFocusClass?: (row: UnplacedRow) => void;
  onFocusTeacher?: (row: UnplacedRow) => void;
  onAutoPlace?: (row: UnplacedRow) => void;
  onOpenAssignments?: (row: UnplacedRow) => void;
  onCopyInfo?: (row: UnplacedRow) => void;
};

function chunkLabel(row: UnplacedRow): string {
  const h = row.chunk_hours ?? row.remaining_hours;
  if (h >= 2) return `${h} saat blok`;
  return '1 saat';
}

function UnplacedCard({
  row,
  selected,
  disabled,
  onSelect,
  onContextMenu,
}: {
  row: UnplacedRow;
  selected: boolean;
  disabled: boolean;
  onSelect: (row: UnplacedRow) => void;
  onContextMenu: (row: UnplacedRow, e: React.MouseEvent) => void;
}) {
  const colors = classSectionColor(row.class_section);
  const style = entryCellInlineStyle(colors);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: row.pool_id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex gap-1 rounded-lg border bg-card/90 text-left shadow-sm transition-shadow',
        selected
          ? 'ring-2 ring-primary/45'
          : 'border-border/80 hover:border-primary/35 hover:shadow-md',
        isDragging && 'opacity-55',
        disabled && 'opacity-60',
      )}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: colors.border,
        backgroundColor: selected ? colors.bg : undefined,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        disabled={disabled}
        className={cn(
          'flex shrink-0 items-center self-stretch rounded-l-lg border-r border-border/60 px-1 text-muted-foreground',
          !disabled && 'cursor-grab touch-manipulation active:cursor-grabbing hover:bg-muted/50',
        )}
        aria-label="Sürükleyerek yerleştir"
        {...(!disabled ? { ...attributes, ...listeners } : {})}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        className="min-w-0 flex-1 px-2 py-1.5 text-left"
        onClick={() => onSelect(row)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(row, e);
        }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="truncate text-[11px] font-semibold leading-tight" style={{ color: style.color }}>
            {row.subject_name}
          </span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
            style={{ backgroundColor: colors.border, color: '#fff' }}
          >
            {chunkLabel(row)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] font-medium" style={{ color: colors.text }}>
          {row.class_section}
        </p>
        <p className="truncate text-[10px] text-muted-foreground/90">
          {row.teacher_label ?? 'Öğretmen atanmamış'}
          {row.pattern_label ? (
            <span className="text-muted-foreground"> · desen {row.pattern_label}</span>
          ) : null}
        </p>
      </button>
    </div>
  );
}

/** Alt panel: yerleşmemiş atama parçaları (2+1 → ayrı kartlar) */
export function TimetableUnplacedTray({
  unplaced,
  busy,
  selectedId,
  onSelect,
  onClearSelection,
  actions,
}: {
  unplaced: EditorContext['unplaced'];
  busy: boolean;
  selectedId: string | null;
  onSelect: (row: UnplacedRow) => void;
  onClearSelection?: () => void;
  actions?: Omit<UnplacedTrayActions, 'onSelect'>;
}) {
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<{ row: UnplacedRow; x: number; y: number } | null>(null);

  const act: UnplacedTrayActions = {
    onSelect,
    ...actions,
  };

  const totalHours = useMemo(
    () => unplaced.reduce((s, u) => s + (u.remaining_hours ?? 0), 0),
    [unplaced],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    if (!needle) return unplaced;
    return unplaced.filter((u) => {
      const hay = `${u.class_section} ${u.subject_name} ${u.teacher_label ?? ''} ${u.pattern_label ?? ''}`.toLocaleLowerCase('tr');
      return hay.includes(needle);
    });
  }, [unplaced, q]);

  if (unplaced.length === 0) return null;

  const selected = selectedId ? unplaced.find((u) => u.pool_id === selectedId) : null;

  return (
    <section className="print:hidden overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-b from-primary/[0.06] to-muted/20 shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-primary/15 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold tracking-tight text-foreground">
            Yerleşmemiş dersler
            <span className="ml-1.5 tabular-nums text-primary">({unplaced.length})</span>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {totalHours} saat · her kart bir blok/parça (2+2+1) · sürükle veya seçip hücreye tıkla · Esc seçimi bırakır
          </p>
        </div>
        {selected && onClearSelection && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-muted"
            onClick={onClearSelection}
          >
            <X className="size-3" aria-hidden />
            Seçimi kaldır (Esc)
          </button>
        )}
      </header>
      <div className="space-y-2 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sınıf, ders veya öğretmen ara…"
            className="h-8 w-full rounded-md border border-border/80 bg-background/90 pl-8 pr-2 text-xs outline-none ring-primary/30 placeholder:text-muted-foreground focus-visible:ring-2"
          />
        </div>
        {selected && (
          <p className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-primary">
            <span className="font-semibold">{selected.subject_name}</span>
            {' · '}
            {selected.class_section}
            {' · '}
            {chunkLabel(selected)}
            {' — '}
            uygun boş saate tıklayın
          </p>
        )}
        <div className="max-h-[min(280px,40vh)] overflow-y-auto pr-0.5">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Arama sonucu yok.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((u) => (
                <UnplacedCard
                  key={u.pool_id}
                  row={u}
                  selected={selectedId === u.pool_id}
                  disabled={busy}
                  onSelect={act.onSelect}
                  onContextMenu={(row, e) => {
                    const pad = 8;
                    const w = 180;
                    const h = 220;
                    setMenu({
                      row,
                      x: Math.min(Math.max(pad, e.clientX), window.innerWidth - w - pad),
                      y: Math.min(Math.max(pad, e.clientY), window.innerHeight - h - pad),
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {q && filtered.length < unplaced.length && (
          <p className="text-[10px] text-muted-foreground">
            {filtered.length} / {unplaced.length} gösteriliyor
          </p>
        )}
      </div>
      {menu && (
        <TimetableUnplacedMenu
          row={menu.row}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onSelectForPlacement={() => {
            act.onSelect(menu.row);
            setMenu(null);
          }}
          onFocusClass={() => {
            act.onFocusClass?.(menu.row);
            setMenu(null);
          }}
          onFocusTeacher={() => {
            act.onFocusTeacher?.(menu.row);
            setMenu(null);
          }}
          onAutoPlace={() => {
            act.onAutoPlace?.(menu.row);
            setMenu(null);
          }}
          onOpenAssignments={() => {
            act.onOpenAssignments?.(menu.row);
            setMenu(null);
          }}
          onCopyInfo={() => {
            act.onCopyInfo?.(menu.row);
            setMenu(null);
          }}
        />
      )}
    </section>
  );
}
