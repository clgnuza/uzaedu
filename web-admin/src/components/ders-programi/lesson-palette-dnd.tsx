'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { SchoolClass } from '@/hooks/use-school-classes-subjects';

export function paletteDragId(subjectKey: string) {
  return `palette-${subjectKey}`;
}

export function parsePaletteDragId(id: string): string | null {
  const m = /^palette-(.+)$/.exec(id);
  return m ? m[1]! : null;
}

export function LessonPaletteDnd({
  subjects,
  classSection,
  disabled,
}: {
  subjects: Array<{ id: string; label: string }>;
  classSection: string;
  disabled?: boolean;
}) {
  if (!classSection.trim()) {
    return <p className="text-xs text-muted-foreground">Önce sınıf/şube seçin veya yazın.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {subjects.map((s) => (
        <PaletteChip key={s.id} id={s.id} label={s.label} disabled={!!disabled} />
      ))}
    </div>
  );
}

function PaletteChip({ id, label, disabled }: { id: string; label: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteDragId(id),
    data: { subjectId: id, label },
    disabled,
  });
  return (
    <span
      ref={setNodeRef}
      {...(!disabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        'inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium',
        !disabled && 'cursor-grab touch-manipulation active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      {label}
    </span>
  );
}
