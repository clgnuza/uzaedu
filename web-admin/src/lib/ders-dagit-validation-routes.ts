import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { atamalarUrl } from '@/lib/dd-entity-scope';

export type ValidationIssueExt = ValidationIssue & {
  entity_type?: string;
  entity_id?: string;
};

const HREF_BY_CODE: Record<string, string> = {
  MIN_CLASSES: '/ders-dagit/studyo/kurulum',
  CLASS_NO_SECTIONS: '/ders-dagit/studyo/kurulum',
  CLASS_OVER_CAPACITY: '/ders-dagit/studyo/kurulum',
  CLASS_UNDER_MIN: '/ders-dagit/studyo/dersler',
  CLASS_OVER_MAX: '/ders-dagit/studyo/kurulum',
  SECTION_NO_HOURS: '/ders-dagit/studyo/dersler',
  MIN_TEACHERS: '/ders-dagit/studyo/ogretmenler',
  TEACHER_OVER_MAX: '/ders-dagit/studyo/ogretmenler',
  TEACHER_UNDER_MIN: '/ders-dagit/studyo/atamalar',
  MIN_SUBJECTS: '/ders-dagit/studyo/dersler',
  MIN_ASSIGNMENTS: '/ders-dagit/studyo/atamalar',
  ASSIGN_NO_SECTION: '/ders-dagit/studyo/atamalar',
  ASSIGN_NO_TEACHER: '/ders-dagit/studyo/atamalar',
  NO_ROOMS_LIST: '/ders-dagit/studyo/derslikler',
  BIWEEKLY_ODD: '/ders-dagit/studyo/atamalar',
  PERIOD_NO_DAYS: '/ders-dagit/studyo/donem',
  AIHL_NORM_EXCEEDED: '/ders-dagit/studyo/secmeli',
  PLANNING_STRICT_UNSUPPORTED: '/ders-dagit/studyo/planlama-iliskileri',
  DUTY_SLOTS_ACTIVE: '/nobet',
};

const ASSIGNMENT_CODES = new Set([
  'NO_ROOMS_LIST',
  'ASSIGN_NO_SECTION',
  'ASSIGN_NO_TEACHER',
  'BIWEEKLY_ODD',
  'MIN_ASSIGNMENTS',
]);

/** Hata kodu ve varlığa göre hedef stüdyo sayfası */
export function resolveValidationIssueHref(issue: ValidationIssueExt): string | undefined {
  if (issue.entity_type === 'assignment' && issue.entity_id && ASSIGNMENT_CODES.has(issue.code)) {
    return atamalarUrl({});
  }
  if (issue.entity_type === 'class_profile' && issue.entity_id && issue.code.startsWith('CLASS_')) {
    return '/ders-dagit/studyo/kurulum';
  }
  if (issue.code === 'TEACHER_OVER_MAX' || issue.code === 'TEACHER_UNDER_MIN') {
    const m = issue.message.match(/:\s*haftalık/i);
    if (m) return '/ders-dagit/studyo/ogretmenler';
  }
  return HREF_BY_CODE[issue.code] ?? issue.href;
}
