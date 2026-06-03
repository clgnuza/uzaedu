'use client';

import { AlertTriangle, DoorOpen, Lock, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export type TimetableEntryStatusBadgesProps = {
  entry: Pick<EditorEntry, 'is_locked' | 'user_id'>;
  hasClash?: boolean;
  noRoom?: boolean;
  /** Yerleştirme / seçim modunda işaretli kart */
  picked?: boolean;
  compact?: boolean;
  className?: string;
};

/** Ders kartı: kilit, çakışma, derslik/öğretmen eksik, seçili. */
export function TimetableEntryStatusBadges({
  entry,
  hasClash = false,
  noRoom = false,
  picked = false,
  compact = false,
  className,
}: TimetableEntryStatusBadgesProps) {
  const noTeacher = !entry.user_id;
  const iconCls = compact ? 'size-2.5' : 'size-3';
  const pad = compact ? 'p-0.5' : 'p-0.5';

  if (!hasClash && !noRoom && !entry.is_locked && !noTeacher && !picked) return null;

  return (
    <div
      className={cn('flex shrink-0 items-center gap-0.5', className)}
      role="group"
      aria-label="Kart durumu"
    >
      {picked && (
        <span
          className={cn('rounded-full bg-sky-500 text-white shadow-sm', pad)}
          title="Seçili — hedef saate tıklayın veya sürükleyin"
        >
          <span className={cn('block rounded-full bg-white', compact ? 'size-1' : 'size-1.5')} aria-hidden />
        </span>
      )}
      {hasClash && (
        <span className={cn('rounded-full bg-destructive text-white shadow-sm', pad)} title="Çakışma">
          <AlertTriangle className={iconCls} aria-hidden />
        </span>
      )}
      {noRoom && (
        <span
          className={cn('rounded-full bg-background/95 shadow-sm ring-1 ring-border/60', pad)}
          title="Derslik atanmamış"
        >
          <DoorOpen className={cn(iconCls, 'text-muted-foreground')} aria-hidden />
        </span>
      )}
      {noTeacher && (
        <span
          className={cn('rounded-full bg-violet-100 shadow-sm ring-1 ring-violet-300/60 dark:bg-violet-950/80', pad)}
          title="Öğretmen atanmamış"
        >
          <UserX className={cn(iconCls, 'text-violet-800 dark:text-violet-200')} aria-hidden />
        </span>
      )}
      {entry.is_locked && (
        <span
          className={cn('rounded-full bg-amber-100 shadow-sm ring-1 ring-amber-400/70 dark:bg-amber-950/90', pad)}
          title="Kilitli — taşınamaz"
        >
          <Lock className={cn(iconCls, 'text-amber-800 dark:text-amber-200')} aria-hidden />
        </span>
      )}
    </div>
  );
}
