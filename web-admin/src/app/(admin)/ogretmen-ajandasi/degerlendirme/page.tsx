'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Target,
  Users,
  List,
  ListFilter,
  Printer,
  ThumbsUp,
  ThumbsDown,
  X,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Info,
  Download,
  Trash2,
  Pencil,
  Plus,
  Table,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  BookOpen,
  BarChart3,
  Wrench,
  Sparkles,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import { splitStudentNameForCard } from './lib/student-avatar';
import { StudentMascotIcon } from './lib/student-mascot-icon';
import { buildWeekSummary, getWeekBounds } from './lib/eval-week-summary';
import { HaftalikOzetPanel } from './components/HaftalikOzetPanel';
import { SinifAraclariPanel } from './components/SinifAraclariPanel';
import { EvalBlobMascot, EvalEmptyIllustration, EvalSparkleCluster } from './components/eval-decor';
import { BehaviorPresetsGrid } from './components/behavior-presets-grid';
import { DegerlendirmeHero } from './components/DegerlendirmeHero';
import { PrintReportModal } from './components/print-report-modal';
import { GridStudentScoreSheet } from './components/GridStudentScoreSheet';
import { StudentEvalQuickCards, evalQuickKindTags, type EvalQuickKind } from './components/student-eval-quick-cards';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Criterion = {
  id: string;
  name: string;
  maxScore: number;
  scoreType?: 'numeric' | 'sign';
  description?: string | null;
  subjectId?: string | null;
  criterionCategory?: 'lesson' | 'behavior';
};
type SubjectOption = { id: string; label: string };
type StudentList = { id: string; name: string; studentIds: string[] };
type Student = { id: string; name: string };
type Score = {
  id: string;
  criterionId: string;
  studentId: string;
  score: number;
  noteDate: string;
  note?: string | null;
  createdAt?: string;
  criterion?: Criterion;
};
type StudentNote = { id: string; studentId: string; noteType: string; noteDate: string; description?: string | null; createdAt?: string; tags?: string[] | null };

type EvalTab = 'tablo' | 'kriterler' | 'listeler' | 'ozet' | 'araclar';
type TableViewMode = 'table' | 'grid';

const EVAL_PANEL = {
  table: {
    card: 'border-indigo-200/45 dark:border-indigo-900/40',
    head: 'border-b border-indigo-200/40 bg-indigo-500/6 px-3 py-3 dark:border-indigo-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-indigo-500/15',
    iconClass: 'text-indigo-800 dark:text-indigo-300',
  },
  criteria: {
    card: 'border-violet-200/45 dark:border-violet-900/40',
    head: 'border-b border-violet-200/40 bg-violet-500/6 px-3 py-3 dark:border-violet-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-violet-500/15',
    iconClass: 'text-violet-800 dark:text-violet-300',
  },
  lists: {
    card: 'border-amber-200/45 dark:border-amber-900/40',
    head: 'border-b border-amber-200/40 bg-amber-500/6 px-3 py-3 dark:border-amber-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-amber-500/15',
    iconClass: 'text-amber-800 dark:text-amber-300',
  },
  ozet: {
    card: 'border-teal-200/45 dark:border-teal-900/40',
    head: 'border-b border-teal-200/40 bg-teal-500/6 px-3 py-3 dark:border-teal-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-teal-500/15',
    iconClass: 'text-teal-800 dark:text-teal-300',
  },
  araclar: {
    card: 'border-sky-200/45 dark:border-sky-900/40',
    head: 'border-b border-sky-200/40 bg-sky-500/6 px-3 py-3 dark:border-sky-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-sky-500/15',
    iconClass: 'text-sky-800 dark:text-sky-300',
  },
} as const;

/** Izgara öğrenci kartları: dönüşümlü renkli çerçeve */
const STUDENT_GRID_NAME_CARD_BORDER = [
  'border-2 border-indigo-400/85 dark:border-indigo-500/55',
  'border-2 border-violet-400/85 dark:border-violet-500/55',
  'border-2 border-sky-400/85 dark:border-sky-500/55',
  'border-2 border-amber-400/85 dark:border-amber-500/50',
  'border-2 border-emerald-400/85 dark:border-emerald-500/50',
  'border-2 border-fuchsia-400/85 dark:border-fuchsia-500/50',
] as const;

const EVAL_QUICK_TOAST: Record<EvalQuickKind, string> = {
  lesson_pos: 'Ders · olumlu',
  lesson_neg: 'Ders · olumsuz',
  behavior_pos: 'Davranış · olumlu',
  behavior_neg: 'Davranış · olumsuz',
};

