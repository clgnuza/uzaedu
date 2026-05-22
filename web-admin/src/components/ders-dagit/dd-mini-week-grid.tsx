'use client';

import { isSlotBlocked, periodsToBlockedKeys, type UnavailablePeriod } from '@/lib/teacher-availability';
import { buildSectionScheduleColumns, effectiveSlotState, type LongBreakDef, type SectionScheduleConfig } from '@/lib/section-schedule';
import { cn } from '@/lib/utils';

type TeacherProps = {
  mode: 'teacher';
  workDays: number[];
  maxLessons: number;
  periods: UnavailablePeriod[];
};

type SectionProps = {
  mode: 'section';
  workDays: number[];
  maxLessons: number;
  schedule: SectionScheduleConfig;
  longBreaks?: LongBreakDef[];
};

type Props = (TeacherProps | SectionProps) & { className?: string };

export function DdMiniWeekGrid(props: Props) {
  const days = props.workDays.length ? props.workDays : [1, 2, 3, 4, 5];
  const max =
    props.mode === 'section'
      ? Math.max(
          props.maxLessons,
          ...days.map((d) => {
            const key = String(d);
            const fromDay = props.schedule.lessons_per_day_by_dow?.[key];
            return fromDay != null && fromDay >= 1 ? Math.min(props.maxLessons, fromDay) : props.maxLessons;
          }),
        )
      : props.maxLessons;

  const cols =
    props.mode === 'section'
      ? buildSectionScheduleColumns(max, props.longBreaks)
      : Array.from({ length: max }, (_, i) => ({ kind: 'lesson' as const, lessonNum: i + 1 }));

  return (
    <div
      className={cn('inline-grid gap-px rounded border bg-border p-px', props.className)}
      style={{ gridTemplateColumns: `repeat(${cols.length}, 5px)`, gridTemplateRows: `repeat(${days.length}, 5px)` }}
      role="img"
      aria-label="Haftalık özet ızgara"
    >
      {days.map((d) =>
        cols.map((col, idx) => {
          if (col.kind === 'lunch') {
            return <span key={`${d}-l-${idx}`} className="size-[5px] rounded-[1px] bg-violet-500/80" />;
          }
          const l = col.lessonNum;
          let cls = 'bg-emerald-500/70';
          if (props.mode === 'teacher') {
            const keys = periodsToBlockedKeys(props.periods);
            if (isSlotBlocked(keys, d, l)) cls = 'bg-rose-500/80';
          } else {
            const dayMax =
              props.schedule.lessons_per_day_by_dow?.[String(d)] != null
                ? Math.min(max, props.schedule.lessons_per_day_by_dow![String(d)]!)
                : max;
            const st = effectiveSlotState(props.schedule, d, l, dayMax);
            if (st === 'closed' || st === 'no_slot') cls = st === 'closed' ? 'bg-red-600' : 'bg-rose-500/70';
            else if (st === 'internship') cls = 'bg-amber-500/80';
            else if (st === 'lunch') cls = 'bg-violet-500/80';
          }
          return <span key={`${d}-${l}`} className={cn('size-[5px] rounded-[1px]', cls)} />;
        }),
      )}
    </div>
  );
}
