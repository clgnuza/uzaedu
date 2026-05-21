import { apiFetch, resolveDefaultApiBase } from '@/lib/api';
import { filenameFromContentDisposition, triggerBlobDownload } from '@/lib/optik-blob-download';

export type OptikScoringMode = 'standard' | 'penalty_4_1';

export type ExamSession = {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  examType: string | null;
  classId: string | null;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  questionCount: number;
  choiceCount: number;
  answerKey: Record<string, string>;
  scoringMode: OptikScoringMode;
  status: string;
  openQuestions: Array<{ id: string; title: string; max_score: number; mode?: string }>;
  examDate: string | null;
  butterflyPlanId: string | null;
  outcomePlanKey: string | null;
  questionOutcomes: Record<
    string,
    { label: string; plan_item_id?: string; week_order?: number; konu?: string }
  >;
  createdAt: string;
  updatedAt: string;
  /** Liste API özeti */
  mcScanCount?: number;
  scanCount?: number;
  keyFilledCount?: number;
  keyReady?: boolean;
};

export type QuestionOutcomeMeta = {
  label: string;
  plan_item_id?: string;
  week_order?: number;
  konu?: string;
};

export type OutcomeInsights = {
  session_id: string;
  outcome_plan_key: string | null;
  butterfly_plan_id: string | null;
  weak_outcomes: Array<{
    question: number;
    label: string;
    konu: string | null;
    week_order: number | null;
    correct_pct: number;
    top_wrong: string | null;
  }>;
  unmapped_questions: Array<{ question: number; correct_pct: number }>;
};

export type CreateExamSessionPayload = {
  title: string;
  template_id: string;
  template_name: string;
  exam_type?: string;
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  question_count?: number;
  choice_count?: number;
  scoring_mode?: OptikScoringMode;
  exam_date?: string;
  butterfly_plan_id?: string;
  outcome_plan_key?: string;
};

export type SessionScanPayload = {
  template_id: string;
  template_name: string;
  kind: 'mc' | 'open';
  student_id?: string;
  student_label?: string;
  answers?: Array<{ question: number; label: string; choice?: number }>;
  ambiguous_count?: number;
  confidence?: number;
  anchor_score?: number;
  grade_score?: number;
  grade_max_score?: number;
  grade_mode?: string;
};

export type SessionScanResponse = {
  id: string;
  netScore?: number | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  blankCount?: number | null;
  scoring?: { correct: number; wrong: number; blank: number; net: number };
};

export type OpenQuestionDef = {
  id: string;
  title: string;
  max_score: number;
  mode?: string;
  /** Beklenen cevap / rubrik — AI puanlama anahtarı */
  key_text?: string;
};

export type SessionReport = {
  session: {
    id: string;
    title: string;
    template_name: string;
    class_name: string | null;
    subject_name: string | null;
    question_count: number;
    choice_count: number;
    scoring_mode: OptikScoringMode;
    answer_key: Record<string, string>;
    status: string;
    exam_date: string | null;
    open_questions?: OpenQuestionDef[];
    butterfly_plan_id?: string | null;
    outcome_plan_key?: string | null;
    question_outcomes?: Record<string, QuestionOutcomeMeta>;
  };
  summary: {
    scanned_count: number;
    mc_count: number;
    open_count: number;
    avg_net: number | null;
    max_net: number;
    missing_count: number;
  };
  matrix: Array<{
    scan_id: string;
    student_id: string | null;
    student_label: string | null;
    correct: number | null;
    wrong: number | null;
    blank: number | null;
    net: number | null;
    answers: Array<{ question: number; label: string }>;
    scanned_at: string;
  }>;
  item_analysis: Array<{ question: number; correct_pct: number; top_wrong: string | null }>;
  hardest_questions: Array<{ question: number; correct_pct: number; top_wrong: string | null }>;
  missing_student_ids: string[];
  open_matrix?: Array<{
    scan_id: string;
    student_id: string | null;
    student_label: string | null;
    grade_score: number | null;
    grade_max_score: number | null;
    open_grades: Array<{ question_id: string; score: number; max_score: number }>;
    scanned_at: string;
  }>;
  combined_matrix?: Array<{
    student_id: string | null;
    student_label: string | null;
    correct: number | null;
    wrong: number | null;
    blank: number | null;
    net: number | null;
    answers: Array<{ question: number; label: string }>;
    open_score: number | null;
    open_max: number | null;
    open_pct: number | null;
    open_grades: Array<{ question_id: string; score: number; max_score: number }>;
  }>;
  scans: Array<{
    id: string;
    student_id: string | null;
    student_label: string | null;
    kind: string;
    net: number | null;
    grade_score: number | null;
    grade_max_score: number | null;
    scanned_at: string;
  }>;
};

export function fetchExamSessions(token: string, butterflyPlanId?: string) {
  const qs = butterflyPlanId ? `?butterfly_plan_id=${encodeURIComponent(butterflyPlanId)}` : '';
  return apiFetch<ExamSession[]>(`/optik/sessions${qs}`, { token });
}

