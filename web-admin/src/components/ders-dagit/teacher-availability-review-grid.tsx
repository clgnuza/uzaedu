'use client';

import { useMemo } from 'react';
import { DdStudioTimeTable } from '@/components/ders-dagit/dd-studio-time-table';
import {
  computeReviewSummary,
  reviewCellVisual,
} from '@/lib/teacher-availability-review';
import type { UnavailablePeriod } from '@/lib/teacher-availability';
import { Check, ShieldCheck, X } from 'lucide-react';

type Props = {
  workDays: number[];
  maxLessons: number;
  teacherRequest: UnavailablePeriod[];
  approvedPeriods: UnavailablePeriod[] | null;
};

export function TeacherAvailabilityReviewGrid({
  workDays,
  maxLessons,
  teacherRequest,
  approvedPeriods,
}: Props) {
  const summary = useMemo(
    () => computeReviewSummary(teacherRequest, approvedPeriods, workDays, maxLessons),
    [teacherRequest, approvedPeriods, workDays, maxLessons],
  );
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {summary.approved > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-900 dark:text-violet-100">
            <ShieldCheck className="size-3.5" />
            {summary.approved} onaylı kısıt
          </span>
        )}
        {summary.denied > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-950 dark:text-amber-100">
            <Check className="size-3.5" />
            {summary.denied} talep reddedildi
          </span>
        )}
        {summary.admin_added > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-900 dark:text-rose-100">
            <X className="size-3.5" />
            {summary.admin_added} idare ekledi
          </span>
        )}
        {summary.program_restrictions === 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-100">
            <Check className="size-3.5" />
            Programda ek kısıt yok
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3 text-violet-600" /> Talep onaylandı (programda uygun değil)
        </span>
        <span className="inline-flex items-center gap-1">
          <Check className="size-3 text-amber-600" /> Talep reddedildi (uygun sayıldı)
        </span>
        <span className="inline-flex items-center gap-1">
          <X className="size-3 text-rose-600" /> İdare ekledi
        </span>
        <span className="inline-flex items-center gap-1">
          <Check className="size-3 text-emerald-600" /> Uygun
        </span>
      </div>
      <DdStudioTimeTable
        workDays={days}
        maxLessons={maxLessons}
        getCell={(d, lesson) => reviewCellVisual(teacherRequest, approvedPeriods, d, lesson)}
        readOnly
        showLegend={false}
        hint="Mor: talebiniz onaylandı · Sarı: talebiniz reddedildi · Kırmızı: idarenin eklediği kısıt"
      />
    </div>
  );
}
