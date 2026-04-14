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
  ChevronRight,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { DegerlendirmeHero } from './components/DegerlendirmeHero';
import { PrintReportModal } from './components/print-report-modal';
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
type StudentNote = { id: string; studentId: string; noteType: string; noteDate: string; description?: string | null; createdAt?: string };

type EvalTab = 'tablo' | 'kriterler' | 'listeler';

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
} as const;

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

  const openCriterionModal = (edit: Criterion | null = null) => {
    setCriterionEditing(edit);
    setCriterionModalOpen(true);
  };
  const [listModalOpen, setListModalOpen] = useState(false);
  const [scoreModal, setScoreModal] = useState<{ student: Student; criterion: Criterion } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [evalTab, setEvalTab] = useState<EvalTab>('tablo');
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  /** Tablo sütunları: null = tüm kriterler; uuid = genel + o derse özel */
  const [tableSubjectFilterId, setTableSubjectFilterId] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
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

  const subjectLabel = useCallback(
    (subjectId: string | null | undefined) => {
      if (!subjectId) return 'Tüm dersler';
      return subjects.find((s) => s.id === subjectId)?.label ?? subjectId;
    },
    [subjects],
  );

  const criteriaGrouped = useMemo(() => {
    const genel: Criterion[] = [];
    const bySub = new Map<string, Criterion[]>();
    for (const c of displayCriteria) {
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
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getScore = (studentId: string, criterionId: string) =>
    displayScores.find((s) => s.studentId === studentId && s.criterionId === criterionId);

  const handleAddScore = async (studentId: string, criterionId: string, score: number) => {
    if (!token) return;
    try {
      await apiFetch('/teacher-agenda/evaluation/scores', {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId, criterionId, score, noteDate: today }),
      });
      toast.success('Puan eklendi');
      setScoreModal(null);
      fetchData();
    } catch {
      toast.error('Eklenemedi');
    }
  };

  const handleQuickNote = async (studentId: string, studentName: string, noteType: 'positive' | 'negative', e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!token) return;
    try {
      const created = await apiFetch<StudentNote>('/teacher-agenda/student-notes', {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId, noteType, noteDate: today }),
      });
      toast.success(`${studentName}: ${noteType === 'positive' ? 'Olumlu' : 'Olumsuz'} not eklendi`);
      setStudentNotes((prev) => [{ ...created, studentId, noteType, noteDate: today }, ...prev]);
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
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
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
  ];

  return (
    <div className="min-w-0 space-y-3 sm:space-y-5 pb-24 sm:pb-0">
      <DegerlendirmeHero
        criteriaCount={displayCriteria.length}
        studentCount={displayStudentsResolved.length}
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

      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:overflow-visible">
        <Button variant="outline" size="sm" onClick={() => openCriterionModal(null)} className="h-11 shrink-0 rounded-xl px-2 sm:h-9 sm:px-3">
          <Target className="size-4 shrink-0 sm:mr-1" />
          <span className="max-sm:sr-only sm:inline">Kriter Ekle</span>
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

      {evalTab === 'kriterler' && (
        <Card className={cn('overflow-hidden rounded-2xl border shadow-sm bg-card', EVAL_PANEL.criteria.card)}>
          <CardHeader className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', EVAL_PANEL.criteria.head)}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('flex size-8 items-center justify-center rounded-lg', EVAL_PANEL.criteria.iconWrap)}>
                <Target className={cn('size-4 shrink-0', EVAL_PANEL.criteria.iconClass)} />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">Başarı kriterleri</CardTitle>
                <p className="text-xs text-muted-foreground">Ders seçerek tabloda sütunları süzebilirsiniz; genel kriterler her derste görünür.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => openCriterionModal(null)}>
              <Plus className="size-4 mr-1" />
              Kriter Ekle
            </Button>
          </CardHeader>
          <CardContent className="space-y-5 p-3 sm:p-6">
            {criteriaGrouped.genel.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tüm dersler (genel)</p>
                <div className="flex flex-wrap items-center gap-2">
                  {criteriaGrouped.genel.map((c, i) => (
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
            {criteriaGrouped.bySubject.map(([subId, list]) => (
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
            <button
              type="button"
              onClick={() => openCriterionModal(null)}
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-muted-foreground/40 px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              title="Yeni kriter ekle"
            >
              <Plus className="size-4" />
              Kriter Ekle
            </button>
          </CardContent>
        </Card>
      )}

      {evalTab === 'listeler' && (
        <Card className={cn('overflow-hidden rounded-2xl border shadow-sm bg-card', EVAL_PANEL.lists.card)}>
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
        <div className="rounded-2xl border border-dashed border-border p-12 text-center sm:p-16">
          <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10">
            <Table className="size-6 animate-pulse text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="font-medium text-muted-foreground">Yükleniyor...</p>
        </div>
      ) : evalTab === 'tablo' ? (
        <Card className={cn('overflow-hidden rounded-2xl border shadow-sm', EVAL_PANEL.table.card)}>
          <CardHeader
            className={cn(
              'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
              EVAL_PANEL.table.head,
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('flex size-8 items-center justify-center rounded-lg', EVAL_PANEL.table.iconWrap)}>
                <Table className={cn('size-4 shrink-0', EVAL_PANEL.table.iconClass)} />
              </span>
              <CardTitle className="text-base font-semibold">Değerlendirme tablosu</CardTitle>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
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
                {filteredStudents.length} / {displayStudentsResolved.length} öğrenci · {tableCriteria.length} sütun
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:table-x-scroll">
            {displayStudentsResolved.length === 0 ? (
              <div className="py-20 text-center">
                <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground mb-1">Öğrenci yok</p>
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
              <div className="flex flex-col gap-3.5 px-3 pb-4 sm:hidden">
                {filteredStudents.map((s, idx) => (
                  <div
                    key={s.id}
                    className={cn(
                      'overflow-hidden rounded-[1.35rem] p-3.5 shadow-[0_2px_12px_-4px_rgba(99,102,241,0.12),0_1px_0_rgba(255,255,255,0.8)_inset] ring-1 ring-black/4 dark:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.35)] dark:ring-white/8',
                      idx % 3 === 0 &&
                        'border border-indigo-200/70 bg-linear-to-br from-indigo-50/95 via-violet-50/40 to-white dark:border-indigo-800/35 dark:from-indigo-950/50 dark:via-violet-950/25 dark:to-background',
                      idx % 3 === 1 &&
                        'border border-violet-200/70 bg-linear-to-br from-violet-50/95 via-fuchsia-50/35 to-white dark:border-violet-800/35 dark:from-violet-950/50 dark:via-fuchsia-950/20 dark:to-background',
                      idx % 3 === 2 &&
                        'border border-sky-200/70 bg-linear-to-br from-sky-50/95 via-cyan-50/35 to-white dark:border-sky-800/35 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-background',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setStudentDetailStudent(s)}
                      className={cn(
                        'flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-colors active:opacity-90',
                        idx % 3 === 0 &&
                          'border-indigo-200/80 bg-white/70 text-indigo-950 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-100',
                        idx % 3 === 1 &&
                          'border-violet-200/80 bg-white/70 text-violet-950 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-100',
                        idx % 3 === 2 &&
                          'border-sky-200/80 bg-white/70 text-sky-950 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100',
                      )}
                    >
                      <span className="truncate text-sm font-semibold tracking-tight">{s.name}</span>
                      <ChevronRight
                        className={cn(
                          'size-4 shrink-0 opacity-60',
                          idx % 3 === 0 && 'text-indigo-600 dark:text-indigo-300',
                          idx % 3 === 1 && 'text-violet-600 dark:text-violet-300',
                          idx % 3 === 2 && 'text-sky-600 dark:text-sky-300',
                        )}
                      />
                    </button>
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/45 px-2 py-1.5 shadow-sm dark:border-white/10 dark:bg-black/15">
                        <button
                          type="button"
                          onClick={(e) => handleQuickNote(s.id, s.name, 'positive', e)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-200/90 active:scale-[0.98] dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/55"
                          title="Olumlu not ekle"
                        >
                          <ThumbsUp className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickNote(s.id, s.name, 'negative', e)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-rose-100/90 text-rose-600 shadow-sm transition-colors hover:bg-rose-200/80 active:scale-[0.98] dark:bg-rose-950/45 dark:text-rose-300 dark:hover:bg-rose-900/50"
                          title="Olumsuz not ekle"
                        >
                          <ThumbsDown className="size-5" />
                        </button>
                      </div>
                      {(() => {
                        const notes = getNotesForStudent(s.id);
                        const pos = notes.filter((n) => n.noteType === 'positive').length;
                        const neg = notes.filter((n) => n.noteType === 'negative').length;
                        if (notes.length === 0) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => setNotesDetailStudent(s)}
                            className="flex items-center gap-2.5 rounded-full border border-violet-200/70 bg-violet-100/70 px-3.5 py-1.5 text-xs font-semibold text-violet-900 shadow-sm transition-colors hover:bg-violet-100 active:scale-[0.98] dark:border-violet-800/45 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/55"
                            title="Detayları görüntüle"
                          >
                            <span className="text-emerald-700 dark:text-emerald-300">+{pos}</span>
                            <span className="text-rose-600 opacity-80 dark:text-rose-300">−{neg}</span>
                          </button>
                        );
                      })()}
                    </div>
                    <div
                      className={cn(
                        'mt-3 grid grid-cols-2 gap-2 rounded-2xl border p-2.5',
                        idx % 3 === 0 && 'border-indigo-200/50 bg-indigo-100/25 dark:border-indigo-800/30 dark:bg-indigo-950/20',
                        idx % 3 === 1 && 'border-violet-200/50 bg-violet-100/25 dark:border-violet-800/30 dark:bg-violet-950/20',
                        idx % 3 === 2 && 'border-sky-200/50 bg-sky-100/25 dark:border-sky-800/30 dark:bg-sky-950/20',
                      )}
                    >
                      {tableCriteria.map((c, ci) => {
                        const sc = getScore(s.id, c.id);
                        const pastel = [
                          'border-violet-200/60 bg-violet-50/90 text-violet-900 dark:border-violet-800/40 dark:bg-violet-950/35 dark:text-violet-100',
                          'border-emerald-200/60 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/35 dark:text-emerald-100',
                          'border-amber-200/60 bg-amber-50/90 text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/35 dark:text-amber-100',
                        ] as const;
                        const p = pastel[ci % 3];
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setScoreModal({ student: s, criterion: c })}
                            className={cn(
                              'flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left shadow-sm transition-all active:scale-[0.99]',
                              p,
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight opacity-90">{c.name}</span>
                            {sc ? (
                              <span
                                className={cn(
                                  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold shadow-sm',
                                  ci % 3 === 0 && 'bg-violet-200/80 text-violet-900 dark:bg-violet-800/60 dark:text-violet-50',
                                  ci % 3 === 1 && 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-800/55 dark:text-emerald-50',
                                  ci % 3 === 2 && 'bg-amber-200/85 text-amber-950 dark:bg-amber-800/50 dark:text-amber-50',
                                )}
                              >
                                {(c.scoreType ?? 'numeric') === 'sign'
                                  ? (sc.score === 1 ? '+' : sc.score === -1 ? '−' : '·')
                                  : sc.score}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed text-xs font-medium opacity-70',
                                  ci % 3 === 0 && 'border-violet-300/70 text-violet-600 dark:border-violet-600/50 dark:text-violet-300',
                                  ci % 3 === 1 && 'border-emerald-300/70 text-emerald-600 dark:border-emerald-600/50 dark:text-emerald-300',
                                  ci % 3 === 2 && 'border-amber-300/70 text-amber-700 dark:border-amber-600/50 dark:text-amber-200',
                                )}
                              >
                                +
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block table-x-scroll">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="text-left px-4 py-3.5 font-semibold sticky left-0 bg-muted/50 z-10 rounded-tl-lg">Öğrenci</th>
                    <th className="text-center px-2 py-3.5 min-w-[100px]">+ / − Notlar</th>
                    {tableCriteria.map((c) => (
                      <th key={c.id} className="text-center px-2 py-3.5 min-w-[64px] font-medium group/cell">
                        <div className="flex items-center justify-center gap-1">
                          {c.name}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCriterion(c.id); }}
                            className="p-1 rounded opacity-0 group-hover/cell:opacity-100 hover:bg-destructive/20 text-destructive"
                            title="Kriteri sil"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="text-center px-2 py-3.5 min-w-[64px]">
                      <button
                        type="button"
                        onClick={() => openCriterionModal(null)}
                        className="inline-flex items-center justify-center size-9 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                        title="Yeni kriter ekle"
                      >
                        <Plus className="size-4" />
                      </button>
                    </th>
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
                          'px-4 py-3.5 font-medium sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:text-primary hover:underline',
                          idx % 2 === 0 ? 'bg-background group-hover/row:bg-muted/40' : 'bg-muted/20 group-hover/row:bg-muted/40',
                        )}
                        onClick={() => setStudentDetailStudent(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setStudentDetailStudent(s)}
                      >
                        {s.name}
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleQuickNote(s.id, s.name, 'positive', e)}
                              className="p-2 rounded-xl hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                              title="Olumlu not ekle"
                            >
                              <ThumbsUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleQuickNote(s.id, s.name, 'negative', e)}
                              className="p-2 rounded-xl hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                              title="Olumsuz not ekle"
                            >
                              <ThumbsDown className="size-4" />
                          </button>
                          </div>
                          {(() => {
                            const notes = getNotesForStudent(s.id);
                            const pos = notes.filter((n) => n.noteType === 'positive').length;
                            const neg = notes.filter((n) => n.noteType === 'negative').length;
                            if (notes.length === 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setNotesDetailStudent(s)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium bg-muted/60 hover:bg-muted transition-colors"
                                title="Detayları görüntüle"
                              >
                                <span className="text-emerald-600 dark:text-emerald-400">+{pos}</span>
                                <span className="text-red-600 dark:text-red-400">−{neg}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                      {tableCriteria.map((c) => {
                        const sc = getScore(s.id, c.id);
                        return (
                          <td
                            key={c.id}
                            className="px-2 py-3.5 text-center cursor-pointer group"
                            onClick={() => setScoreModal({ student: s, criterion: c })}
                            title={`${s.name} – ${c.name}: Puan ver`}
                          >
                            {sc ? (
                              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-semibold group-hover:bg-primary/25 transition-colors">
                                {(c.scoreType ?? 'numeric') === 'sign'
                                  ? (sc.score === 1 ? '+' : sc.score === -1 ? '−' : '·')
                                  : sc.score}
                              </span>
                            ) : (
                              <span className="inline-flex size-9 items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-xs group-hover:border-primary/40 group-hover:text-primary/70 transition-colors">
                                +
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-3.5" />
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </>
            )}
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
      {studentDetailStudent && (
        <StudentDetailModal
          student={studentDetailStudent}
          notes={getNotesForStudent(studentDetailStudent.id)}
          scores={displayScores.filter((sc) => sc.studentId === studentDetailStudent.id)}
          onClose={() => setStudentDetailStudent(null)}
          onAddNote={(type) => handleQuickNote(studentDetailStudent.id, studentDetailStudent.name, type)}
        />
      )}
      {notesDetailStudent && (
        <StudentNotesDetailModal
          student={notesDetailStudent}
          notes={getNotesForStudent(notesDetailStudent.id)}
          onClose={() => setNotesDetailStudent(null)}
          onAddNote={async (type) => { await handleQuickNote(notesDetailStudent.id, notesDetailStudent.name, type); fetchData(); }}
        />
      )}
      {scoreModal && (
        <ScoreModal
          student={scoreModal.student}
          criterion={scoreModal.criterion}
          currentScore={getScore(scoreModal.student.id, scoreModal.criterion.id)?.score}
          onClose={() => setScoreModal(null)}
          onSubmit={(score) => handleAddScore(scoreModal.student.id, scoreModal.criterion.id, score)}
        />
      )}
    </div>
  );
}

function StudentDetailModal({
  student,
  notes,
  scores,
  onClose,
  onAddNote,
}: {
  student: Student;
  notes: StudentNote[];
  scores: Score[];
  onClose: () => void;
  onAddNote: (type: 'positive' | 'negative') => void;
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
      <div className="bg-card max-h-[min(92vh,100dvh)] w-full max-w-lg flex flex-col rounded-t-2xl border border-border shadow-2xl sm:max-h-[90vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between p-4 border-b border-border sm:p-5">
          <div>
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <p className="text-sm text-muted-foreground">
              +{pos} olumlu, −{neg} olumsuz · {scores.length} kriter puanı
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 p-4 border-b border-border">
          <Button size="sm" onClick={() => onAddNote('positive')} className="rounded-xl flex-1">
            <ThumbsUp className="size-4 mr-1" />
            + Ekle
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAddNote('negative')} className="rounded-xl flex-1">
            <ThumbsDown className="size-4 mr-1" />
            − Ekle
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
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
  onClose,
  onAddNote,
}: {
  student: Student;
  notes: StudentNote[];
  onClose: () => void;
  onAddNote: (type: 'positive' | 'negative') => void;
}) {
  const pos = notes.filter((n) => n.noteType === 'positive');
  const neg = notes.filter((n) => n.noteType === 'negative');
  const sorted = [...notes].sort((a, b) => (b.noteDate ?? '').localeCompare(a.noteDate ?? ''));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="bg-card max-h-[min(88vh,100dvh)] w-full max-w-md flex flex-col rounded-t-2xl border border-border shadow-2xl sm:max-h-[85vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between p-4 border-b border-border sm:p-5">
          <div>
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <p className="text-sm text-muted-foreground">
              +{pos.length} olumlu, −{neg.length} olumsuz
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 p-4 border-b border-border">
          <Button size="sm" onClick={() => onAddNote('positive')} className="rounded-xl flex-1">
            <ThumbsUp className="size-4 mr-1" />
            + Ekle
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAddNote('negative')} className="rounded-xl flex-1">
            <ThumbsDown className="size-4 mr-1" />
            − Ekle
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
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
      <div className="bg-card w-full max-w-sm rounded-t-2xl border border-border p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{isSign ? 'Değerlendir' : 'Puan Ver'}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="rounded-xl bg-muted/50 px-4 py-2.5 mb-4">
          <p className="font-medium">{student.name}</p>
          <p className="text-sm text-muted-foreground">{criterion.name}</p>
        </div>
        {isSign ? (
          <div className="flex gap-2 mb-5">
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
                  'flex-1 py-3 rounded-xl font-semibold transition-all',
                  cls,
                  score === v && 'ring-2 ring-offset-2 ring-primary scale-105',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap mb-5">
            {Array.from({ length: criterion.maxScore + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={cn(
                  'size-11 rounded-xl font-semibold transition-all',
                  score === i ? 'bg-primary text-primary-foreground scale-105 shadow-md' : 'bg-muted hover:bg-muted/80',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">İptal</Button>
          <Button onClick={() => onSubmit(score)} className="rounded-xl">Kaydet</Button>
        </div>
      </div>
    </div>
  );
}

function CriterionModal({
  subjects,
  editing,
  onClose,
  onSuccess,
  token,
}: {
  subjects: SubjectOption[];
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setMaxScore(editing.maxScore);
      setScoreType(editing.scoreType ?? 'numeric');
      setSubjectId(editing.subjectId ?? '');
    } else {
      setName('');
      setMaxScore(5);
      setScoreType('numeric');
      setSubjectId('');
    }
  }, [editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setLoading(true);
    try {
      if (isEdit && editing) {
        const body: Record<string, unknown> = {
          name: name.trim(),
          scoreType,
          subjectId: subjectId || null,
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
            ...(subjectId ? { subjectId } : {}),
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
