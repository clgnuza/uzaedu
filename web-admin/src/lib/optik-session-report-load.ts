/** Oturum raporu için sınıf öğrenci id listesi (boş sınıf → undefined). */
export function reportStudentIdsForClass(
  classId: string | null | undefined,
  students: Array<{ id: string }>,
): string[] | undefined {
  if (!classId) return undefined;
  return students.map((s) => s.id);
}

export function pickActiveStudentId(
  students: Array<{ id: string }>,
  preferId?: string | null,
): string {
  if (!students.length) return '';
  if (preferId && students.some((s) => s.id === preferId)) return preferId;
  return students[0]!.id;
}

export function manualScoresFromOpenGrades(
  defaults: Record<string, { score: number; max: number }>,
  openGrades: Array<{ question_id: string; score: number; max_score: number }>,
): Record<string, { score: number; max: number }> {
  const next = { ...defaults };
  for (const g of openGrades) {
    next[g.question_id] = { score: g.score, max: g.max_score };
  }
  return next;
}
