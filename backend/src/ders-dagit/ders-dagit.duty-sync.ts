/** Faz 38 — Nöbet → müsait değil (tarih bazlı → haftalık gün) */

export type DutyUnavailableSlot = {
  day_of_week: number;
  lesson_num: number | null;
  user_id: string;
  duty_date?: string;
  shift?: string | null;
};

/** JS getDay: 0=Paz → 7; 1=Pzt … */
export function dateStringToDayOfWeek(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00`);
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function dutySlotsToUnavailable(
  slots: Array<{
    date: string;
    lesson_num: number | null;
    user_id: string;
    shift?: string | null;
  }>,
  opts?: { work_days?: number[]; from?: string; to?: string },
): DutyUnavailableSlot[] {
  const work = new Set(opts?.work_days ?? [1, 2, 3, 4, 5]);
  const from = opts?.from ? new Date(`${opts.from}T00:00:00`) : null;
  const to = opts?.to ? new Date(`${opts.to}T23:59:59`) : null;
  const out: DutyUnavailableSlot[] = [];
  const seen = new Set<string>();

  for (const s of slots) {
    if (!s.date) continue;
    const dt = new Date(`${s.date}T12:00:00`);
    if (from && dt < from) continue;
    if (to && dt > to) continue;
    const dow = dateStringToDayOfWeek(s.date);
    if (!work.has(dow)) continue;
    const lesson = s.lesson_num ?? null;
    const key = `${s.user_id}:${dow}:${lesson ?? '*'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      day_of_week: dow,
      lesson_num: lesson,
      user_id: s.user_id,
      duty_date: s.date,
      shift: s.shift ?? null,
    });
  }
  return out;
}

export function findDutyPlacementConflicts(
  entries: Array<{ day_of_week: number; lesson_num: number; user_id: string | null }>,
  duty: DutyUnavailableSlot[],
): string[] {
  const violations: string[] = [];
  for (const e of entries) {
    if (!e.user_id) continue;
    for (const d of duty) {
      if (d.user_id !== e.user_id || d.day_of_week !== e.day_of_week) continue;
      if (d.lesson_num != null && d.lesson_num !== e.lesson_num) continue;
      violations.push(
        `Nöbet çakışması: öğretmen ${e.user_id.slice(0, 8)}… ${e.day_of_week}. gün ${e.lesson_num}. ders${d.duty_date ? ` (nöbet ${d.duty_date})` : ''}`,
      );
      break;
    }
  }
  return violations;
}
