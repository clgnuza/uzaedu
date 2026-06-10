export type EvalScoreRow = {
  id?: string;
  studentId: string;
  criterionId: string;
  score: number;
  noteDate: string;
  note?: string | null;
  createdAt?: string;
  criterion?: { scoreType?: 'numeric' | 'sign' };
};

export function scoresForStudentCriterion(
  scores: EvalScoreRow[],
  studentId: string,
  criterionId: string,
): EvalScoreRow[] {
  return scores
    .filter((x) => x.studentId === studentId && x.criterionId === criterionId)
    .sort((a, b) => {
      const d = (b.noteDate ?? '').localeCompare(a.noteDate ?? '');
      if (d !== 0) return d;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
}

export function getLatestScore(
  scores: EvalScoreRow[],
  studentId: string,
  criterionId: string,
): EvalScoreRow | undefined {
  return scoresForStudentCriterion(scores, studentId, criterionId)[0];
}

export function getLatestScoreForDate(
  scores: EvalScoreRow[],
  studentId: string,
  criterionId: string,
  noteDate: string,
): EvalScoreRow | undefined {
  return scoresForStudentCriterion(scores, studentId, criterionId).find((s) => s.noteDate === noteDate);
}

export function isFilledEvalCell(
  scores: EvalScoreRow[],
  studentId: string,
  criterionId: string,
): boolean {
  return getLatestScore(scores, studentId, criterionId) !== undefined;
}
