import { apiFetch, resolveDefaultApiBase } from '@/lib/api';
import { filenameFromContentDisposition, triggerBlobDownload } from '@/lib/optik-blob-download';

export type OptikReportQuery = {
  from?: string;
  to?: string;
  class_id?: string;
  subject_id?: string;
  template_id?: string;
  exam_type?: string;
  kind?: string;
  session_id?: string;
};

export type OptikFullReport = {
  summary: {
    total_scans: number;
    mc_scans: number;
    open_scans: number;
    total_answers: number;
    avg_confidence: number | null;
    ambiguous_total: number;
    ambiguous_rate: number | null;
    avg_grade_pct: number | null;
    avg_net?: number | null;
    mc_with_net?: number;
  };
  by_class: Array<{
    class_id: string | null;
    class_name: string;
    scans: number;
    answers: number;
    ambiguous: number;
    ambiguous_rate: number;
  }>;
  by_subject: Array<{
    subject_id: string | null;
    subject_name: string;
    scans: number;
    answers: number;
  }>;
  by_template: Array<{
    template_id: string;
    template_name: string;
    exam_type: string | null;
    scans: number;
    kind_mc: number;
    kind_open: number;
  }>;
  by_day: Array<{ date: string; scans: number; mc: number; open: number }>;
  choice_distribution: Array<{
    question: number;
    total: number;
    choices: Record<string, number>;
  }>;
  recent: Array<{
    id: string;
    scanned_at: string;
    kind: string;
    template_name: string;
    class_name: string | null;
    subject_name: string | null;
    student_label: string | null;
    answer_count: number;
    ambiguous_count: number;
    confidence: number | null;
    grade_score: number | null;
    grade_max_score: number | null;
    net_score?: number | null;
    correct_count?: number | null;
    wrong_count?: number | null;
    blank_count?: number | null;
    student_id?: string | null;
    session_id?: string | null;
  }>;
};

export type CreateScanResultPayload = {
  template_id: string;
  template_name: string;
  kind: 'mc' | 'open';
  exam_type?: string;
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  student_label?: string;
  student_id?: string;
  session_id?: string;
  answers?: Array<{ question: number; label: string }>;
  ambiguous_count?: number;
  confidence?: number;
  anchor_score?: number;
  grade_score?: number;
  grade_max_score?: number;
  grade_mode?: string;
};

export function fetchOptikReport(token: string, q: OptikReportQuery) {
  const params = new URLSearchParams();
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.class_id) params.set('class_id', q.class_id);
  if (q.subject_id) params.set('subject_id', q.subject_id);
  if (q.template_id) params.set('template_id', q.template_id);
  if (q.exam_type) params.set('exam_type', q.exam_type);
  if (q.kind) params.set('kind', q.kind);
  if (q.session_id) params.set('session_id', q.session_id);
  const qs = params.toString();
  return apiFetch<OptikFullReport>(`/optik/reports${qs ? `?${qs}` : ''}`, { token });
}

export function postOptikScanResult(token: string, body: CreateScanResultPayload) {
  return apiFetch<{ id: string; scanned_at: string }>('/optik/scan-results', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function deleteOptikScanResult(token: string, id: string) {
  return apiFetch<{ success: boolean }>(`/optik/scan-results/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function downloadReportPdf(
  token: string,
  q: OptikReportQuery,
  filename?: string,
) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const params = new URLSearchParams({ type: 'period_summary' });
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.class_id) params.set('class_id', q.class_id);
  if (q.subject_id) params.set('subject_id', q.subject_id);
  if (q.template_id) params.set('template_id', q.template_id);
  if (q.exam_type) params.set('exam_type', q.exam_type);
  if (q.kind) params.set('kind', q.kind);
  if (q.session_id) params.set('session_id', q.session_id);
  const res = await fetch(`${base}/optik/reports/export/pdf?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `PDF indirilemedi (${res.status})`);
  }
  const blob = await res.blob();
  const fromHeader = filenameFromContentDisposition(res.headers.get('Content-Disposition'));
  triggerBlobDownload(blob, filename ?? fromHeader ?? 'optik-donem-ozet.pdf');
}
