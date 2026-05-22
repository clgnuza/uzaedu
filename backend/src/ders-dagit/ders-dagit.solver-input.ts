import type { SolverAssignment } from './ders-dagit.solver';

function effWeekly(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

/** Çoklu öğretmen: saat böl veya ortak öğretim (co_teach). */
export function expandAssignmentsForSolver(
  rows: Array<SolverAssignment & { options?: Record<string, unknown> }>,
): SolverAssignment[] {
  const out: SolverAssignment[] = [];
  for (const a of rows) {
    const coTeach = !!(a.options?.co_teach ?? a.co_teach);
    const tids = (a.teacher_ids ?? []).filter(Boolean);
    if (coTeach || tids.length <= 1) {
      out.push({ ...a, co_teach: coTeach, teacher_ids: tids.length ? tids : a.teacher_ids });
      continue;
    }
    const total = effWeekly(a);
    const base = Math.floor(total / tids.length);
    let rem = total - base * tids.length;
    for (const uid of tids) {
      const h = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      if (h <= 0) continue;
      out.push({
        ...a,
        teacher_ids: [uid],
        weekly_hours: a.biweekly ? h * 2 : h,
        co_teach: false,
      });
    }
  }
  return out;
}
