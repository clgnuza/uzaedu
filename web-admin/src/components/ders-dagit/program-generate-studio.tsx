'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  Copy,
  GripVertical,
  Gauge,
  LayoutGrid,
  MousePointerClick,
  Pencil,
  Settings2,
  Sparkles,
  Star,
  Target,
  Trash2,
  User,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { StudioValidationGate } from '@/components/ders-dagit/StudioValidationGate';
import { computeStudioReadiness, type StudioReadiness } from '@/lib/ders-dagit-readiness';
import { filterGenerateBlockingIssues } from '@/lib/ders-dagit-generate-gate';
import {
  distributionPolicySummary,
  parseDistributionPolicyDto,
  type DistributionPolicyDto,
} from '@/lib/distribution-policy';
import {
  DERS_DAGIT_ASSIGNMENTS_CHANGED,
  type AssignmentsChangedDetail,
} from '@/lib/ders-dagit-assignments-sync';
import { apiFetch, type ApiError } from '@/lib/api';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import {
  archiveProgram,
  cloneProgram,
  deleteProgram,
  listStudioPrograms,
  setFavoriteProgram,
  type DdProgramRow,
} from '@/lib/ders-dagit-program-api';
import { ProgramManageBar } from '@/components/timetable/ProgramManageBar';
import { TimetableReadonly } from '@/components/timetable/TimetableReadonly';
import { fetchEditorContext, type EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { Button } from '@/components/ui/button';
import { DdAccentButton, DdCard, DdGlassPanel, DdPageHeader, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { ProgramScoreBreakdownPanel } from '@/components/ders-dagit/ProgramScoreBreakdownPanel';
import { UnplacedPlacementReportPanel } from '@/components/ders-dagit/UnplacedPlacementReportPanel';
import type { ProgramScoreBreakdown, ScoreDeduction } from '@/lib/ders-dagit-score-breakdown';
import type { UnplacedPlacementReport } from '@/lib/ders-dagit-unplaced-report';
import {
  entryIdsForGroup,
  firstEntryIdForScroll,
  focusSummary,
} from '@/lib/score-breakdown-focus';
import type { ScoreDeductionGroup } from '@/lib/score-breakdown-groups';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type GeneratePriority = 'coverage' | 'balanced' | 'fast';

const PRIORITY_OPTIONS: Array<{
  id: GeneratePriority;
  title: string;
  desc: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: boolean;
}> = [
  {
    id: 'coverage',
    title: 'Tüm dersleri yerleştir',
    desc: 'Boş ders kalmasın; çözücü tüm kombinasyonları zorlar.',
    hint: 'Gelişmiş çözücü + 3 taslak + uzun süre. Yerleşmeyen ders kaldığında en iyi sonucu verir, biraz daha yavaştır.',
    icon: Target,
    recommended: true,
  },
  {
    id: 'balanced',
    title: 'Dengeli',
    desc: 'Hız ve yerleşim arasında denge.',
    hint: 'Standart süre ve tek taslak. Çoğu okul için yeterli.',
    icon: Gauge,
  },
  {
    id: 'fast',
    title: 'Hızlı taslak',
    desc: 'Hızlı önizleme; ince ayar sonra.',
    hint: 'En hızlı seçenek. Yerleşmeyen ders olabilir; düzenleyiciden tamamlayın.',
    icon: Zap,
  },
];

type CompareRow = {
  id: string;
  name: string | null;
  score: number | null;
  entry_count: number;
  score_breakdown?: ProgramScoreBreakdown | null;
  placement_percent?: number;
  unplaced_hours?: number;
  is_fully_placed?: boolean;
};

type PreviewTeacher = { id: string; label: string };

type PreviewState = {
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
  classSections: string[];
  teachers: PreviewTeacher[];
};

type PreviewViewMode = 'class' | 'teacher';

type GenerateResult = {
  programs: Array<{ id: string; name: string; score: number | null }>;
  score?: number;
  score_breakdown?: ProgramScoreBreakdown;
  unplaced_report?: UnplacedPlacementReport | null;
  violations?: string[];
  violation_links?: Array<{ text: string; href?: string }>;
  failed?: number;
  entries_count?: number;
};

const PREVIEW_DROP_ID = 'preview-drop';

function generateErrorText(e: unknown): string {
  const err = e as ApiError;
  if (err?.code === 'STRICT_RULES_VIOLATED') {
    const viol = err.details?.violations;
    if (Array.isArray(viol) && viol.length) {
      return viol
        .slice(0, 5)
        .map((v) => (typeof v === 'string' ? v : ''))
        .filter(Boolean)
        .join('\n');
    }
    return err.message || 'Zorunlu kurallar tam sağlanamadı — Kurallar / Planlama ilişkileri.';
  }
  if (err?.code === 'INTERNAL_ERROR') {
    return 'Sunucu hatası. Backend güncel mi kontrol edin; biraz sonra tekrar deneyin.';
  }
  if (err?.code === 'VALIDATION_FAILED') {
    const issues = err.details?.issues;
    if (Array.isArray(issues) && issues.length) {
      return issues
        .slice(0, 5)
        .map((i) => (typeof i === 'object' && i && 'message' in i ? String((i as { message: string }).message) : ''))
        .filter(Boolean)
        .join('\n');
    }
    return err.message || 'Doğrulama hatası — kırmızı kayıtları düzeltin.';
  }
  if (err?.code === 'DUTY_CONFLICT') {
    return 'Nöbet saatleriyle çakışma var. Nöbet planı veya ders saatlerini gözden geçirin.';
  }
  return e instanceof Error ? e.message : 'Üretim başarısız';
}

function ReadinessRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="relative size-[4.5rem] shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-[rgb(var(--dd-accent))] transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

function SortableDraftCard({
  draft,
  active,
  isBest,
  onSelect,
  onClone,
  onFavorite,
  onArchive,
  onDelete,
}: {
  draft: CompareRow;
  active: boolean;
  isBest: boolean;
  onSelect: () => void;
  onClone: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: draft.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const scorePct =
    draft.placement_percent != null
      ? Math.min(100, Math.max(0, draft.placement_percent))
      : draft.score != null
        ? Math.min(100, Math.max(0, draft.score))
        : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur-sm transition-shadow',
        active ? 'border-[rgb(var(--dd-accent))] ring-2 ring-[rgb(var(--dd-accent))]/25' : 'border-border/70',
        isBest && !active && 'border-emerald-500/50',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-manipulation text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Sürükle"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{draft.name ?? draft.id.slice(0, 8)}</p>
            {isBest && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                Önerilen
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{draft.entry_count} ders saati</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--dd-accent))] to-violet-500 transition-all"
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <p className="mt-1 text-xs tabular-nums">
            Yerleşme <strong>%{draft.placement_percent ?? '—'}</strong>
            {draft.score != null ? (
              <>
                {' '}
                · Puan <strong>{draft.score}</strong>
              </>
            ) : null}
            {(draft.unplaced_hours ?? 0) > 0 ? (
              <span className="text-amber-700 dark:text-amber-300"> · {draft.unplaced_hours} sa eksik</span>
            ) : null}
          </p>
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Önizlemeye sürükleyin veya tıklayın</p>
      <div className="mt-2 flex flex-wrap gap-1 opacity-90 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
        <Button type="button" size="sm" variant={active ? 'default' : 'outline'} asChild>
          <Link href={`/ders-dagit/studyo/program?id=${draft.id}`}>
            <Pencil className="mr-1 size-3" />
            Düzenle
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClone}>
          <Copy className="size-3" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onFavorite}>
          <Star className="size-3" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onArchive}>
          <Archive className="size-3" />
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function DraftDragPreview({ draft }: { draft: CompareRow }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--dd-accent))] bg-card px-3 py-2 shadow-xl">
      <p className="text-sm font-medium">{draft.name ?? 'Taslak'}</p>
      <p className="text-xs text-muted-foreground">Puan {draft.score ?? '—'}</p>
    </div>
  );
}

