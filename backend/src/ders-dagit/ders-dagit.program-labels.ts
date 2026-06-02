const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROGRAM_NAME_MAX_LEN = 128;
export const PROGRAM_ENTRY_SUBJECT_MAX_LEN = 128;
export const PROGRAM_ENTRY_SECTION_MAX_LEN = 64;

export function clipVarchar(value: string, maxLen: number): string {
  const t = (value ?? '').trim();
  if (t.length <= maxLen) return t;
  if (maxLen <= 1) return t.slice(0, maxLen);
  return `${t.slice(0, maxLen - 1)}…`;
}

export function clipProgramName(value: string): string {
  return clipVarchar(value, PROGRAM_NAME_MAX_LEN);
}

export function clipProgramEntryFields(entry: {
  class_section: string;
  subject: string;
}): { class_section: string; subject: string } {
  return {
    class_section: clipVarchar(entry.class_section, PROGRAM_ENTRY_SECTION_MAX_LEN),
    subject: clipVarchar(entry.subject, PROGRAM_ENTRY_SUBJECT_MAX_LEN),
  };
}

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function subjectCatalogMap(subjects: Array<{ id: string; name: string }>): Map<string, string> {
  return new Map(subjects.map((s) => [s.id, s.name.trim()]));
}

/** Katalog adı; yoksa anlamlı subject_name; UUID ise "Ders". */
export function resolveAssignmentSubjectLabel(
  a: { subject_id?: string | null; subject_name?: string | null },
  subjectById: Map<string, string>,
): string {
  const fromCat = a.subject_id ? subjectById.get(a.subject_id) : undefined;
  if (fromCat) return fromCat;
  const sn = (a.subject_name ?? '').trim();
  if (sn && !isUuidLike(sn)) return sn;
  return sn || 'Ders';
}

/** Program slotunda görünen ders adı (yalnızca ders; şube ayrı kolonda). */
export function formatProgramEntrySubject(
  a: { subject_id?: string | null; subject_name?: string | null },
  subjectById: Map<string, string>,
): string {
  return resolveAssignmentSubjectLabel(a, subjectById);
}

export function buildGeneratedProgramName(opts: {
  score: number;
  version: number;
  classSections: string[];
  at?: Date;
}): string {
  const at = opts.at ?? new Date();
  const when = at.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const n = new Set(opts.classSections.map((s) => s.trim()).filter(Boolean)).size;
  const secPart = n > 0 ? ` · ${n} şube` : '';
  return clipProgramName(`Taslak ${opts.version} · Puan ${opts.score} · ${when}${secPart}`);
}
