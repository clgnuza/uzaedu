const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const secs = [...new Set(opts.classSections.map((s) => s.trim()).filter(Boolean))].sort();
  const head = secs.slice(0, 3).join(', ');
  const tail = secs.length > 3 ? ` +${secs.length - 3} şube` : '';
  const secPart = head ? ` · ${head}${tail}` : '';
  return `Taslak ${opts.version} · Puan ${opts.score} · ${when}${secPart}`;
}
