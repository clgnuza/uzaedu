import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import type { ScoreDeduction, ScoreDeductionFocus } from '@/lib/ders-dagit-score-breakdown';
import type { ScoreDeductionGroup } from '@/lib/score-breakdown-groups';
import { clashEntryIds } from '@/lib/timetable-clash';

function normSubject(s: string): string {
  return s.trim().toLocaleUpperCase('tr');
}

function subjectFromTitle(title: string): string | null {
  const colon = title.indexOf(':');
  if (colon <= 0) return null;
  return title.slice(0, colon).trim() || null;
}

function resolveSubject(deduction: ScoreDeduction): string | null {
  return deduction.focus?.subject ?? subjectFromTitle(deduction.title);
}

export function canHighlightDeduction(d: ScoreDeduction): boolean {
  if (d.focus?.type === 'rules' || d.focus?.type === 'unplaced') return false;
  if (d.focus?.type === 'clash' || d.focus?.type === 'assignment') return true;
  return !!subjectFromTitle(d.title);
}

export function canHighlightGroup(g: ScoreDeductionGroup): boolean {
  if (g.focus?.type === 'rules' || g.focus?.type === 'unplaced') return false;
  if (g.focus?.type === 'clash') return true;
  return !!(g.focus?.subject ?? g.label);
}

function idsForSubject(entries: EditorEntry[], subject: string, sectionFilter?: string): Set<string> {
  const want = normSubject(subject);
  const ids = new Set(
    entries.filter((e) => normSubject(e.subject) === want).map((e) => e.id),
  );
  if (!sectionFilter) return ids;
  const out = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id) && e.class_section === sectionFilter) out.add(e.id);
  }
  return out;
}

export function entryIdsForFocus(
  entries: EditorEntry[],
  focus: ScoreDeductionFocus | undefined,
  deduction: ScoreDeduction,
  options?: { allSections?: boolean; classSection?: string },
): Set<string> {
  const sectionFilter = options?.allSections !== false ? undefined : options?.classSection;

  if (focus?.type === 'clash') {
    const ids = clashEntryIds(entries);
    if (!sectionFilter) return ids;
    const out = new Set<string>();
    for (const e of entries) {
      if (ids.has(e.id) && e.class_section === sectionFilter) out.add(e.id);
    }
    return out;
  }

  const subject = focus?.subject ?? resolveSubject(deduction);
  if (subject) {
    return idsForSubject(entries, subject, sectionFilter);
  }

  if (focus?.type === 'assignment' && focus.assignment_id) {
    const ids = new Set(entries.filter((e) => e.assignment_id === focus.assignment_id).map((e) => e.id));
    if (!sectionFilter) return ids;
    const out = new Set<string>();
    for (const e of entries) {
      if (ids.has(e.id) && e.class_section === sectionFilter) out.add(e.id);
    }
    return out;
  }

  return new Set();
}

export function entryIdsForDeduction(
  entries: EditorEntry[],
  deduction: ScoreDeduction,
  classSection?: string,
): Set<string> {
  return entryIdsForFocus(entries, deduction.focus, deduction, {
    allSections: true,
    classSection,
  });
}

export function entryIdsForGroup(entries: EditorEntry[], group: ScoreDeductionGroup): Set<string> {
  if (group.items.length === 1) {
    return entryIdsForDeduction(entries, group.items[0]!);
  }
  const ids = new Set<string>();
  for (const item of group.items) {
    for (const id of entryIdsForDeduction(entries, item)) ids.add(id);
  }
  if (ids.size) return ids;
  return entryIdsForFocus(entries, group.focus, group.items[0]!, { allSections: true });
}

export function firstEntryIdForScroll(ids: Set<string>, entries: EditorEntry[]): string | null {
  if (!ids.size) return null;
  for (const e of entries) {
    if (ids.has(e.id)) return e.id;
  }
  return [...ids][0] ?? null;
}

export function focusSummary(ids: Set<string>, entries: EditorEntry[]): string {
  if (!ids.size) return '';
  const sections = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id) && e.class_section) sections.add(e.class_section);
  }
  const n = ids.size;
  const sec = sections.size;
  if (sec > 1) return `${n} ders saati · ${sec} şube`;
  if (sec === 1) return `${n} ders saati · ${[...sections][0]}`;
  return `${n} ders saati`;
}
