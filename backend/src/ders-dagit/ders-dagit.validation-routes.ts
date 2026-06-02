/** Doğrulama kaydı → stüdyo sayfası yolu (web-admin ile uyumlu) */

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
  TEACHER_SLOTS_INSUFFICIENT: '/ders-dagit/studyo/ogretmenler',
  TEACHER_SCHEDULE_TIGHT: '/ders-dagit/studyo/ogretmenler',
  TEACHER_HIGH_UNAVAILABLE: '/ders-dagit/studyo/ogretmenler',
  SECTION_SLOTS_INSUFFICIENT: '/ders-dagit/studyo/sinif-saatleri',
  SECTION_SCHEDULE_TIGHT: '/ders-dagit/studyo/sinif-saatleri',
  ASSIGN_SLOTS_BLOCKED: '/ders-dagit/studyo/atamalar',
};

const ASSIGNMENT_CODES = new Set([
  'NO_ROOMS_LIST',
  'ASSIGN_NO_SECTION',
  'ASSIGN_NO_TEACHER',
  'BIWEEKLY_ODD',
  'MIN_ASSIGNMENTS',
  'ASSIGN_SLOTS_BLOCKED',
]);

export function resolveValidationIssueHref(issue: {
  code: string;
  message?: string;
  entity_type?: string;
  entity_id?: string;
  href?: string;
}): string | undefined {
  if (issue.entity_type === 'assignment' && issue.entity_id && ASSIGNMENT_CODES.has(issue.code)) {
    return '/ders-dagit/studyo/atamalar';
  }
  if (issue.entity_type === 'class_profile' && issue.entity_id && issue.code.startsWith('CLASS_')) {
    return '/ders-dagit/studyo/kurulum';
  }
  return HREF_BY_CODE[issue.code] ?? issue.href;
}
