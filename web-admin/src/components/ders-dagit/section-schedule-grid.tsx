'use client';

import { useEffect, useMemo, useState } from 'react';
import { schoolSetupCapabilities } from '@/lib/school-profile-capabilities';
import { weekdayShort } from '@/lib/studio-timetable-ui';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { DdWeekdayPicker } from '@/components/ders-dagit/dd-weekday-picker';
import {
  PAINT_STATES,
  SLOT_STATE_UI,
  buildSectionScheduleColumns,
  countSectionSlots,
  dayMaxLessons,
  effectiveSlotState,
  setCellState,
  periodLessonCountForDay,
  scheduleForSchoolType,
  setInternshipDays,
  type LongBreakDef,
  type SectionScheduleConfig,
  type SectionSlotState,
} from '@/lib/section-schedule';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Props = {
  schoolType?: string | null;
  workDays: number[];
  schoolMaxLessons: number;
  studioLessonsByDow?: Record<string, number>;
  longBreaks?: LongBreakDef[];
  schedule: SectionScheduleConfig;
  onChange: (schedule: SectionScheduleConfig) => void;
};

export function SectionScheduleGrid({
  schoolType,
  workDays,
  schoolMaxLessons,
  studioLessonsByDow,
  longBreaks,
  schedule,
  onChange,
}: Props) {
  const allowInternship = schoolSetupCapabilities(schoolType).sectionScheduleInternship;
  const paintStates = useMemo(
    () => (allowInternship ? PAINT_STATES : PAINT_STATES.filter((s) => s !== 'internship')),
    [allowInternship],
  );
  const legendKeys = useMemo(
    () =>
      (Object.keys(SLOT_STATE_UI) as Array<keyof typeof SLOT_STATE_UI>).filter(
        (k) => allowInternship || k !== 'internship',
      ),
    [allowInternship],
  );
  const [brush, setBrush] = useState<SectionSlotState>('closed');

  useEffect(() => {
    if (!allowInternship && brush === 'internship') setBrush('closed');
  }, [allowInternship, brush]);

  function applyChange(next: SectionScheduleConfig) {
    onChange(scheduleForSchoolType(next, schoolType));
  }
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  const gridMax = useMemo(() => {
    let m = schoolMaxLessons;
    for (const d of days) {
      m = Math.max(m, dayMaxLessons(schedule, d, schoolMaxLessons, studioLessonsByDow));
    }
    return m;
  }, [days, schedule, schoolMaxLessons, studioLessonsByDow]);
  const columns = useMemo(() => buildSectionScheduleColumns(gridMax, longBreaks), [gridMax, longBreaks]);
  const slotCounts = useMemo(
    () => countSectionSlots(schedule, days, schoolMaxLessons, studioLessonsByDow, longBreaks),
    [schedule, days, schoolMaxLessons, studioLessonsByDow, longBreaks],
  );

  function paint(day: number, lesson: number) {
    const eff = effectiveSlotState(
      schedule,
      day,
      lesson,
      dayMaxLessons(schedule, day, schoolMaxLessons, studioLessonsByDow),
    );
    if (eff === 'no_slot' || eff === 'lunch') return;
    applyChange(setCellState(schedule, day, lesson, brush));
  }

  return (
    <div className="space-y-4">
      {allowInternship ? (
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium">Tam gün staj (bu şube)</p>
          <DdWeekdayPicker
            value={schedule.internship_days ?? []}
            onChange={(days) => applyChange(setInternshipDays(schedule, days))}
            minSelected={0}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Gün seçerseniz o günün tüm ders saatleri staj olur. Yalnızca bazı saatler için: &quot;Seçili durum →
            Staj&quot; deyip tablodaki hücrelere tıklayın.
          </p>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Günlük ders sayısı ve öğle arası{' '}
        <Link href="/ders-dagit/studyo/donem" className="font-medium text-primary underline">
          Program merkezi dönem ayarları
        </Link>
        ile aynıdır; burada yalnızca müsait / kapalı / staj hücreleri düzenlenir.
      </p>
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Boyama aracı">
        <span className="text-xs font-medium text-muted-foreground">Seçili durum:</span>
        {paintStates.map((st) => {
          const ui = SLOT_STATE_UI[st];
          return (
            <button
              key={st}
              type="button"
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ui.className,
                brush === st && 'ring-2 ring-primary ring-offset-2',
              )}
              aria-pressed={brush === st}
              onClick={() => setBrush(st)}
            >
              {ui.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-xs" role="list" aria-label="Tablo renkleri">
        {legendKeys.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5" role="listitem">
            <span className={cn('size-3 rounded', SLOT_STATE_UI[k].className.split(' ')[0])} aria-hidden />
            {SLOT_STATE_UI[k].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table
          className="w-full min-w-[28rem] border-collapse text-center text-xs"
          role="grid"
          aria-label="Şube zaman tablosu"
        >
          <thead>
            <tr>
              <th className="border-b bg-muted/80 px-2 py-1.5 font-medium w-24" scope="col" />
              {columns.map((col, idx) =>
                col.kind === 'lunch' ? (
                  <th
                    key={`lunch-h-${idx}`}
                    className="border-b bg-violet-100 px-1 py-1.5 font-medium text-violet-950 dark:bg-violet-950/60 dark:text-violet-100"
                    scope="col"
                    title={`${col.afterLesson}. dersten sonra — ${col.label}`}
                  >
                    Ö
                  </th>
                ) : (
                  <th
                    key={`lesson-h-${col.lessonNum}`}
                    className="border-b bg-muted/50 px-1 py-1.5 font-medium"
                    scope="col"
                    title={`${col.lessonNum}. ders`}
                  >
                    {col.lessonNum}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const max = dayMaxLessons(schedule, d, schoolMaxLessons, studioLessonsByDow);
              const dayCols = buildSectionScheduleColumns(max, longBreaks);
              return (
                <tr key={d}>
                  <th scope="row" className="border-r bg-muted/40 px-1 py-1 align-middle">
                    <div className="font-semibold text-muted-foreground">{weekdayShort(d)}</div>
                    <div
                      className="mt-0.5 font-mono text-[9px] text-muted-foreground"
                      title="Dönem ayarlarındaki günlük ders sayısı"
                    >
                      {periodLessonCountForDay(d, schoolMaxLessons, studioLessonsByDow)} ders
                    </div>
                  </th>
                  {dayCols.map((col, idx) => {
                    if (col.kind === 'lunch') {
                      const ui = SLOT_STATE_UI.lunch;
                      return (
                        <td key={`lunch-${d}-${idx}`} className="border-b border-r p-0.5">
                          <div
                            className={cn(
                              'flex h-8 w-full items-center justify-center rounded-sm text-[10px] font-semibold',
                              ui.className,
                            )}
                            aria-label={`${dayLabel(d)} öğle arası`}
                          >
                            {ui.short}
                          </div>
                        </td>
                      );
                    }
                    const lesson = col.lessonNum;
                    const eff = effectiveSlotState(schedule, d, lesson, max);
                    const ui = SLOT_STATE_UI[eff];
                    const canPaint = eff !== 'no_slot' && eff !== 'lunch';
                    return (
                      <td key={`${d}-${lesson}`} className="border-b border-r p-0.5">
                        <button
                          type="button"
                          disabled={!canPaint}
                          className={cn(
                            'flex h-8 w-full items-center justify-center rounded-sm text-[10px] font-semibold',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            ui.className,
                            !canPaint && 'opacity-80',
                          )}
                          aria-label={`${dayLabel(d)} ${lesson}. ders, ${ui.aria}`}
                          onClick={() => paint(d, lesson)}
                        >
                          {ui.short}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{slotCounts.placeable}</span> müsait slot
        {slotCounts.closed > 0 ? (
          <>
            {' '}
            · <span className="font-medium text-red-600 dark:text-red-400">{slotCounts.closed}</span> kapalı (K)
          </>
        ) : null}
        {allowInternship && slotCounts.internship > 0 ? <> · {slotCounts.internship} staj</> : null}
        {slotCounts.lunchCells > 0 ? (
          <>
            {' '}
            · <span className="font-medium text-violet-700 dark:text-violet-300">{slotCounts.lunchCells}</span> öğle
          </>
        ) : null}{' '}
        · <span className="font-medium text-foreground">{slotCounts.lessonCells}</span> ders hücresi. Satır = gün;
        ders sayısı dönem ayarlarından gelir (öğle hariç).
      </p>
    </div>
  );
}
