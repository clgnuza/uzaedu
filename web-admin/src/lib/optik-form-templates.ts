import { getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';

export type OptikFormTemplate = {
  id: string;
  name: string;
  slug: string;
  formType: string;
  questionCount: number;
  choiceCount: number;
  pageSize?: string;
  examType?: string;
  gradeLevel?: string | null;
  subjectHint?: string | null;
  description?: string | null;
  scope?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const OPTIK_EXAM_TYPES = [
  { value: 'genel', label: 'Genel' },
  { value: 'yazili', label: 'Yazılı' },
  { value: 'deneme', label: 'Deneme' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'karma', label: 'Karma' },
] as const;

export const OPTIK_EXAM_LABELS: Record<string, string> = Object.fromEntries(
  OPTIK_EXAM_TYPES.map((t) => [t.value, t.label]),
);

export const OPTIK_EXAM_FILTER_ORDER = ['', 'genel', 'yazili', 'deneme', 'quiz', 'karma'] as const;

export const OPTIK_SCOPE_OPTIONS = [
  { value: '', label: 'Tüm kaynaklar' },
  { value: 'system', label: 'Sistem' },
  { value: 'school', label: 'Okul' },
  { value: 'teacher', label: 'Özel' },
] as const;

export const OPTIK_FORM_PRESETS = [
  { name: 'Yazılı (15+3 karma)', slug: 'yazili-15-3', questionCount: 18, choiceCount: 4, examType: 'yazili', gradeLevel: '6-12', subjectHint: 'Genel' },
  { name: 'Quiz (10 soru)', slug: 'quiz-10-4', questionCount: 10, choiceCount: 4, examType: 'quiz', gradeLevel: null, subjectHint: null },
  { name: 'Deneme (20 soru)', slug: 'deneme-20-5', questionCount: 20, choiceCount: 5, examType: 'deneme', gradeLevel: null, subjectHint: null },
] as const;

export const OPTIK_EXAM_TAB_STYLES: Record<string, { active: string; idle: string }> = {
  '': {
    active:
      'border-slate-400/40 bg-slate-500/15 font-semibold text-foreground shadow-sm ring-1 ring-slate-400/25 dark:bg-slate-400/20',
    idle: 'border-transparent bg-slate-500/8 text-muted-foreground hover:bg-slate-500/14 dark:bg-slate-500/15',
  },
  genel: {
    active:
      'border-violet-400/45 bg-violet-500/18 font-semibold text-violet-950 shadow-sm ring-1 ring-violet-400/30 dark:text-violet-100',
    idle: 'border-transparent bg-violet-500/10 text-violet-900/85 hover:bg-violet-500/16 dark:bg-violet-950/40 dark:text-violet-200',
  },
  yazili: {
    active:
      'border-sky-400/45 bg-sky-500/18 font-semibold text-sky-950 shadow-sm ring-1 ring-sky-400/30 dark:text-sky-100',
    idle: 'border-transparent bg-sky-500/10 text-sky-900/85 hover:bg-sky-500/16 dark:bg-sky-950/40 dark:text-sky-200',
  },
  deneme: {
    active:
      'border-amber-400/45 bg-amber-500/18 font-semibold text-amber-950 shadow-sm ring-1 ring-amber-400/30 dark:text-amber-100',
    idle: 'border-transparent bg-amber-500/10 text-amber-950/80 hover:bg-amber-500/16 dark:bg-amber-950/35 dark:text-amber-100',
  },
  quiz: {
    active:
      'border-emerald-400/45 bg-emerald-500/18 font-semibold text-emerald-950 shadow-sm ring-1 ring-emerald-400/30 dark:text-emerald-100',
    idle: 'border-transparent bg-emerald-500/10 text-emerald-900/85 hover:bg-emerald-500/16 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  karma: {
    active:
      'border-fuchsia-400/45 bg-fuchsia-500/18 font-semibold text-fuchsia-950 shadow-sm ring-1 ring-fuchsia-400/30 dark:text-fuchsia-100',
    idle: 'border-transparent bg-fuchsia-500/10 text-fuchsia-900/85 hover:bg-fuchsia-500/16 dark:bg-fuchsia-950/40 dark:text-fuchsia-200',
  },
};

export const OPTIK_EXAM_CARD_STYLES: Record<string, string> = {
  genel:
    'border-l-violet-500/70 bg-violet-500/[0.08] dark:border-l-violet-400/55 dark:bg-violet-950/30',
  yazili: 'border-l-sky-500/70 bg-sky-500/[0.08] dark:border-l-sky-400/55 dark:bg-sky-950/30',
  deneme: 'border-l-amber-500/70 bg-amber-500/[0.08] dark:border-l-amber-400/55 dark:bg-amber-950/28',
  quiz: 'border-l-emerald-500/70 bg-emerald-500/[0.08] dark:border-l-emerald-400/55 dark:bg-emerald-950/30',
  karma: 'border-l-fuchsia-500/70 bg-fuchsia-500/[0.08] dark:border-l-fuchsia-400/55 dark:bg-fuchsia-950/30',
};

export const OPTIK_EXAM_ROW_STYLES: Record<string, string> = {
  genel: 'bg-violet-500/[0.04] hover:bg-violet-500/[0.09] dark:bg-violet-950/18 dark:hover:bg-violet-950/28',
  yazili: 'bg-sky-500/[0.04] hover:bg-sky-500/[0.09] dark:bg-sky-950/18 dark:hover:bg-sky-950/28',
  deneme: 'bg-amber-500/[0.04] hover:bg-amber-500/[0.09] dark:bg-amber-950/18 dark:hover:bg-amber-950/26',
  quiz: 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.09] dark:bg-emerald-950/18 dark:hover:bg-emerald-950/28',
  karma: 'bg-fuchsia-500/[0.04] hover:bg-fuchsia-500/[0.09] dark:bg-fuchsia-950/18 dark:hover:bg-fuchsia-950/28',
};

export function optikExamPaletteKey(examType?: string | null) {
  const k = examType ?? 'genel';
  return k in OPTIK_EXAM_CARD_STYLES ? k : 'genel';
}

export function optikScopeLabel(s?: string) {
  if (s === 'system') return 'Sistem';
  if (s === 'school') return 'Okul';
  if (s === 'teacher') return 'Özel';
  return '-';
}

export function canModifyOptikFormTemplate(
  item: OptikFormTemplate,
  role: string | null,
  userId: string | null,
): boolean {
  if (!role || !userId) return false;
  if (item.scope === 'school') return role === 'school_admin';
  if (item.scope === 'teacher') return role === 'teacher';
  return false;
}

export function slugifyOptikFormName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return (base || 'form').slice(0, 64);
}