export default function DegerlendirmePage() {
  const { me, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [lists, setLists] = useState<StudentList[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [notesDetailStudent, setNotesDetailStudent] = useState<Student | null>(null);
  const [studentDetailStudent, setStudentDetailStudent] = useState<Student | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [criterionModalOpen, setCriterionModalOpen] = useState(false);
  const [criterionEditing, setCriterionEditing] = useState<Criterion | null>(null);
  const [criterionModalCategory, setCriterionModalCategory] = useState<'lesson' | 'behavior'>('lesson');

  const openCriterionModal = (edit: Criterion | null = null, defaultCategory: 'lesson' | 'behavior' = 'lesson') => {
    setCriterionEditing(edit);
    setCriterionModalCategory(edit ? (edit.criterionCategory ?? 'lesson') : defaultCategory);
    setCriterionModalOpen(true);
  };
  const [listModalOpen, setListModalOpen] = useState(false);
  const [scoreModal, setScoreModal] = useState<{ student: Student; criterion: Criterion } | null>(null);
  const [gridScoreSheetStudent, setGridScoreSheetStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [criterionColumnFilter, setCriterionColumnFilter] = useState('');
  const [evalTab, setEvalTab] = useState<EvalTab>('tablo');
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  /** Tablo sütunları: null = tüm kriterler; uuid = genel + o derse özel */
  const [tableSubjectFilterId, setTableSubjectFilterId] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [tableViewMode, setTableViewMode] = useState<TableViewMode>('grid');
  const [scoreSavingKeys, setScoreSavingKeys] = useState<Record<string, boolean>>({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [mobileEvalToolbarOpen, setMobileEvalToolbarOpen] = useState(false);
  const [mobileTableFiltersOpen, setMobileTableFiltersOpen] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const listId = selectedListId ?? undefined;
    try {
      const res = await apiFetch<{ criteria: Criterion[]; lists: StudentList[]; students: Student[]; scores: Score[]; studentNotes?: StudentNote[] }>(
        `/teacher-agenda/evaluation${listId ? `?listId=${listId}` : ''}`,
        { token },
      );
      setCriteria(res.criteria ?? []);
      setLists(res.lists ?? []);
      setStudents(res.students ?? []);
      setScores(res.scores ?? []);
      setStudentNotes(res.studentNotes ?? []);
    } catch {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, selectedListId]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Array<{ id: string; label?: string; name?: string }>>('/classes-subjects/subjects', { token })
      .then((rows) =>
        setSubjects(
          (rows ?? []).map((s) => ({
            id: s.id,
            label: String(s.name ?? s.label ?? s.id).trim() || s.id,
          })),
        ),
      )
      .catch(() => setSubjects([]));
  }, [token]);

  const displayCriteria = criteria;

  const tableCriteria = useMemo(() => {
    if (tableSubjectFilterId === null) return displayCriteria;
    return displayCriteria.filter((c) => !c.subjectId || c.subjectId === tableSubjectFilterId);
  }, [displayCriteria, tableSubjectFilterId]);

  const tableLessonCriteria = useMemo(
    () => tableCriteria.filter((c) => (c.criterionCategory ?? 'lesson') === 'lesson'),
    [tableCriteria],
  );
  const tableBehaviorCriteria = useMemo(
    () => tableCriteria.filter((c) => c.criterionCategory === 'behavior'),
    [tableCriteria],
  );
  const tableCriteriaFlat = useMemo(
    () => [...tableLessonCriteria, ...tableBehaviorCriteria],
    [tableLessonCriteria, tableBehaviorCriteria],
  );

  const tableLessonCriteriaVisible = useMemo(() => {
    const n = criterionColumnFilter.trim().toLocaleLowerCase('tr');
    if (!n) return tableLessonCriteria;
    return tableLessonCriteria.filter((c) => c.name.toLocaleLowerCase('tr').includes(n));
  }, [tableLessonCriteria, criterionColumnFilter]);

  const tableBehaviorCriteriaVisible = useMemo(() => {
    const n = criterionColumnFilter.trim().toLocaleLowerCase('tr');
    if (!n) return tableBehaviorCriteria;
    return tableBehaviorCriteria.filter((c) => c.name.toLocaleLowerCase('tr').includes(n));
  }, [tableBehaviorCriteria, criterionColumnFilter]);

  const tableCriteriaFlatVisible = useMemo(
    () => [...tableLessonCriteriaVisible, ...tableBehaviorCriteriaVisible],
    [tableLessonCriteriaVisible, tableBehaviorCriteriaVisible],
  );

  const behaviorCriteriaNames = useMemo(
    () => new Set(displayCriteria.filter((c) => c.criterionCategory === 'behavior').map((c) => c.name)),
    [displayCriteria],
  );

  const subjectLabel = useCallback(
    (subjectId: string | null | undefined) => {
      if (!subjectId) return 'Tüm dersler';
      return subjects.find((s) => s.id === subjectId)?.label ?? subjectId;
    },
    [subjects],
  );

  const lessonCriteriaGrouped = useMemo(() => {
    const lesson = displayCriteria.filter((c) => (c.criterionCategory ?? 'lesson') === 'lesson');
    const genel: Criterion[] = [];
    const bySub = new Map<string, Criterion[]>();
    for (const c of lesson) {
      if (!c.subjectId) genel.push(c);
      else {
        const arr = bySub.get(c.subjectId) ?? [];
        arr.push(c);
        bySub.set(c.subjectId, arr);
      }
    }
    const orderedSubs = [...bySub.entries()].sort((a, b) => subjectLabel(a[0]).localeCompare(subjectLabel(b[0]), 'tr'));
    return { genel, bySubject: orderedSubs };
  }, [displayCriteria, subjectLabel]);

  const behaviorCriteriaAll = useMemo(
    () => displayCriteria.filter((c) => c.criterionCategory === 'behavior'),
    [displayCriteria],
  );
  const displayLists = lists;
  const displayStudentsResolved = students;
  const displayScores = scores;
  const displayStudentNotes = studentNotes;
  const getNotesForStudent = (studentId: string) => displayStudentNotes.filter((n) => n.studentId === studentId);
  const filteredStudents = studentSearch.trim()
    ? displayStudentsResolved.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
    : displayStudentsResolved;

  const listLabelShort =
    selectedListId === null ? 'Tüm öğrenciler' : displayLists.find((l) => l.id === selectedListId)?.name ?? 'Liste';

  const weekBounds = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const weekRows = useMemo(
    () =>
      buildWeekSummary(
        displayStudentsResolved,
        displayScores,
        displayStudentNotes,
        displayCriteria,
        weekBounds.weekStart,
        weekBounds.weekEnd,
      ),
    [
      displayStudentsResolved,
      displayScores,
      displayStudentNotes,
      displayCriteria,
      weekBounds.weekStart,
      weekBounds.weekEnd,
    ],
  );
  const weekActivityCount = useMemo(
    () => weekRows.filter((r) => r.scoreCount > 0 || r.pos > 0 || r.neg > 0).length,
    [weekRows],
  );

  const criteriaById = useMemo(() => new Map(displayCriteria.map((c) => [c.id, c])), [displayCriteria]);
  const todayScoreSumByStudent = useMemo(() => {
    const m = new Map<string, number>();
    for (const sc of displayScores) {
      if (sc.noteDate !== today) continue;
      const crit = sc.criterion ?? criteriaById.get(sc.criterionId);
      const add = (crit?.scoreType ?? 'numeric') === 'sign' ? sc.score : sc.score;
      m.set(sc.studentId, (m.get(sc.studentId) ?? 0) + add);
    }
    return m;
  }, [displayScores, today, criteriaById]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getScore = (studentId: string, criterionId: string) =>
    displayScores.find((s) => s.studentId === studentId && s.criterionId === criterionId);

  const persistScore = async (studentId: string, criterionId: string, score: number, quiet?: boolean) => {
    if (!token) return;
    const sk = `${studentId}:${criterionId}`;
    setScoreSavingKeys((prev) => ({ ...prev, [sk]: true }));
    try {
      await apiFetch('/teacher-agenda/evaluation/scores', {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId, criterionId, score, noteDate: today }),
      });
      if (!quiet) toast.success('Puan eklendi');
      await fetchData();
    } catch {
      toast.error('Eklenemedi');
    } finally {
      setScoreSavingKeys((prev) => {
        const next = { ...prev };
        delete next[sk];
        return next;
      });
    }
  };

  const handleAddScoreFromModal = async (studentId: string, criterionId: string, score: number) => {
    await persistScore(studentId, criterionId, score, false);
    setScoreModal(null);
  };

  const handleQuickGridScore = (studentId: string, criterionId: string, score: number) => {
    void persistScore(studentId, criterionId, score, true);
  };

  const handleQuickNote = async (
    studentId: string,
    studentName: string,
    noteType: 'positive' | 'negative',
    e?: React.MouseEvent,
    evalQuickKind?: EvalQuickKind,
  ) => {
    e?.stopPropagation();
    if (!token) return;
    try {
      const tags = evalQuickKind ? evalQuickKindTags(evalQuickKind) : undefined;
      const created = await apiFetch<StudentNote>('/teacher-agenda/student-notes', {
        method: 'POST',
        token,
        body: JSON.stringify({
          studentId,
          noteType,
          noteDate: today,
          ...(tags?.length ? { tags } : {}),
        }),
      });
      const toastLabel = evalQuickKind ? EVAL_QUICK_TOAST[evalQuickKind] : noteType === 'positive' ? 'Olumlu' : 'Olumsuz';
      toast.success(`${studentName}: ${toastLabel} not eklendi`);
      setStudentNotes((prev) => [
        {
          ...created,
          studentId: created.studentId ?? studentId,
          noteType: created.noteType ?? noteType,
          noteDate: created.noteDate ?? today,
          tags: created.tags ?? tags ?? null,
        },
        ...prev,
      ]);
      fetchData();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message) : '';
      toast.error(msg || 'Eklenemedi');
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/teacher-agenda/evaluation/criteria/${criterionId}`, { method: 'DELETE', token });
      toast.success('Kriter silindi');
      setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
    } catch {
      toast.error('Silinemedi');
    }
  };

  const handleCriterionSubjectChange = async (criterionId: string, subjectId: string | null) => {
    if (!token) return;
    try {
      await apiFetch(`/teacher-agenda/evaluation/criteria/${criterionId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ subjectId }),
      });
      setCriteria((prev) => prev.map((c) => (c.id === criterionId ? { ...c, subjectId } : c)));
      toast.success('Ders güncellendi');
    } catch {
      toast.error('Güncellenemedi');
    }
  };

  if (!me || me.role !== 'teacher') {
    return <ForbiddenView />;
  }

  type TabDef = {
    id: EvalTab;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    count: number;
    base: string;
    active: string;
  };
  const evalTabs: TabDef[] = [
    {
      id: 'tablo',
      label: 'Değerlendirme tablosu',
      shortLabel: 'Tablo',
      icon: Table,
      count: displayStudentsResolved.length,
      base: 'border-indigo-500/35 bg-indigo-500/12 text-indigo-900 dark:text-indigo-100',
      active: 'ring-2 ring-indigo-500/35 shadow-sm',
    },
    {
      id: 'kriterler',
      label: 'Kriterler',
      shortLabel: 'Kriter',
      icon: Target,
      count: displayCriteria.length,
      base: 'border-violet-500/35 bg-violet-500/12 text-violet-900 dark:text-violet-100',
      active: 'ring-2 ring-violet-500/35 shadow-sm',
    },
    {
      id: 'listeler',
      label: 'Öğrenci listeleri',
      shortLabel: 'Liste',
      icon: List,
      count: displayLists.length,
      base: 'border-amber-500/35 bg-amber-500/12 text-amber-900 dark:text-amber-100',
      active: 'ring-2 ring-amber-500/35 shadow-sm',
    },
    {
      id: 'ozet',
      label: 'Haftalık özet',
      shortLabel: 'Özet',
      icon: BarChart3,
      count: weekActivityCount,
      base: 'border-teal-500/35 bg-teal-500/12 text-teal-900 dark:text-teal-100',
      active: 'ring-2 ring-teal-500/35 shadow-sm',
    },
    {
      id: 'araclar',
      label: 'Sınıf araçları',
      shortLabel: 'Araç',
      icon: Wrench,
      count: displayStudentsResolved.length,
      base: 'border-sky-500/35 bg-sky-500/12 text-sky-900 dark:text-sky-100',
      active: 'ring-2 ring-sky-500/35 shadow-sm',
    },
  ];

  return (
    <div className="min-w-0 space-y-3 sm:space-y-5 pb-24 sm:pb-0">
      <DegerlendirmeHero
        criteriaCount={displayCriteria.length}
        studentCount={displayStudentsResolved.length}
        weekActivityCount={weekActivityCount}
        listLabel={listLabelShort}
        activeTab={evalTab}
        onSelectTab={setEvalTab}
      />

      <div className="mobile-tab-scroll akilli-tahta-tabnav -mx-1 hidden snap-x snap-mandatory px-1 pb-0.5 sm:mx-0 sm:block sm:px-0">
        <div
          role="tablist"
          aria-label="Değerlendirme bölümleri"
          className="flex w-max gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1 shadow-sm sm:w-full sm:flex-wrap sm:justify-start sm:gap-1.5 sm:overflow-visible sm:p-1.5"
        >
          {evalTabs.map((tab) => {
            const Icon = tab.icon;
            const active = evalTab === tab.id;
            const c = tab.count > 99 ? '99+' : String(tab.count);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.label}
                onClick={() => setEvalTab(tab.id)}
                className={cn(
                  'flex snap-start shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all sm:min-h-[44px] sm:px-3 sm:py-2.5 sm:text-sm',
                  active ? cn('border', tab.base, tab.active) : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-background/90 hover:text-foreground',
                )}
              >
                <Icon className={cn('size-4 shrink-0', active && 'sm:size-5')} />
                <span className="max-sm:hidden">
                  {tab.label}
                  <span className="ml-1 tabular-nums opacity-80">({c})</span>
                </span>
                <span className="sm:hidden">
                  {tab.shortLabel}
                  <span className="ml-0.5 tabular-nums text-[10px] opacity-80">{c}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setMobileEvalToolbarOpen((o) => !o)}
          aria-expanded={mobileEvalToolbarOpen}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold shadow-sm sm:hidden"
        >
          <span>Hızlı işlemler</span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', mobileEvalToolbarOpen && 'rotate-180')} aria-hidden />
        </button>
        <div
          className={cn(
            'grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:overflow-visible',
            !mobileEvalToolbarOpen && 'max-sm:hidden',
          )}
        >
          <Button variant="outline" size="sm" onClick={() => openCriterionModal(null, 'lesson')} className="h-11 shrink-0 rounded-xl px-2 sm:h-9 sm:px-3">
            <GraduationCap className="size-4 shrink-0 sm:mr-1" />
            <span className="max-sm:sr-only sm:inline">Ders kriteri</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCriterionModal(null, 'behavior')} className="h-11 shrink-0 rounded-xl px-2 sm:h-9 sm:px-3">
            <Sparkles className="size-4 shrink-0 sm:mr-1" />
            <span className="max-sm:sr-only sm:inline">Davranış</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setListModalOpen(true)} className="h-11 shrink-0 rounded-xl px-2 sm:h-9 sm:px-3">
            <List className="size-4 shrink-0 sm:mr-1" />
            <span className="max-sm:sr-only sm:inline">Liste Ekle</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrintModalOpen(true)} className="h-11 shrink-0 rounded-xl px-2 sm:h-9 sm:px-3">
            <Printer className="size-4 shrink-0 sm:mr-1" />
            <span className="max-sm:sr-only sm:inline">Yazdır</span>
          </Button>
        </div>
      </div>

      {evalTab === 'kriterler' && (
        <Card className={cn('overflow-hidden rounded-3xl border-2 shadow-md bg-card', EVAL_PANEL.criteria.card)}>
          <CardHeader className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', EVAL_PANEL.criteria.head)}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('flex size-8 items-center justify-center rounded-lg', EVAL_PANEL.criteria.iconWrap)}>
                <Target className={cn('size-4 shrink-0', EVAL_PANEL.criteria.iconClass)} />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">Kriterler</CardTitle>
                <p className="text-xs text-muted-foreground">Ders kriterleri ve davranışlar ayrı yönetilir; tabloda ders filtresi her iki gruptan uygun sütunları gösterir.</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openCriterionModal(null, 'lesson')}>
                <GraduationCap className="size-4 mr-1" />
                Ders kriteri
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openCriterionModal(null, 'behavior')}>
                <Sparkles className="size-4 mr-1" />
                Davranış
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 p-3 sm:p-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-indigo-200/50 pb-2 dark:border-indigo-900/40">
                <GraduationCap className="size-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Sınıf içi ders kriterleri</h3>
              </div>
              <p className="text-xs text-muted-foreground">Dersle ilişkilendirilebilir; tabloda ders filtresine göre görünür.</p>
              {lessonCriteriaGrouped.genel.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Genel (tüm dersler)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {lessonCriteriaGrouped.genel.map((c, i) => (
                      <span
                        key={c.id}
                        className={cn(
                          'inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium',
                          i % 3 === 0 && 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
                          i % 3 === 1 && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                          i % 3 === 2 && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        <span className="min-w-0 truncate">{c.name}</span>
                        <span className="text-xs opacity-80">
                          {(c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`}
                        </span>
                        <select
                          value={c.subjectId ?? ''}
                          onChange={(e) => handleCriterionSubjectChange(c.id, e.target.value || null)}
                          onClick={(e) => e.stopPropagation()}
                          className="max-w-36 rounded-lg border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium"
                          title="Ders"
                          aria-label="Kriter dersi"
                        >
                          <option value="">Genel</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCriterionModal(c);
                          }}
                          className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                          title="Düzenle"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCriterion(c.id);
                          }}
                          className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                          title="Kriteri sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {lessonCriteriaGrouped.bySubject.map(([subId, list]) => (
                <div key={subId} className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <BookOpen className="size-3.5 shrink-0 opacity-70" />
                    {subjectLabel(subId)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {list.map((c, i) => (
                      <span
                        key={c.id}
                        className={cn(
                          'inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium',
                          i % 3 === 0 && 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
                          i % 3 === 1 && 'bg-fuchsia-500/12 text-fuchsia-800 dark:text-fuchsia-300',
                          i % 3 === 2 && 'bg-teal-500/12 text-teal-800 dark:text-teal-300',
                        )}
                      >
                        <span className="min-w-0 truncate">{c.name}</span>
                        <span className="text-xs opacity-80">
                          {(c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`}
                        </span>
                        <select
                          value={c.subjectId ?? ''}
                          onChange={(e) => handleCriterionSubjectChange(c.id, e.target.value || null)}
                          onClick={(e) => e.stopPropagation()}
                          className="max-w-36 rounded-lg border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium"
                          title="Ders"
                          aria-label="Kriter dersi"
                        >
                          <option value="">Genel</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCriterionModal(c);
                          }}
                          className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                          title="Düzenle"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCriterion(c.id);
                          }}
                          className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                          title="Kriteri sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {lessonCriteriaGrouped.genel.length === 0 && lessonCriteriaGrouped.bySubject.length === 0 && (
                <p className="text-sm text-muted-foreground">Henüz ders kriteri yok. Yukarıdan ekleyin veya tabloda kullanın.</p>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-emerald-200/50 pb-2 dark:border-emerald-900/40">
                <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Davranışlar</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Şablona dokunup not verin; isteğe bağlı olarak alttan kalıcı kriter ekleyin. Kriterlerde genelde +/− uygundur.
              </p>
              <BehaviorPresetsGrid
                token={token}
                students={displayStudentsResolved}
                noteDate={today}
                existingNames={behaviorCriteriaNames}
                onAdded={() => void fetchData()}
                onQuickApplied={() => void fetchData()}
              />
              {behaviorCriteriaAll.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tanımlı davranışlar</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {behaviorCriteriaAll.map((c, i) => (
                      <span
                        key={c.id}
                        className={cn(
                          'inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-emerald-200/60 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100',
                        )}
                      >
                        <span className="min-w-0 truncate">{c.name}</span>
                        <span className="text-xs opacity-80">
                          {(c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCriterionModal(c);
                          }}
                          className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                          title="Düzenle"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCriterion(c.id);
                          }}
                          className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                          title="Kriteri sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      )}

      {evalTab === 'ozet' && (
        <HaftalikOzetPanel
          weekLabel={weekBounds.label}
          weekOffset={weekOffset}
          onWeekOffset={(d) => setWeekOffset((w) => w + d)}
          rows={weekRows}
          panelClass={EVAL_PANEL.ozet.card}
          headClass={EVAL_PANEL.ozet.head}
          iconWrapClass={EVAL_PANEL.ozet.iconWrap}
          iconClass={EVAL_PANEL.ozet.iconClass}
        />
      )}

      {evalTab === 'araclar' && (
        <SinifAraclariPanel
          students={displayStudentsResolved}
          panelClass={EVAL_PANEL.araclar.card}
          headClass={EVAL_PANEL.araclar.head}
          iconWrapClass={EVAL_PANEL.araclar.iconWrap}
          iconClass={EVAL_PANEL.araclar.iconClass}
        />
      )}

      {evalTab === 'listeler' && (
        <Card className={cn('overflow-hidden rounded-3xl border-2 shadow-md bg-card', EVAL_PANEL.lists.card)}>
          <CardHeader className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', EVAL_PANEL.lists.head)}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('flex size-8 items-center justify-center rounded-lg', EVAL_PANEL.lists.iconWrap)}>
                <List className={cn('size-4 shrink-0', EVAL_PANEL.lists.iconClass)} />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">Hangi öğrenciler?</CardTitle>
                <p className="text-xs text-muted-foreground">Liste seçimi tabloyu ve veri yüklemesini günceller.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => setListModalOpen(true)}>
              <Plus className="size-4 mr-1" />
              Liste Ekle
            </Button>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="mobile-tab-scroll flex gap-2 pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedListId(null)}
                className={cn(
                  'shrink-0 snap-start rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  !selectedListId ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/80 hover:bg-muted',
                )}
              >
                Tüm Öğrenciler
              </button>
              {displayLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedListId(l.id)}
                  className={cn(
                    'shrink-0 snap-start rounded-xl px-4 py-2 text-sm font-medium transition-all',
                    selectedListId === l.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/80 hover:bg-muted',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {evalTab === 'tablo' && loading ? (
        <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-indigo-200/60 bg-linear-to-br from-indigo-500/8 via-violet-500/5 to-amber-500/10 p-12 text-center dark:border-indigo-800/40 sm:p-16">
          <EvalSparkleCluster className="pointer-events-none absolute right-6 top-6 size-12 opacity-60" />
          <div className="relative z-[1] mx-auto mb-3 flex size-16 items-center justify-center rounded-3xl bg-white/80 shadow-lg ring-2 ring-indigo-200/50 dark:bg-indigo-950/60 dark:ring-indigo-700/40">
            <EvalBlobMascot size={52} className="animate-pulse" />
          </div>
          <Table className="mx-auto mb-2 size-6 animate-pulse text-indigo-500 opacity-40" aria-hidden />
          <p className="relative z-[1] font-bold text-indigo-900 dark:text-indigo-100">Yükleniyor…</p>
        </div>
      ) : evalTab === 'tablo' ? (
        <Card className={cn('overflow-hidden rounded-3xl border-2 shadow-md', EVAL_PANEL.table.card)}>
          <CardHeader
            className={cn(
              'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
              EVAL_PANEL.table.head,
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('relative flex size-10 items-center justify-center rounded-2xl shadow-inner ring-2 ring-white/40 dark:ring-white/10', EVAL_PANEL.table.iconWrap)}>
                <Table className={cn('size-5 shrink-0', EVAL_PANEL.table.iconClass)} />
                <EvalSparkleCluster className="pointer-events-none absolute -right-1 -top-1 size-6" />
              </span>
              <CardTitle className="text-base font-extrabold tracking-tight">Değerlendirme tablosu</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setMobileTableFiltersOpen((o) => !o)}
              aria-expanded={mobileTableFiltersOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-left text-sm font-medium shadow-sm sm:hidden"
            >
              <span className="text-muted-foreground">Filtreler ve görünüm</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                {tableViewMode === 'grid' ? 'Izgara' : 'Tablo'} · {filteredStudents.length}/{displayStudentsResolved.length}
                <ChevronDown className={cn('size-4 transition-transform', mobileTableFiltersOpen && 'rotate-180')} aria-hidden />
              </span>
            </button>
            <div
              className={cn(
                'flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center',
                !mobileTableFiltersOpen && 'max-sm:hidden',
              )}
            >
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <select
                  value={tableSubjectFilterId ?? ''}
                  onChange={(e) => setTableSubjectFilterId(e.target.value || null)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm sm:h-auto sm:max-w-56 sm:flex-none sm:py-2"
                  aria-label="Tabloda gösterilecek ders kriterleri"
                >
                  <option value="">Tüm dersler (tüm sütunlar)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — genel + bu ders
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative min-w-0 w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Öğrenci ara..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="h-11 w-full pl-9 pr-3 text-sm sm:h-auto sm:py-2 rounded-xl border border-input bg-background"
                />
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                {filteredStudents.length} / {displayStudentsResolved.length} öğrenci · {tableCriteriaFlatVisible.length} kriter
              </span>
              {filteredStudents.length > 0 && (
                <div
                  className="flex w-full rounded-xl border border-border/80 bg-muted/25 p-0.5 sm:w-auto"
                  role="group"
                  aria-label="Tablo veya ızgara görünümü"
                >
                  <button
                    type="button"
                    onClick={() => setTableViewMode('table')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-3',
                      tableViewMode === 'table'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Table className="size-3.5 shrink-0" />
                    Tablo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableViewMode('grid')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-3',
                      tableViewMode === 'grid'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <LayoutGrid className="size-3.5 shrink-0" />
                    Izgara
                  </button>
                </div>
              )}
              {tableCriteriaFlat.length > 0 && (
                <div className="flex w-full min-w-0 items-center gap-2 border-t border-border/60 pt-2 sm:border-t-0 sm:pt-0">
                  <ListFilter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <input
                    type="text"
                    value={criterionColumnFilter}
                    onChange={(e) => setCriterionColumnFilter(e.target.value)}
                    placeholder="Kriter sütunlarını süz…"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-xs sm:max-w-xs"
                    aria-label="Kriter süzgeci"
                  />
                  {criterionColumnFilter.trim() ? (
                    <button
                      type="button"
                      onClick={() => setCriterionColumnFilter('')}
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Temizle
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:table-x-scroll">
            {displayStudentsResolved.length === 0 ? (
              <div className="py-16 text-center sm:py-20">
                <EvalEmptyIllustration className="mx-auto mb-4 w-40" />
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-3xl bg-indigo-500/10 ring-2 ring-indigo-200/40 dark:ring-indigo-800/40">
                  <Users className="size-7 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="font-bold text-foreground mb-1">Öğrenci yok</p>
                <p className="text-sm text-muted-foreground mb-4">Liste seçin veya yeni liste oluşturun.</p>
                <Button size="sm" onClick={() => setListModalOpen(true)} className="rounded-xl">
                  <List className="size-4 mr-1" />
                  Liste Ekle
                </Button>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>
                {studentSearch} ile eşleşen öğrenci bulunamadı.
              </p>
              </div>
            ) : (
              <>
              {tableViewMode === 'grid' ? (
                <div className="rounded-3xl border border-zinc-200/70 bg-zinc-100/40 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-950/35 sm:p-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
                  {filteredStudents.map((s, cardIdx) => {
                    const { given, familyUpper } = splitStudentNameForCard(s.name);
                    const daySum = todayScoreSumByStudent.get(s.id) ?? 0;
                    const badgeLabel = daySum > 99 ? '99' : daySum < -99 ? '-99' : String(daySum);
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-white p-2.5 pt-3 pr-10 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900 sm:p-3 sm:pt-3.5 sm:pr-12',
                          STUDENT_GRID_NAME_CARD_BORDER[cardIdx % STUDENT_GRID_NAME_CARD_BORDER.length],
                        )}
                      >
                        <span
                          className={cn(
                            'absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full text-xs font-bold tabular-nums shadow-md ring-2 ring-white dark:ring-zinc-900 sm:right-2 sm:top-2 sm:size-9 sm:text-sm',
                            daySum > 0 && 'bg-emerald-500 text-white',
                            daySum < 0 && 'bg-rose-500 text-white',
                            daySum === 0 && 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
                          )}
                          title="Bugün girilen kriter puanlarının toplamı. Ortadaki dört kutu (hızlı not) bununla toplanmaz."
                        >
                          {badgeLabel}
                        </span>
                        <div className="relative flex flex-col gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <div
                            className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-2 ring-white/90 dark:bg-zinc-800 dark:ring-zinc-700/80 sm:size-14 sm:rounded-2xl"
                            aria-hidden
                          >
                            <StudentMascotIcon studentId={s.id} className="size-12 sm:size-14" />
                          </div>
                          <div className="flex min-w-0 flex-1 items-start gap-0.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setGridScoreSheetStudent(s)}
                              className="min-w-0 flex-1 text-left hover:opacity-90"
                            >
                              <span className="block truncate text-[13px] font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[15px]">
                                {given}
                              </span>
                              {familyUpper ? (
                                <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 sm:text-[11px]">
                                  {familyUpper}
                                </span>
                              ) : null}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentDetailStudent(s)}
                              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Özet ve geçmiş"
                            >
                              <Info className="size-4" />
                            </button>
                          </div>
                        </div>
                        <StudentEvalQuickCards
                          studentId={s.id}
                          studentName={s.name}
                          today={today}
                          notes={displayStudentNotes}
                          onAdd={(kind, e) => {
                            const noteType = kind.endsWith('_pos') ? 'positive' : 'negative';
                            void handleQuickNote(s.id, s.name, noteType, e, kind);
                          }}
                          onOpenNotes={() => setNotesDetailStudent(s)}
                        />
                        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800/80">
                          <span className="text-[10px] text-muted-foreground">
                            {tableCriteriaFlatVisible.length === 0 ? 'Kriter yok' : `${tableCriteriaFlatVisible.length} kriter`}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs"
                            disabled={tableCriteriaFlatVisible.length === 0}
                            onClick={() => setGridScoreSheetStudent(s)}
                          >
                            Puanlar
                          </Button>
                        </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              ) : (
              <>
              <div className="flex flex-col gap-2.5 px-2 pb-3 sm:hidden">
                {filteredStudents.map((s, idx) => (
                  <div
                    key={s.id}
                    className={cn(
                      'overflow-hidden rounded-2xl p-2.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10',
                      STUDENT_GRID_NAME_CARD_BORDER[idx % STUDENT_GRID_NAME_CARD_BORDER.length],
                      idx % 6 === 0 &&
                        'bg-linear-to-br from-indigo-50/95 via-violet-50/40 to-white dark:from-indigo-950/50 dark:via-violet-950/25 dark:to-background',
                      idx % 6 === 1 &&
                        'bg-linear-to-br from-violet-50/95 via-fuchsia-50/35 to-white dark:from-violet-950/50 dark:via-fuchsia-950/20 dark:to-background',
                      idx % 6 === 2 &&
                        'bg-linear-to-br from-sky-50/95 via-cyan-50/35 to-white dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-background',
                      idx % 6 === 3 &&
                        'bg-linear-to-br from-amber-50/95 via-orange-50/35 to-white dark:from-amber-950/40 dark:via-orange-950/20 dark:to-background',
                      idx % 6 === 4 &&
                        'bg-linear-to-br from-emerald-50/95 via-teal-50/35 to-white dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-background',
                      idx % 6 === 5 &&
                        'bg-linear-to-br from-fuchsia-50/95 via-pink-50/35 to-white dark:from-fuchsia-950/40 dark:via-pink-950/20 dark:to-background',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGridScoreSheetStudent(s)}
                        className={cn(
                          'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 px-2 py-2 text-left shadow-sm transition-colors active:opacity-90',
                          idx % 6 === 0 &&
                            'border-indigo-300/80 bg-white/75 text-indigo-950 dark:border-indigo-600/50 dark:bg-indigo-950/35 dark:text-indigo-100',
                          idx % 6 === 1 &&
                            'border-violet-300/80 bg-white/75 text-violet-950 dark:border-violet-600/50 dark:bg-violet-950/35 dark:text-violet-100',
                          idx % 6 === 2 &&
                            'border-sky-300/80 bg-white/75 text-sky-950 dark:border-sky-600/50 dark:bg-sky-950/35 dark:text-sky-100',
                          idx % 6 === 3 &&
                            'border-amber-300/80 bg-white/75 text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/35 dark:text-amber-100',
                          idx % 6 === 4 &&
                            'border-emerald-300/80 bg-white/75 text-emerald-950 dark:border-emerald-600/50 dark:bg-emerald-950/35 dark:text-emerald-100',
                          idx % 6 === 5 &&
                            'border-fuchsia-300/80 bg-white/75 text-fuchsia-950 dark:border-fuchsia-600/50 dark:bg-fuchsia-950/35 dark:text-fuchsia-100',
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                          <StudentMascotIcon studentId={s.id} className="size-8" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold leading-tight">{s.name}</span>
                        <ChevronRight
                          className={cn(
                            'size-4 shrink-0 opacity-50',
                            idx % 6 === 0 && 'text-indigo-600',
                            idx % 6 === 1 && 'text-violet-600',
                            idx % 6 === 2 && 'text-sky-600',
                            idx % 6 === 3 && 'text-amber-600',
                            idx % 6 === 4 && 'text-emerald-600',
                            idx % 6 === 5 && 'text-fuchsia-600',
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentDetailStudent(s)}
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background/90 text-muted-foreground shadow-sm active:scale-[0.98]"
                        title="Özet ve geçmiş"
                      >
                        <Info className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2">
                      <StudentEvalQuickCards
                        studentId={s.id}
                        studentName={s.name}
                        today={today}
                        notes={displayStudentNotes}
                        compact
                        onAdd={(kind, e) => {
                          const noteType = kind.endsWith('_pos') ? 'positive' : 'negative';
                          void handleQuickNote(s.id, s.name, noteType, e, kind);
                        }}
                        onOpenNotes={() => setNotesDetailStudent(s)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-2 h-9 w-full rounded-xl text-xs font-semibold"
                      disabled={tableCriteriaFlatVisible.length === 0}
                      onClick={() => setGridScoreSheetStudent(s)}
                    >
                      Puanlar ({tableCriteriaFlatVisible.length})
                    </Button>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block table-x-scroll">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th rowSpan={2} className="text-left px-4 py-3.5 font-semibold sticky left-0 bg-muted/50 z-10 align-middle rounded-tl-lg">
                      Öğrenci
                    </th>
                    <th rowSpan={2} className="text-center px-2 py-3.5 min-w-[168px] align-middle border-l border-border/60">
                      Ders / davranış notu
                    </th>
                    {tableLessonCriteriaVisible.length > 0 && (
                      <th
                        colSpan={tableLessonCriteriaVisible.length}
                        className="border-l border-indigo-200/60 bg-indigo-500/10 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-indigo-900 dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-100"
                      >
                        Ders kriterleri
                      </th>
                    )}
                    {tableBehaviorCriteriaVisible.length > 0 && (
                      <th
                        colSpan={tableBehaviorCriteriaVisible.length}
                        className="border-l border-emerald-200/60 bg-emerald-500/10 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/25 dark:text-emerald-100"
                      >
                        Davranışlar
                      </th>
                    )}
                    {tableLessonCriteriaVisible.length === 0 && tableBehaviorCriteriaVisible.length === 0 && (
                      <th className="border-l border-border/60 px-2 py-2 text-center text-xs text-muted-foreground">
                        {tableCriteriaFlat.length === 0 ? 'Kriter yok' : 'Filtreyle eşleşen yok'}
                      </th>
                    )}
                    <th rowSpan={2} className="text-center px-2 py-3.5 min-w-[72px] align-middle border-l border-border/60">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openCriterionModal(null, 'lesson')}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-dashed border-indigo-300/70 text-indigo-600 hover:bg-indigo-500/10 dark:border-indigo-700 dark:text-indigo-300"
                          title="Ders kriteri"
                        >
                          <GraduationCap className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openCriterionModal(null, 'behavior')}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-dashed border-emerald-300/70 text-emerald-600 hover:bg-emerald-500/10 dark:border-emerald-700 dark:text-emerald-300"
                          title="Davranış"
                        >
                          <Sparkles className="size-4" />
                        </button>
                      </div>
                    </th>
                  </tr>
                  <tr className="border-b-2 border-border bg-muted/40">
                    {tableLessonCriteriaVisible.map((c) => (
                      <th key={c.id} className="border-l border-indigo-100/80 px-2 py-2 text-center text-[11px] font-medium text-indigo-950 dark:border-indigo-900/30 dark:text-indigo-100 group/cell min-w-[64px]">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="line-clamp-2 leading-tight">{c.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCriterion(c.id);
                            }}
                            className="p-0.5 rounded opacity-0 group-hover/cell:opacity-100 hover:bg-destructive/20 text-destructive"
                            title="Kriteri sil"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    {tableBehaviorCriteriaVisible.map((c) => (
                      <th key={c.id} className="border-l border-emerald-100/80 px-2 py-2 text-center text-[11px] font-medium text-emerald-950 dark:border-emerald-900/30 dark:text-emerald-100 group/cell2 min-w-[64px]">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="line-clamp-2 leading-tight">{c.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCriterion(c.id);
                            }}
                            className="p-0.5 rounded opacity-0 group-hover/cell2:opacity-100 hover:bg-destructive/20 text-destructive"
                            title="Kriteri sil"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    {tableLessonCriteriaVisible.length === 0 && tableBehaviorCriteriaVisible.length === 0 && (
                      <th className="border-l border-border/50" aria-hidden />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => (
                    <tr key={s.id} className={cn(
                      'border-b border-border transition-colors group/row',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                      'hover:bg-muted/40',
                    )}>
                      <td
                        className={cn(
                          'px-3 py-2.5 font-medium sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:text-primary sm:px-4 sm:py-3.5',
                          idx % 2 === 0 ? 'bg-background group-hover/row:bg-muted/40' : 'bg-muted/20 group-hover/row:bg-muted/40',
                        )}
                        onClick={() => setGridScoreSheetStudent(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setGridScoreSheetStudent(s)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-inner ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10 sm:size-8 sm:rounded-lg"
                            aria-hidden
                          >
                            <StudentMascotIcon studentId={s.id} className="size-7 sm:size-8" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] hover:underline sm:text-sm">{s.name}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Özet ve geçmiş"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStudentDetailStudent(s);
                            }}
                          >
                            <Info className="size-3.5" />
                          </button>
                        </span>
                      </td>
                      <td className="px-1.5 py-2 align-top">
                        <StudentEvalQuickCards
                          studentId={s.id}
                          studentName={s.name}
                          today={today}
                          notes={displayStudentNotes}
                          compact
                          onAdd={(kind, e) => {
                            const noteType = kind.endsWith('_pos') ? 'positive' : 'negative';
                            void handleQuickNote(s.id, s.name, noteType, e, kind);
                          }}
                          onOpenNotes={() => setNotesDetailStudent(s)}
                        />
                      </td>
                      {tableCriteriaFlatVisible.length === 0 ? (
                        <td className="border-l border-border/60 px-2 py-3 text-center text-xs text-muted-foreground">—</td>
                      ) : (
                        tableCriteriaFlatVisible.map((c) => {
                          const sc = getScore(s.id, c.id);
                          const isBeh = c.criterionCategory === 'behavior';
                          return (
                            <td
                              key={c.id}
                              className={cn(
                                'px-2 py-3.5 text-center cursor-pointer group border-l',
                                isBeh ? 'border-emerald-100/70 dark:border-emerald-900/25' : 'border-indigo-100/60 dark:border-indigo-900/25',
                              )}
                              onClick={() => setScoreModal({ student: s, criterion: c })}
                              title={`${s.name} – ${c.name}: Puan ver`}
                            >
                              {sc ? (
                                <span
                                  className={cn(
                                    'inline-flex size-9 items-center justify-center rounded-xl font-semibold transition-colors',
                                    isBeh
                                      ? 'bg-emerald-500/15 text-emerald-800 group-hover:bg-emerald-500/25 dark:text-emerald-200'
                                      : 'bg-primary/15 text-primary group-hover:bg-primary/25',
                                  )}
                                >
                                  {(c.scoreType ?? 'numeric') === 'sign'
                                    ? (sc.score === 1 ? '+' : sc.score === -1 ? '−' : '·')
                                    : sc.score}
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    'inline-flex size-9 items-center justify-center rounded-xl border border-dashed text-xs transition-colors',
                                    isBeh
                                      ? 'border-emerald-300/50 text-emerald-700/80 group-hover:border-emerald-500/50 dark:border-emerald-800 dark:text-emerald-300'
                                      : 'border-muted-foreground/30 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary/70',
                                  )}
                                >
                                  +
                                </span>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="px-2 py-3.5" />
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </>
              )}
              </>
            )}
            <div className="border-t border-emerald-200/55 bg-linear-to-b from-emerald-500/[0.06] to-transparent px-3 py-4 dark:border-emerald-900/45 sm:px-6">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Davranış şablonları</h3>
                  <p className="text-xs text-muted-foreground">
                    Şablona dokunarak not verin veya alttan kriter ekleyin. Aynı alan <span className="font-medium text-foreground">Kriterler</span> sekmesinde de vardır.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-xl" onClick={() => setEvalTab('kriterler')}>
                  <Target className="size-4 mr-1" />
                  Kriterler sekmesi
                </Button>
              </div>
              <BehaviorPresetsGrid
                token={token}
                students={displayStudentsResolved}
                noteDate={today}
                existingNames={behaviorCriteriaNames}
                onAdded={() => void fetchData()}
                onQuickApplied={() => void fetchData()}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {printModalOpen && me && (
        <PrintReportModal
          open={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          token={token}
          initialListId={selectedListId}
          initialSubjectFilterId={tableSubjectFilterId}
          lists={displayLists}
          subjects={subjects}
          allCriteria={displayCriteria}
          me={me}
        />
      )}
      {criterionModalOpen && (
        <CriterionModal
          subjects={subjects}
          initialCategory={criterionModalCategory}
          editing={criterionEditing}
          onClose={() => {
            setCriterionModalOpen(false);
            setCriterionEditing(null);
          }}
          onSuccess={(saved, mode) => {
            setCriterionModalOpen(false);
            setCriterionEditing(null);
            if (!saved) {
              fetchData();
              return;
            }
            if (mode === 'update') {
              setCriteria((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
            } else {
              setCriteria((prev) => [...prev, saved]);
            }
          }}
          token={token}
        />
      )}
      {listModalOpen && (
        <ListModal
          token={token}
          onClose={() => setListModalOpen(false)}
          onSuccess={() => { setListModalOpen(false); fetchData(); }}
        />
      )}
      <GridStudentScoreSheet
        student={gridScoreSheetStudent}
        lessonCriteria={tableLessonCriteria}
        behaviorCriteria={tableBehaviorCriteria}
        today={today}
        evalNotes={displayStudentNotes}
        onClose={() => setGridScoreSheetStudent(null)}
        getScore={(sid, cid) => getScore(sid, cid)}
        isSaving={(sid, cid) => !!scoreSavingKeys[`${sid}:${cid}`]}
        onQuickScore={handleQuickGridScore}
        onOpenScoreModal={(st, c) => {
          setGridScoreSheetStudent(null);
          setScoreModal({ student: st, criterion: c });
        }}
        onOpenDetail={(st) => {
          setGridScoreSheetStudent(null);
          setStudentDetailStudent(st);
        }}
        onEvalQuickNote={(kind, e) => {
          const st = gridScoreSheetStudent;
          if (!st) return;
          const noteType = kind.endsWith('_pos') ? 'positive' : 'negative';
          void handleQuickNote(st.id, st.name, noteType, e, kind);
        }}
        onOpenNotesDetail={(st) => {
          setGridScoreSheetStudent(null);
          setNotesDetailStudent(st);
        }}
      />
      {studentDetailStudent && (
        <StudentDetailModal
          student={studentDetailStudent}
          notes={getNotesForStudent(studentDetailStudent.id)}
          scores={displayScores.filter((sc) => sc.studentId === studentDetailStudent.id)}
          today={today}
          onClose={() => setStudentDetailStudent(null)}
          onAddEvalQuick={(kind, e) => {
            const noteType = kind.endsWith('_pos') ? 'positive' : 'negative';
            void handleQuickNote(studentDetailStudent.id, studentDetailStudent.name, noteType, e, kind);
          }}
        />
      )}
      {notesDetailStudent && (
        <StudentNotesDetailModal
          student={notesDetailStudent}
          notes={getNotesForStudent(notesDetailStudent.id)}
          today={today}
          onClose={() => setNotesDetailStudent(null)}
          onAddEvalQuick={async (kind, e) => {
            const noteType = kind.endsWith('_pos') ? 'positive' : 'negative';
            await handleQuickNote(notesDetailStudent.id, notesDetailStudent.name, noteType, e, kind);
            fetchData();
          }}
        />
      )}
      {scoreModal && (
        <ScoreModal
          student={scoreModal.student}
          criterion={scoreModal.criterion}
          currentScore={getScore(scoreModal.student.id, scoreModal.criterion.id)?.score}
          onClose={() => setScoreModal(null)}
          onSubmit={(score) => handleAddScoreFromModal(scoreModal.student.id, scoreModal.criterion.id, score)}
        />
      )}
    </div>
  );
}

function StudentDetailModal({
  student,
  notes,
  scores,
  today,
  onClose,
  onAddEvalQuick,
}: {
  student: Student;
  notes: StudentNote[];
  scores: Score[];
  today: string;
  onClose: () => void;
  onAddEvalQuick: (kind: EvalQuickKind, e?: React.MouseEvent) => void;
}) {
  type TimelineItem = { type: 'note'; date: string; noteType: string; description?: string } | { type: 'score'; date: string; criterionName: string; score: number; scoreType?: 'numeric' | 'sign' };
  const items: TimelineItem[] = [
    ...notes.map((n) => ({ type: 'note' as const, date: n.noteDate, noteType: n.noteType, description: n.description ?? undefined })),
    ...scores.map((s) => ({ type: 'score' as const, date: s.noteDate, criterionName: s.criterion?.name ?? '-', score: s.score, scoreType: s.criterion?.scoreType })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  const pos = notes.filter((n) => n.noteType === 'positive').length;
  const neg = notes.filter((n) => n.noteType === 'negative').length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="bg-card max-h-[min(92vh,100dvh)] w-full max-w-lg flex flex-col rounded-t-[1.35rem] border border-border shadow-2xl sm:max-h-[90vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-2 border-b border-border/80 p-3 sm:gap-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10 sm:size-12"
              aria-hidden
            >
              <StudentMascotIcon studentId={student.id} className="size-11 sm:size-12" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight sm:text-lg">{student.name}</h3>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-sm">
                +{pos} / −{neg} not · {scores.length} kriter
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b border-border/60 bg-muted/5 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Bugün · hızlı</p>
            <p className="text-[10px] font-medium tabular-nums text-muted-foreground/90">
              {format(new Date(`${today}T12:00:00`), 'd MMM', { locale: tr })}
            </p>
          </div>
          <StudentEvalQuickCards
            variant="sheet"
            hideNotesLink
            studentId={student.id}
            studentName={student.name}
            today={today}
            notes={notes}
            onAdd={onAddEvalQuick}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Tüm veriler (tarihe göre)</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz veri yok.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-4 py-3 border',
                    it.type === 'note'
                      ? it.noteType === 'positive'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                      : 'bg-violet-500/5 border-violet-500/20',
                  )}
                >
                  {it.type === 'note' ? (
                    <>
                      <span className={cn('shrink-0 font-bold', it.noteType === 'positive' ? 'text-emerald-600' : 'text-red-600')}>
                        {it.noteType === 'positive' ? '+' : '−'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.date ? format(new Date(it.date), 'd MMM yyyy', { locale: tr }) : '-'}</p>
                        {it.description && <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="shrink-0 font-bold text-violet-600">
                        {it.scoreType === 'sign' ? (it.score === 1 ? '+' : it.score === -1 ? '−' : '·') : it.score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.criterionName}</p>
                        <p className="text-xs text-muted-foreground">{it.date ? format(new Date(it.date), 'd MMM yyyy', { locale: tr }) : '-'}</p>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentNotesDetailModal({
  student,
  notes,
  today,
  onClose,
  onAddEvalQuick,
}: {
  student: Student;
  notes: StudentNote[];
  today: string;
  onClose: () => void;
  onAddEvalQuick: (kind: EvalQuickKind, e?: React.MouseEvent) => void | Promise<void>;
}) {
  const pos = notes.filter((n) => n.noteType === 'positive');
  const neg = notes.filter((n) => n.noteType === 'negative');
  const sorted = [...notes].sort((a, b) => (b.noteDate ?? '').localeCompare(a.noteDate ?? ''));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="bg-card max-h-[min(88vh,100dvh)] w-full max-w-md flex flex-col rounded-t-[1.35rem] border border-border shadow-2xl sm:max-h-[85vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-2 border-b border-border/80 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10 sm:size-11"
              aria-hidden
            >
              <StudentMascotIcon studentId={student.id} className="size-10 sm:size-11" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight sm:text-lg">{student.name}</h3>
              <p className="text-[11px] text-muted-foreground sm:text-sm">
                +{pos.length} / −{neg.length} not
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b border-border/60 bg-muted/5 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Bugün · hızlı</p>
            <p className="text-[10px] font-medium tabular-nums text-muted-foreground/90">
              {format(new Date(`${today}T12:00:00`), 'd MMM', { locale: tr })}
            </p>
          </div>
          <StudentEvalQuickCards
            variant="sheet"
            hideNotesLink
            studentId={student.id}
            studentName={student.name}
            today={today}
            notes={notes}
            onAdd={(kind, e) => {
              void onAddEvalQuick(kind, e);
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz not yok.</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-4 py-3 border',
                    n.noteType === 'positive' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20',
                  )}
                >
                  <span className={cn('shrink-0 font-bold', n.noteType === 'positive' ? 'text-emerald-600' : 'text-red-600')}>
                    {n.noteType === 'positive' ? '+' : '−'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.noteDate ? format(new Date(n.noteDate), 'd MMM yyyy', { locale: tr }) : '-'}</p>
                    {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreModal({
  student,
  criterion,
  currentScore,
  onClose,
  onSubmit,
}: {
  student: Student;
  criterion: Criterion;
  currentScore?: number;
  onClose: () => void;
  onSubmit: (score: number) => void;
}) {
  const isSign = (criterion.scoreType ?? 'numeric') === 'sign';
  const [score, setScore] = useState<number>(
    currentScore ?? (isSign ? 0 : 0),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-[min(100%,20rem)] rounded-t-[1.35rem] border border-border p-4 shadow-2xl sm:max-w-sm sm:rounded-2xl sm:p-5"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto -mt-0.5 mb-2.5 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight sm:text-lg">{isSign ? 'Değerlendir' : 'Puan ver'}</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-border/50 bg-muted/35 px-2.5 py-2 dark:bg-muted/20">
          <span
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10"
            aria-hidden
          >
            <StudentMascotIcon studentId={student.id} className="size-9" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{student.name}</p>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{criterion.name}</p>
          </div>
        </div>
        {isSign ? (
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {[
              { v: 1, label: '+', cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30' },
              { v: 0, label: '·', cls: 'bg-muted hover:bg-muted/80' },
              { v: -1, label: '−', cls: 'bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30' },
            ].map(({ v, label, cls }) => (
              <button
                key={v}
                type="button"
                onClick={() => setScore(v)}
                className={cn(
                  'min-h-11 rounded-xl py-2.5 text-base font-bold transition-all active:scale-[0.98]',
                  cls,
                  score === v && 'ring-2 ring-primary ring-offset-2 ring-offset-background dark:ring-offset-card',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: criterion.maxScore + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-[0.98] sm:size-10 sm:text-base',
                  score === i ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/90 hover:bg-muted',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-0.5">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 rounded-xl px-3 sm:h-10 sm:px-4">
            İptal
          </Button>
          <Button size="sm" onClick={() => onSubmit(score)} className="h-9 rounded-xl px-4 sm:h-10 sm:px-5">
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

function CriterionModal({
  subjects,
  initialCategory,
  editing,
  onClose,
  onSuccess,
  token,
}: {
  subjects: SubjectOption[];
  initialCategory: 'lesson' | 'behavior';
  editing: Criterion | null;
  onClose: () => void;
  onSuccess: (saved?: Criterion, mode?: 'create' | 'update') => void;
  token: string | null;
}) {
  const isEdit = !!editing;
  const [name, setName] = useState('');
  const [maxScore, setMaxScore] = useState(5);
  const [scoreType, setScoreType] = useState<'numeric' | 'sign'>('numeric');
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState<'lesson' | 'behavior'>(initialCategory);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setMaxScore(editing.maxScore);
      setScoreType(editing.scoreType ?? 'numeric');
      setSubjectId(editing.subjectId ?? '');
      setCategory(editing.criterionCategory ?? 'lesson');
    } else {
      setName('');
      setMaxScore(5);
      setCategory(initialCategory);
      setScoreType(initialCategory === 'behavior' ? 'sign' : 'numeric');
      setSubjectId('');
    }
  }, [editing, initialCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setLoading(true);
    try {
      if (isEdit && editing) {
        const body: Record<string, unknown> = {
          name: name.trim(),
          scoreType,
          criterionCategory: category,
          subjectId: category === 'behavior' ? null : subjectId || null,
        };
        if (scoreType === 'numeric') body.maxScore = maxScore;
        const updated = await apiFetch<Criterion>(`/teacher-agenda/evaluation/criteria/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Kriter güncellendi');
        onSuccess(updated, 'update');
      } else {
        const created = await apiFetch<Criterion>('/teacher-agenda/evaluation/criteria', {
          method: 'POST',
          token,
          body: JSON.stringify({
            name: name.trim(),
            maxScore,
            scoreType,
            criterionCategory: category,
            ...(category === 'lesson' && subjectId ? { subjectId } : {}),
          }),
        });
        toast.success('Kriter eklendi');
        onSuccess(created, 'create');
      }
    } catch {
      toast.error(isEdit ? 'Güncellenemedi' : 'Eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const subjectHint = (
    <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:mt-0.5">
      Genel: her ders filtresinde görünür. Derse bağlı: yalnızca o ders + genel görünümde.
    </p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[min(88vh,100dvh)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border/70 bg-card/95 p-3 shadow-2xl ring-1 ring-black/6 backdrop-blur-md dark:bg-card/98 dark:ring-white/10 sm:max-h-[85vh] sm:rounded-2xl sm:p-4 sm:ring-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="mb-2.5 flex items-center justify-between sm:mb-3">
          <h3 className="text-sm font-semibold sm:text-base">{isEdit ? 'Kriteri düzenle' : 'Kriter ekle'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground sm:text-[11px]">Ad *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-full rounded-xl border border-input bg-background px-2.5 text-xs shadow-sm sm:h-9 sm:rounded-lg sm:text-sm"
              placeholder="örn: Derse katılım"
              required
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground sm:text-[11px]">Kategori</label>
            <div className="flex gap-1">
              <label
                className={cn(
                  'flex min-h-8 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-1 text-[11px] font-medium transition-colors sm:rounded-lg sm:py-1.5 sm:text-xs',
                  category === 'lesson' ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="critCategory"
                  checked={category === 'lesson'}
                  onChange={() => {
                    setCategory('lesson');
                  }}
                  className="sr-only"
                />
                Sınıf içi ders
              </label>
              <label
                className={cn(
                  'flex min-h-8 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-1 text-[11px] font-medium transition-colors sm:rounded-lg sm:py-1.5 sm:text-xs',
                  category === 'behavior' ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="critCategory"
                  checked={category === 'behavior'}
                  onChange={() => {
                    setCategory('behavior');
                    setSubjectId('');
                  }}
                  className="sr-only"
                />
                Davranış
              </label>
            </div>
          </div>
          {category === 'lesson' && (
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground sm:mb-0.5 sm:text-[11px]">Ders</label>
              <div
                className="touch-pan-y sm:hidden"
                role="listbox"
                aria-label="Ders seçin"
              >
                <div className="max-h-[min(9.5rem,28dvh)] overflow-y-auto overscroll-y-contain rounded-xl border border-border/60 bg-muted/30 p-1 shadow-inner dark:bg-muted/20">
                  <button
                    type="button"
                    role="option"
                    aria-selected={subjectId === ''}
                    onClick={() => setSubjectId('')}
                    className={cn(
                      'flex w-full min-h-8 items-center rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors active:scale-[0.99]',
                      subjectId === ''
                        ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                        : 'text-foreground hover:bg-background/90',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">Genel (tüm dersler)</span>
                  </button>
                  {subjects.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      role="option"
                      aria-selected={subjectId === s.id}
                      onClick={() => setSubjectId(s.id)}
                      className={cn(
                        'flex w-full min-h-8 items-center rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors active:scale-[0.99]',
                        subjectId === s.id
                          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                          : 'text-foreground hover:bg-background/90',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="hidden h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm sm:block"
              >
                <option value="">Genel (tüm dersler)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {subjectHint}
            </div>
          )}
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground sm:text-[11px]">Tür</label>
            <div className="flex gap-1">
              <label
                className={cn(
                  'flex min-h-8 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-1 text-[11px] font-medium transition-colors sm:rounded-lg sm:py-1.5 sm:text-xs',
                  scoreType === 'numeric' ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted/50',
                )}
              >
                <input type="radio" name="critScoreType" checked={scoreType === 'numeric'} onChange={() => setScoreType('numeric')} className="sr-only" />
                Puan 0–max
              </label>
              <label
                className={cn(
                  'flex min-h-8 flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-1 text-[11px] font-medium transition-colors sm:rounded-lg sm:py-1.5 sm:text-xs',
                  scoreType === 'sign' ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted/50',
                )}
              >
                <input type="radio" name="critScoreType" checked={scoreType === 'sign'} onChange={() => setScoreType('sign')} className="sr-only" />
                + / −
              </label>
            </div>
          </div>
          {scoreType === 'numeric' && (
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground sm:text-[11px]">Üst puan</label>
              <select
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="h-8 w-full rounded-xl border border-input bg-background px-2.5 text-xs shadow-sm sm:h-9 sm:rounded-lg sm:text-sm"
              >
                {[1, 2, 3, 4, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-0.5 sm:pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 rounded-xl text-xs sm:rounded-lg">
              İptal
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()} className="h-8 rounded-xl text-xs sm:rounded-lg">
              {isEdit ? 'Kaydet' : 'Ekle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ListModal({ token, onClose, onSuccess }: { token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ students: Student[] }>('/teacher-agenda/evaluation', { token })
      .then((r) => setStudents(r.students ?? []))
      .catch(() => setStudents([]));
  }, [token]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(students.map((s) => s.id)));
  const selectNone = () => setSelectedIds(new Set());

  const matchByName = (excelName: string): Student | null => {
    const n = String(excelName ?? '').trim();
    if (!n) return null;
    const lower = n.toLowerCase();
    const exact = students.find((s) => s.name.toLowerCase() === lower);
    if (exact) return exact;
    const partial = students.find((s) => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase()));
    return partial ?? null;
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) throw new Error('Dosya okunamadı');
        const wb = XLSX.read(data, { type: 'binary' });
        const first = wb.SheetNames[0];
        if (!first) throw new Error('Boş dosya');
        const ws = wb.Sheets[first];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as (string | number)[][];
        const names: string[] = [];
        const header = rows[0]?.map((c) => String(c ?? '').toLowerCase()) ?? [];
        const nameColIdx = header.findIndex((h) => /ad|soyad|isim|öğrenci|name/i.test(h));
        const colIdx = nameColIdx >= 0 ? nameColIdx : 0;
        for (let i = nameColIdx >= 0 ? 1 : 0; i < rows.length; i++) {
          const cell = rows[i]?.[colIdx];
          const val = typeof cell === 'number' ? String(cell) : String(cell ?? '').trim();
          if (val) names.push(val);
        }
        const matched = new Set<string>();
        const unmatched: string[] = [];
        for (const n of names) {
          const s = matchByName(n);
          if (s) matched.add(s.id);
          else unmatched.push(n);
        }
        setSelectedIds((prev) => {
          const next = new Set(prev);
          matched.forEach((id) => next.add(id));
          return next;
        });
        if (unmatched.length > 0) {
          setExcelError(`${unmatched.length} öğrenci eşleşmedi: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '...' : ''}`);
        } else {
          toast.success(`${matched.size} öğrenci listeye eklendi`);
        }
      } catch (err) {
        setExcelError(err instanceof Error ? err.message : 'Excel okunamadı');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Ad Soyad'], ['Ahmet Yılmaz'], ['Ayşe Demir'], ['Mehmet Kaya']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Öğrenciler');
    XLSX.writeFile(wb, 'ogrenci_listesi_ornek.xlsx');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/teacher-agenda/evaluation/lists', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim(), studentIds: Array.from(selectedIds) }),
      });
      toast.success('Liste eklendi');
      onSuccess();
    } catch {
      toast.error('Eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] p-6 flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Öğrenci Listesi Ekle</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex gap-2">
          <Info className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">Excel ile toplu ekleme</p>
            <p>İlk sütunda &quot;Ad Soyad&quot; başlığı ve altında öğrenci adları olan .xlsx dosyası yükleyebilirsiniz. Öğrenci adları sistemdeki kayıtlarla eşleştirilir.</p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
            <FileSpreadsheet className="size-4 mr-1.5" />
            Excel Yükle
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={downloadSample} className="rounded-xl text-muted-foreground">
            <Download className="size-4 mr-1.5" />
            Örnek İndir
          </Button>
        </div>
        {excelError && (
          <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{excelError}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Liste Adı *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5"
              placeholder="örn: Proje Grubu, 7-A Sınıfı"
              required
            />
          </div>
          <div className="flex-1 overflow-y-auto mb-4 max-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Öğrenciler ({selectedIds.size} seçili)</label>
              <div className="flex gap-1">
                <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">Tümünü seç</button>
                <span className="text-muted-foreground">|</span>
                <button type="button" onClick={selectNone} className="text-xs text-muted-foreground hover:underline">Kaldır</button>
              </div>
            </div>
            <div className="space-y-0.5 rounded-xl border border-border overflow-hidden">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 px-3 py-2.5 transition-colors">
                  {selectedIds.has(s.id) ? <CheckSquare className="size-4 text-primary shrink-0" /> : <Square className="size-4 text-muted-foreground shrink-0" />}
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} className="sr-only" />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
              {students.length === 0 && <p className="text-sm text-muted-foreground px-3 py-4">Okulda öğrenci kaydı yok. Önce öğrenci ekleyin.</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">İptal</Button>
            <Button type="submit" disabled={loading || !name.trim()} className="rounded-xl">
              Kaydet {selectedIds.size > 0 && `(${selectedIds.size})`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
