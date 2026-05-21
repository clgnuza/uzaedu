export type OptikSessionPdfType =
  | 'class_list'
  | 'summary'
  | 'item_analysis'
  | 'outcome'
  | 'student';

export type OptikPeriodPdfType = 'period_summary';

export type SessionReportForPdf = {
  session: {
    id: string;
    title: string;
    template_name: string;
    class_name: string | null;
    subject_name: string | null;
    question_count: number;
    exam_date: string | null;
    answer_key: Record<string, string> | Record<number, string>;
    open_questions: Array<{ id: string; label?: string }>;
  };
  summary: {
    scanned_count: number;
    mc_count: number;
    open_count: number;
    avg_net: number | null;
    missing_count: number;
  };
  combined_matrix: Array<{
    student_id: string | null;
    student_label: string | null;
    correct: number | null;
    wrong: number | null;
    blank: number | null;
    net: number | null;
    answers: Array<{ question: number; label: string }>;
    open_score?: number | null;
    open_max?: number | null;
    open_pct?: number | null;
  }>;
  matrix: Array<{
    student_id: string | null;
    student_label: string | null;
    correct: number | null;
    wrong: number | null;
    blank: number | null;
    net: number | null;
    answers: Array<{ question: number; label: string }>;
  }>;
  item_analysis: Array<{
    question: number;
    key: string;
    correct_pct: number;
    wrong_pct: number;
    blank_pct: number;
    top_wrong_choice: string | null;
  }>;
  hardest_questions: Array<{
    question: number;
    correct_pct: number;
    top_wrong_choice?: string | null;
  }>;
};

export type OutcomeInsightsForPdf = {
  weak_outcomes: Array<{
    question: number;
    label: string;
    konu: string | null;
    correct_pct: number;
    top_wrong: string | null;
  }>;
  unmapped_questions: Array<{ question: number; correct_pct: number }>;
};

export type PeriodReportForPdf = {
  summary: {
    total_scans: number;
    mc_scans: number;
    open_scans: number;
    avg_net?: number | null;
    ambiguous_rate: number | null;
    avg_grade_pct: number | null;
  };
  by_class: Array<{
    class_name: string;
    scans: number;
    ambiguous_rate: number;
  }>;
  by_subject: Array<{ subject_name: string; scans: number }>;
  by_day: Array<{ date: string; scans: number; mc: number; open: number }>;
};
