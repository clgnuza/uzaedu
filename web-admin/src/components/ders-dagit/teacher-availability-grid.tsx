'use client';

import { useMemo } from 'react';
import { DdStudioTimeTable, type StudioCellVisual } from '@/components/ders-dagit/dd-studio-time-table';
import {
  blockedKeysToPeriods,
  isSlotBlocked,
  periodsToBlockedKeys,
  toggleDayBlocked,
  toggleSlotBlocked,
  type UnavailablePeriod,
} from '@/lib/teacher-availability';

type Props = {
  workDays: number[];
  maxLessons: number;
  periods: UnavailablePeriod[];
  onChange: (periods: UnavailablePeriod[]) => void;
  readOnly?: boolean;
  caption?: string;
};

export function TeacherAvailabilityGrid({
  workDays,
  maxLessons,
  periods,
  onChange,
  readOnly,
  caption,
}: Props) {
  const keys = useMemo(() => periodsToBlockedKeys(periods), [periods]);
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];

  function setKeys(next: Set<string>) {
    onChange(blockedKeysToPeriods(next));
  }

  function getCell(day: number, lesson: number): StudioCellVisual {
    const blocked = isSlotBlocked(keys, day, lesson);
    return {
      state: blocked ? 'blocked' : 'available',
      title: blocked ? 'Uygun değil' : 'Uygun',
    };
  }

  return (
    <div className="space-y-2">
      {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
      <DdStudioTimeTable
        workDays={days}
        maxLessons={maxLessons}
        getCell={getCell}
        readOnly={readOnly}
        hint="Gün başlığına tıklayınca tüm gün uygun değil olur."
        onDayHeader={
          readOnly
            ? undefined
            : (d) => setKeys(toggleDayBlocked(keys, d, maxLessons))
        }
        onCell={
          readOnly
            ? undefined
            : (d, lesson) => setKeys(toggleSlotBlocked(keys, d, lesson, maxLessons))
        }
      />
      {!readOnly && keys.size > 0 && (
        <button type="button" className="text-xs text-primary underline" onClick={() => onChange([])}>
          Tümünü uygun yap
        </button>
      )}
    </div>
  );
}
