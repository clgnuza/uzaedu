export type ScoreDeduction = {
  id: string;
  title: string;
  subtitle?: string;
  points: number;
  href?: string;
};

export type ProgramScoreBreakdown = {
  score: number;
  max_score: number;
  points_to_full: number;
  deductions: ScoreDeduction[];
};
