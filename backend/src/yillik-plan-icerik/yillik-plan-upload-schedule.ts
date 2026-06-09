import { generateMebWorkCalendar } from '../config/meb-calendar';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';

/** Katkı şablonunda öğretmenin dolduracağı öğretim haftası üst sınırı */
export const YILLIK_PLAN_UPLOAD_TEACHING_WEEKS = 36;

export type YillikPlanUploadScheduleRow = {
  ay: string;
  hafta_label: string;
  ders_saati: number;
  week_order: number | null;
  is_teaching: boolean;
};

function mebWeeksToEntities(academicYear: string): WorkCalendar[] {
  const stamp = new Date();
  return generateMebWorkCalendar(academicYear).map((w, i) => {
    const e = new WorkCalendar();
    e.id = `meb-${i}`;
    e.academicYear = academicYear;
    e.weekOrder = w.week_order;
    e.weekStart = w.week_start;
    e.weekEnd = w.week_end;
    e.ay = w.ay;
    e.haftaLabel = w.hafta_label;
    e.isTatil = w.is_tatil;
    e.tatilLabel = w.tatil_label;
    e.sinavEtiketleri = w.sinav_etiketleri;
    e.sortOrder = i;
    e.createdAt = stamp;
    e.updatedAt = stamp;
    return e;
  });
}

export async function resolveUploadCalendarWeeks(
  workCalendarService: WorkCalendarService,
  academicYear: string,
): Promise<WorkCalendar[]> {
  const year = academicYear.trim();
  const db = await workCalendarService.findAll(year);
  if (db.length > 0) {
    const sorted = workCalendarService.sortWeeksLikeFindAll(db);
    const hasBreakRows = sorted.some((w) => w.weekOrder === 0);
    if (hasBreakRows) return sorted;
  }
  return mebWeeksToEntities(year);
}

/**
 * Kronolojik sıra: seminer, öğretim (1..36), ara tatiller; 37+ yok.
 * Tatil/seminer satırlarında ders_saati=0.
 */
export function buildYillikPlanUploadSchedule(
  calendar: WorkCalendar[],
  weeklyLessonHours: number,
  maxTeachingWeeks = YILLIK_PLAN_UPLOAD_TEACHING_WEEKS,
): YillikPlanUploadScheduleRow[] {
  const rows: YillikPlanUploadScheduleRow[] = [];
  for (const c of calendar) {
    if (c.weekOrder === 0) {
      const label = (c.haftaLabel ?? c.tatilLabel ?? '').trim();
      if (!label) continue;
      rows.push({
        ay: c.ay ?? '',
        hafta_label: label,
        ders_saati: 0,
        week_order: null,
        is_teaching: false,
      });
      continue;
    }
    if (c.isTatil || c.weekOrder < 1 || c.weekOrder > maxTeachingWeeks) continue;
    rows.push({
      ay: c.ay ?? '',
      hafta_label: (c.haftaLabel ?? `${c.weekOrder}. Hafta`).trim(),
      ders_saati: weeklyLessonHours,
      week_order: c.weekOrder,
      is_teaching: true,
    });
  }
  return rows;
}
