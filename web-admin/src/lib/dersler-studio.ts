import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { canonicalizeSectionList, mergeRecordBySectionAlias, sectionsMatch } from '@/lib/class-section-canonical';
import { sortClassSections, sortValidationIssues } from '@/lib/class-section-sort';

export const SCHOOL_TYPE_LABELS: Record<string, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  anadolu_lise: 'Anadolu Lisesi',
  mtal: 'MTAL',
  fen_lise: 'Fen/Sosyal Bilimler Lisesi',
  aihl: 'Anadolu İmam Hatip',
};

export type DerslerSubject = {
  id: string;
  name: string;
  short_code: string | null;
  class_hours: Record<string, number>;
  is_elective?: boolean;
};

export type DerslerAssignment = {
  id: string;
  subject_id?: string | null;
  subject_name: string;
  class_sections: string[];
  weekly_hours: number;
  teacher_ids?: string[];
  room_ids?: string[];
  group_id?: string | null;
  biweekly?: boolean;
  place_first?: boolean;
  min_days_per_week?: number | null;
  max_per_day?: number | null;
  options?: Record<string, unknown>;
};

export type TtkbPreviewCell = {
  subject_code?: string;
  subject_name: string;
  class_section: string;
  grade?: number;
  weekly_hours: number;
  source: string;
};

export type TtkbSubjectSummary = {
  subject_code: string;
  subject_name: string;
  hours_by_grade: Record<number, number>;
  section_count: number;
};

export type TtkbPreview = {
  sections: string[];
  sections_without_grade?: string[];
  grades?: number[];
  empty_message?: string;
  school_type: string;
  mode?: 'sections' | 'grade_catalog';
  cell_count: number;
  subject_count: number;
  yillik_plan_keys?: number;
  sample: TtkbPreviewCell[];
  cells?: TtkbPreviewCell[];
  by_grade?: Record<number, TtkbPreviewCell[]>;
  subject_summary?: TtkbSubjectSummary[];
  totals_by_section?: Record<string, number>;
  totals_by_grade?: Record<string, number>;
};

export type SchoolCatalogPreview = {
  school_type: string;
  class_count: number;
  school_subject_count: number;
  class_sections: string[];
  ttkb_mode: 'sections' | 'grade_catalog' | 'none';
  ttkb_cell_count: number;
  ttkb_subject_count: number;
  by_grade: Record<number, TtkbPreviewCell[]>;
  subject_summary: TtkbSubjectSummary[];
};

/** TTKB önizleme listesini CSV olarak indir (Excel uyumlu UTF-8 BOM). */
export function downloadTtkbCsv(
  preview: TtkbPreview,
  schoolTypeLabel: string,
  filenamePrefix = 'ttkb-ders-listesi',
): void {
  const rows = preview.cells?.length ? preview.cells : preview.sample;
  if (!rows.length) return;
  const header = ['Sınıf', 'Ders kodu', 'Ders', 'Haftalık saat', 'Kaynak'];
  const lines = [
    header.join(';'),
    ...rows.map((c) =>
      [
        c.grade != null ? String(c.grade) : '',
        c.subject_code ?? '',
        c.subject_name.replace(/;/g, ','),
        String(c.weekly_hours),
        c.source,
      ].join(';'),
    ),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${schoolTypeLabel.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export type DerslerWarning = {
  id: string;
  severity: 'error' | 'warning';
  message: string;
};

export function schoolTypeLabel(type: string): string {
  return SCHOOL_TYPE_LABELS[type] ?? type;
}

export { canonicalizeSectionList, mergeRecordBySectionAlias } from '@/lib/class-section-canonical';

export function subjectTotalHours(classHours: Record<string, number> | undefined): number {
  return Object.values(classHours ?? {}).reduce((s, h) => s + (Number(h) || 0), 0);
}

export function sectionsFromSubjects(subjects: DerslerSubject[]): string[] {
  const set = new Set<string>();
  for (const s of subjects) {
    for (const sec of Object.keys(s.class_hours ?? {})) {
      if (sec.trim()) set.add(sec);
    }
  }
  return sortClassSections([...set]);
}

export function computeDerslerWarnings(
  subjects: DerslerSubject[],
  assignments: DerslerAssignment[],
  validation: ValidationIssue[],
  teacherNameById: Map<string, string>,
): DerslerWarning[] {
  const out: DerslerWarning[] = [];
  const rel = sortValidationIssues(
    validation.filter((v) =>
      ['SECTION_NO_HOURS', 'ASSIGN_NO_SECTION', 'NO_ROOMS_LIST', 'TEACHER_OVER_MAX', 'TEACHER_UNDER_MIN'].includes(
        v.code,
      ),
    ),
  );
  for (const [i, v] of rel.slice(0, 8).entries()) {
    const id = v.entity_id ? `${v.code}:${v.entity_id}` : `${v.code}:${i}:${v.message}`;
    out.push({ id, severity: v.severity === 'error' ? 'error' : 'warning', message: v.message });
  }

  for (const sub of subjects) {
    const planned = sub.class_hours ?? {};
    const keys = Object.keys(planned);
    if (!keys.length) {
      out.push({
        id: `sub-empty-${sub.id}`,
        severity: 'warning',
        message: `${sub.name}: şube/saat planı yok.`,
      });
    }
    for (const [sec, planH] of Object.entries(planned)) {
      const plan = Number(planH) || 0;
      if (!plan) continue;
      const assigned = assignments
        .filter(
          (a) =>
            (a.subject_id === sub.id || a.subject_name.trim().toLowerCase() === sub.name.trim().toLowerCase()) &&
            a.class_sections.some((cs) => sectionsMatch(cs, sec)),
        )
        .reduce((s, a) => s + (Number(a.weekly_hours) || 0), 0);
      if (assigned < plan) {
        out.push({
          id: `gap-${sub.id}-${sec}`,
          severity: 'warning',
          message: `${sub.name} · ${sec}: plan ${plan} saat, atanan ${assigned} saat (${plan - assigned} eksik).`,
        });
      } else if (assigned > plan) {
        out.push({
          id: `over-${sub.id}-${sec}`,
          severity: 'error',
          message: `${sub.name} · ${sec}: plan ${plan} saat, atanan ${assigned} saat (fazla).`,
        });
      }
    }
  }

  for (const a of assignments) {
    if (!a.teacher_ids?.length) {
      out.push({
        id: `no-t-${a.id}`,
        severity: 'warning',
        message: `${a.subject_name} (${a.class_sections.join(', ') || '—'}): öğretmen seçilmedi.`,
      });
    }
    for (const tid of a.teacher_ids ?? []) {
      if (!teacherNameById.has(tid)) {
        out.push({
          id: `bad-t-${a.id}-${tid}`,
          severity: 'error',
          message: `${a.subject_name}: geçersiz öğretmen kimliği.`,
        });
      }
    }
  }

  return out.slice(0, 24);
}

export function filterAssignments(
  rows: DerslerAssignment[],
  subject: DerslerSubject | null,
  sectionFilter: string,
): DerslerAssignment[] {
  return rows.filter((a) => {
    if (subject) {
      const matchSub =
        a.subject_id === subject.id ||
        a.subject_name.trim().toLowerCase() === subject.name.trim().toLowerCase();
      if (!matchSub) return false;
    }
    if (sectionFilter && !a.class_sections.some((cs) => sectionsMatch(cs, sectionFilter))) return false;
    return true;
  });
}
