import {
  assignmentDayDistribution,
  distributionToPlacementHints,
  inferDayDistribution,
  isValidDayDistribution,
} from './ders-dagit.day-distribution';
import {
  type DistributionPolicy,
  shouldReportDistributionViolations,
} from './ders-dagit.distribution-policy';
import type { SolverAssignment, SolverSlot } from './ders-dagit.solver';

function effHours(a: { weekly_hours: number; biweekly?: boolean }): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

/** Katalog / içe aktarım: haftalık desenle uyumlu varsayılan min gün. */
export function defaultMinDaysFromWeeklyHours(weeklyHours: number, biweekly = false): number {
  return distributionToPlacementHints(inferDayDistribution(weeklyHours, {}, biweekly)).min_days_per_week;
}

/** Gerçekten kontrol edilecek min gün (1 gün ve çelişkili üst sınırlar elenir). */
export function effectiveMinDaysPerWeek(
  a: SolverAssignment,
  pattern?: number[] | null,
): number | null {
  const effH = effHours(a);
  if (effH <= 1) return null;

  let patternDays: number | null = null;
  if (pattern?.length) {
    patternDays = pattern.length;
  } else {
    const stored = assignmentDayDistribution(a.options);
    if (stored && isValidDayDistribution(stored, effH)) patternDays = stored.length;
  }

  let required = a.min_days_per_week;
  if (patternDays != null) {
    required = required != null ? Math.min(required, patternDays) : patternDays;
  }
  if (required == null || required <= 1) return null;
  required = Math.min(required, effH);
  return required <= 1 ? null : required;
}

export function assignmentTargetSlotCount(a: SolverAssignment): number {
  return effHours(a) * Math.max(1, a.class_sections?.length ?? 1);
}

export function countAssignmentPlacedHours(entries: SolverSlot[], assignmentId: string): number {
  return entries.filter((e) => e.assignment_id === assignmentId).length;
}

export function countAssignmentUsedDays(entries: SolverSlot[], assignmentId: string): number {
  const days = new Set<number>();
  for (const e of entries) {
    if (e.assignment_id === assignmentId) days.add(e.day_of_week);
  }
  return days.size;
}

/** Tam yerleşmiş atamalarda min gün ihlali (kısmi yerleşimde yalnızca “saat yerleşmedi” raporlanır). */
export function appendMinDaysViolationIfNeeded(
  violations: string[],
  a: SolverAssignment,
  entries: SolverSlot[],
  policy: DistributionPolicy | undefined,
  pattern?: number[] | null,
): void {
  if (!shouldReportDistributionViolations(policy)) return;
  if (countAssignmentPlacedHours(entries, a.id) < assignmentTargetSlotCount(a)) return;

  const minDays = effectiveMinDaysPerWeek(a, pattern);
  if (minDays == null) return;
  if (countAssignmentUsedDays(entries, a.id) < minDays) {
    violations.push(`${a.subject_name}: min ${minDays} gün dağılımı sağlanamadı`);
  }
}
