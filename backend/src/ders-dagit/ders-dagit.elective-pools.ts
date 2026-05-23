/** Seçmeli havuz taslağı — TTKB kataloğu + stüdyo şubeleri */

import { sortClassSections } from './class-section-sort';
import { splitSectionTrack } from './ders-dagit.elective';
import type { TtkbCatalogRow } from './ders-dagit.ttkb-seed';
import { gradeFromClassSection } from './ders-dagit.ttkb-seed';

export type ElectivePoolDraft = {
  grade: number;
  name: string;
  base_section: string;
  member_sections: string[];
  subject_names: string[];
};

function trackClustersForSections(sections: string[]): Map<string, string[]> {
  const byBase = new Map<string, Set<string>>();
  for (const sec of sections) {
    const t = String(sec).trim();
    if (!t) continue;
    const { base, track } = splitSectionTrack(t);
    if (!track) continue;
    const set = byBase.get(base) ?? new Set<string>();
    set.add(t);
    byBase.set(base, set);
  }
  const out = new Map<string, string[]>();
  for (const [base, set] of byBase) {
    const members = sortClassSections([...set]);
    if (members.length >= 2) out.set(base, members);
  }
  return out;
}

function memberSectionsForGrade(grade: number, studioSections: string[]): string[] {
  const gradeSecs = sortClassSections(
    studioSections.filter((s) => gradeFromClassSection(s) === grade),
  );
  if (gradeSecs.length >= 2) {
    const clusters = trackClustersForSections(gradeSecs);
    if (clusters.size > 0) {
      let best: string[] = [];
      for (const m of clusters.values()) {
        if (m.length > best.length) best = m;
      }
      return best;
    }
    return gradeSecs;
  }
  if (gradeSecs.length === 1) {
    const base = gradeSecs[0]!;
    return [`${base}-S1`, `${base}-S2`];
  }
  return [`${grade}A-S1`, `${grade}A-S2`];
}

export function buildElectivePoolDraftsFromCatalog(
  catalogRows: TtkbCatalogRow[],
  studioSections: string[],
): ElectivePoolDraft[] {
  const namesByGrade = new Map<number, Set<string>>();
  for (const r of catalogRows) {
    if (!r.grade || r.grade < 1) continue;
    const set = namesByGrade.get(r.grade) ?? new Set<string>();
    set.add(r.subject_name);
    namesByGrade.set(r.grade, set);
  }
  const drafts: ElectivePoolDraft[] = [];
  for (const [grade, names] of [...namesByGrade].sort((a, b) => a[0] - b[0])) {
    const member_sections = memberSectionsForGrade(grade, studioSections);
    const base_section = splitSectionTrack(member_sections[0]!).base || member_sections[0]!;
    drafts.push({
      grade,
      name: `${grade}. Sınıf Seçmeli`,
      base_section,
      member_sections,
      subject_names: [...names].sort((a, b) => a.localeCompare(b, 'tr')),
    });
  }
  return drafts;
}
