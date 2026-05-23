import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';

/** Kullanıcıya gösterilecek metin; teknik kod asla eklenmez. */
export function formatValidationIssueText(issue: ValidationIssue): string {
  return issue.message.trim();
}

export function formatValidationIssueDetail(issue: ValidationIssue): {
  text: string;
  hint?: string;
  href?: string;
} {
  return {
    text: formatValidationIssueText(issue),
    hint: issue.fix_hint?.trim() || undefined,
    href: issue.href,
  };
}
