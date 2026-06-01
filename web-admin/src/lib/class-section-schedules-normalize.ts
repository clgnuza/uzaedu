import { buildSectionAliasMap, dedupeSectionAliases } from '@/lib/class-section-canonical';
import type { SectionScheduleConfig } from '@/lib/section-schedule';

/** API’den gelen şube + saat kayıtlarını tek ada indirger */
export function normalizeSectionSchedulesResponse(
  sections: string[],
  schedules: Record<string, SectionScheduleConfig>,
): { sections: string[]; schedules: Record<string, SectionScheduleConfig> } {
  const raw = [...sections, ...Object.keys(schedules)];
  const aliasMap = buildSectionAliasMap(raw);
  const canonical = dedupeSectionAliases(raw);
  const empty = { lessons_per_day_by_dow: {}, cells: {} };
  const out: Record<string, SectionScheduleConfig> = {};
  for (const sec of canonical) {
    let sched = schedules[sec];
    if (!sched) {
      for (const [alias, canon] of aliasMap) {
        if (canon === sec && schedules[alias]) {
          sched = schedules[alias];
          break;
        }
      }
    }
    out[sec] = sched ?? empty;
  }
  return { sections: canonical, schedules: out };
}