function PreviewDropPanel({
  children,
  isOver,
  hasPreview,
  busy,
}: {
  children: React.ReactNode;
  isOver: boolean;
  hasPreview: boolean;
  busy: boolean;
}) {
  const { setNodeRef, isOver: over } = useDroppable({ id: PREVIEW_DROP_ID });
  const highlight = isOver || over;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-h-[280px] rounded-2xl border-2 border-dashed transition-all duration-200',
        highlight
          ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/8 shadow-inner'
          : 'border-border/60 bg-muted/10',
        busy && 'animate-pulse',
      )}
    >
      {!hasPreview && !busy && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <LayoutGrid className="size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Önizleme alanı</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Taslak kartını buraya sürükleyin veya soldan seçin. Tam düzenleme için tablo görünümüne geçin.
          </p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
            <MousePointerClick className="size-3" />
            Sürükle-bırak
          </span>
        </div>
      )}
      {busy && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[2px]">
          <Wand2 className="size-8 animate-pulse text-[rgb(var(--dd-accent))]" />
          <p className="text-sm font-medium">Programlar oluşturuluyor…</p>
        </div>
      )}
      <div className={cn('relative p-2 sm:p-3', !hasPreview && !busy && 'opacity-0')}>{children}</div>
      {highlight && (
        <div className="pointer-events-none absolute inset-x-3 top-3 rounded-md bg-[rgb(var(--dd-accent))]/90 px-2 py-1 text-center text-xs font-medium text-white">
          Bırak — önizle
        </div>
      )}
    </div>
  );
}

