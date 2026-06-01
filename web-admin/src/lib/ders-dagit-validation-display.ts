import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { resolveValidationIssueHref, type ValidationIssueExt } from '@/lib/ders-dagit-validation-routes';

/** Kullanıcıya gösterilecek metin; teknik kod asla eklenmez. */
export function formatValidationIssueText(issue: ValidationIssue): string {
  return issue.message.trim();
}

export function formatValidationIssueDetail(issue: ValidationIssueExt): {
  text: string;
  hint?: string;
  href?: string;
} {
  const href = resolveValidationIssueHref(issue);
  return {
    text: formatValidationIssueText(issue),
    hint: issue.fix_hint?.trim() || undefined,
    href,
  };
}
