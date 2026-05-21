import { apiFetch } from '@/lib/api';
import type { OptikFormTemplate } from '@/lib/optik-form-templates';

export type OptikStatus = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  daily_limit_per_user: number | null;
  usage_today: number | null;
  remaining_today: number | null;
};

export type OcrKind = 'KEY' | 'STUDENT';

export type OcrResult = {
  text: string;
  confidence: number;
  needs_rescan?: boolean;
};

export type GradeMode =
  | 'CONTENT'
  | 'LANGUAGE'
  | 'CONTENT_LANGUAGE'
  | 'MATH_FINAL'
  | 'MATH_STEPS';

export type GradeResult = {
  question_id: string;
  mode: GradeMode;
  score: number;
  max_score: number;
  confidence: number;
  needs_rescan: boolean;
  reasons: Array<{ criterion: string; points: number; evidence: string[] }>;
};

export type OptikRubricTemplate = {
  id: string;
  slug: string;
  name: string;
  mode: string;
  subject: string | null;
  criteria: Array<{ criterion: string; max_points: number; weight?: number }>;
};

export type OmrScanBubble = {
  question: number;
  choice: number;
  label: string;
  x: number;
  y: number;
  r: number;
};

export type OmrScanLayout = {
  version: string;
  page_width: number;
  page_height: number;
  anchors: Array<{ x: number; y: number; size: number }>;
  bubbles: OmrScanBubble[];
  question_count: number;
  blocks: Array<{ label: string; questionCount: number; choiceCount: number }>;
};

export function fetchOptikStatus(token: string) {
  return apiFetch<OptikStatus>('/optik/status', { token });
}

export function fetchOptikTemplates(token: string) {
  return apiFetch<OptikFormTemplate[]>('/optik/form-templates', { token });
}

export function fetchOptikScanLayout(token: string, templateId: string) {
  return apiFetch<OmrScanLayout>(`/optik/form-templates/${templateId}/scan-layout`, { token });
}

export async function ensureOptikScanLayout(
  token: string,
  templateId: string,
  cache: {
    get: (id: string) => OmrScanLayout | null;
    set: (id: string, layout: OmrScanLayout) => void;
  },
): Promise<OmrScanLayout> {
  const hit = cache.get(templateId);
  if (hit) return hit;
  const layout = await fetchOptikScanLayout(token, templateId);
  cache.set(templateId, layout);
  return layout;
}

export function fetchOptikRubrics(token: string) {
  return apiFetch<OptikRubricTemplate[]>('/optik/rubric-templates', { token });
}

export function postOptikOcr(
  token: string,
  imageBase64: string,
  opts?: { language_hint?: 'tr' | 'en'; kind?: OcrKind },
) {
  return apiFetch<OcrResult>('/optik/ocr', {
    method: 'POST',
    token,
    body: JSON.stringify({
      image_base64: imageBase64,
      language_hint: opts?.language_hint ?? 'tr',
      kind: opts?.kind ?? 'STUDENT',
    }),
  });
}

export function postOptikGrade(
  token: string,
  body: {
    template_id: string;
    question_id: string;
    mode: GradeMode;
    max_score: number;
    key_text: string;
    student_text: string;
    ocr_confidence: number;
    language?: 'tr' | 'en';
    subject?: string;
  },
) {
  return apiFetch<GradeResult>('/optik/grade', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function isOptikMcTemplate(t: OptikFormTemplate) {
  const ft = (t.formType ?? 'multiple_choice').toLowerCase();
  return ft === 'multiple_choice' || ft === 'mc' || ft === 'optik';
}