export function ProgramGenerateStudio() {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  const readiness = computeStudioReadiness(overview);
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState<'coverage' | 'balanced' | 'fast'>('balanced');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useCsp, setUseCsp] = useState(false);
  const [versions, setVersions] = useState('1');
  const [durationSec, setDurationSec] = useState('120');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [compareMap, setCompareMap] = useState<Map<string, CompareRow>>(new Map());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewScoreBreakdown, setPreviewScoreBreakdown] = useState<ProgramScoreBreakdown | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewSection, setPreviewSection] = useState('');
  const [previewView, setPreviewView] = useState<PreviewViewMode>('class');
  const [previewTeacherId, setPreviewTeacherId] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [focusEntryIds, setFocusEntryIds] = useState<Set<string> | null>(null);
  const [focusHint, setFocusHint] = useState<string | null>(null);
  const previewGridRef = useRef<HTMLDivElement>(null);
  const [existing, setExisting] = useState<DdProgramRow[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [generateBlockers, setGenerateBlockers] = useState<ValidationIssue[]>([]);
  const [distributionPolicy, setDistributionPolicy] = useState<DistributionPolicyDto | null>(null);

  const refreshGenerateBlockers = useCallback(async () => {
    if (!token || !studio) return [];
    const list = await apiFetch<ValidationIssue[]>(`/ders-dagit/studios/${studio.id}/validation`, {
      token,
    });
    const blockers = filterGenerateBlockingIssues(list);
    setGenerateBlockers(blockers);
    return blockers;
  }, [token, studio]);

  useEffect(() => {
    void refreshGenerateBlockers();
  }, [refreshGenerateBlockers]);

  useEffect(() => {
    if (!token || !studio) return;
    void apiFetch<DistributionPolicyDto>(`/ders-dagit/studios/${studio.id}/distribution-policy`, { token })
      .then((raw) => setDistributionPolicy(parseDistributionPolicyDto(raw)))
      .catch(() => setDistributionPolicy(parseDistributionPolicyDto(null)));
  }, [token, studio]);

  useEffect(() => {
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<AssignmentsChangedDetail>).detail;
      if (detail?.studioId && detail.studioId !== studio?.id) return;
      void refreshGenerateBlockers();
    };
    window.addEventListener(DERS_DAGIT_ASSIGNMENTS_CHANGED, onChanged);
    return () => window.removeEventListener(DERS_DAGIT_ASSIGNMENTS_CHANGED, onChanged);
  }, [studio?.id, refreshGenerateBlockers]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );

  const orderedDrafts = useMemo(() => {
    return draftOrder.map((id) => compareMap.get(id)).filter(Boolean) as CompareRow[];
  }, [draftOrder, compareMap]);

  const bestId = useMemo(() => {
    const sorted = [...orderedDrafts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return sorted[0]?.id ?? null;
  }, [orderedDrafts]);

  const sections = preview?.classSections ?? [];

  const previewTeachers = useMemo((): PreviewTeacher[] => {
    if (!preview?.entries.length) return [];
    const labelById = new Map(preview.teachers.map((t) => [t.id, t.label]));
    const seen = new Map<string, string>();
    for (const e of preview.entries) {
      if (!e.user_id || seen.has(e.user_id)) continue;
      const label =
        e.teacher_label?.trim() || labelById.get(e.user_id) || e.user_id.slice(0, 8);
      seen.set(e.user_id, label);
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr', { sensitivity: 'base' }));
  }, [preview]);

  useEffect(() => {
    if (!sections.length) {
      setPreviewSection('');
      return;
    }
    if (!previewSection || !sections.includes(previewSection)) {
      setPreviewSection(sections[0]!);
    }
  }, [sections, previewSection]);

  useEffect(() => {
    if (previewView !== 'teacher') return;
    if (!previewTeachers.length) {
      setPreviewTeacherId('');
      return;
    }
    if (!previewTeacherId || !previewTeachers.some((t) => t.id === previewTeacherId)) {
      setPreviewTeacherId(previewTeachers[0]!.id);
    }
  }, [previewView, previewTeachers, previewTeacherId]);

  const loadExisting = useCallback(async () => {
    if (!token || !studio) return;
    setExisting(await listStudioPrograms(token, studio.id));
  }, [token, studio]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const loadPreview = useCallback(
    async (id: string) => {
      if (!token || !studio) return;
      setPreviewId(id);
      try {
        const ctx = await fetchEditorContext(token, studio.id, id);
        const teacherById = new Map(ctx.teachers.map((t) => [t.id, t.label]));
        const entries = ctx.entries.map((e) => ({
          ...e,
          day_of_week: Number(e.day_of_week),
          lesson_num: Number(e.lesson_num),
          teacher_label:
            e.teacher_label?.trim() ||
            (e.user_id ? teacherById.get(e.user_id) ?? null : null),
        }));
        setPreview({
          entries,
          workDays: ctx.period.work_days?.length ? ctx.period.work_days : [1, 2, 3, 4, 5],
          maxLesson: ctx.max_lesson,
          classSections: ctx.class_sections,
          teachers: ctx.teachers,
        });
        setPreviewSection(ctx.class_sections[0] ?? '');
        setPreviewScoreBreakdown(ctx.score_breakdown ?? null);
      } catch (e) {
        setPreview(null);
        setPreviewScoreBreakdown(null);
        toast.error(e instanceof Error ? e.message : 'Önizleme yüklenemedi');
      }
    },
    [token, studio],
  );

  useEffect(() => {
    if (!token || !studio || previewId || !bestId) return;
    void loadPreview(bestId);
  }, [token, studio, bestId, previewId, loadPreview]);

  function setCompareRows(rows: CompareRow[]) {
    setCompareMap(new Map(rows.map((r) => [r.id, r])));
    setDraftOrder(rows.map((r) => r.id));
  }

  async function generate() {
    if (!token || !studio) return;
    setBusy(true);
    setPreview(null);
    setPreviewId(null);
    setPreviewScoreBreakdown(null);
    setPreviewView('class');
    setPreviewTeacherId('');
    try {
      const blockers = await refreshGenerateBlockers();
      if (blockers.length) {
        toast.error(
          blockers
            .slice(0, 5)
            .map((b) => b.message)
            .join('\n'),
        );
        return;
      }
      const body = showAdvanced
        ? { duration_sec: Number(durationSec), versions: Number(versions), use_csp: useCsp, priority }
        : { priority };
      const res = await apiFetch<GenerateResult & { entries_count: number }>(
        `/ders-dagit/studios/${studio.id}/generate`,
        { token, method: 'POST', body },
      );
      setResult({
        programs: res.programs.map((p) => ({ id: p.id, name: p.name ?? 'Program', score: p.score })),
        score: res.score,
        score_breakdown: res.score_breakdown,
        unplaced_report: res.unplaced_report ?? null,
        violations: res.violations,
        violation_links: res.violation_links,
        failed: res.failed,
        entries_count: res.entries_count,
      });
      const ids = res.programs.map((p) => p.id).join(',');
      if (ids) {
        const cmp = await apiFetch<{ programs: CompareRow[] }>(
          `/ders-dagit/studios/${studio.id}/programs/compare?ids=${ids}`,
          { token },
        );
        setCompareRows(cmp.programs);
        const best = [...cmp.programs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        if (best) await loadPreview(best.id);
      }
      const failed = res.failed ?? 0;
      if (failed > 0) {
        toast.warning(
          res.unplaced_report
            ? `${res.entries_count} saat yerleşti, ${failed} saat sığmadı — eksik kartlar ve öneriler aşağıda.`
            : `${res.entries_count} saat yerleşti, ${failed} saat sığmadı — süreyi artırın veya atamaları gözden geçirin.`,
        );
      } else {
        toast.success(`${res.entries_count} ders saati yerleştirildi`);
      }
      await refresh({ force: true });
      await loadExisting();
    } catch (e) {
      toast.error(generateErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  function removeDraft(id: string) {
    setDraftOrder((o) => o.filter((x) => x !== id));
    setCompareMap((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });
    setResult((r) => (r ? { ...r, programs: r.programs.filter((p) => p.id !== id) } : r));
    if (previewId === id) {
      setPreviewId(null);
      setPreview(null);
    }
  }

  function onDragStart(ev: DragStartEvent) {
    setActiveDragId(String(ev.active.id));
  }

  function onDragEnd(ev: DragEndEvent) {
    setActiveDragId(null);
    const activeId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;

    if (overId === PREVIEW_DROP_ID && compareMap.has(activeId)) {
      void loadPreview(activeId);
      return;
    }

    if (overId && activeId !== overId && draftOrder.includes(activeId) && draftOrder.includes(overId)) {
      const oldIndex = draftOrder.indexOf(activeId);
      const newIndex = draftOrder.indexOf(overId);
      setDraftOrder(arrayMove(draftOrder, oldIndex, newIndex));
    }
  }

  const activeBreakdown = useMemo(() => {
    if (previewId) {
      return previewScoreBreakdown ?? compareMap.get(previewId)?.score_breakdown ?? null;
    }
    return result?.score_breakdown ?? null;
  }, [previewId, previewScoreBreakdown, compareMap, result?.score_breakdown]);

  useEffect(() => {
    setActiveGroupId(null);
    setFocusEntryIds(null);
    setFocusHint(null);
  }, [previewId, previewSection]);

  const onSelectGroup = useCallback(
    (g: ScoreDeductionGroup) => {
      if (!preview?.entries.length) return;
      setActiveGroupId(g.id);
      const ids = entryIdsForGroup(preview.entries, g);
      if (!ids.size) {
        toast.message('Bu konu için tabloda eşleşen ders bulunamadı');
        setFocusEntryIds(null);
        setFocusHint(null);
        return;
      }
      setFocusEntryIds(ids);
      const hint = focusSummary(ids, preview.entries);
      setFocusHint(hint);
      if (sections.length > 1) {
        const counts = new Map<string, number>();
        for (const e of preview.entries) {
          if (!ids.has(e.id)) continue;
          counts.set(e.class_section, (counts.get(e.class_section) ?? 0) + 1);
        }
        let best = previewSection;
        let bestN = 0;
        for (const [sec, n] of counts) {
          if (n > bestN) {
            bestN = n;
            best = sec;
          }
        }
        if (best && sections.includes(best) && best !== previewSection) {
          setPreviewSection(best);
        }
      }
      const eid = firstEntryIdForScroll(ids, preview.entries);
      if (eid) {
        requestAnimationFrame(() => {
          const el = previewGridRef.current?.querySelector(`[data-entry-id="${eid}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        });
      }
    },
    [preview],
  );

  const dragDraft = activeDragId ? compareMap.get(activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        <DdPageHeader
          icon={Sparkles}
          title="Program oluştur"
          description="ASC-benzeri arama ile taslak üretir. Ders/şube kısıtları Planlama ilişkilerinde; haftalık dağıtım modu Kurallar’da."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start">
          <div className="space-y-4">
            <DdCard variant="sky">
              <CardContent className="flex gap-4 pt-5">
                <ReadinessRing percent={readiness.percent} />
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="font-medium">Hazırlık</p>
                  <ReadinessChips readiness={readiness} />
                </div>
              </CardContent>
            </DdCard>

            {distributionPolicy && (
              <DdCard>
                <CardContent className="space-y-2 pt-4 text-xs">
                  <p className="font-medium text-foreground">Dağıtım ayarı (üretimde)</p>
                  <p className="text-muted-foreground">{distributionPolicySummary(distributionPolicy)}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Ders bazlı 2+2, haftaya yay vb. için{' '}
                    <Link href="/ders-dagit/studyo/planlama-iliskileri" className="text-primary underline">
                      Planlama ilişkileri
                    </Link>
                    ; okul geneli için{' '}
                    <Link href="/ders-dagit/studyo/kurallar" className="text-primary underline">
                      Kurallar
                    </Link>
                    .
                  </p>
                  <Link href="/ders-dagit/studyo/kurallar" className="inline-block text-primary underline">
                    Kurallar → haftalık dağıtım modu
                  </Link>
                </CardContent>
              </DdCard>
            )}

            <DdCard variant="indigo">
              <CardHeader>
                <CardTitle className="text-base">Üret</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StudioValidationGate overview={overview} action="generate">
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Yerleştirme önceliği (süre / kapsam)
                    </p>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPriority(opt.id)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          priority === opt.id
                            ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/10 ring-2 ring-[rgb(var(--dd-accent))]/25'
                            : 'border-border/70 hover:bg-muted/40',
                        )}
                      >
                        <opt.icon
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            priority === opt.id ? 'text-[rgb(var(--dd-accent))]' : 'text-muted-foreground',
                          )}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {opt.title}
                            {opt.recommended && (
                              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                                Önerilen
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{opt.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Settings2 className="size-3.5" />
                    Gelişmiş ayarlar {showAdvanced ? '▴' : '▾'}
                  </button>
                  {showAdvanced && (
                    <div className="grid gap-2 rounded-lg border border-dashed border-border/70 p-2.5">
                      <DdSelectField
                        label="Taslak sayısı"
                        value={versions}
                        onValueChange={setVersions}
                        options={[
                          { value: '1', label: '1 (tek)' },
                          { value: '2', label: '2' },
                          { value: '3', label: '3 (karşılaştır)' },
                        ]}
                      />
                      <DdSelectField
                        label="Süre (sn)"
                        value={durationSec}
                        onValueChange={setDurationSec}
                        options={[
                          { value: '60', label: '60' },
                          { value: '90', label: '90' },
                          { value: '120', label: '120' },
                          { value: '180', label: '180' },
                          { value: '240', label: '240' },
                        ]}
                      />
                      <label className="flex cursor-pointer items-center gap-2 text-sm" title="Büyük okullarda yavaş; yerleşemeyen çoksa açın">
                        <input type="checkbox" checked={useCsp} onChange={(e) => setUseCsp(e.target.checked)} />
                        Gelişmiş yerleştirme (yavaş, daha iyi)
                      </label>
                    </div>
                  )}

                  {generateBlockers.length > 0 && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-900 dark:text-rose-100">
                      <p className="font-medium">Üretimi engelleyen hatalar</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {generateBlockers.slice(0, 6).map((b, i) => (
                          <li key={`${b.code}-${i}`}>{b.message}</li>
                        ))}
                      </ul>
                      <Link href="/ders-dagit/studyo/dogrulama" className="mt-1 inline-block text-primary underline">
                        Doğrulama
                      </Link>
                    </div>
                  )}
                  <DdAccentButton
                    type="button"
                    className="w-full"
                    disabled={busy || !studio || generateBlockers.length > 0}
                    onClick={() => void generate()}
                  >
                    <Wand2 className="mr-2 size-4" />
                    {busy ? 'Oluşturuluyor…' : 'Program oluştur'}
                  </DdAccentButton>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {PRIORITY_OPTIONS.find((o) => o.id === priority)?.hint}
                  </p>
                </StudioValidationGate>
              </CardContent>
            </DdCard>

            {orderedDrafts.length > 0 && (
              <DdCard variant="violet">
                <CardHeader>
                  <CardTitle className="text-base">Taslaklar</CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext items={draftOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {orderedDrafts.map((d) => (
                        <SortableDraftCard
                          key={d.id}
                          draft={d}
                          active={previewId === d.id}
                          isBest={d.id === bestId}
                          onSelect={() => void loadPreview(d.id)}
                          onClone={() =>
                            void (async () => {
                              if (!token || !studio) return;
                              const c = await cloneProgram(token, studio.id, d.id);
                              toast.success('Kopyalandı');
                              await loadExisting();
                              await loadPreview(c.id);
                            })()
                          }
                          onFavorite={() =>
                            void (async () => {
                              if (!token || !studio) return;
                              await setFavoriteProgram(token, studio.id, d.id);
                              toast.success('Favori');
                              await loadExisting();
                            })()
                          }
                          onArchive={() =>
                            void (async () => {
                              if (!token || !studio) return;
                              await archiveProgram(token, studio.id, d.id);
                              toast.success('Arşivlendi');
                              removeDraft(d.id);
                              await loadExisting();
                            })()
                          }
                          onDelete={() => {
                            if (!window.confirm('Silinsin mi?') || !token || !studio) return;
                            void (async () => {
                              await deleteProgram(token, studio.id, d.id);
                              toast.success('Silindi');
                              removeDraft(d.id);
                              await loadExisting();
                            })();
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </DdCard>
            )}

          </div>

          <DdGlassPanel strong className="space-y-3 p-3 sm:p-4 lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Görsel önizleme</h2>
              {result?.score != null && (
                <span className="rounded-full bg-[rgb(var(--dd-accent))]/15 px-2 py-0.5 text-xs font-medium tabular-nums">
                  En iyi puan {result.score}
                </span>
              )}
            </div>

            {preview && preview.entries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/70 p-0.5">
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors',
                      previewView === 'class'
                        ? 'bg-[rgb(var(--dd-accent))]/15 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50',
                    )}
                    onClick={() => setPreviewView('class')}
                  >
                    <Users className="size-3.5" aria-hidden />
                    Sınıf
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors',
                      previewView === 'teacher'
                        ? 'bg-[rgb(var(--dd-accent))]/15 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50',
                    )}
                    onClick={() => setPreviewView('teacher')}
                    disabled={!previewTeachers.length}
                  >
                    <User className="size-3.5" aria-hidden />
                    Öğretmen
                  </button>
                </div>
                {previewView === 'class' && sections.length > 1 && (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {sections.map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                          previewSection === sec
                            ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/15 font-medium'
                            : 'border-border/70 hover:bg-muted/50',
                        )}
                        onClick={() => setPreviewSection(sec)}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                )}
                {previewView === 'teacher' && previewTeachers.length > 1 && (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {previewTeachers.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                          previewTeacherId === t.id
                            ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/15 font-medium'
                            : 'border-border/70 hover:bg-muted/50',
                        )}
                        onClick={() => setPreviewTeacherId(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
                {previewView === 'teacher' && previewTeachers.length === 1 && (
                  <span className="text-xs text-muted-foreground">{previewTeachers[0]!.label}</span>
                )}
              </div>
            )}

            <PreviewDropPanel isOver={!!activeDragId} hasPreview={(preview?.entries.length ?? 0) > 0} busy={busy}>
              {preview && preview.entries.length > 0 && (
                <TimetableReadonly
                  entries={preview.entries}
                  workDays={preview.workDays}
                  maxLesson={preview.maxLesson}
                  displayMode={previewView}
                  placementMode="drag"
                  classSection={
                    previewView === 'class' &&
                    sections.length > 1 &&
                    previewSection &&
                    sections.includes(previewSection)
                      ? previewSection
                      : undefined
                  }
                  teacherId={
                    previewView === 'teacher' && previewTeacherId ? previewTeacherId : undefined
                  }
                  focusEntryIds={focusEntryIds}
                  gridRef={previewGridRef}
                />
              )}
            </PreviewDropPanel>

            {result?.unplaced_report && (
              <UnplacedPlacementReportPanel report={result.unplaced_report} />
            )}

            {activeBreakdown && (
              <ProgramScoreBreakdownPanel
                breakdown={activeBreakdown}
                activeGroupId={activeGroupId}
                focusHint={focusHint}
                onSelectGroup={preview?.entries.length ? onSelectGroup : undefined}
                title={
                  activeBreakdown.points_to_full > 0
                    ? previewId && compareMap.get(previewId)?.name
                      ? `Neden ${activeBreakdown.score} puan? — ${compareMap.get(previewId)?.name}`
                      : `Neden ${activeBreakdown.score} değil 100?`
                    : 'Puan özeti'
                }
              />
            )}

            {previewId && token && studio && (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" asChild>
                    <Link href={`/ders-dagit/studyo/program?id=${previewId}`}>
                      <LayoutGrid className="mr-1 size-3.5" />
                      Tabloda sürükle-bırak düzenle
                    </Link>
                  </Button>
                </div>
                <ProgramManageBar
                  programId={previewId}
                  program={
                    existing.find((e) => e.id === previewId) ??
                    ({ id: previewId, name: null, status: 'generated', score: null } as DdProgramRow)
                  }
                  onChanged={async (opts) => {
                    await loadExisting();
                    if (opts?.removedId) removeDraft(opts.removedId);
                    if (opts?.selectId) await loadPreview(opts.selectId);
                  }}
                  compact
                />
              </div>
            )}
          </DdGlassPanel>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragDraft ? <DraftDragPreview draft={dragDraft} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function ReadinessChips({ readiness }: { readiness: StudioReadiness }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {readiness.phases.data.steps
        .filter((s) => s.required)
        .map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={cn(
              'rounded-full border px-2 py-0.5 transition-colors',
              s.done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10',
            )}
          >
            {s.label}
          </Link>
        ))}
      <Link href="/ders-dagit/studyo/planlama-iliskileri" className="rounded-full border px-2 py-0.5 hover:bg-muted/50">
        Planlama ilişkileri
      </Link>
      <Link href="/ders-dagit/studyo/kurallar" className="rounded-full border px-2 py-0.5 hover:bg-muted/50">
        Okul kuralları
      </Link>
      <Link href="/ders-dagit/studyo/kurulum" className="rounded-full border px-2 py-0.5 hover:bg-muted/50">
        Dağıtım modu
      </Link>
    </div>
  );
}
