import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';

/** Backend `ders-dagit.generate-gate.ts` ile aynı */
const GENERATE_NON_BLOCKING_CODES = new Set([
  'NO_ROOMS_LIST',
  'DUTY_SLOTS_ACTIVE',
  'TEACHER_SLOTS_INSUFFICIENT',
  'TEACHER_SCHEDULE_TIGHT',
  'TEACHER_HIGH_UNAVAILABLE',
  'SECTION_SLOTS_INSUFFICIENT',
  'SECTION_SCHEDULE_TIGHT',
  'ASSIGN_SLOTS_BLOCKED',
  'CLASS_UNDER_MIN',
  'CLASS_OVER_MAX',
  'CLASS_OVER_CAPACITY',
  'SECTION_NO_HOURS',
  'CLASS_NO_SECTIONS',
  'AIHL_NORM_EXCEEDED',
]);

export function filterGenerateBlockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => i.severity === 'error' && !GENERATE_NON_BLOCKING_CODES.has(i.code));
}