export function filterOptikFormTemplates(
  items: OptikFormTemplate[],
  opts: { examFilter?: string; scopeFilter?: string; search?: string },
): OptikFormTemplate[] {
  const q = opts.search?.trim().toLowerCase();
  return items.filter((i) => {
    if (opts.examFilter && (i.examType ?? 'genel') !== opts.examFilter) return false;
    if (opts.scopeFilter && (i.scope ?? 'system') !== opts.scopeFilter) return false;
    if (q) {
      const hay = [i.name, i.slug, i.gradeLevel, i.subjectHint, i.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function downloadOptikFormPdf(
  token: string | null,
  item: OptikFormTemplate,
  prependBlank = 0,
): Promise<void> {
  if (!token) throw new Error('Oturum gerekli');
  const qs = prependBlank > 0 ? `?prepend_blank=${prependBlank}` : '';
  const pdfApiUrl = getApiUrl(`/optik/form-templates/${item.id}/pdf${qs}${qs ? '&' : '?'}_=${Date.now()}`);
  const headers: Record<string, string> = {};
  if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(pdfApiUrl, {
    credentials: 'include',
    ...(Object.keys(headers).length > 0 && { headers }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? 'İndirme başarısız');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download =
    prependBlank > 0 ? `${item.slug || item.id}-yazili-form.pdf` : `${item.slug || item.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
