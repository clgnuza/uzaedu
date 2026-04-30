'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  FileText,
  FileEdit,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Download,
  Check,
  Settings,
  ArrowRight,
  HelpCircle,
  Clock,
  FileSpreadsheet,
  ShoppingBag,
  Sparkles,
  Layers,
  Trash2,
  Archive,
  Eye,
  CheckCircle2,
  Calendar,
  BookOpen,
  ListChecks,
  GraduationCap,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getYillikPlanEvrakStorage, type YillikPlanEvrakVariant } from '@/config/yillik-plan-evrak-variants';
import { filterBilsemCatalogSubjects } from '@/lib/bilsem-catalog-subjects';
import { BILSEM_ALT_GRUPLAR, BILSEM_ANA_GRUPLAR } from '@/lib/bilsem-groups';
import { BilsemPlanSourceEngagement } from '@/components/bilsem/bilsem-plan-source-engagement';
import { EvrakWizardHero } from '@/components/evrak/evrak-wizard-hero';

type FormSchemaField = { key: string; label: string; type: string; required?: boolean };

type DocumentTemplate = {
  id: string;
  type: string;
  subject_code?: string | null;
  subject_label?: string | null;
  subjectCode?: string | null;
  subjectLabel?: string | null;
  grade: number | null;
  file_format?: string;
  fileFormat?: string;
  is_active?: boolean;
  isActive?: boolean;
  requiresMerge?: boolean;
  formSchema?: FormSchemaField[] | null;
  form_schema?: FormSchemaField[] | null;
};

type ListResponse = { total: number; items: DocumentTemplate[] };

type OptionsResponse = {
  academic_years: string[];
  sections?: { value: string; label: string }[];
};

type SubjectsResponse = { items: Array<{ code: string; label: string; ana_grup?: string | null }> };

type BilsemOutcomeSetRow = {
  id: string;
  subjectCode?: string | null;
  subject_code?: string | null;
  subjectLabel?: string | null;
  subject_label?: string | null;
  grupAdi?: string | null;
  grup_adi?: string | null;
  academicYear?: string | null;
  academic_year?: string | null;
  grade?: number | null;
  yetenekLabel?: string | null;
  yetenek_label?: string | null;
  ownerUserId?: string | null;
  owner_user_id?: string | null;
};

type BilsemOutcomeItemRow = {
  id: string;
  description: string;
  code?: string | null;
  unite?: string | null;
  konu?: string | null;
  sortOrder?: number;
};

type BilsemPlanContentRow = {
  id: string;
  week_order?: number;
  unite?: string | null;
  konu?: string | null;
  kazanimlar?: string | null;
};

type ZumreItem = { isim: string; unvan: string };

function parseZumreRaw(raw: string): ZumreItem[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => {
      const pipe = t.indexOf('|');
      if (pipe >= 0) return { isim: t.slice(0, pipe).trim(), unvan: t.slice(pipe + 1).trim() };
      return { isim: t, unvan: '' };
    })
    .filter((x) => x.isim.length > 0);
}

function dedupeZumre(items: ZumreItem[]): ZumreItem[] {
  const map = new Map<string, ZumreItem>();
  for (const item of items) {
    const key = item.isim.toLocaleLowerCase('tr-TR');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    if (!prev.unvan && item.unvan) map.set(key, item);
  }
  return [...map.values()];
}

function serializeZumre(items: ZumreItem[]): string {
  return items.map((x) => (x.unvan ? `${x.isim}|${x.unvan}` : x.isim)).join(', ');
}

function mudurFromZumre(items: ZumreItem[]): string {
  return items.find((x) => x.unvan === 'Okul Müdürü')?.isim ?? '';
}

type PreviewResponse =
  | { format: 'xlsx'; sheet_name: string; sheet_html: string; preview_url?: string }
  | { format: 'docx'; sheet_name?: string; sheet_html?: string; preview_available: true }
  | { format: 'docx'; preview_available: false; message: string; sheet_name?: string; sheet_html?: string };

/** /evrak — kart üst şeritleri (mobil / masaüstü) */
const EVRAK_UI_PANEL = {
  settings: {
    card: 'border-sky-200/50 dark:border-sky-900/42 border-l-4 border-l-sky-500/55',
    head: 'border-b border-sky-200/40 bg-sky-500/[0.07] dark:border-sky-900/38',
  },
  plan: {
    card: 'border-sky-200/45 dark:border-sky-900/40',
    head: 'border-sky-200/40 bg-sky-500/6 dark:border-sky-900/40',
    iconWrap: 'bg-sky-500/15',
    iconClass: 'text-sky-800 dark:text-sky-300',
  },
  templates: {
    card: 'border-emerald-200/45 dark:border-emerald-900/40',
    head: 'border-emerald-200/40 bg-emerald-500/6 dark:border-emerald-900/40',
    iconWrap: 'bg-emerald-500/15',
    iconClass: 'text-emerald-800 dark:text-emerald-300',
  },
  archive: {
    card: 'border-amber-200/45 dark:border-amber-900/40',
    head: 'border-amber-200/40 bg-amber-500/6 dark:border-amber-900/40',
    iconWrap: 'bg-amber-500/15',
    iconClass: 'text-amber-900 dark:text-amber-200',
  },
} as const;

type YillikPlanWizardFilters = {
  grade: string;
  section: string;
  subject_code: string;
  academic_year: string;
  curriculum_model: string;
  ana_grup: string;
  alt_grup: string;
};

const emptyWizardFilters = (): YillikPlanWizardFilters => ({
  grade: '',
  section: '',
  subject_code: '',
  academic_year: '',
  curriculum_model: '',
  ana_grup: '',
  alt_grup: '',
});

function loadFiltersFromStorage(scope: YillikPlanEvrakVariant): YillikPlanWizardFilters {
  if (typeof window === 'undefined') return emptyWizardFilters();
  const { filtersKey } = getYillikPlanEvrakStorage(scope);
  try {
    const s = localStorage.getItem(filtersKey);
    if (!s) return emptyWizardFilters();
    const o = JSON.parse(s);
    return {
      grade: o?.grade ?? '',
      section: o?.section ?? '',
      subject_code: o?.subject_code ?? '',
      academic_year: o?.academic_year ?? '',
      curriculum_model: o?.curriculum_model ?? '',
      ana_grup: o?.ana_grup ?? '',
      alt_grup: o?.alt_grup ?? '',
    };
  } catch {
    return emptyWizardFilters();
  }
}

