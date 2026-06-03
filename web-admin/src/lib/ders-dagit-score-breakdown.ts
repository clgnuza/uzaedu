export type ScoreDeductionFocus = {
  type: 'assignment' | 'clash' | 'unplaced' | 'rules';
  assignment_id?: string;
  subject?: string;
  class_section?: string;
  rule_key?: string;
};

export type ScoreDeduction = {
  id: string;
  title: string;
  subtitle?: string;
  /** Satır sağı — özet kutucuk */
  aside?: string;
  points: number;
  href?: string;
  focus?: ScoreDeductionFocus;
};

export type ProgramScoreBreakdown = {
  score: number;
  max_score: number;
  points_to_full: number;
  deductions: ScoreDeduction[];
};