export function fetchSessionsByButterflyPlan(token: string, planId: string) {
  return apiFetch<ExamSession[]>(`/optik/sessions/by-butterfly/${planId}`, { token });
}

export function fetchExamSession(token: string, id: string) {
  return apiFetch<ExamSession>(`/optik/sessions/${id}`, { token });
}

export function deleteExamSession(token: string, id: string) {
  return apiFetch<{ success: boolean }>(`/optik/sessions/${id}`, { method: 'DELETE', token });
}

export function patchSessionStatus(token: string, id: string, status: 'active' | 'closed' | 'archived') {
  return apiFetch<ExamSession>(`/optik/sessions/${id}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}

export function createExamSession(token: string, body: CreateExamSessionPayload) {
  return apiFetch<{ id: string; title: string }>('/optik/sessions', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function patchSessionLinks(
  token: string,
  sessionId: string,
  body: { butterfly_plan_id?: string | null; outcome_plan_key?: string | null },
) {
  return apiFetch<ExamSession>(`/optik/sessions/${sessionId}/links`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function patchQuestionOutcomes(
  token: string,
  sessionId: string,
  question_outcomes: Record<string, QuestionOutcomeMeta>,
) {
  return apiFetch<ExamSession>(`/optik/sessions/${sessionId}/question-outcomes`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ question_outcomes }),
  });
}

export function fetchOutcomeInsights(token: string, sessionId: string) {
  return apiFetch<OutcomeInsights>(`/optik/sessions/${sessionId}/outcome-insights`, { token });
}

export function patchExamAnswerKey(
  token: string,
  id: string,
  answer_key: Record<string, string>,
  scoring_mode?: OptikScoringMode,
) {
  return apiFetch<ExamSession>(`/optik/sessions/${id}/answer-key`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ answer_key, scoring_mode }),
  });
}

export function fetchSessionReport(token: string, id: string, classStudentIds?: string[]) {
  const qs =
    classStudentIds && classStudentIds.length > 0
      ? `?student_ids=${encodeURIComponent(classStudentIds.join(','))}`
      : '';
  return apiFetch<SessionReport>(`/optik/sessions/${id}/report${qs}`, { token });
}

export function postSessionScan(token: string, sessionId: string, body: SessionScanPayload) {
  return apiFetch<SessionScanResponse>(`/optik/sessions/${sessionId}/scans`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function patchOpenQuestions(token: string, sessionId: string, open_questions: OpenQuestionDef[]) {
  return apiFetch<ExamSession>(`/optik/sessions/${sessionId}/open-questions`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ open_questions }),
  });
}

export type GradeSessionOpenPayload = {
  student_id: string;
  student_label?: string;
  key_text: string;
  ocr_confidence?: number;
  items: Array<{
    question_id: string;
    student_text: string;
    mode?: string;
    max_score?: number;
  }>;
};

export function postGradeSessionOpen(token: string, sessionId: string, body: GradeSessionOpenPayload) {
  return apiFetch<{
    scan_id: string;
    open_grades: Array<{ question_id: string; score: number; max_score: number }>;
    grade_score: number;
    grade_max_score: number;
  }>(`/optik/sessions/${sessionId}/grade-open`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function postManualOpenScores(
  token: string,
  sessionId: string,
  body: {
    student_id: string;
    student_label?: string;
    grades: Array<{ question_id: string; score: number; max_score: number }>;
  },
) {
  return apiFetch<{ scan_id: string; grade_score: number; grade_max_score: number }>(
    `/optik/sessions/${sessionId}/open-scores`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    },
  );
}

export type OptikSessionPdfType =
  | 'class_list'
  | 'summary'
  | 'item_analysis'
  | 'outcome'
  | 'student';

export async function downloadSessionPdf(
  token: string,
  sessionId: string,
  type: OptikSessionPdfType,
  opts?: { studentId?: string; filename?: string },
) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const qs = new URLSearchParams({ type });
  if (opts?.studentId) qs.set('student_id', opts.studentId);
  const res = await fetch(`${base}/optik/sessions/${sessionId}/export/pdf?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `PDF indirilemedi (${res.status})`);
  }
  const blob = await res.blob();
  const fromHeader = filenameFromContentDisposition(res.headers.get('Content-Disposition'));
  triggerBlobDownload(blob, opts?.filename ?? fromHeader ?? `optik-${type}.pdf`);
}

export async function downloadSessionExport(
  token: string,
  sessionId: string,
  kind: 'csv' | 'eokul',
  filename?: string,
) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const path =
    kind === 'eokul'
      ? `/optik/sessions/${sessionId}/export/eokul`
      : `/optik/sessions/${sessionId}/export.csv`;
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `İndirme başarısız (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? (kind === 'eokul' ? `eokul-${sessionId.slice(0, 8)}.csv` : `optik-${sessionId.slice(0, 8)}.csv`);
  a.click();
  URL.revokeObjectURL(url);
}
