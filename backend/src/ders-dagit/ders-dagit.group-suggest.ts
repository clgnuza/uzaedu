import { sortClassSections } from './class-section-sort';
import { clusterElectiveImportRows, splitSectionTrack } from './ders-dagit.elective';
import type { DersDagitGroupMode } from './ders-dagit.groups';
import type { MebSchoolType } from './ders-dagit.school-profile';

const MESLEK_PARALLEL_RE = /atölye|atolye|staj|meslek|uygulama|workshop/i;

export type GroupSuggestion = {
  key: string;
  name: string;
  abbreviation: string;
  parallel_mode: DersDagitGroupMode;
  member_sections: string[];
  source: 'section_tracks' | 'assignment_joined' | 'elective_cluster';
  reason: string;
};

function membersKey(mode: DersDagitGroupMode, sections: string[]): string {
  return `${mode}:${sortClassSections(sections).join('\0')}`;
}

function abbrFromBase(base: string): string {
  const s = base.replace(/[^\wÇĞİÖŞÜçğıöşü]/gi, '').slice(0, 8);
  return (s || 'grp').toLowerCase();
}

function collectTrackClusters(sections: string[]): Map<string, string[]> {
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

export function suggestGroupsFromData(args: {
  sections: string[];
  school_type?: MebSchoolType | string;
  assignments: Array<{
    subject_name: string;
    class_sections: string[];
    teacher_ids?: string[];
    options?: Record<string, unknown> | null;
  }>;
  existing: Array<{ member_sections: string[]; parallel_mode: string | null }>;
}): GroupSuggestion[] {
  const schoolType = args.school_type as MebSchoolType | undefined;
  const seen = new Set<string>();
  const existingKeys = new Set(
    args.existing.map((g) =>
      membersKey(
        (g.parallel_mode === 'subgroups' ||
        g.parallel_mode === 'teacher_multi_class' ||
        g.parallel_mode === 'parallel_rooms'
          ? g.parallel_mode
          : 'parallel_rooms') as DersDagitGroupMode,
        g.member_sections ?? [],
      ),
    ),
  );
  const out: GroupSuggestion[] = [];

  function push(s: GroupSuggestion) {
    const key = membersKey(s.parallel_mode, s.member_sections);
    if (seen.has(key) || existingKeys.has(key)) return;
    seen.add(key);
    out.push(s);
  }

  const allSecs = new Set<string>([...args.sections]);
  for (const a of args.assignments) {
    for (const s of a.class_sections ?? []) if (s?.trim()) allSecs.add(s.trim());
  }

  for (const [base, members] of collectTrackClusters([...allSecs])) {
    const parMode = modeForTrackCluster(schoolType, base);
    push({
      key: `tracks:${base}`,
      name: schoolType === 'mtal' ? `${base}. sınıf — dal/şube` : `${base} — alt gruplar`,
      abbreviation: abbrFromBase(base),
      parallel_mode: parMode,
      member_sections: members,
      source: 'section_tracks',
      reason: `Şube adları (${members.join(', ')}) aynı sınıfın bölünmesi gibi görünüyor.`,
    });
  }

  const byTeacherSubject = new Map<string, string[]>();
  for (const a of args.assignments) {
    const secs = sortClassSections(
      (a.class_sections ?? []).map((s) => String(s).trim()).filter(Boolean),
    );
    if (secs.length < 2) continue;
    const tids = (a.teacher_ids ?? []).filter(Boolean).sort().join(',');
    if (tids) {
      const tk = `${tids}\0${a.subject_name}`;
      const prev = byTeacherSubject.get(tk) ?? [];
      byTeacherSubject.set(tk, sortClassSections([...new Set([...prev, ...secs])]));
    }
  }
  for (const [tk, secs] of byTeacherSubject) {
    if (secs.length < 2) continue;
    const subject = tk.split('\0')[1] ?? 'Ders';
    push({
      key: `teacher:${tk}`,
      name: `${subject} — öğretmen birleşik`,
      abbreviation: abbrFromBase(secs[0] ?? 'ogr'),
      parallel_mode: 'teacher_multi_class',
      member_sections: secs,
      source: 'assignment_joined',
      reason: `Aynı öğretmen, çoklu şube: ${subject}`,
    });
  }

  for (const a of args.assignments) {
    const secs = sortClassSections(
      (a.class_sections ?? []).map((s) => String(s).trim()).filter(Boolean),
    );
    if (secs.length < 2) continue;
    const opts = a.options ?? {};
    const joined =
      opts.use_joined === true ||
      (Array.isArray(opts.joined_sections) && (opts.joined_sections as string[]).length >= 2);
    const parMode = modeForJoinedAssignment(schoolType, joined, a.subject_name);
    push({
      key: `join:${secs.join('|')}`,
      name: joined ? `${secs[0]} birleşik` : `${secs.join(' + ')} paralel`,
      abbreviation: abbrFromBase(secs[0] ?? 'par'),
      parallel_mode: parMode,
      member_sections: secs,
      source: 'assignment_joined',
      reason: joined
        ? `Atamada birleşik şube: ${a.subject_name}`
        : `Atamada çoklu şube: ${a.subject_name}`,
    });
  }

  const electiveRows = args.assignments.map((a) => ({
    subject_name: a.subject_name,
    class_sections: a.class_sections ?? [],
  }));
  for (const c of clusterElectiveImportRows(electiveRows)) {
    const members = sortClassSections(c.member_sections);
    if (members.length < 2) continue;
    push({
      key: `elective:${c.base_section}`,
      name: `${c.base_section} seçmeli`,
      abbreviation: abbrFromBase(c.base_section),
      parallel_mode: 'subgroups',
      member_sections: members,
      source: 'elective_cluster',
      reason: `Seçmeli ders şubeleri: ${c.subject_names.slice(0, 3).join(', ')}`,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function modeForJoinedAssignment(
  schoolType: MebSchoolType | undefined,
  joined: boolean,
  subjectName: string,
): DersDagitGroupMode {
  if (joined) return 'subgroups';
  if (schoolType === 'mtal' && MESLEK_PARALLEL_RE.test(subjectName)) return 'parallel_rooms';
  if (schoolType === 'mtal') return 'parallel_rooms';
  return 'parallel_rooms';
}

function modeForTrackCluster(schoolType: MebSchoolType | undefined, base: string): DersDagitGroupMode {
  if (schoolType === 'mtal' && /^\d{1,2}$/.test(base.trim())) return 'subgroups';
  return 'subgroups';
}

export function suggestionExists(
  s: GroupSuggestion,
  existing: Array<{ member_sections: string[]; parallel_mode: string | null }>,
): boolean {
  const key = membersKey(s.parallel_mode, s.member_sections);
  return existing.some(
    (g) =>
      membersKey(
        (g.parallel_mode === 'subgroups' ||
        g.parallel_mode === 'teacher_multi_class' ||
        g.parallel_mode === 'parallel_rooms'
          ? g.parallel_mode
          : 'parallel_rooms') as DersDagitGroupMode,
        g.member_sections ?? [],
      ) === key,
  );
}
