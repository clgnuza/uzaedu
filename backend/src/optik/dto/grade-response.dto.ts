export interface GradeReasonDto {
  criterion: string;
  points: number;
  evidence?: string[];
}

export interface GradeResultDto {
  question_id: string;
  mode: string;
  score: number;
  max_score: number;
  confidence: number;
  needs_rescan: boolean;
  reasons?: GradeReasonDto[];
}
