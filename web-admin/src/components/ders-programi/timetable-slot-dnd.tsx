'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export function entryDragId(day: number, lesson: number) {
  return `entry-${day}-${lesson}`;
}

export function slotDropId(day: number, lesson: number) {
  return `slot-${day}-${lesson}`;
}

export function parseEntryDragId(id: string): { day: number; lesson: number } | null {
  const m = /^entry-(\d+)-(\d+)$/.exec(id);
  if (!m) return null;
  return { day: Number(m[1]), lesson: Number(m[2]) };
}

export function parseSlotDropId(id: string): { day: number; lesson: number } | null {
  const m = /^slot-(\d+)-(\d+)$/.exec(id);
  if (!m) return null;
  return { day: Number(m[1]), lesson: Number(m[2]) };
}

export function TimetableDraggableCell({
  day,
  lesson,
  disabled,
  children,
}: {
  day: number;
  lesson: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entryDragId(day, lesson),
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...(!disabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        'flex h-full min-h-14 w-full items-stretch justify-center sm:min-h-16',
        !disabled && 'cursor-grab touch-manipulation active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
      title={disabled ? undefined : 'Başka güne/saate sürükleyin'}
    >
      {children}
    </div>
  );
}

export function TimetableDroppableSlot({
  day,
  lesson,
  disabled,
  children,
  className,
}: {
  day: number;
  lesson: number;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: slotDropId(day, lesson),
    disabled,
  });
  return (
    <td
      ref={setNodeRef}
      className={cn(
        className,
        !disabled && isOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
      )}
    >
      {children}
    </td>
  );
}
