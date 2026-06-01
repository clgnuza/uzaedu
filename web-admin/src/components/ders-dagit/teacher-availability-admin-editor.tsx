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
import { cn } from '@/lib/utils';

type Props = {
  workDays: number[];
  maxLessons: number;
  /** İdarenin programa işleyeceği son hali */
  periods: UnavailablePeriod[];
  onChange: (periods: UnavailablePeriod[]) => void;
  /** Öğretmenin gönderdiği talep (karşılaştırma) */
  teacherRequest: UnavailablePeriod[];
  currentApplied?: UnavailablePeriod[];
};

export function TeacherAvailabilityAdminEditor({
  workDays,
  maxLessons,
  periods,
  onChange,
  teacherRequest,
  currentApplied,
}: Props) {
  const keys = useMemo(() => periodsToBlockedKeys(periods), [periods]);
  const teacherKeys = useMemo(() => periodsToBlockedKeys(teacherRequest), [teacherRequest]);
  const appliedKeys = useMemo(
    () => (currentApplied ? periodsToBlockedKeys(currentApplied) : new Set<string>()),
    [currentApplied],
  );
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];

  function setKeys(next: Set<string>) {
    onChange(blockedKeysToPeriods(next));
  }

  function getCell(day: number, lesson: number): StudioCellVisual {
    const blocked = isSlotBlocked(keys, day, lesson);
    const teacherWanted = isSlotBlocked(teacherKeys, day, lesson);
    const wasApplied = isSlotBlocked(appliedKeys, day, lesson);

    if (blocked && teacherWanted) {
      return { state: 'blocked', title: 'Uygun değil — öğretmen talebi onaylandı' };
    }
    if (blocked && !teacherWanted) {
      return { state: 'blocked', title: 'Uygun değil — idare ekledi' };
    }
    if (!blocked && teacherWanted) {
      return { state: 'conditional', title: 'Öğretmen istemişti; siz uygun bıraktınız' };
    }
    if (wasApplied) {
      return { state: 'disabled', title: 'Önceki programda kısıt vardı (şimdi uygun)' };
    }
    return { state: 'available', title: 'Uygun' };
  }

  const changedFromTeacher = useMemo(() => {
    const a = periodsToBlockedKeys(periods);
    const t = periodsToBlockedKeys(teacherRequest);
    if (a.size !== t.size) return true;
    for (const k of a) if (!t.has(k)) return true;
    for (const k of t) if (!a.has(k)) return true;
    return false;
  }, [periods, teacherRequest]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded border-2 border-rose-500 bg-rose-500/80" />
          Uygun değil (programa yazılacak)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded border-2 border-sky-400 bg-sky-400/20" />
          Öğretmen istedi, siz uygun bıraktınız
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded border border-border bg-emerald-500/15" />
          Uygun
        </span>
      </div>
      {changedFromTeacher && (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
          Öğretmen talebinden farklı düzenleme yapıldı — kayıtta bu hali geçerli olur.
        </p>
      )}
      <p className={cn('text-xs tabular-nums text-muted-foreground')}>
        {keys.size} uygun değil işareti · öğretmen talebi {teacherKeys.size} slot
      </p>
      <DdStudioTimeTable
        workDays={days}
        maxLessons={maxLessons}
        getCell={getCell}
        showLegend={false}
        hint="Hücreye tıklayarak uygun / uygun değil değiştirin. Gün başlığı tüm günü kapatır."
        onDayHeader={(d) => setKeys(toggleDayBlocked(keys, d, maxLessons))}
        onCell={(d, lesson) => setKeys(toggleSlotBlocked(keys, d, lesson, maxLessons))}
      />
      <button type="button" className="text-xs text-primary underline" onClick={() => onChange([])}>
        Tüm saatleri uygun yap
      </button>
    </div>
  );
}
