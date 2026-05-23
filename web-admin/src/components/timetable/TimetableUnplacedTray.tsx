'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { EditorContext } from '@/lib/ders-dagit-timetable-api';

function TrayChip({
  assignmentId,
  label,
  hours,
  disabled,
}: {
  assignmentId: string;
  label: string;
  hours: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${assignmentId}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...(!disabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        'shrink-0 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1 text-[10px]',
        !disabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="ml-1 text-amber-800">({hours})</span>
    </div>
  );
}

/** Alt panel: yerleşmemiş atamalar */
export function TimetableUnplacedTray({
  unplaced,
  busy,
}: {
  unplaced: EditorContext['unplaced'];
  busy: boolean;
}) {
  if (unplaced.length === 0) return null;
  return (
    <div className="print:hidden rounded-lg border border-dashed border-primary/30 bg-muted/20 p-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Yerleşmemiş dersler ({unplaced.length}) — tabloya sürükleyin
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {unplaced.map((u) => (
          <TrayChip
            key={u.assignment_id}
            assignmentId={u.assignment_id}
            label={`${u.class_section} · ${u.subject_name}`}
            hours={u.remaining_hours}
            disabled={busy}
          />
        ))}
      </div>
    </div>
  );
}