function saveFiltersToStorage(scope: YillikPlanEvrakVariant, f: YillikPlanWizardFilters) {
  if (typeof window === 'undefined') return;
  const { filtersKey } = getYillikPlanEvrakStorage(scope);
  try {
    localStorage.setItem(filtersKey, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

type ArchiveItem = {
  id: string;
  displayLabel: string;
  grade: string | null;
  section: string | null;
  subjectCode: string | null;
  subjectLabel: string | null;
  academicYear: string | null;
  fileFormat: string;
  createdAt: string;
  curriculumModel?: string | null;
};

function isArchiveBilsem(item: ArchiveItem): boolean {
  if (item.curriculumModel === 'bilsem') return true;
  const code = (item.subjectCode ?? '').toLowerCase();
  if (code.startsWith('bilsem')) return true;
  const dl = (item.displayLabel ?? '').toLowerCase();
  return dl.includes('bilsem');
}

function ArchivePlanCards({
  items,
  variant,
  redownloadingId,
  deletingId,
  onRedownload,
  onApply,
  onDelete,
}: {
  items: ArchiveItem[];
  variant: 'bilsem' | 'other';
  redownloadingId: string | null;
  deletingId: string | null;
  onRedownload: (id: string) => void;
  onApply: (item: ArchiveItem) => void;
  onDelete: (id: string) => void;
}) {
  const bilsem = variant === 'bilsem';
  const shell =
    bilsem
      ? 'overflow-hidden rounded-xl border border-violet-400/35 bg-violet-500/[0.03] dark:border-violet-500/30 dark:bg-violet-950/20'
      : 'overflow-hidden rounded-xl border border-border/80 bg-card/50';
  return (
    <ul className={`divide-y ${shell}`} role="list">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex flex-col gap-2 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-1.5 sm:pl-3 sm:pr-2',
            bilsem && 'gap-1.5 px-2 py-1.5 max-sm:text-[11px] sm:gap-3 sm:px-2.5 sm:py-2',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0 text-[10px] font-medium ${
                  item.fileFormat === 'xlsx'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-300'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-900/45 dark:text-sky-300'
                }`}
              >
                {item.fileFormat === 'xlsx' ? <FileSpreadsheet className="size-3" /> : <FileText className="size-3" />}
                {item.fileFormat === 'xlsx' ? 'Excel' : 'Word'}
              </span>
              {bilsem && (
                <span className="rounded bg-violet-600 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-violet-500">
                  Bilsem
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-3 shrink-0 opacity-70" />
                {formatArchiveDate(item.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-foreground sm:line-clamp-1" title={item.displayLabel}>
              {item.displayLabel}
            </p>
          </div>
          <div
            className={`flex shrink-0 flex-wrap items-center justify-end gap-1 border-t pt-2 sm:border-t-0 sm:pt-0 ${
              bilsem ? 'border-violet-400/20 dark:border-violet-500/15' : 'border-border/60'
            }`}
          >
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={deletingId === item.id || redownloadingId === item.id}
              title="Arşivden sil"
              className={`inline-flex h-7 items-center justify-center gap-0.5 rounded-md border px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                bilsem
                  ? 'border-red-400/35 text-red-700 hover:bg-red-500/10 dark:border-red-500/30 dark:text-red-400'
                  : 'border-destructive/30 text-destructive hover:bg-destructive/10'
              }`}
            >
              <Trash2 className="size-3" />
              {deletingId === item.id ? '…' : 'Sil'}
            </button>
            <button
              type="button"
              onClick={() => onRedownload(item.id)}
              disabled={redownloadingId === item.id || deletingId === item.id}
              title="Tekrar indir (kota düşmez)"
              className={`inline-flex h-7 items-center justify-center gap-0.5 rounded-md px-2.5 text-[11px] font-semibold text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                bilsem
                  ? 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              <Download className="size-3" />
              {redownloadingId === item.id ? '…' : 'İndir'}
            </button>
            <button
              type="button"
              onClick={() => onApply(item)}
              disabled={deletingId === item.id}
              title="Seçimlere uygula"
              className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                bilsem
                  ? 'border-violet-400/45 bg-background/90 hover:bg-violet-500/10 dark:border-violet-500/40'
                  : 'border-border hover:bg-muted'
              }`}
            >
              Uygula
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tarih formatı: "2 gün önce" veya "16 Şub 2025" */
function formatArchiveDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Öğretmen arayüzü: Bilsem Word akışında «sınıf» yerine düzey; form alanı `sinif` değişmez */
function formatYillikPlanGradeLabel(grade: string | number | null | undefined, bilsem: boolean): string {
  if (grade === null || grade === undefined || grade === '') return '';
  const g = typeof grade === 'number' ? String(grade) : String(grade).trim();
  if (!g) return '';
  return bilsem ? `${g}. düzey` : `${g}. Sınıf`;
}

function labelBilsemOutcomeSetOption(
  s: BilsemOutcomeSetRow,
  catalog: Array<{ code: string; label: string }>,
  catalogFallback: Array<{ code: string; label: string }> | undefined,
  currentUserId?: string | null,
): string {
  const yetenek = (s.yetenekLabel ?? s.yetenek_label ?? '').trim();
  const subj = (s.subjectLabel ?? s.subject_label ?? '').trim();
  const grup = (s.grupAdi ?? s.grup_adi ?? '').trim();
  const year = (s.academicYear ?? s.academic_year ?? '').trim();
  const g = s.grade;
  const gradePart = g != null && Number.isFinite(Number(g)) ? formatYillikPlanGradeLabel(g, true) : '';
  const parts = [yetenek, subj, grup, year, gradePart].filter(Boolean);
  const mine =
    currentUserId && (s.ownerUserId ?? s.owner_user_id) === currentUserId ? ' (sizin)' : '';
  if (parts.length) return parts.join(' · ') + mine;
  const sc = (s.subjectCode ?? s.subject_code ?? '').trim();
  if (sc) {
    const lab =
      catalog.find((x) => x.code === sc)?.label?.trim() ||
      catalogFallback?.find((x) => x.code === sc)?.label?.trim();
    return (lab || sc) + mine;
  }
  return 'Öğrenme Çıktıları' + mine;
}

/** Bilsem: sonner toast — minimal, küçük, violet ton */
const bilsemToastOk = {
  className:
    '!gap-1 !rounded-xl !border !border-violet-500/20 !bg-violet-50/95 !py-2.5 !text-[13px] !shadow-md !shadow-violet-500/10 dark:!border-violet-500/35 dark:!bg-violet-950/50 dark:!text-violet-50',
};
const bilsemToastErr = {
  className:
    '!gap-1 !rounded-xl !border !border-red-500/15 !bg-red-50/90 !py-2.5 !text-[13px] !text-red-950 dark:!border-red-500/25 dark:!bg-red-950/40 dark:!text-red-50',
};

function getInitialFilters(searchParams: URLSearchParams | null, scope: YillikPlanEvrakVariant): YillikPlanWizardFilters {
  const stored = loadFiltersFromStorage(scope);
  const bilsemDefault = scope === 'bilsem' ? 'bilsem' : '';
  if (!searchParams) {
    return { ...stored, curriculum_model: stored.curriculum_model || bilsemDefault };
  }
  const grade = searchParams.get('grade') ?? stored.grade;
  const section = searchParams.get('section') ?? stored.section;
  const subject_code = searchParams.get('subject_code') ?? stored.subject_code;
  const academic_year = searchParams.get('academic_year') ?? stored.academic_year;
  const curriculum_model = searchParams.get('curriculum_model') ?? stored.curriculum_model ?? bilsemDefault;
  const ana_grup = searchParams.get('ana_grup') ?? stored.ana_grup;
  const alt_grup = searchParams.get('alt_grup') ?? stored.alt_grup;
  if (grade || section || subject_code || academic_year || curriculum_model || ana_grup || alt_grup) {
    return { grade, section, subject_code, academic_year, curriculum_model, ana_grup, alt_grup };
  }
  return { ...stored, curriculum_model: stored.curriculum_model || bilsemDefault };
}

export type YillikPlanTeacherWizardProps = {
  /** evrak: /evrak — bilsem: Bilsem Word şablonu (curriculum_model=bilsem), normal yıllık plandan ayrı depolama */
  scope: YillikPlanEvrakVariant;
  /** Sekmeli sayfada dış başlık varken içteki H1’i gizle */
  hideHeader?: boolean;
};

export function YillikPlanTeacherWizard({ scope, hideHeader }: YillikPlanTeacherWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me, refetchMe } = useAuth();
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState(() => getInitialFilters(searchParams, scope));
  const [subjects, setSubjects] = useState<SubjectsResponse | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ListResponse | null>(null);
  const [generateModal, setGenerateModal] = useState<DocumentTemplate | null>(null);
  const [generateForm, setGenerateForm] = useState<Record<string, string>>({});
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [mainTab, setMainTab] = useState<'plan' | 'archive'>('plan');
  const [redownloadingId, setRedownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planUretimKota, setPlanUretimKota] = useState<number | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [bilsemOutcomeSets, setBilsemOutcomeSets] = useState<BilsemOutcomeSetRow[]>([]);
  const [bilsemSetDetail, setBilsemSetDetail] = useState<{
    id: string;
    items: BilsemOutcomeItemRow[];
  } | null>(null);
  const [bilsemSelectedSetId, setBilsemSelectedSetId] = useState('');
  const [bilsemSelectedItemIds, setBilsemSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [bilsemPlanScope, setBilsemPlanScope] = useState<'yillik' | 'donem_1' | 'donem_2'>('yillik');
  const [bilsemWeeklyHours, setBilsemWeeklyHours] = useState('2');
  const [bilsemSetsLoading, setBilsemSetsLoading] = useState(false);
  const bilsemSetListReqRef = useRef(0);
  const bilsemSetDetailReqRef = useRef(0);

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const isBilsemYillikPlan = scope === 'bilsem';
  const useBilsemPlanContentSource = false;
  const canAccess = isBilsemYillikPlan
    ? me?.role === 'teacher' || me?.role === 'school_admin' || me?.role === 'superadmin'
    : me?.role === 'teacher' ||
      me?.role === 'superadmin' ||
      (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));

  const fetchSubjects = useCallback(
    async (
      grade?: number,
      section?: string,
      bilsemQuery?: { academic_year?: string; ana_grup?: string; alt_grup?: string },
    ) => {
      if (!token || !canAccess) return;
      try {
        const params = new URLSearchParams();
        if (grade) params.set('grade', String(grade));
        if (section) params.set('section', section);
        params.set('has_plan_content', '1');
        if (scope === 'bilsem') {
          params.set('curriculum_model', 'bilsem');
          if (bilsemQuery?.academic_year?.trim()) params.set('academic_year', bilsemQuery.academic_year.trim());
          if (bilsemQuery?.ana_grup?.trim()) params.set('ana_grup', bilsemQuery.ana_grup.trim());
          if (bilsemQuery?.alt_grup?.trim()) params.set('alt_grup', bilsemQuery.alt_grup.trim());
        } else if (filters.academic_year?.trim()) {
          params.set('academic_year', filters.academic_year.trim());
        }
        const res = await apiFetch<SubjectsResponse>(
          `/document-templates/subjects?${params}`,
          { token }
        );
        const items =
          scope === 'bilsem' ? filterBilsemCatalogSubjects(res.items ?? []) : (res.items ?? []);
        setSubjects({ items });
      } catch {
        setSubjects(null);
      }
    },
    [token, canAccess, scope]
  );

  const fetchOptions = useCallback(
    async () => {
      if (!token || !canAccess) return;
      try {
        const res = await apiFetch<OptionsResponse>('/document-templates/options', { token });
        setOptions(res);
      } catch {
        setOptions(null);
      }
    },
    [token, canAccess]
  );

  const fetchTemplates = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    const bilsem = scope === 'bilsem';
    const loadId = bilsem
      ? toast.loading('Şablonlar getiriliyor', {
          className: bilsemToastOk.className,
          description: 'Seçimlerinize göre liste hazırlanıyor',
        })
      : undefined;
    try {
      const params = new URLSearchParams();
      params.set('active_only', 'true');
      params.set('limit', '50');
      params.set('type', 'yillik_plan');
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.section) params.set('section', filters.section);
      if (filters.subject_code) params.set('subject_code', filters.subject_code);
      if (filters.academic_year) params.set('academic_year', filters.academic_year);
      if (scope === 'bilsem') {
        if (filters.curriculum_model?.trim()) params.set('curriculum_model', filters.curriculum_model.trim());
        else params.set('curriculum_model', 'bilsem');
      } else if (filters.curriculum_model?.trim()) {
        params.set('curriculum_model', filters.curriculum_model.trim());
      } else {
        params.set('exclude_curriculum_model', 'bilsem');
      }
      const res = await apiFetch<ListResponse>(`/document-templates?${params}`, { token });
      setTemplates(res);
      saveFiltersToStorage(scope, filters);
      if (bilsem && loadId !== undefined) {
        const n = res?.total ?? res?.items?.length ?? 0;
        toast.success(n > 0 ? `${n} şablon hazır` : 'Uygun şablon yok', {
          id: loadId,
          ...bilsemToastOk,
          description:
            n > 0
              ? me?.role === 'teacher'
                ? 'Listeden bir şablon seçin'
                : 'Listeden «Plan İste» ile devam edin'
              : 'Kriterleri veya yılı değiştirmeyi deneyin',
        });
      }
    } catch {
      setTemplates(null);
      if (bilsem && loadId !== undefined) {
        toast.error('Şablonlar yüklenemedi', { id: loadId, ...bilsemToastErr, description: 'Bağlantıyı kontrol edip tekrar deneyin' });
      }
    } finally {
      setLoading(false);
    }
  }, [token, canAccess, filters, scope, me?.role]);

  useEffect(() => {
    if (!canAccess) {
      router.replace('/403');
      return;
    }
    fetchOptions();
    refetchMe();
  }, [canAccess, router, fetchOptions, refetchMe]);

  // İlk ziyarette rehber modalını göster (Evrak / Bilsem ayrı anahtar)
  useEffect(() => {
    if (!canAccess) return;
    const { guideSeenKey } = getYillikPlanEvrakStorage(scope);
    try {
      if (!localStorage.getItem(guideSeenKey)) {
        setShowGuideModal(true);
      }
    } catch {
      /* ignore */
    }
  }, [canAccess, scope]);

  const dismissGuide = useCallback(() => {
    setShowGuideModal(false);
    const { guideSeenKey } = getYillikPlanEvrakStorage(scope);
    try {
      localStorage.setItem(guideSeenKey, '1');
    } catch {
      /* ignore */
    }
  }, [scope]);

  const fetchArchive = useCallback(async () => {
    if (!token || !canAccess) return;
    setArchiveLoading(true);
    try {
      const res = await apiFetch<ArchiveItem[]>(`/documents/generations?limit=50`, { token });
      setArchiveItems(Array.isArray(res) ? res : []);
    } catch {
      setArchiveItems([]);
    } finally {
      setArchiveLoading(false);
    }
  }, [token, canAccess]);

  useEffect(() => {
    if (canAccess && token) fetchArchive();
  }, [canAccess, token, fetchArchive]);

  useEffect(() => {
    if (mainTab === 'archive' && canAccess && token) fetchArchive();
  }, [mainTab, canAccess, token, fetchArchive]);

  const fetchPlanKota = useCallback(async () => {
    if (!token || !canAccess || me?.role !== 'teacher') return;
    try {
      const list = await apiFetch<{ entitlementType: string; quantity: number }[]>('/entitlements', { token });
      const row = list?.find((e) => e.entitlementType === 'yillik_plan_uretim');
      setPlanUretimKota(row?.quantity ?? 0);
    } catch {
      setPlanUretimKota(null);
    }
  }, [token, canAccess, me?.role]);

  useEffect(() => {
    if (canAccess && token && me?.role === 'teacher') fetchPlanKota();
  }, [canAccess, token, me?.role, fetchPlanKota]);

  useEffect(() => {
    if (isBilsemYillikPlan) {
      if (filters.ana_grup?.trim() && filters.academic_year?.trim()) {
        fetchSubjects(undefined, filters.section || undefined, {
          academic_year: filters.academic_year,
          ana_grup: filters.ana_grup,
          alt_grup: filters.alt_grup?.trim() || undefined,
        });
      } else {
        setSubjects(null);
      }
      return;
    }
    if (filters.grade) {
      const g = parseInt(filters.grade, 10);
      fetchSubjects(g, filters.section || undefined);
    } else {
      setSubjects(null);
    }
  }, [
    isBilsemYillikPlan,
    filters.grade,
    filters.section,
    filters.ana_grup,
    filters.academic_year,
    filters.alt_grup,
    fetchSubjects,
  ]);

  const orderedBilsemSelectedItemIds = useMemo(() => {
    if (!bilsemSetDetail?.items?.length || bilsemSelectedItemIds.size === 0) {
      return [...bilsemSelectedItemIds];
    }
    const picked = new Set(bilsemSelectedItemIds);
    return bilsemSetDetail.items
      .filter((it) => picked.has(it.id))
      .sort((a, b) => {
        const sa = Number.isFinite(a.sortOrder as number) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
        const sb = Number.isFinite(b.sortOrder as number) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return a.id.localeCompare(b.id);
      })
      .map((it) => it.id);
  }, [bilsemSetDetail?.items, bilsemSelectedItemIds]);

  const handleGenerateClick = async (t: DocumentTemplate) => {
    const schema = t.formSchema ?? t.form_schema ?? [];
    // Birleşik şablon (subject_code null): ders bilgisi wizard seçiminden gelir
    const tSubjCode = (t.subject_code ?? t.subjectCode ?? '').trim();
    const isBirlesik = !tSubjCode;
    const subjCode = isBirlesik
      ? (filters.subject_code ?? '')
      : (t.subject_code ?? t.subjectCode ?? '');
    const subjLabel = isBirlesik
      ? (subjects?.items?.find((s) => s.code === filters.subject_code)?.label ?? filters.subject_code ?? '')
      : (t.subject_label ?? t.subjectLabel ?? t.subject_code ?? t.subjectCode ?? '');
    let evrakDefaults: Record<string, string> | null | undefined;
    let school: { name?: string; principalName?: string | null } | null | undefined;
    if (token) {
      try {
        const res = await apiFetch<Record<string, unknown>>(`/me?_=${Date.now()}`, {
          token,
          cache: 'no-store',
        });
        school = (res?.school ?? null) as { name?: string; principalName?: string | null } | null;
        evrakDefaults = (res?.evrak_defaults ?? res?.evrakDefaults ?? null) as Record<string, string> | null;
        refetchMe?.(); // auth context'i güncelle
      } catch {
        school = me?.school;
        evrakDefaults = (me as { evrak_defaults?: Record<string, string> })?.evrak_defaults;
      }
    } else {
      school = me?.school;
      evrakDefaults = (me as { evrak_defaults?: Record<string, string> })?.evrak_defaults;
    }
    const defaults = (evrakDefaults ?? (me as { evrak_defaults?: Record<string, string> })?.evrak_defaults ?? {}) as Record<string, string>;
    const zumreItems = dedupeZumre(parseZumreRaw(defaults.zumre_ogretmenleri ?? defaults.zumreler ?? ''));
    const normalizedZumre = serializeZumre(zumreItems);
    const mudurAdi = mudurFromZumre(zumreItems).trim() || (defaults.mudur_adi ?? '').trim() || school?.principalName || '';
    const ogretimYiliFallback = filters.academic_year || options?.academic_years?.[0] || '2024-2025';
    const bilsemAnaLabel = BILSEM_ANA_GRUPLAR.find((g) => g.value === filters.ana_grup)?.label ?? filters.ana_grup;
    const bilsemAltLabel = filters.alt_grup
      ? BILSEM_ALT_GRUPLAR.find((g) => g.value === filters.alt_grup)?.label ?? filters.alt_grup
      : '';
    const bilsemGrupSinifLine = [bilsemAnaLabel, bilsemAltLabel].filter(Boolean).join(' · ');
    const onayTarihiValue =
      (defaults.onay_tarihi ?? defaults.onayTarihi)?.trim() ||
      new Date().toLocaleDateString('tr-TR');
    const initial: Record<string, string> = {
      onay_tarihi: onayTarihiValue,
      tarih: onayTarihiValue,
      onay_tarihi_alt: onayTarihiValue.replace(/\./g, ' / '),
      ders_kodu: subjCode ?? '',
      dersKodu: subjCode ?? '',
      subject_code: subjCode ?? '',
      ders_adi: subjLabel ?? '',
      dersAdi: subjLabel ?? '',
      subject_label: subjLabel ?? '',
      ogretmen_unvani: defaults.ogretmen_unvani ?? '',
    };
    for (const f of schema) {
      const k = f?.key ?? (f as { Key?: string }).Key;
      if (k === 'onay_tarihi' || k === 'tarih' || k === 'onay_tarihi_alt' || k === 'onayTarihi') {
        initial[k] = onayTarihiValue;
        if (k === 'onay_tarihi_alt') initial[k] = onayTarihiValue.replace(/\./g, ' / ');
      } else if (k === 'ogretim_yili') {
        initial[k] = filters.academic_year || defaults.ogretim_yili || ogretimYiliFallback;
      } else if (k === 'sinif') {
        initial[k] = isBilsemYillikPlan
          ? bilsemGrupSinifLine || defaults.sinif || ''
          : filters.grade || defaults.sinif || String(t.grade ?? '');
      } else if (k === 'ders_kodu' || k === 'dersKodu' || k === 'ders-kodu' || k === 'subject_code') {
        initial[k] = subjCode ?? '';
      } else if (k === 'ders_adi' || k === 'dersAdi' || k === 'ders-adi' || k === 'subject_label') {
        initial[k] = subjLabel ?? '';
      } else if (k === 'okul_adi') {
        initial[k] = defaults.okul_adi || school?.name || '';
      } else if (k === 'mudur_adi') {
        initial[k] = mudurAdi;
      } else if (k === 'zumre_ogretmenleri') {
        initial[k] = normalizedZumre;
      } else if (k === 'zumreler') {
        initial[k] = normalizedZumre;
      } else if (k === 'ogretmen_unvani') {
        initial[k] = defaults.ogretmen_unvani ?? '';
      } else if (k) {
        initial[k] = '';
      }
    }
    if (isBilsemYillikPlan) {
      initial.ana_grup = filters.ana_grup?.trim() ?? '';
      initial.alt_grup = filters.alt_grup?.trim() ?? '';
      initial.bilsem_plan_scope = bilsemPlanScope;
      const ay = String(filters.academic_year || initial.ogretim_yili || '').trim();
      if (!useBilsemPlanContentSource && bilsemSelectedSetId && bilsemSelectedItemIds.size > 0 && ay) {
        initial.bilsem_yillik_draft_json = JSON.stringify({
          outcome_set_id: bilsemSelectedSetId,
          selected_outcome_item_ids: orderedBilsemSelectedItemIds,
          academic_year: ay,
          plan_scope: bilsemPlanScope,
          weekly_lesson_hours: Math.max(1, Math.min(20, parseInt(bilsemWeeklyHours, 10) || 2)),
        });
      }
    } else {
      const ay = filters.academic_year || ogretimYiliFallback;
      if (!String(initial.ogretim_yili ?? '').trim()) initial.ogretim_yili = ay;
      if (!String(initial.academic_year ?? '').trim()) initial.academic_year = ay;
    }
    setGenerateForm(initial);
    setGenerateModal(t);
    setGenerateSuccess(false);
    setPreview(null);
  };

  const fetchPreview = useCallback(
    async (templateId: string, formData: Record<string, string>) => {
      if (!token) return;
      previewAbortRef.current?.abort();
      previewAbortRef.current = new AbortController();
      const ctrl = previewAbortRef.current;
      setPreviewLoading(true);
      setPreview(null);
      try {
        const res = await apiFetch<PreviewResponse>('/documents/preview', {
          token,
          method: 'POST',
          body: JSON.stringify({ template_id: templateId, form_data: formData }),
          signal: ctrl.signal,
        });
        if (!ctrl.signal.aborted) setPreview(res);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        if (!ctrl?.signal.aborted) setPreview(null);
      } finally {
        if (!ctrl?.signal.aborted) setPreviewLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (generateModal) setPreviewExpanded(scope === 'bilsem');
  }, [generateModal, scope]);

  useEffect(() => {
    if (!generateModal || !token) return;
    const t = setTimeout(() => {
      fetchPreview(generateModal.id, generateForm);
    }, 400);
    return () => clearTimeout(t);
  }, [generateModal, generateForm, token, fetchPreview]);

  useEffect(() => {
    if (!isBilsemYillikPlan || !token) {
      bilsemSetListReqRef.current += 1;
      setBilsemOutcomeSets([]);
      setBilsemSetsLoading(false);
      return;
    }
    if (!filters.subject_code?.trim() || !filters.academic_year?.trim()) {
      bilsemSetListReqRef.current += 1;
      setBilsemOutcomeSets([]);
      setBilsemSelectedSetId('');
      setBilsemSelectedItemIds(new Set());
      setBilsemSetDetail(null);
      setBilsemSetsLoading(false);
      return;
    }
    const reqId = bilsemSetListReqRef.current + 1;
    bilsemSetListReqRef.current = reqId;
    const wantedSubjectCode = filters.subject_code.trim().toLowerCase();
    const wantedAnaGrup = String(filters.ana_grup ?? '').trim().toLowerCase();
    setBilsemSetsLoading(true);
    setBilsemSelectedSetId('');
    setBilsemSelectedItemIds(new Set());
    setBilsemSetDetail(null);
    if (useBilsemPlanContentSource) {
      const params = new URLSearchParams();
      params.set('curriculum_model', 'bilsem');
      params.set('subject_code', filters.subject_code.trim());
      params.set('academic_year', filters.academic_year.trim());
      if (filters.ana_grup?.trim()) params.set('ana_grup', filters.ana_grup.trim());
      if (filters.alt_grup?.trim()) params.set('alt_grup', filters.alt_grup.trim());
      apiFetch<{ items: BilsemPlanContentRow[] }>(`/yillik-plan-icerik?${params}`, { token })
        .then(async (res) => {
          if (bilsemSetListReqRef.current !== reqId) return;
          const rows = Array.isArray(res?.items) ? res.items : [];
          const mapped: BilsemOutcomeItemRow[] = rows
            .sort((a, b) => Number(a.week_order ?? 0) - Number(b.week_order ?? 0))
            .map((r) => ({
              id: r.id,
              code: r.week_order ? `W${r.week_order}` : null,
              unite: r.unite ?? null,
              konu: r.konu ?? null,
              description:
                String(r.kazanimlar ?? '').trim() ||
                String(r.konu ?? '').trim() ||
                String(r.unite ?? '').trim() ||
                `Hafta ${String(r.week_order ?? '')}`,
              sortOrder: Number(r.week_order ?? 0) || 0,
            }));
          if (!mapped.length) {
            const setParams = new URLSearchParams();
            setParams.set('subject_code', filters.subject_code.trim());
            setParams.set('academic_year', filters.academic_year.trim());
            const setRows = await apiFetch<BilsemOutcomeSetRow[]>(`/bilsem/yillik-plan/outcome-sets?${setParams}`, { token });
            if (bilsemSetListReqRef.current !== reqId) return;
            const list = Array.isArray(setRows) ? setRows : [];
            const filtered = list.filter((s) => {
              const sc = String(s.subjectCode ?? s.subject_code ?? '').trim().toLowerCase();
              if (sc && sc !== wantedSubjectCode) return false;
              if (!wantedAnaGrup) return true;
              const ga = String(s.grupAdi ?? s.grup_adi ?? '').trim().toLowerCase();
              return !ga || ga === wantedAnaGrup;
            });
            setBilsemOutcomeSets(filtered);
            setBilsemSetDetail(null);
            setBilsemSelectedSetId(filtered.length === 1 ? filtered[0].id : '');
            setBilsemSelectedItemIds(new Set());
            return;
          }
          const sourceSetId = `plan-content:${filters.subject_code}:${filters.academic_year}:${filters.ana_grup ?? ''}:${filters.alt_grup ?? ''}`;
          setBilsemOutcomeSets([
            {
              id: sourceSetId,
              subject_code: filters.subject_code,
              subject_label: subjects?.items?.find((s) => s.code === filters.subject_code)?.label ?? filters.subject_code,
              grup_adi: filters.ana_grup || null,
              academic_year: filters.academic_year,
            },
          ]);
          setBilsemSetDetail({ id: sourceSetId, items: mapped });
          setBilsemSelectedSetId(sourceSetId);
          setBilsemSelectedItemIds(new Set(mapped.map((m) => m.id)));
        })
        .catch(() => {
          if (bilsemSetListReqRef.current !== reqId) return;
          setBilsemOutcomeSets([]);
          setBilsemSetDetail(null);
          setBilsemSelectedSetId('');
          setBilsemSelectedItemIds(new Set());
        })
        .finally(() => {
          if (bilsemSetListReqRef.current !== reqId) return;
          setBilsemSetsLoading(false);
        });
      return;
    }
    const params = new URLSearchParams();
    params.set('subject_code', filters.subject_code.trim());
    params.set('academic_year', filters.academic_year.trim());
    apiFetch<BilsemOutcomeSetRow[]>(`/bilsem/yillik-plan/outcome-sets?${params}`, { token })
      .then((rows) => {
        if (bilsemSetListReqRef.current !== reqId) return;
        const list = Array.isArray(rows) ? rows : [];
        const filtered = list.filter((s) => {
          const sc = String(s.subjectCode ?? s.subject_code ?? '').trim().toLowerCase();
          if (sc && sc !== wantedSubjectCode) return false;
          if (!wantedAnaGrup) return true;
          const ga = String(s.grupAdi ?? s.grup_adi ?? '').trim().toLowerCase();
          return !ga || ga === wantedAnaGrup;
        });
        setBilsemOutcomeSets(filtered);
        if (filtered.length === 1) setBilsemSelectedSetId(filtered[0].id);
      })
      .catch(() => {
        if (bilsemSetListReqRef.current !== reqId) return;
        setBilsemOutcomeSets([]);
      })
      .finally(() => {
        if (bilsemSetListReqRef.current !== reqId) return;
        setBilsemSetsLoading(false);
      });
  }, [
    isBilsemYillikPlan,
    useBilsemPlanContentSource,
    token,
    filters.subject_code,
    filters.academic_year,
    filters.ana_grup,
    filters.alt_grup,
    subjects?.items,
  ]);

  useEffect(() => {
    if (!token || !bilsemSelectedSetId || !isBilsemYillikPlan) {
      bilsemSetDetailReqRef.current += 1;
      setBilsemSetDetail(null);
      return;
    }
    if (useBilsemPlanContentSource) return;
    const reqId = bilsemSetDetailReqRef.current + 1;
    bilsemSetDetailReqRef.current = reqId;
    apiFetch<{ id: string; items: BilsemOutcomeItemRow[] }>(
      `/bilsem/yillik-plan/outcome-sets/${encodeURIComponent(bilsemSelectedSetId)}`,
      { token },
    )
      .then((d) => {
        if (bilsemSetDetailReqRef.current !== reqId) return;
        setBilsemSetDetail(d);
      })
      .catch(() => {
        if (bilsemSetDetailReqRef.current !== reqId) return;
        setBilsemSetDetail(null);
      });
  }, [token, bilsemSelectedSetId, isBilsemYillikPlan, useBilsemPlanContentSource]);

  useEffect(() => {
    if (!isBilsemYillikPlan || useBilsemPlanContentSource) return;
    if (!generateModal) return;
    const ay = String(filters.academic_year || generateForm.ogretim_yili || '').trim();
    const hasSelection = !!bilsemSelectedSetId && bilsemSelectedItemIds.size > 0 && !!ay;
    const nextDraft = hasSelection
      ? JSON.stringify({
          outcome_set_id: bilsemSelectedSetId,
          selected_outcome_item_ids: orderedBilsemSelectedItemIds,
          academic_year: ay,
          plan_scope: bilsemPlanScope,
          weekly_lesson_hours: Math.max(1, Math.min(20, parseInt(bilsemWeeklyHours, 10) || 2)),
        })
      : '';
    setGenerateForm((prev) => {
      const prevDraft = String(prev.bilsem_yillik_draft_json ?? '');
      const prevScope = String(prev.bilsem_plan_scope ?? '');
      if (prevDraft === nextDraft && prevScope === bilsemPlanScope) return prev;
      return {
        ...prev,
        bilsem_plan_scope: bilsemPlanScope,
        ...(nextDraft
          ? { bilsem_yillik_draft_json: nextDraft }
          : { bilsem_yillik_draft_json: '' }),
      };
    });
  }, [
    isBilsemYillikPlan,
    useBilsemPlanContentSource,
    generateModal,
    bilsemSelectedSetId,
    bilsemSelectedItemIds,
    orderedBilsemSelectedItemIds,
    bilsemPlanScope,
    bilsemWeeklyHours,
    filters.academic_year,
    generateForm.ogretim_yili,
  ]);

  const handleGenerateSubmit = async () => {
    if (!token || !generateModal) return;
    setGenerateLoading(true);
    try {
      const res = await apiFetch<{ download_url: string; filename: string }>('/documents/generate', {
        token,
        method: 'POST',
        body: JSON.stringify({
          template_id: generateModal.id,
          form_data: generateForm,
        }),
      });
      const w = window.open(res.download_url, '_blank');
      const okTitle = isBilsemYillikPlan ? 'Word dosyası hazır' : 'Plan üretildi';
      const okDesc = w
        ? isBilsemYillikPlan
          ? 'İndirme yeni sekmede başladı'
          : 'İndiriliyor'
        : isBilsemYillikPlan
          ? 'Tarayıcı penceresi engelledi — aşağıdan indirin'
          : 'Popup engellendiyse aşağıdaki butona tıklayın';
      toast.success(okTitle, {
        ...(isBilsemYillikPlan ? bilsemToastOk : {}),
        description: okDesc,
        action: {
          label: 'İndir',
          onClick: () => window.open(res.download_url, '_blank'),
        },
      });
      setGenerateSuccess(true);
      fetchArchive();
      fetchPlanKota();

      // Evrak varsayılanlarını güncelle (okul, müdür, zümre, yıl vb.)
      const evrakDefaultsFields = ['okul_adi', 'mudur_adi', 'ogretim_yili', 'sinif', 'zumre_ogretmenleri', 'zumreler', 'ogretmen_unvani', 'onay_tarihi'];
      const defaults: Record<string, string> = {};
      for (const k of evrakDefaultsFields) {
        const v = generateForm[k]?.trim();
        if (v) defaults[k === 'zumreler' ? 'zumre_ogretmenleri' : k] = v;
      }
      if (defaults.zumre_ogretmenleri) defaults.zumreler = defaults.zumre_ogretmenleri;
      if (Object.keys(defaults).length > 0) {
        apiFetch('/me', { method: 'PATCH', token, body: JSON.stringify({ evrak_defaults: defaults }) })
          .then(() => refetchMe?.())
          .catch(() => {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Plan üretilemedi';
      const isEntitlementError = /kota|Marketten|evrak|plan üretim/i.test(msg);
      if (isEntitlementError && me?.role === 'teacher') {
        toast.error('Plan üretim kotanız bitti. Marketten hak alarak devam edebilirsiniz.', {
          ...(isBilsemYillikPlan ? bilsemToastErr : {}),
          description: isBilsemYillikPlan ? 'Marketten plan / evrak hakkı' : undefined,
          action: {
            label: 'Markete git',
            onClick: () => router.push('/market'),
          },
        });
      } else {
        toast.error(msg, isBilsemYillikPlan ? { ...bilsemToastErr } : undefined);
      }
    } finally {
      setGenerateLoading(false);
    }
  };

  const mudurAdi = (generateForm?.mudur_adi ?? '').trim();
  const zumreOgretmenleri = (generateForm?.zumre_ogretmenleri ?? generateForm?.zumreler ?? '').trim();
  const onayBolumuEksik = !mudurAdi || !zumreOgretmenleri;

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const gradeNum = parseInt(filters.grade, 10);
  const needsSection = gradeNum >= 5; // 5-8 ve 9-12 için bölüm seçimi (Ders, Seçmeli, İHO/İHL, Meslek, GSL, Spor L. vb.)
  const bilsemSubjectStep = 2;
  const bilsemOutcomesStep = 3;
  const mebLastStep = needsSection ? 3 : 2;
  const lastStep = isBilsemYillikPlan ? bilsemOutcomesStep : mebLastStep;

  const canProceed = () => {
    if (isBilsemYillikPlan) {
      if (step === 0) return !!filters.academic_year?.trim();
      if (step === 1) return !!filters.ana_grup?.trim();
      if (step === bilsemSubjectStep) return !!filters.subject_code?.trim();
      if (step === bilsemOutcomesStep) {
        if (useBilsemPlanContentSource) return (bilsemSetDetail?.items?.length ?? 0) > 0;
        return !!bilsemSelectedSetId && bilsemSelectedItemIds.size > 0;
      }
      return false;
    }
    if (step === 0) return !!filters.grade;
    if (step === 1) return needsSection ? !!filters.section : !!filters.subject_code;
    if (step === 2 && needsSection) return !!filters.subject_code;
    if ((step === 2 && !needsSection) || (step === 3 && needsSection)) return !!filters.academic_year;
    return false;
  };

  const nextStep = () => {
    if (step < lastStep) setStep(step + 1);
    else fetchTemplates();
  };

  const handleRedownload = useCallback(
    async (id: string) => {
      if (!token) return;
      setRedownloadingId(id);
      try {
        const res = await apiFetch<{ download_url: string; filename: string }>(
          `/documents/generations/${id}/redownload`,
          { token, method: 'POST' }
        );
        window.open(res.download_url, '_blank');
        toast.success(scope === 'bilsem' ? 'Word yeniden indiriliyor' : 'Evrak üretildi, indiriliyor.', {
          ...(scope === 'bilsem' ? bilsemToastOk : {}),
          description: scope === 'bilsem' ? 'Yeni sekmede açıldı' : undefined,
        });
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Tekrar indirme başarısız.';
        const isEntitlementError = /kota|Marketten|evrak|plan üretim/i.test(msg);
        if (isEntitlementError) {
          toast.error('Plan üretim kotası yetersiz veya sunucu reddi. Gerekirse marketten hak alın.', {
            ...(scope === 'bilsem' ? bilsemToastErr : {}),
            description: scope === 'bilsem' ? 'Tekrar indirme genelde kotadan düşmez; sorun devam ederse destek.' : undefined,
            action: {
              label: 'Markete git',
              onClick: () => router.push('/market'),
            },
          });
        } else {
          toast.error(msg, scope === 'bilsem' ? { ...bilsemToastErr } : undefined);
        }
      } finally {
        setRedownloadingId(null);
      }
    },
    [token, scope]
  );

  const handleDeleteArchive = useCallback(
    async (id: string) => {
      if (!token) return;
      if (!window.confirm('Bu kaydı arşivden silmek istediğinize emin misiniz?')) return;
      setDeletingId(id);
      try {
        await apiFetch<{ ok: boolean }>(`/documents/generations/${id}`, { token, method: 'DELETE' });
        toast.success('Arşivden silindi.');
        await fetchArchive();
      } catch (e) {
        const msg =
          e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Silme başarısız.';
        toast.error(msg);
      } finally {
        setDeletingId(null);
      }
    },
    [token, fetchArchive]
  );

  const applyArchive = useCallback(
    async (item: ArchiveItem) => {
      if (!token) return;
      const grade = item.grade ?? '';
      const section = item.section ?? '';
      const subjectCode = item.subjectCode ?? '';
      const academicYear = item.academicYear ?? '';
      setFilters((f) => ({
        ...f,
        grade,
        section,
        subject_code: subjectCode,
        academic_year: academicYear,
        curriculum_model: scope === 'bilsem' ? 'bilsem' : f.curriculum_model,
        ...(scope === 'bilsem' ? { ana_grup: '', alt_grup: '' } : {}),
      }));
      const g = parseInt(grade, 10);
      setStep(isBilsemYillikPlan ? 3 : g >= 5 ? 3 : 2);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('active_only', 'true');
        params.set('limit', '50');
        params.set('type', 'yillik_plan');
        if (grade) params.set('grade', grade);
        if (section) params.set('section', section);
        if (subjectCode) params.set('subject_code', subjectCode);
        if (academicYear) params.set('academic_year', academicYear);
        if (scope === 'bilsem') params.set('curriculum_model', 'bilsem');
        else params.set('exclude_curriculum_model', 'bilsem');
        const res = await apiFetch<ListResponse>(`/document-templates?${params}`, { token });
        setTemplates(res);
      } catch {
        setTemplates(null);
      } finally {
        setLoading(false);
      }
    },
    [token, scope]
  );

  const wizardSteps = isBilsemYillikPlan
    ? me?.role === 'teacher'
      ? [
          { label: 'Yıl', step: 0 },
          { label: 'Grup', step: 1 },
          { label: 'Ders', step: bilsemSubjectStep },
          { label: 'Öğrenme Çıktıları', step: bilsemOutcomesStep },
        ]
      : [
          { label: 'Öğretim yılı', step: 0 },
          { label: 'Ana / alt grup', step: 1 },
          { label: 'Ders', step: bilsemSubjectStep },
          { label: 'Öğrenme Çıktıları', step: bilsemOutcomesStep },
        ]
    : [
        { label: 'Sınıf', step: 0 },
        ...(needsSection ? [{ label: 'Bölüm', step: 1 }] : []),
        { label: 'Ders', step: needsSection ? 2 : 1 },
        { label: 'Öğretim yılı', step: needsSection ? 3 : 2 },
      ];

  const sectionLabel =
    options?.sections?.find((s) => s.value === filters.section)?.label ?? filters.section ?? '';
  const bilsemSubjectItems = useMemo(() => {
    if (!isBilsemYillikPlan || !subjects?.items?.length) return subjects?.items ?? [];
    const ag = filters.ana_grup.trim();
    if (!ag) return [];
    return subjects.items.filter((s) => (s.ana_grup ?? '') === ag);
  }, [isBilsemYillikPlan, subjects?.items, filters.ana_grup]);
  const subjectSummaryLabel = filters.subject_code
    ? (isBilsemYillikPlan ? bilsemSubjectItems : subjects?.items)?.find((s) => s.code === filters.subject_code)?.label ??
      subjects?.items.find((s) => s.code === filters.subject_code)?.label ??
      filters.subject_code
    : '';

  const templateDisplayName = useCallback(
    (t: DocumentTemplate) => {
      const all = subjects?.items ?? [];
      const tCode = (t.subject_code ?? t.subjectCode ?? '').trim();
      const isBirlesik = !tCode;
      const resolveFromCode = (code: string) =>
        bilsemSubjectItems.find((s) => s.code === code)?.label?.trim() ||
        all.find((s) => s.code === code)?.label?.trim();
      const direct = (t.subject_label ?? t.subjectLabel ?? '').trim();
      if (isBirlesik) {
        const w = filters.subject_code?.trim() ?? '';
        return (resolveFromCode(w) || direct || w || 'Yıllık Plan').trim();
      }
      return (direct || resolveFromCode(tCode) || tCode || 'Yıllık Plan').trim();
    },
    [bilsemSubjectItems, subjects?.items, filters.subject_code]
  );

  const selectionSummaryLine = (() => {
    const p: string[] = [];
    if (isBilsemYillikPlan && filters.academic_year) p.push(filters.academic_year);
    if (isBilsemYillikPlan && filters.ana_grup) {
      const al = BILSEM_ANA_GRUPLAR.find((g) => g.value === filters.ana_grup)?.label ?? filters.ana_grup;
      const bl = filters.alt_grup
        ? BILSEM_ALT_GRUPLAR.find((g) => g.value === filters.alt_grup)?.label ?? filters.alt_grup
        : '';
      p.push(bl ? `${al} / ${bl}` : al);
    }
    if (!isBilsemYillikPlan && filters.grade) p.push(formatYillikPlanGradeLabel(filters.grade, isBilsemYillikPlan));
    if (!isBilsemYillikPlan && needsSection && filters.section) p.push(sectionLabel || filters.section);
    if (subjectSummaryLabel) p.push(subjectSummaryLabel);
    if (!isBilsemYillikPlan && filters.academic_year) p.push(filters.academic_year);
    return p.join(' · ');
  })();

  const bilsemGrupSummaryShort = (() => {
    if (!isBilsemYillikPlan) return '';
    const al = filters.ana_grup
      ? BILSEM_ANA_GRUPLAR.find((g) => g.value === filters.ana_grup)?.label ?? filters.ana_grup
      : '';
    const bl = filters.alt_grup
      ? BILSEM_ALT_GRUPLAR.find((g) => g.value === filters.alt_grup)?.label ?? filters.alt_grup
      : '';
    return [al, bl].filter(Boolean).join(' / ');
  })();

  const archiveBilsem = useMemo(() => archiveItems.filter(isArchiveBilsem), [archiveItems]);
  const archiveOther = useMemo(() => archiveItems.filter((i) => !isArchiveBilsem(i)), [archiveItems]);

  if (!canAccess) return null;

  const evrakDefaults = (me as { evrak_defaults?: { okul_adi?: string; mudur_adi?: string } | null } | undefined)?.evrak_defaults;
  const hasDefaults = !!(evrakDefaults?.okul_adi?.trim() || evrakDefaults?.mudur_adi?.trim());
  const schoolFallback = !!(me?.school?.name || (me?.school as { principalName?: string })?.principalName);
  const defaultsIncomplete = me?.role === 'teacher' && !hasDefaults && !schoolFallback;
  const noPlanKota =
    me?.role === 'teacher' &&
    planUretimKota !== null &&
    planUretimKota <= 0;

  const shellClass = isBilsemYillikPlan
    ? 'relative isolate space-y-1 overflow-hidden rounded-md border border-violet-300/35 bg-gradient-to-br from-violet-500/[0.09] via-background to-fuchsia-500/[0.06] p-1.5 shadow-[0_16px_40px_-14px_rgba(109,40,217,0.16)] dark:border-violet-500/25 dark:from-violet-950/50 dark:via-background dark:to-fuchsia-950/30 sm:space-y-6 sm:rounded-2xl sm:p-5 md:space-y-8 md:p-8'
    : 'relative isolate space-y-3 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-sky-500/[0.06] via-background to-muted/25 p-3 shadow-[0_16px_40px_-18px_rgba(14,116,144,0.14)] sm:space-y-4 sm:p-4 md:space-y-5 md:p-6';

  return (
    <div className={shellClass}>
      {isBilsemYillikPlan && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-[14rem] rounded-full bg-gradient-to-br from-violet-500/18 to-fuchsia-500/10 blur-2xl dark:from-violet-600/22 sm:-right-24 sm:-top-24 sm:size-[28rem] sm:blur-3xl"
        />
      )}
      {!isBilsemYillikPlan && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-0 size-[22rem] rounded-full bg-gradient-to-br from-sky-400/15 to-cyan-400/5 blur-3xl dark:from-sky-500/20"
        />
      )}
      {hideHeader && isBilsemYillikPlan && (
        <Card className="overflow-hidden border-violet-400/30 bg-gradient-to-r from-violet-500/[0.08] via-background to-fuchsia-500/[0.05] shadow-sm dark:border-violet-500/25 dark:from-violet-950/40 dark:to-fuchsia-950/25">
          <CardContent className="space-y-2 p-2 sm:space-y-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href="/bilsem/plan-katki"
                  title="Plan katkısı (topluluk)"
                  aria-label="Plan katkısı (topluluk)"
                  className="inline-flex items-center gap-1 rounded-md border border-violet-500/35 bg-violet-500/10 px-1.5 py-1 text-violet-700 transition-colors hover:bg-violet-500/15 dark:border-violet-400/35 dark:bg-violet-950/45 dark:text-violet-300"
                >
                  <Sparkles className="size-3.5" />
                </Link>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    title="Bilsem · Word yıllık plan"
                    className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-1 text-violet-700 dark:border-violet-400/35 dark:bg-violet-950/45 dark:text-violet-200"
                  >
                    <FileText className="size-3.5" />
                  </span>
                  <span
                    title="Bilsem yıllık plan"
                    className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-1 text-violet-700 dark:border-violet-400/35 dark:bg-violet-950/45 dark:text-violet-200"
                  >
                    <BookOpen className="size-3.5" />
                  </span>
                  <span
                    title="Yıl ve grup -> ders -> kazanımlar -> Word şablonu ve indir. Dosyalar Arşiv'de kalır."
                    className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-1 text-violet-700 dark:border-violet-400/35 dark:bg-violet-950/45 dark:text-violet-200"
                  >
                    <ListChecks className="size-3.5" />
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-violet-500/40 bg-background/95 px-2 py-1 text-[10px] font-semibold text-violet-900 shadow-sm transition-colors hover:bg-violet-500/10 dark:border-violet-400/35 dark:bg-violet-950/60 dark:text-violet-100 dark:hover:bg-violet-950 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
                aria-label="Adım adım rehberi aç"
              >
                <HelpCircle className="size-3 shrink-0 sm:size-4" />
                Rehberi aç
              </button>
            </div>

            <div className="mobile-tab-scroll akilli-tahta-tabnav w-full min-w-0 snap-x snap-mandatory sm:w-auto">
              <div
                role="tablist"
                aria-label="Plan oluşturma ve arşiv"
                className="flex w-max max-w-full gap-0.5 rounded-xl border border-violet-400/45 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/10 to-violet-500/12 p-0.5 shadow-inner shadow-violet-500/10 dark:border-violet-500/40 dark:from-violet-950/50 dark:via-fuchsia-950/40 dark:to-violet-950/50 sm:w-full sm:flex-wrap sm:justify-start sm:gap-1.5 sm:rounded-2xl sm:p-1.5 sm:shadow-sm sm:overflow-visible"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'plan'}
                  onClick={() => setMainTab('plan')}
                  className={cn(
                    'flex min-w-0 shrink-0 snap-start items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all sm:min-h-[44px] sm:flex-1 sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm',
                    mainTab === 'plan'
                      ? 'border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 ring-1 ring-white/20 dark:from-violet-600 dark:to-fuchsia-600'
                      : 'border-transparent bg-transparent text-violet-900/80 hover:bg-white/50 dark:text-violet-100/90 dark:hover:bg-violet-950/40',
                  )}
                >
                  <FileEdit className="size-4 shrink-0" />
                  Plan oluştur
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'archive'}
                  onClick={() => setMainTab('archive')}
                  className={cn(
                    'relative flex min-w-0 shrink-0 snap-start items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all sm:min-h-[44px] sm:flex-1 sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm',
                    mainTab === 'archive'
                      ? 'border-transparent bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/20 ring-1 ring-white/20 dark:from-fuchsia-600 dark:to-violet-600'
                      : 'border-transparent bg-transparent text-violet-900/80 hover:bg-white/50 dark:text-violet-100/90 dark:hover:bg-violet-950/40',
                  )}
                >
                  <Archive className="size-4 shrink-0" />
                  Arşiv
                  {archiveItems.length > 0 && (
                    <span
                      className={cn(
                        'min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums sm:text-xs',
                        mainTab === 'archive' ? 'bg-white/25 text-white' : 'bg-fuchsia-500/25 text-fuchsia-900 dark:bg-fuchsia-400/20 dark:text-fuchsia-100',
                      )}
                    >
                      {archiveItems.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {me?.role === 'teacher' && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-2 py-1.5 dark:border-violet-500/25 dark:bg-violet-950/35">
                <div className="flex items-center gap-1.5">
                  <span
                    title="Plan üretirken okul adı, müdür ve zümre öğretmenleri otomatik doldurulur. Ayarlardan düzenleyebilirsiniz."
                    className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-1 text-violet-700 dark:border-violet-400/35 dark:bg-violet-950/45 dark:text-violet-200"
                  >
                    <Settings className="size-3.5" />
                  </span>
                  {planUretimKota !== null && (
                    <span
                      title={`Yıllık plan üretim kotanız: ${planUretimKota} adet`}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold',
                        planUretimKota > 0
                          ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/35 dark:bg-violet-950/45 dark:text-violet-200'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/45 dark:text-amber-300',
                      )}
                    >
                      <Clock className="size-3.5" />
                      {planUretimKota} adet
                    </span>
                  )}
                </div>
                <Link
                  href="/settings"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-900 transition-colors hover:bg-violet-500/15 dark:border-violet-400/35 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950/70 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                >
                  <Settings className="size-3.5" />
                  Varsayılanlara git
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {!hideHeader && isBilsemYillikPlan && (
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-800 ring-1 ring-violet-500/25 dark:bg-violet-500/20 dark:text-violet-200">
              <Sparkles className="size-3.5" />
              {me?.role === 'teacher' ? 'Plan' : 'Bilsem Word'}
            </span>
            <h1 className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-violet-300 dark:via-fuchsia-400 dark:to-violet-300 md:text-4xl">
              {me?.role === 'teacher' ? 'Yıllık plan' : 'Bilsem yıllık plan'}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {me?.role === 'teacher'
                ? 'Adımları izleyerek Word dosyanızı oluşturun.'
                : 'Bilsem Word şablonları ve içerikler tanımlandıkça listelenir; formu doldurup indirirsiniz.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-violet-400/40 bg-background/90 px-4 py-2.5 text-sm font-medium text-violet-800 shadow-sm transition-colors hover:bg-violet-500/10 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-950/50 sm:self-start"
            aria-label="Adım adım rehberi aç"
          >
            <HelpCircle className="size-4" />
            Rehberi aç
          </button>
        </div>
      )}
      {!hideHeader && !isBilsemYillikPlan && (
        <EvrakWizardHero
          onOpenGuide={() => setShowGuideModal(true)}
          archiveCount={archiveItems.length}
          templatesTotal={templates?.total ?? null}
          showQuota={me?.role === 'teacher'}
          planUretimKota={planUretimKota}
          noPlanKota={noPlanKota}
          defaultsIncomplete={defaultsIncomplete}
        />
      )}

      <Dialog open={showGuideModal} onOpenChange={(open) => { setShowGuideModal(open); if (!open) dismissGuide(); }}>
        <DialogContent
          title={isBilsemYillikPlan ? 'Yıllık plan rehberi' : 'Evrak rehberi'}
          className={
            isBilsemYillikPlan
              ? 'max-h-[min(88dvh,36rem)] max-w-xl overflow-y-auto border-violet-500/20 shadow-2xl shadow-violet-500/10 dark:border-violet-500/25 max-sm:mx-3 max-sm:max-w-[calc(100vw-1.5rem)]'
              : 'max-w-xl border-sky-500/15 shadow-xl shadow-sky-500/5 dark:border-sky-900/35'
          }
        >
          <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
            {isBilsemYillikPlan
              ? me?.role === 'teacher'
                ? 'Aşağıdaki sırayı izleyerek Word dosyanızı oluşturun.'
                : 'Bilsem yıllık plan akışında izlenen adımlar.'
              : 'Sınıf ve ders seçimlerinden şablon indirmeye kadar izlenen yol.'}
          </p>

          {isBilsemYillikPlan ? (
            <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
              <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-2.5 dark:border-violet-500/20 dark:bg-violet-950/35 sm:rounded-xl sm:p-3.5">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200 sm:size-9">
                    <Calendar className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">1. Öğretim yılı</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:mt-1 sm:text-xs">
                      Listeden çalıştığınız akademik yılı seçin. Öğrenme çıktıları ve Word şablon listeleri bu yıla göre gelir.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-2.5 dark:border-violet-500/20 dark:bg-violet-950/35 sm:rounded-xl sm:p-3.5">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200 sm:size-9">
                    <Layers className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">2. Ana ve alt grup</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:mt-1 sm:text-xs">
                      Yetenek alanınızı (ana grup) seçin. Program aşaması için alt grup isteğe bağlıdır; ders listesi buna göre filtrelenir.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-2.5 dark:border-violet-500/20 dark:bg-violet-950/35 sm:rounded-xl sm:p-3.5">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200 sm:size-9">
                    <BookOpen className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">3. Ders ve öğrenme çıktıları</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:mt-1 sm:text-xs">
                      Dersinizi seçin. Öğrenme çıktıları listesinden haftaya yansıyacak maddeleri işaretleyin; tüm yıl veya dönem kapsamı ile haftalık ders saatini ayarlayın.{' '}
                      <strong className="font-medium text-foreground">Şablonları göster</strong> ile bir sonraki adıma geçin.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-2.5 dark:border-violet-500/20 dark:bg-violet-950/35 sm:rounded-xl sm:p-3.5">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200 sm:size-9">
                    <ListChecks className="size-3.5 sm:size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">4. Şablon, önizleme, indirme</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:mt-1 sm:text-xs">
                      Uygun şablonu seçin; okul ve onay bilgilerini kontrol edin. İsterseniz önizlemeyi açıp tabloyu görün, ardından{' '}
                      <strong className="font-medium text-foreground">Üret ve İndir</strong> ile Word dosyasını alın. Dosya{' '}
                      <strong className="font-medium text-foreground">Arşiv</strong> sekmesinde de saklanır; tekrar indirebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3.5 dark:border-sky-500/20 dark:bg-sky-950/30">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200">
                    <GraduationCap className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">1. Sınıf (ve gerekirse bölüm)</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Sınıfınızı seçin. Ortaokul ve lisede ders türü (ör. Ders, Seçmeli) ayrıca sorulabilir.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3.5 dark:border-sky-500/20 dark:bg-sky-950/30">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200">
                    <BookOpen className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">2. Ders</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Hazır içeriği olan dersler listelenir. Dersiniz yoksa okul yöneticinize danışın.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3.5 dark:border-sky-500/20 dark:bg-sky-950/30">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200">
                    <Calendar className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">3. Öğretim yılı</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Yılı seçtikten sonra size uygun şablonlar listelenir.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3.5 dark:border-sky-500/20 dark:bg-sky-950/30">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200">
                    <ListChecks className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">4. Üret ve indir</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Şablonu açıp formu doldurun, önizleyin, <strong className="font-medium text-foreground">Üret ve İndir</strong> ile dosyayı indirin. Kayıtlar <strong className="font-medium text-foreground">Arşiv</strong> sekmesinde tutulur.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className={`mt-5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
              isBilsemYillikPlan
                ? 'border-violet-500/20 bg-violet-500/[0.06] text-muted-foreground dark:border-violet-500/25 dark:bg-violet-950/40'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}
          >
            {me?.role === 'teacher' ? (
              <>
                Okul adı, müdür ve zümre satırları için{' '}
                <Link href="/settings" className="font-medium text-foreground underline-offset-2 hover:underline">
                  Ayarlar
                </Link>{' '}
                → Yıllık plan varsayılanları bölümünü kullanabilirsiniz; tanımlıysa formlar otomatik dolar.
              </>
            ) : (
              <>
                Okul adı, müdür ve zümre öğretmenleri için{' '}
                <Link href="/settings" className="font-medium text-foreground underline-offset-2 hover:underline">
                  Ayarlar
                </Link>{' '}
                → Yıllık plan varsayılanları alanından toplu varsayılan tanımlanabilir.
              </>
            )}
          </div>
          <button
            type="button"
            onClick={dismissGuide}
            className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors ${
              isBilsemYillikPlan
                ? 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            Anladım
          </button>
        </DialogContent>
      </Dialog>

      <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2', hideHeader && isBilsemYillikPlan && 'hidden')}>
        <div className="mobile-tab-scroll akilli-tahta-tabnav w-full min-w-0 snap-x snap-mandatory sm:w-auto">
          <div
            role="tablist"
            aria-label="Plan oluşturma ve arşiv"
            className={cn(
              'flex w-max max-w-full shadow-sm sm:w-full sm:flex-wrap sm:justify-start sm:overflow-visible',
              isBilsemYillikPlan
                ? 'gap-0.5 rounded-xl border border-violet-400/45 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/10 to-violet-500/12 p-0.5 shadow-inner shadow-violet-500/10 dark:border-violet-500/40 dark:from-violet-950/50 dark:via-fuchsia-950/40 dark:to-violet-950/50 sm:gap-1.5 sm:rounded-2xl sm:p-1.5'
                : 'gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1 sm:gap-1.5 sm:p-1.5',
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'plan'}
              onClick={() => setMainTab('plan')}
              className={cn(
                isBilsemYillikPlan
                  ? 'flex min-w-0 shrink-0 snap-start items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all sm:min-h-[44px] sm:flex-1 sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm'
                  : 'flex min-w-0 shrink-0 snap-start items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all sm:min-h-[44px] sm:flex-1 sm:py-2.5 sm:text-sm',
                mainTab === 'plan'
                  ? isBilsemYillikPlan
                    ? 'border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 ring-1 ring-white/20 dark:from-violet-600 dark:to-fuchsia-600'
                    : cn('border-sky-500/35 bg-sky-500/12 text-sky-950 ring-2 ring-sky-500/30 shadow-sm dark:text-sky-100')
                  : isBilsemYillikPlan
                    ? 'border-transparent bg-transparent text-violet-900/80 hover:bg-white/50 dark:text-violet-100/90 dark:hover:bg-violet-950/40'
                    : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-background/90 hover:text-foreground',
              )}
            >
              <FileEdit className="size-4 shrink-0" />
              <span className="max-sm:hidden">Plan oluştur</span>
              <span className="sm:hidden">Plan</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'archive'}
              onClick={() => setMainTab('archive')}
              className={cn(
                isBilsemYillikPlan
                  ? 'relative flex min-w-0 shrink-0 snap-start items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all sm:min-h-[44px] sm:flex-1 sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm'
                  : 'relative flex min-w-0 shrink-0 snap-start items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all sm:min-h-[44px] sm:flex-1 sm:py-2.5 sm:text-sm',
                mainTab === 'archive'
                  ? isBilsemYillikPlan
                    ? 'border-transparent bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/20 ring-1 ring-white/20 dark:from-fuchsia-600 dark:to-violet-600'
                    : cn('border-amber-500/35 bg-amber-500/12 text-amber-950 ring-2 ring-amber-500/30 shadow-sm dark:text-amber-100')
                  : isBilsemYillikPlan
                    ? 'border-transparent bg-transparent text-violet-900/80 hover:bg-white/50 dark:text-violet-100/90 dark:hover:bg-violet-950/40'
                    : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-background/90 hover:text-foreground',
              )}
            >
              <Archive className="size-4 shrink-0" />
              <span className="max-sm:hidden">Arşiv</span>
              <span className="sm:hidden">Arşiv</span>
              {archiveItems.length > 0 && (
                <span
                  className={cn(
                    'min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums sm:text-xs',
                    mainTab === 'archive'
                      ? isBilsemYillikPlan
                        ? 'bg-white/25 text-white'
                        : 'bg-amber-800/20 text-amber-950 dark:bg-amber-400/25 dark:text-amber-50'
                      : isBilsemYillikPlan
                        ? 'bg-fuchsia-500/25 text-fuchsia-900 dark:bg-fuchsia-400/20 dark:text-fuchsia-100'
                        : 'bg-amber-500/20 text-amber-900 dark:bg-amber-300/90',
                  )}
                >
                  {archiveItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {mainTab === 'plan' && (
        <>
      {noPlanKota && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-[0_16px_40px_-20px_rgba(244,63,94,0.6)]">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-white/20 blur-2xl" />
          <CardContent className="relative z-10 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <ShoppingBag className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight sm:text-base">
                  Plan üretim krediniz bitti
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/90 sm:text-sm">
                  Marketten kredi alıp üretime hemen devam edebilirsiniz.
                </p>
              </div>
              <Link
                href="/market"
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-white/95 sm:text-sm"
              >
                <Sparkles className="size-4" />
                Markete git
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Öğretmen: plan kotası ve varsayılanlar */}
      {me?.role === 'teacher' && !(hideHeader && isBilsemYillikPlan) && (
        <Card
          className={cn(
            'relative overflow-hidden shadow-sm',
            (hideHeader && isBilsemYillikPlan) || (isBilsemYillikPlan && 'max-sm:hidden'),
            isBilsemYillikPlan
              ? 'border-violet-400/35 border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-500/[0.08] via-transparent to-fuchsia-500/[0.04] dark:border-violet-500/30 dark:from-violet-950/40'
              : cn(
                  EVRAK_UI_PANEL.settings.card,
                  'bg-gradient-to-r from-sky-500/[0.06] via-transparent to-transparent dark:from-sky-950/25',
                ),
          )}
        >
          {!isBilsemYillikPlan && (
            <CardHeader className={cn('flex flex-row items-center gap-2 space-y-0 border-0 py-2.5 sm:py-3', EVRAK_UI_PANEL.settings.head)}>
              <span className="flex size-7 items-center justify-center rounded-md bg-sky-500/15">
                <Settings className="size-3.5 text-sky-800 dark:text-sky-300" />
              </span>
              <CardTitle className="text-xs font-semibold leading-tight sm:text-sm">Varsayılanlar ve kota</CardTitle>
            </CardHeader>
          )}
          <CardContent
            className={cn(
              'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
              !isBilsemYillikPlan ? 'pt-0 pb-3 sm:px-6' : 'px-2 py-1.5 sm:px-6 sm:py-3',
            )}
          >
            <div className="min-w-0">
              <p className={cn('text-foreground', isBilsemYillikPlan ? 'text-[10px] leading-snug sm:text-xs' : 'text-xs sm:text-sm')}>
                Plan üretirken okul adı, müdür ve zümre öğretmenleri otomatik doldurulur.
                <span className="ml-1 text-muted-foreground">Ayarlardan düzenleyebilirsiniz.</span>
              </p>
              {planUretimKota !== null && (
                <p className={cn('mt-1', isBilsemYillikPlan ? 'text-[10px] leading-snug sm:text-xs' : 'text-xs sm:text-sm')}>
                  <span className="font-medium text-foreground">Yıllık plan üretim kotanız:</span>{' '}
                  <span
                    className={
                      planUretimKota > 0
                        ? isBilsemYillikPlan
                          ? 'font-semibold text-violet-700 dark:text-violet-300'
                          : 'text-primary'
                        : 'text-amber-600 dark:text-amber-500'
                    }
                  >
                    {planUretimKota} adet
                  </span>
                  {planUretimKota <= 0 && (
                    <Link
                      href="/market"
                      className={cn(
                        'ml-1 inline-flex items-center gap-1 text-[10px] font-medium hover:underline sm:text-xs',
                        isBilsemYillikPlan ? 'text-violet-700 dark:text-violet-300' : 'text-primary',
                      )}
                    >
                      <ShoppingBag className="size-4" />
                      Marketten hak al
                    </Link>
                  )}
                </p>
              )}
              {defaultsIncomplete && (
                <p className="mt-1 text-[10px] font-medium leading-snug text-amber-600 dark:text-amber-500 sm:text-xs">
                  Önerilen: Okul adı ve müdür bilgisini varsayılanlara ekleyin; evraklarda otomatik görünür.
                </p>
              )}
            </div>
            <Link
              href="/settings"
              className={cn(
                'inline-flex shrink-0 items-center gap-1 self-start rounded-md border font-medium transition-colors sm:self-center sm:gap-2 sm:rounded-xl',
                isBilsemYillikPlan
                  ? 'border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-900 hover:bg-violet-500/15 dark:border-violet-400/35 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950/70 sm:px-4 sm:py-2.5 sm:text-sm'
                  : 'border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-primary hover:bg-primary/20',
              )}
            >
              <Settings className="size-4" />
              Varsayılanlara git
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      <Card
        className={cn(
          'relative overflow-hidden bg-card/95 shadow-xl ring-1 ring-black/5 dark:ring-white/10',
          isBilsemYillikPlan
            ? 'border-violet-400/30 dark:border-violet-500/25 [&_select]:focus:border-violet-600 [&_select]:focus:ring-2 [&_select]:focus:ring-violet-500/25'
            : cn(EVRAK_UI_PANEL.plan.card, '[&_select]:focus:border-sky-600 [&_select]:focus:ring-2 [&_select]:focus:ring-sky-500/25'),
        )}
      >
        <CardHeader
          className={cn(
            'border-b',
            isBilsemYillikPlan
              ? 'space-y-3 border-violet-400/25 bg-gradient-to-r from-violet-500/[0.07] via-transparent to-fuchsia-500/[0.05] px-3 pb-3 pt-3 dark:border-violet-500/20 sm:space-y-4 sm:px-6 sm:pb-4 sm:pt-4'
              : cn('space-y-4 px-3 pb-4 sm:px-6', EVRAK_UI_PANEL.plan.head),
          )}
        >
          <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between', isBilsemYillikPlan ? 'gap-2 sm:gap-4' : 'gap-3 sm:gap-4')}>
            <button
              type="button"
              onClick={goBack}
              className={cn(
                'flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                isBilsemYillikPlan
                  ? 'text-violet-900/80 hover:bg-violet-500/10 dark:text-violet-100/90 dark:hover:bg-violet-950/50'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <ChevronLeft className="size-4" />
              Geri
            </button>
            <nav
              className="-mx-1 flex max-w-full flex-1 items-center gap-0.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:justify-center sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
              aria-label="Plan seçim adımları"
            >
              {wizardSteps.map((s, i) => (
                <div key={s.label} className="flex shrink-0 items-center">
                  <div
                    aria-current={i === step ? 'step' : undefined}
                    aria-label={`${i + 1}. adım: ${s.label}${i < step ? ' (tamamlandı)' : ''}`}
                    className={cn(
                      isBilsemYillikPlan
                        ? 'flex snap-start items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all duration-200 sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-sm'
                        : 'flex snap-start items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200 sm:px-3 sm:py-1.5 sm:text-sm',
                      i < step
                        ? isBilsemYillikPlan
                          ? 'bg-violet-500/15 text-violet-800 dark:bg-violet-500/25 dark:text-violet-100'
                          : 'bg-primary/10 text-primary'
                        : i === step
                          ? isBilsemYillikPlan
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/20 ring-2 ring-violet-400/30 ring-offset-2 ring-offset-background dark:ring-violet-500/40'
                            : 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2'
                          : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {i < step ? <Check className="size-3.5 shrink-0 sm:size-4" /> : <span>{i + 1}</span>}
                    <span className="whitespace-nowrap">{s.label}</span>
                  </div>
                  {i < wizardSteps.length - 1 && (
                    <ChevronRight
                      className={cn(
                        'mx-0.5 size-4 shrink-0 sm:mx-1',
                        isBilsemYillikPlan ? 'text-violet-400/50 dark:text-violet-500/40' : 'text-muted-foreground/50',
                      )}
                    />
                  )}
                </div>
              ))}
            </nav>
          </div>
          {isBilsemYillikPlan ? (
            <CardTitle className="text-base sm:text-lg">
              {step === 0 && (me?.role === 'teacher' ? 'Öğretim yılı' : 'Öğretim yılı seçin')}
              {step === 1 && (me?.role === 'teacher' ? 'Grup seçimi' : 'Ana ve alt grup seçin')}
              {step === bilsemSubjectStep && 'Ders seçin'}
              {step === bilsemOutcomesStep &&
                (me?.role === 'teacher' ? 'Öğrenme Çıktıları' : 'Öğrenme Çıktıları ve plan kapsamı')}
            </CardTitle>
          ) : (
            <div className="flex items-start gap-3">
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', EVRAK_UI_PANEL.plan.iconWrap)}>
                <FileEdit className={cn('size-4 shrink-0', EVRAK_UI_PANEL.plan.iconClass)} />
              </span>
              <CardTitle className="text-base font-semibold leading-snug sm:text-lg">
                {step === 0 && 'Sınıf seçin'}
                {step === 1 && (needsSection ? 'Bölüm seçin' : 'Ders seçin')}
                {step === 2 && (needsSection ? 'Ders seçin' : 'Öğretim yılı')}
                {step === 3 && 'Öğretim yılı'}
              </CardTitle>
            </div>
          )}
        </CardHeader>
        <CardContent
          className={cn(
            isBilsemYillikPlan ? 'space-y-3 px-3 pb-4 pt-4 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-6' : 'space-y-4 pt-4 sm:space-y-6 sm:pt-6',
          )}
        >
          {selectionSummaryLine ? (
            <div
              className={cn(
                'rounded-2xl border px-3 py-2.5 text-xs shadow-inner sm:px-4 sm:py-3 sm:text-sm',
                isBilsemYillikPlan
                  ? 'max-sm:rounded-xl max-sm:py-2 max-sm:text-[11px] max-sm:leading-snug border-violet-400/35 bg-gradient-to-r from-violet-500/[0.08] to-fuchsia-500/[0.05] dark:border-violet-500/30 dark:from-violet-950/40 dark:to-fuchsia-950/25'
                  : 'border-sky-200/50 bg-gradient-to-r from-sky-500/[0.08] to-cyan-500/[0.04] dark:border-sky-900/35 dark:from-sky-950/30 dark:to-cyan-950/20',
              )}
            >
              <span className="font-semibold text-foreground">Seçimleriniz:</span>{' '}
              <span className="text-muted-foreground">{selectionSummaryLine}</span>
            </div>
          ) : null}

          {isBilsemYillikPlan && step === 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div>
                <label className="block text-xs font-medium sm:text-sm">Öğretim yılı</label>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  {me?.role === 'teacher'
                    ? 'Listeden seçin.'
                    : 'Örn: 2024-2025 — öğrenme çıktıları şablonları ve liste bu yıla göre filtrelenir.'}
                </p>
              </div>
              <select
                value={filters.academic_year}
                onChange={(e) => setFilters((f) => ({ ...f, academic_year: e.target.value }))}
                className="h-9 w-full max-w-full rounded-lg border border-input bg-background px-3 text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:h-11 sm:max-w-md sm:rounded-xl sm:px-4 sm:text-sm"
              >
                <option value="">Seçiniz</option>
                {options?.academic_years?.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBilsemYillikPlan && step === 1 && (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs font-medium sm:text-sm">Ana grup (yetenek alanı)</label>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  {me?.role === 'teacher'
                    ? 'Branşınıza uygun alanı seçin; ders listesi buna göre değişir.'
                    : 'Katalogdaki Bilsem dersleri ana gruba göre listelenir (Yıllık plan içerikleri ile aynı sözlük).'}
                </p>
                <select
                  value={filters.ana_grup}
                  onChange={(e) => setFilters((f) => ({ ...f, ana_grup: e.target.value, subject_code: '' }))}
                  className="mt-1.5 h-9 w-full max-w-full rounded-lg border border-input bg-background px-3 text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:mt-2 sm:h-11 sm:max-w-md sm:rounded-xl sm:px-4 sm:text-sm"
                >
                  <option value="">Seçiniz</option>
                  {BILSEM_ANA_GRUPLAR.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium sm:text-sm">Alt grup (program aşaması)</label>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  {me?.role === 'teacher' ? 'İsteğe bağlı.' : 'İsteğe bağlı — plan içeriği ve birleştirme için Ek-1 aşamaları.'}
                </p>
                <select
                  value={filters.alt_grup}
                  onChange={(e) => setFilters((f) => ({ ...f, alt_grup: e.target.value }))}
                  className="mt-1.5 h-9 w-full max-w-full rounded-lg border border-input bg-background px-3 text-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:mt-2 sm:h-11 sm:max-w-md sm:rounded-xl sm:px-4 sm:text-sm"
                >
                  <option value="">Tümü / belirtmeyin</option>
                  {BILSEM_ALT_GRUPLAR.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isBilsemYillikPlan && step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Sınıf</label>
                <p className="mt-0.5 text-xs text-muted-foreground">1–12 arası sınıf seçin</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        grade: String(g),
                        section: '',
                        subject_code: '',
                      }))
                    }
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                      filters.grade === String(g)
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-input hover:border-primary/40 hover:bg-muted/50'
                    }`}
                  >
                    {formatYillikPlanGradeLabel(g, false)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isBilsemYillikPlan && step === 1 && needsSection && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Bölüm</label>
                <p className="mt-0.5 text-xs text-muted-foreground">Ortaokul/lise için ders türünü seçin (Ders, Seçmeli, İHO vb.)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(options?.sections?.length ? options.sections : [
                  { value: 'ders', label: 'Ders' },
                  { value: 'secmeli', label: 'Seçmeli' },
                  { value: 'iho', label: 'İHO' },
                  { value: 'ihl', label: 'İHL' },
                  { value: 'meslek', label: 'Meslek' },
                  { value: 'mesem', label: 'Mesem' },
                  { value: 'gsl', label: 'GSL' },
                  { value: 'spor_l', label: 'Spor L.' },
                ]).map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, section: s.value, subject_code: '' }))}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                      filters.section === s.value
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-input hover:border-primary/40 hover:bg-muted/50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {((!isBilsemYillikPlan && step === 1 && !needsSection) ||
            (!isBilsemYillikPlan && step === 2 && needsSection) ||
            (isBilsemYillikPlan && step === bilsemSubjectStep)) && (
            <div className={cn('space-y-3', isBilsemYillikPlan && 'space-y-2 sm:space-y-3')}>
              <div>
                <label className={cn('block font-medium', isBilsemYillikPlan ? 'text-xs sm:text-sm' : 'text-sm')}>Ders</label>
                <p
                  className={cn(
                    'mt-0.5 text-muted-foreground',
                    isBilsemYillikPlan ? 'text-[11px] leading-snug sm:text-xs' : 'text-xs',
                  )}
                >
                  {isBilsemYillikPlan && me?.role === 'teacher' ? (
                    'Hazır içeriği olan dersler listelenir. Dersiniz yoksa okul yöneticinize danışın.'
                  ) : (
                    <>
                      Listede sadece plan içeriği oluşturulmuş dersler görünür.
                      <span className="mt-1 block">Dersiniz yoksa okul yöneticinizle iletişime geçin.</span>
                    </>
                  )}
                </p>
              </div>
              <select
                value={filters.subject_code}
                onChange={(e) => setFilters((f) => ({ ...f, subject_code: e.target.value }))}
                className={cn(
                  'w-full border border-input bg-background transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                  isBilsemYillikPlan
                    ? 'h-9 max-w-full rounded-lg px-3 text-xs sm:h-11 sm:max-w-md sm:rounded-xl sm:px-4 sm:text-sm'
                    : 'h-11 max-w-md rounded-xl px-4 py-2.5 text-sm',
                )}
              >
                <option value="">Seçiniz</option>
                {(isBilsemYillikPlan ? bilsemSubjectItems : subjects?.items)?.map((s, i) => (
                  <option key={`${s.code}-${i}`} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBilsemYillikPlan && step === bilsemOutcomesStep && (
            <div className="space-y-2.5 rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] to-transparent p-3 dark:border-violet-500/20 dark:from-violet-950/25 sm:space-y-3 sm:p-4">
              <div className="flex items-start gap-1.5 sm:gap-2">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-500/12 text-violet-700 sm:size-7 sm:rounded-lg dark:text-violet-200">
                  <Layers className="size-3 sm:size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground sm:text-sm">Öğrenme Çıktıları</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                    İşaretlediğiniz maddeler haftalara yayılır; tatil haftaları ayrı kalır.
                  </p>
                </div>
              </div>
              {bilsemSetsLoading ? (
                <p className="text-sm text-muted-foreground">Öğrenme çıktıları yükleniyor…</p>
              ) : bilsemOutcomeSets.length === 0 ? (
                <Alert
                  message={
                    me?.role === 'teacher'
                      ? 'Bu ders ve yıl için öğrenme çıktıları listesi henüz yok. Okul yöneticinize danışın.'
                      : 'Bu ders ve yıl için öğrenme çıktıları şablonu tanımlı değil. Yönetim ekranından (öğrenme çıktıları) eklenebilir.'
                  }
                  variant="warning"
                />
              ) : (
                <>
                  <label className="block text-xs font-medium sm:text-sm">Tanımlı set</label>
                  <select
                    value={bilsemSelectedSetId}
                    onChange={(e) => {
                      setBilsemSelectedSetId(e.target.value);
                      setBilsemSelectedItemIds(new Set());
                    }}
                    className="h-9 w-full max-w-full rounded-lg border border-input bg-background px-2.5 text-xs sm:h-11 sm:max-w-lg sm:rounded-xl sm:px-3 sm:text-sm"
                  >
                    <option value="">Seçiniz</option>
                    {bilsemOutcomeSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {labelBilsemOutcomeSetOption(s, bilsemSubjectItems, subjects?.items, me?.id)}
                      </option>
                    ))}
                  </select>
                  {bilsemSetDetail?.items?.length ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => setBilsemSelectedItemIds(new Set(bilsemSetDetail.items.map((i) => i.id)))}
                        >
                          Tümünü seç
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => setBilsemSelectedItemIds(new Set())}
                        >
                          Temizle
                        </button>
                      </div>
                      <div className="max-h-[min(12rem,38dvh)] space-y-1 overflow-y-auto overscroll-y-contain rounded-lg border border-border/60 p-1.5 sm:max-h-56 sm:space-y-2 sm:p-2">
                        {bilsemSetDetail.items.map((it) => {
                          const checked = bilsemSelectedItemIds.has(it.id);
                          const label = [it.code, it.unite, it.description?.slice(0, 140)].filter(Boolean).join(' — ');
                          return (
                            <label
                              key={it.id}
                              className="flex cursor-pointer gap-1.5 rounded-md px-1.5 py-1 text-[11px] leading-snug hover:bg-muted/50 sm:gap-2 sm:px-2 sm:py-1.5 sm:text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setBilsemSelectedItemIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(it.id)) next.delete(it.id);
                                    else next.add(it.id);
                                    return next;
                                  });
                                }}
                              />
                              <span className="text-foreground/90">{label || it.id}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  ) : bilsemSelectedSetId ? (
                    <p className="text-sm text-muted-foreground">Öğrenme çıktıları yükleniyor…</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1.5 sm:gap-4 sm:pt-2">
                    {(
                      [
                        ['yillik', 'Tüm yıl'],
                        ['donem_1', '1. dönem'],
                        ['donem_2', '2. dönem'],
                      ] as const
                    ).map(([v, lab]) => (
                      <label key={v} className="flex cursor-pointer items-center gap-1.5 text-[11px] sm:gap-2 sm:text-sm">
                        <input
                          type="radio"
                          name="bilsem-scope-wizard"
                          checked={bilsemPlanScope === v}
                          onChange={() => setBilsemPlanScope(v)}
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium sm:mb-1 sm:text-sm">Haftalık ders saati</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={bilsemWeeklyHours}
                      onChange={(e) => setBilsemWeeklyHours(e.target.value)}
                      className="h-8 w-20 rounded-md border border-input px-2 text-xs sm:h-10 sm:w-24 sm:rounded-lg sm:text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {!isBilsemYillikPlan && ((step === 2 && !needsSection) || (step === 3 && needsSection)) && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Öğretim Yılı</label>
                <p className="mt-0.5 text-xs text-muted-foreground">Örn: 2024-2025</p>
              </div>
              <select
                value={filters.academic_year}
                onChange={(e) => setFilters((f) => ({ ...f, academic_year: e.target.value }))}
                className="h-11 w-full max-w-md rounded-xl border border-input bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seçiniz</option>
                {options?.academic_years?.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={cn('pt-1.5 sm:pt-2', isBilsemYillikPlan && 'max-sm:pt-1')}>
            <button
              type="button"
              onClick={nextStep}
              disabled={!canProceed()}
              className={cn(
                'flex items-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
                isBilsemYillikPlan
                  ? 'w-full justify-center px-4 py-2.5 text-xs sm:w-auto sm:justify-start sm:px-5 sm:py-2.5 sm:text-sm'
                  : 'px-5 py-2.5 text-sm',
              )}
            >
              {step >= lastStep
                ? isBilsemYillikPlan && me?.role === 'teacher'
                  ? 'Şablonları göster'
                  : 'Planları Listele'
                : 'İleri'}
              <ChevronRight className="size-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {templates !== null && (
        <Card
          className={cn(
            'overflow-hidden shadow-sm',
            isBilsemYillikPlan ? 'border-border' : cn(EVRAK_UI_PANEL.templates.card, 'rounded-2xl'),
          )}
        >
          <CardHeader
            className={cn(
              'border-b',
              isBilsemYillikPlan
                ? 'border-border/50 px-3 py-2.5 sm:px-6 sm:py-4'
                : cn('px-3 py-3 sm:px-6 sm:py-4', EVRAK_UI_PANEL.templates.head),
            )}
          >
            <CardTitle
              className={cn(
                'flex items-center gap-2 font-semibold',
                isBilsemYillikPlan ? 'text-sm sm:text-lg' : 'text-base sm:text-lg',
              )}
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg',
                  isBilsemYillikPlan ? '' : EVRAK_UI_PANEL.templates.iconWrap,
                )}
              >
                <FileText
                  className={cn(
                    'size-4 shrink-0 sm:size-5',
                    isBilsemYillikPlan ? 'text-primary' : EVRAK_UI_PANEL.templates.iconClass,
                  )}
                />
              </span>
              {isBilsemYillikPlan
                ? me?.role === 'teacher'
                  ? 'Şablonlar'
                  : 'Bilsem Word şablonları'
                : 'Şablonlar'}{' '}
              ({templates.total})
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(isBilsemYillikPlan ? 'p-3 sm:p-6' : 'p-4 sm:p-6')}>
            {isBilsemYillikPlan && (
              <div className="mb-3 sm:mb-4">
                <BilsemPlanSourceEngagement
                  token={token}
                  subjectCode={filters.subject_code}
                  anaGrup={filters.ana_grup}
                  altGrup={filters.alt_grup}
                  academicYear={filters.academic_year}
                />
              </div>
            )}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-40 rounded-lg" />
                      <Skeleton className="h-4 w-24 rounded-lg" />
                    </div>
                    <Skeleton className="h-10 w-28 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : !templates.items?.length ? (
              <EmptyState
                icon={<FileText className="size-10 text-muted-foreground" />}
                title="Plan şablonu bulunamadı"
                description={
                  isBilsemYillikPlan
                    ? me?.role === 'teacher'
                      ? 'Bu seçimlere uygun şablon yok. Yıl, grup veya dersi değiştirmeyi deneyin.'
                      : 'Seçtiğiniz kriterlere uygun Bilsem şablonu yok. Şablon ekleyin veya farklı düzey, bölüm, ders, yıl deneyin.'
                    : me?.role === 'teacher'
                      ? 'Bu seçimlere uygun plan yok. Farklı sınıf, ders veya yıl deneyin.'
                      : 'Seçtiğiniz kriterlere uygun plan henüz eklenmemiş. Takvim ve plan içeriği tanımlı olmalı. Farklı sınıf/ders/yıl deneyin.'
                }
              />
            ) : (
              <div className={cn('space-y-3', isBilsemYillikPlan && 'space-y-2 sm:space-y-3')}>
                {templates.items.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'group flex rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-md',
                      isBilsemYillikPlan
                        ? 'flex-col items-stretch gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4'
                        : 'items-center justify-between gap-4 p-4',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground sm:text-base">{templateDisplayName(t)}</span>
                      {t.grade != null && (
                        <span
                          className={cn(
                            'mt-0.5 block text-muted-foreground',
                            isBilsemYillikPlan ? 'text-xs sm:text-sm' : 'text-sm',
                          )}
                        >
                          {formatYillikPlanGradeLabel(t.grade, isBilsemYillikPlan)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerateClick(t)}
                      disabled={me?.role === 'teacher' && noPlanKota}
                      title={me?.role === 'teacher' && noPlanKota ? 'Plan üretim kotanız bitti. Marketten hak alın.' : undefined}
                      className={cn(
                        'shrink-0 rounded-xl bg-primary font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow disabled:cursor-not-allowed disabled:opacity-50',
                        isBilsemYillikPlan
                          ? 'w-full px-3 py-2 text-xs sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm'
                          : 'px-4 py-2.5 text-sm',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <FileEdit className="size-4" />
                        {isBilsemYillikPlan && me?.role === 'teacher' ? 'Oluştur' : 'Plan İste'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </>
      )}

      {mainTab === 'archive' && (
        <div
          className={cn(
            'overflow-y-auto overscroll-contain pr-1',
            isBilsemYillikPlan ? 'max-h-[min(68dvh,480px)] sm:max-h-[min(72vh,820px)]' : 'max-h-[min(72vh,820px)]',
          )}
        >
          {archiveLoading ? (
            <Card
              className={cn(
                'relative overflow-hidden shadow-md backdrop-blur-sm',
                isBilsemYillikPlan
                  ? 'border-border/70 bg-card/80'
                  : cn(EVRAK_UI_PANEL.archive.card, 'rounded-2xl bg-card/95'),
              )}
            >
              <CardHeader
                className={cn(
                  'space-y-0.5 border-b pb-3',
                  isBilsemYillikPlan ? 'border-border/60 bg-muted/20' : cn('px-3 sm:px-6', EVRAK_UI_PANEL.archive.head),
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg',
                      isBilsemYillikPlan ? '' : EVRAK_UI_PANEL.archive.iconWrap,
                    )}
                  >
                    <Layers
                      className={cn(
                        'size-4',
                        isBilsemYillikPlan ? 'text-muted-foreground' : EVRAK_UI_PANEL.archive.iconClass,
                      )}
                    />
                  </span>
                  <CardTitle className="text-base font-semibold tracking-tight">Plan arşivi</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">Yükleniyor…</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="divide-y overflow-hidden rounded-xl border border-border/60">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-4 w-full max-w-md rounded" />
                      </div>
                      <Skeleton className="h-7 w-24 shrink-0 rounded-md" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : archiveItems.length > 0 ? (
            <div className="space-y-4">
              {archiveOther.length > 0 && (
                <Card
                  className={cn(
                    'relative overflow-hidden shadow-md backdrop-blur-sm',
                    isBilsemYillikPlan
                      ? 'border-border/70 bg-card/90'
                      : cn(EVRAK_UI_PANEL.archive.card, 'rounded-2xl bg-card/95'),
                  )}
                >
                  <CardHeader
                    className={cn(
                      'space-y-1 border-b pb-3',
                      isBilsemYillikPlan
                        ? 'border-border/60 bg-gradient-to-r from-muted/40 to-transparent'
                        : cn('px-3 sm:px-6', EVRAK_UI_PANEL.archive.head),
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-lg',
                          isBilsemYillikPlan ? '' : EVRAK_UI_PANEL.archive.iconWrap,
                        )}
                      >
                        <Layers
                          className={cn(
                            'size-4',
                            isBilsemYillikPlan ? 'text-primary' : EVRAK_UI_PANEL.archive.iconClass,
                          )}
                        />
                      </span>
                      <CardTitle className="text-base font-semibold tracking-tight">
                        {me?.role === 'teacher' ? 'Arşiv' : 'Yıllık plan arşivi'}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {me?.role === 'teacher' ? 'İndirdiğiniz planlar; tekrar indirebilir veya seçimlere uygulayabilirsiniz.'
                        : 'Word / Excel — indir veya seçimlere uygula.'}
                    </p>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <ArchivePlanCards
                      items={archiveOther}
                      variant="other"
                      redownloadingId={redownloadingId}
                      deletingId={deletingId}
                      onRedownload={handleRedownload}
                      onApply={applyArchive}
                      onDelete={handleDeleteArchive}
                    />
                  </CardContent>
                </Card>
              )}
              {archiveBilsem.length > 0 && (
                <Card className="relative overflow-hidden border-violet-400/35 bg-gradient-to-br from-violet-500/[0.08] via-card/95 to-fuchsia-500/[0.05] shadow-md backdrop-blur-sm dark:border-violet-500/30 dark:from-violet-950/40">
                  <CardHeader className="space-y-0.5 border-b border-violet-400/25 bg-violet-500/[0.06] px-3 pb-2.5 pt-3 dark:border-violet-500/25 dark:bg-violet-950/30 sm:space-y-1 sm:px-5 sm:pb-3 sm:pt-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
                      <CardTitle className="text-base font-semibold tracking-tight text-violet-900 dark:text-violet-100">
                        {me?.role === 'teacher' ? 'Arşiv' : 'Bilsem plan arşivi'}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {me?.role === 'teacher' ? 'Daha önce indirdiğiniz dosyalar.' : 'Bilsem Word kayıtları.'}
                    </p>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <ArchivePlanCards
                      items={archiveBilsem}
                      variant="bilsem"
                      redownloadingId={redownloadingId}
                      deletingId={deletingId}
                      onRedownload={handleRedownload}
                      onApply={applyArchive}
                      onDelete={handleDeleteArchive}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card
              className={cn(
                'overflow-hidden border-2 border-dashed bg-gradient-to-br from-muted/30 to-transparent',
                isBilsemYillikPlan
                  ? 'border-border/70'
                  : 'rounded-2xl border-amber-300/50 dark:border-amber-800/45',
              )}
            >
              <CardContent className="flex flex-col items-center justify-center py-10 text-center sm:py-14">
                <div
                  className={cn(
                    'mb-4 rounded-2xl p-4',
                    isBilsemYillikPlan
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'bg-amber-500/12 text-amber-800 dark:text-amber-200',
                  )}
                >
                  <FileText className="size-10" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Henüz plan üretmediniz</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {isBilsemYillikPlan
                    ? 'Plan oluştur sekmesinden Word üretin; kayıtlar burada listelenir.'
                    : 'Plan oluştur sekmesinden yıllık plan isteyin; kayıtlar burada görünür.'}
                </p>
                <button
                  type="button"
                  onClick={() => setMainTab('plan')}
                  className={cn(
                    'mt-6 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm',
                    isBilsemYillikPlan
                      ? 'bg-violet-600 hover:bg-violet-700'
                      : 'bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500',
                  )}
                >
                  Plan oluştur
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {generateModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-black/45 px-3 py-4 backdrop-blur-[2px] sm:px-4 sm:py-6">
          <Card
            className={`my-2 w-full max-w-2xl flex-col overflow-hidden shadow-2xl sm:my-0 ${
              isBilsemYillikPlan
                ? 'border-violet-500/25 ring-1 ring-violet-500/10 dark:border-violet-500/30'
                : 'border-border'
            } flex max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]`}
          >
            <CardHeader
              className={`shrink-0 flex flex-row items-start justify-between gap-3 border-b ${
                isBilsemYillikPlan ? 'py-3' : 'py-4'
              } ${
                isBilsemYillikPlan
                  ? 'border-violet-500/15 bg-gradient-to-r from-violet-500/[0.06] to-transparent dark:from-violet-950/40'
                  : 'border-sky-200/60 bg-linear-to-r from-sky-500/10 via-cyan-500/6 to-indigo-500/6 dark:border-sky-800/40 dark:from-sky-950/40'
              }`}
            >
              <div className={`min-w-0 ${isBilsemYillikPlan ? 'space-y-0.5' : 'space-y-1'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isBilsemYillikPlan ? 'Son adım · Word üretimi' : 'Plan üretimi'}
                </p>
                <CardTitle className={isBilsemYillikPlan ? 'text-sm font-semibold leading-snug sm:text-base' : 'text-base font-semibold leading-snug sm:text-lg'}>
                  {isBilsemYillikPlan ? (
                    <span className="bg-gradient-to-r from-violet-700 to-fuchsia-600 bg-clip-text text-transparent dark:from-violet-300 dark:to-fuchsia-400">
                      {templateDisplayName(generateModal)}
                    </span>
                  ) : (
                    <span className="bg-linear-to-r from-sky-700 via-cyan-700 to-indigo-700 bg-clip-text text-transparent dark:from-sky-300 dark:via-cyan-300 dark:to-indigo-300">
                      {`${filters.grade && `${filters.grade}. `}Sınıf ${templateDisplayName(generateModal)} Yıllık Plan`}
                    </span>
                  )}
                </CardTitle>
                <p className={isBilsemYillikPlan ? 'text-[11px] leading-snug text-muted-foreground' : 'text-xs text-muted-foreground'}>
                  {isBilsemYillikPlan
                    ? [filters.academic_year, bilsemGrupSummaryShort].filter(Boolean).join(' · ') || '—'
                    : generateForm.ogretim_yili || filters.academic_year || 'Öğretim yılı'}{' '}
                  {!isBilsemYillikPlan && '· Bilgileri kontrol edip üretin'}
                  {isBilsemYillikPlan && '· Kontrol, önizleme, indir'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGenerateModal(null);
                  setGenerateSuccess(false);
                }}
                className={`rounded-full p-1.5 transition-colors ${
                  isBilsemYillikPlan
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    : 'text-sky-700/80 hover:bg-sky-500/15 hover:text-sky-900 dark:text-sky-300 dark:hover:bg-sky-900/40'
                }`}
                aria-label="Kapat"
              >
                ×
              </button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto p-0">
              {generateSuccess ? (
                <div
                  className={`flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 ${
                    isBilsemYillikPlan
                      ? 'bg-linear-to-b from-violet-500/4 to-transparent'
                      : 'bg-linear-to-b from-sky-500/10 via-cyan-500/5 to-transparent'
                  }`}
                >
                  <div
                    className={`flex size-11 items-center justify-center rounded-full ${
                      isBilsemYillikPlan
                        ? 'bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300'
                        : 'bg-sky-500/20 text-sky-700 ring-1 ring-sky-500/30 dark:bg-sky-900/40 dark:text-sky-300'
                    }`}
                  >
                    <CheckCircle2 className="size-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {isBilsemYillikPlan ? 'Dosya indirildi' : 'Plan indirildi'}
                  </p>
                  <p className="max-w-xs text-center text-xs text-muted-foreground">
                    {isBilsemYillikPlan ? 'Arşivde de saklandı. Başka şablon veya seçimle yeni dosya üretebilirsiniz.' : 'Başka plan üretmek ister misiniz?'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setGenerateSuccess(false);
                        setGenerateForm((prev) => ({ ...prev }));
                      }}
                      className={`rounded-lg px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm ${
                        isBilsemYillikPlan
                          ? 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500'
                          : 'bg-linear-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500'
                      }`}
                    >
                      Yeni üret
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenerateModal(null);
                        setGenerateSuccess(false);
                      }}
                      className="rounded-lg border border-sky-300/50 bg-sky-500/5 px-4 py-2 text-xs text-sky-800 hover:bg-sky-500/10 dark:border-sky-700/40 dark:bg-sky-950/30 dark:text-sky-200"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className={isBilsemYillikPlan ? 'space-y-2 p-3' : 'space-y-4 p-4'}>
                  {(() => {
                    const schema = generateModal.formSchema ?? generateModal.form_schema ?? [];
                    const c = isBilsemYillikPlan;
                    const lbl = c ? 'mb-1 block text-xs font-medium text-foreground' : 'mb-1.5 block text-sm font-medium text-foreground';
                    const inp = c
                      ? 'h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-xs transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25'
                      : 'h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
                    const inpZ = c
                      ? 'h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25'
                      : 'h-10 min-w-[120px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
                    const btnZ = c
                      ? 'inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90'
                      : 'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90';
                    const readOnlyKeys = ['ogretim_yili', 'sinif', 'ders_kodu', 'dersKodu', 'ders-kodu', 'subject_code', 'ders_adi', 'dersAdi', 'ders-adi', 'subject_label'];
                    const zumreKeys = ['zumre_ogretmenleri', 'zumreler'];
                    const profileLockedKeys = ['onay_tarihi', 'tarih', 'onay_tarihi_alt', 'mudur_adi', 'zumre_ogretmenleri', 'zumreler', 'ogretmen_unvani'];
                    const summaryLine = [
                      generateForm.sinif && formatYillikPlanGradeLabel(generateForm.sinif, isBilsemYillikPlan),
                      generateForm.ders_adi ?? generateForm.dersAdi,
                      generateForm.ogretim_yili,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div className={c ? 'space-y-3' : 'space-y-5'}>
                        {summaryLine && (
                          <p
                            className={
                              c
                                ? 'rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs font-medium leading-snug text-foreground'
                                : 'rounded-xl bg-muted/40 px-4 py-3 text-sm font-medium text-foreground'
                            }
                          >
                            {summaryLine}
                          </p>
                        )}
                        {onayBolumuEksik && (
                          <Alert
                            message="Müdür adı ve zümre öğretmenleri zorunludur."
                            variant="warning"
                          />
                        )}
                        <Alert
                          message="Tarih, müdür, zümre ve öğretmen unvanı Profil > Zümre sekmesinden alınır."
                          variant="info"
                        />
                        {schema.map((f, fi) => {
                          if (readOnlyKeys.includes(f.key)) return null;
                          if (f.key === 'zumreler' && schema.some((x) => x.key === 'zumre_ogretmenleri')) return null;
                          if (f.key === 'tarih' && schema.some((x) => x.key === 'onay_tarihi')) return null;
                          const isZumre = zumreKeys.includes(f.key);
                          const isProfileLocked = profileLockedKeys.includes(f.key);
                          const zumreValue = generateForm[f.key] ?? generateForm.zumre_ogretmenleri ?? generateForm.zumreler ?? '';
                          const zumreList = zumreValue ? zumreValue.split(',').map((s) => s.trim()).filter(Boolean) : [];
                          const placeholders: Record<string, string> = {
                            okul_adi: 'Örn: Atatürk Anadolu Lisesi',
                            mudur_adi: 'Örn: Mehmet Yılmaz',
                            onay_tarihi: 'GG.AA.YYYY',
                          };
                          if (isZumre) {
                            const zumreItems = dedupeZumre(parseZumreRaw(zumreValue));
                            return (
                              <div key={f.key}>
                                <label className={lbl}>
                                  Zümre öğretmenleri (isim ve branş/unvan ile ekleyin) {f.required && '*'}
                                </label>
                                {!isProfileLocked && (
                                  <div className={c ? 'flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-end' : 'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end'}>
                                  <input
                                    type="text"
                                    id="zumre-isim-input"
                                    placeholder="Öğretmen adı"
                                    className={c ? `${inpZ} min-w-[100px] sm:min-w-[120px]` : inpZ}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const isimEl = document.getElementById('zumre-isim-input') as HTMLInputElement;
                                        const unvanEl = document.getElementById('zumre-unvan-input') as HTMLInputElement;
                                        const isim = isimEl?.value?.trim();
                                        if (isim) {
                                          const unvan = unvanEl?.value?.trim() ?? '';
                                          const next = [...zumreItems, { isim, unvan }];
                                          setGenerateForm((prev) => ({
                                            ...prev,
                                            zumre_ogretmenleri: serializeZumre(next),
                                            zumreler: serializeZumre(next),
                                          }));
                                          isimEl.value = '';
                                          if (unvanEl) unvanEl.value = '';
                                        }
                                      }
                                    }}
                                  />
                                  <input
                                    type="text"
                                    id="zumre-unvan-input"
                                    placeholder="Branş / unvan (örn: Coğrafya Öğretmeni)"
                                    className={c ? `${inpZ} min-w-0 sm:min-w-[120px]` : inpZ}
                                  />
                                  <button
                                    type="button"
                                    className={btnZ}
                                    onClick={() => {
                                      const isimEl = document.getElementById('zumre-isim-input') as HTMLInputElement;
                                      const unvanEl = document.getElementById('zumre-unvan-input') as HTMLInputElement;
                                      const isim = isimEl?.value?.trim();
                                      if (isim) {
                                        const unvan = unvanEl?.value?.trim() ?? '';
                                        const next = [...zumreItems, { isim, unvan }];
                                        setGenerateForm((prev) => ({
                                          ...prev,
                                          zumre_ogretmenleri: serializeZumre(next),
                                          zumreler: serializeZumre(next),
                                        }));
                                        isimEl.value = '';
                                        if (unvanEl) unvanEl.value = '';
                                      }
                                    }}
                                  >
                                    <Plus className={c ? 'size-3.5' : 'size-4'} />
                                    Ekle
                                  </button>
                                </div>
                                )}
                                {zumreItems.length > 0 && (
                                  <div className={c ? 'mt-1.5 flex flex-wrap gap-1' : 'mt-2 flex flex-wrap gap-1.5'}>
                                    {zumreItems.map((item, i) => (
                                      <span
                                        key={`${item.isim}-${item.unvan}-${i}`}
                                        className={
                                          c
                                            ? 'inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] transition-colors hover:bg-primary/20'
                                            : 'inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-sm transition-colors hover:bg-primary/20'
                                        }
                                      >
                                        {item.unvan ? `${item.isim} · ${item.unvan}` : item.isim}
                                        {!isProfileLocked && (
                                          <button
                                            type="button"
                                            className="rounded-full p-0.5 hover:bg-primary/30"
                                            onClick={() => {
                                              const next = zumreItems.filter((_, j) => j !== i);
                                              setGenerateForm((prev) => ({
                                                ...prev,
                                                zumre_ogretmenleri: serializeZumre(next),
                                                zumreler: serializeZumre(next),
                                              }));
                                            }}
                                          >
                                            <X className="size-3.5" />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div key={f.key}>
                              <label className={lbl}>
                                {f.label} {f.required && '*'}
                              </label>
                              {(f.key === 'onay_tarihi' || f.key === 'tarih' || f.key === 'onay_tarihi_alt') ? (
                                <input
                                  type="date"
                                  value={(() => {
                                    const s = (generateForm[f.key] ?? generateForm.onay_tarihi ?? generateForm.tarih ?? '').trim().replace(/\s*\/\s*/g, '.');
                                    if (!s) return '';
                                    const parts = s.split(/[.\/\-]/).map((p) => p.trim());
                                    if (parts.length === 3 && parts[2]?.length === 4)
                                      return `${parts[2]}-${(parts[1] ?? '').padStart(2, '0')}-${(parts[0] ?? '').padStart(2, '0')}`;
                                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                                    return '';
                                  })()}
                                  onChange={(e) => {
                                    if (isProfileLocked) return;
                                    const v = e.target.value;
                                    const tr = v ? new Date(v).toLocaleDateString('tr-TR') : '';
                                    const trAlt = tr.replace(/\./g, ' / ');
                                    setGenerateForm((prev) => ({
                                      ...prev,
                                      onay_tarihi: tr,
                                      tarih: tr,
                                      onay_tarihi_alt: trAlt,
                                    }));
                                  }}
                                  className={inp}
                                  disabled={isProfileLocked}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={generateForm[f.key] ?? ''}
                                  onChange={(e) => {
                                    if (isProfileLocked) return;
                                    setGenerateForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                                  }}
                                  placeholder={placeholders[f.key]}
                                  className={inp}
                                  disabled={isProfileLocked}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
              {(preview !== null || previewLoading) && (
                <div
                  className={`overflow-hidden rounded-xl border ${
                    isBilsemYillikPlan
                      ? 'mx-2 mb-2 border-violet-500/20 bg-gradient-to-br from-violet-500/[0.05] via-muted/30 to-fuchsia-500/[0.03] dark:border-violet-500/25 dark:from-violet-950/30'
                      : 'mx-3 mb-3 border-border bg-muted/25'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded((e) => !e)}
                    className={`flex w-full items-center gap-2 text-left transition-colors ${
                      isBilsemYillikPlan ? 'px-2 py-2 hover:bg-violet-500/[0.06] dark:hover:bg-violet-950/40' : 'gap-3 px-3 py-2.5 hover:bg-muted/40'
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-lg ${
                        isBilsemYillikPlan
                          ? 'size-7 bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'
                          : 'size-8 bg-muted text-muted-foreground'
                      }`}
                    >
                      <Eye className={isBilsemYillikPlan ? 'size-3.5' : 'size-4'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {previewLoading ? 'Önizleme hazırlanıyor' : 'Canlı önizleme'}
                      </span>
                      <span className="line-clamp-1 text-xs font-medium text-foreground">
                        {preview?.sheet_name ?? 'Şablon özeti'}
                      </span>
                    </span>
                    {previewExpanded ? (
                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {previewExpanded && (
                    <div
                      className={`min-h-[80px] overflow-auto overscroll-contain border-t px-2 py-2 sm:px-3 ${
                        isBilsemYillikPlan
                          ? 'max-h-[min(38vh,320px)] border-violet-500/15 bg-white/65 dark:border-violet-500/20 dark:bg-zinc-950/80'
                          : 'max-h-[min(52vh,440px)] border-border bg-white/60 dark:bg-zinc-950/70'
                      }`}
                    >
                      {previewLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8">
                          <LoadingSpinner className="size-6 text-violet-600 dark:text-violet-400" />
                          <p className="text-[11px] text-muted-foreground">Sayfa oluşturuluyor…</p>
                        </div>
                      ) : preview?.sheet_html ? (
                        <div
                          className="origin-top-left [scrollbar-width:thin]"
                          style={
                            (preview as { full_plan?: boolean })?.full_plan
                              ? { transform: 'scale(0.88)', transformOrigin: 'top left', minWidth: '113.6%' }
                              : isBilsemYillikPlan
                                ? { transform: 'scale(0.95)', transformOrigin: 'top left' }
                                : undefined
                          }
                        >
                          <div
                            className={`prose prose-sm max-w-none [&_th]:border [&_th]:border-border/80 [&_th]:bg-muted/60 [&_td]:border [&_td]:border-border/60 dark:[&_th]:border-white/10 dark:[&_td]:border-white/10 ${
                              isBilsemYillikPlan
                                ? 'text-[11px] leading-snug [&_table]:text-[10px] [&_td]:p-1.5 [&_th]:p-1.5'
                                : '[&_td]:p-2 [&_th]:p-2'
                            }`}
                            dangerouslySetInnerHTML={{ __html: preview.sheet_html }}
                          />
                        </div>
                      ) : preview && 'message' in preview ? (
                        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                          {preview.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
                  </div>
                  </div>
              <div
                className={`shrink-0 border-t border-border bg-background ${
                  isBilsemYillikPlan ? 'px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]' : 'px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
                }`}
              >
                <div className={`flex justify-end ${isBilsemYillikPlan ? 'gap-2' : 'gap-3'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setGenerateModal(null);
                      setGenerateSuccess(false);
                    }}
                    className={
                      isBilsemYillikPlan
                        ? 'rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted'
                        : 'rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted'
                    }
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateSubmit}
                    disabled={
                      generateLoading ||
                      noPlanKota ||
                      (isBilsemYillikPlan &&
                        !useBilsemPlanContentSource &&
                        !String(generateForm.bilsem_yillik_draft_json ?? '').trim())
                    }
                    title={noPlanKota ? 'Plan üretim kotanız bitti. Marketten hak alın.' : undefined}
                    className={
                      isBilsemYillikPlan
                        ? 'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                        : 'inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                    }
                  >
                    {generateLoading ? (
                      <>
                        <LoadingSpinner className={isBilsemYillikPlan ? 'size-3.5' : 'size-4'} />
                        Üretiliyor…
                      </>
                    ) : (
                      <>
                        <Download className={isBilsemYillikPlan ? 'size-3.5' : 'size-4'} />
                        Üret ve İndir
                      </>
                    )}
                  </button>
                </div>
              </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
