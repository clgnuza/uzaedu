'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useTimetableEditor } from '@/hooks/use-timetable-editor';
import { TimetableGrid, type TimetableDragSource } from './TimetableGrid';
import { TimetableSidebar } from './TimetableSidebar';
import { CollisionResolveDialog } from './CollisionResolveDialog';
import { TimetableEntryEditDialog, type TimetableEntryEditSave } from './TimetableEntryEditDialog';
import { TimetableUnplacedTray, type UnplacedRow } from './TimetableUnplacedTray';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DdSelect, DdSelectField } from '@/components/ders-dagit/dd-select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiFetch } from '@/lib/api';
import { listStudioPrograms, type DdProgramRow } from '@/lib/ders-dagit-program-api';
import { ProgramManageBar } from './ProgramManageBar';
import { downloadDersDagitExport, openScheduleViewPdf } from '@/lib/ders-dagit-api';
import { cn } from '@/lib/utils';
import type { EditorContext, EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { Undo2, ZoomIn, ZoomOut, Printer } from 'lucide-react';
import { DndContext, DragOverlay, pointerWithin, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { TimetableLegend } from './TimetableLegend';
import { TimetableQuickLinks } from './TimetableQuickLinks';
import { TimetableHealthStrip } from './TimetableHealthStrip';
import { TimetableSimulationBar } from './TimetableSimulationBar';
import { TimetablePrintHeader } from './TimetablePrintHeader';
import { slotHighlightKey } from '@/lib/timetable-grid-build';
import { buildTimetableCompare, maxStackedInCell } from '@/lib/timetable-compare';
import { buildSlotClosures, closureAt } from '@/lib/timetable-slot-closures';
import { validateTimetableMove } from '@/lib/timetable-move-validation';
import {
  canPlaceEntryAt,
  finalizeMovesForEntry,
  planBlockEntryMoveDeep,
  planChainEntryMoveDeep,
  planChainPoolPlaceDeep,
} from '@/lib/timetable-drag-resolve';
import { listOkPoolSlotsWithClosures, planPoolPlacement, planSmartEntryMove } from '@/lib/timetable-pool-place';
import { parsePoolDragId } from '@/lib/timetable-pool-id';
import { findUnplacedPoolRow } from '@/lib/timetable-unplaced-pool';
import { yieldToMain } from '@/lib/timetable-placement-budget';
import {
  DEFAULT_TIMETABLE_PLACEMENT_SETTINGS,
  type TimetablePlacementSettings,
} from '@/lib/timetable-placement-settings';
import { fetchPlacementSearchPolicy } from '@/lib/placement-search-policy';
import { TimetablePlacementSettingsMenu } from './TimetablePlacementSettingsMenu';
import { entryMatchesMatrixRow, parseMatrixDropId, poolRowMatches } from '@/lib/timetable-matrix-dnd';
import { clashAtSlot, clashEntryIds } from '@/lib/timetable-clash';
import { useRouter } from 'next/navigation';
import {
  applySimulationDraft,
  buildClashesFromEntries,
  pendingSimulationMoves,
} from '@/lib/timetable-simulation';
import { toast } from 'sonner';
import { applyDocumentPrintMode } from '@/components/ders-dagit/ReportPrintSettings';
import { loadReportPrintMode } from '@/lib/ders-dagit-report-settings';
import {
  entriesInGridDayColumn,
  type TimetableCellMenuHandlers,
  type TimetableMatrixRowMenuHandlers,
  type TimetableEmptySlotMenuHandlers,
} from '@/lib/timetable-cell-menu';
import { findConsecutivePartner, sameDayBlockRun } from '@/lib/timetable-double-block';
import { filterEntriesForPreview } from '@/lib/timetable-preview-filter';
import type { TimetablePreviewTarget } from '@/lib/timetable-preview-types';
import { TimetablePreviewDialog } from './TimetablePreviewDialog';
import { planlamaIliskileriUrl } from '@/lib/dd-entity-scope';
import type { LessonAssignmentRow } from '@/lib/lesson-assignment';
import { assignmentUpsertBodyWithDistribution } from '@/lib/timetable-assignment-edit';
import './timetable-print.css';

type ProgramRow = DdProgramRow;
type AuditRow = {
  id: string;
  action: string;
  user_label: string | null;
  created_at: string;
  detail?: Record<string, unknown>;
};

const EMPTY_GRID = {
  blocked_lesson_nums: [] as number[],
  long_breaks: [] as Array<{ after_lesson: number; label?: string }>,
  lessons_per_day_by_dow: {} as Record<string, number>,
};

type ViewMode = 'class' | 'teacher' | 'room' | 'all';

/** Filtrede «Tümü» — kompakt matris (tüm sınıf/öğretmen/derslik satırları). */
const FILTER_ALL = '__all__';

function matrixAxisForView(view: ViewMode, filterId: string, matrixAxis: 'teacher' | 'class' | 'room') {
  if (view === 'all') return matrixAxis;
  if (view === 'class' || view === 'teacher' || view === 'room') {
    if (filterId === FILTER_ALL) return view;
  }
  return undefined;
}

export function TimetableShell({
  initialProgramId,
  compareProgramId,
  initialView,
  initialFilterId,
  initialAutoPrint,
  onProgramIdChange,
}: {
  initialProgramId?: string;
  compareProgramId?: string;
  initialView?: ViewMode;
  /** URL ?filter= — şube / öğretmen id / derslik id */
  initialFilterId?: string;
  initialAutoPrint?: boolean;
  onProgramIdChange?: (id: string) => void;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const editor = useTimetableEditor(token, studio?.id ?? null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [view, setView] = useState<ViewMode>(initialView ?? 'all');

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);
  const [matrixAxis, setMatrixAxis] = useState<'teacher' | 'class' | 'room'>('teacher');
  const [filterId, setFilterId] = useState('');
  const [zoom, setZoom] = useState(100);
  const [compareId, setCompareId] = useState(compareProgramId ?? '');
  const [compareCtx, setCompareCtx] = useState<typeof editor.ctx>(null);
  const [editEntry, setEditEntry] = useState<EditorEntry | null>(null);
  const [editAssignment, setEditAssignment] = useState<LessonAssignmentRow | null>(null);
  const [editAssignmentLoading, setEditAssignmentLoading] = useState(false);

  useEffect(() => {
    const aid = editEntry?.assignment_id;
    if (!aid || !token || !studio?.id) {
      setEditAssignment(null);
      setEditAssignmentLoading(false);
      return;
    }
    let cancelled = false;
    setEditAssignmentLoading(true);
    void apiFetch<LessonAssignmentRow[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token })
      .then((list) => {
        if (!cancelled) setEditAssignment(list.find((a) => a.id === aid) ?? null);
      })
      .catch(() => {
        if (!cancelled) setEditAssignment(null);
      })
      .finally(() => {
        if (!cancelled) setEditAssignmentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editEntry?.assignment_id, token, studio?.id]);
  const [poolDrag, setPoolDrag] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [highlightSlotKey, setHighlightSlotKey] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<'drag' | 'click'>('drag');
  const [pickedEntryId, setPickedEntryId] = useState<string | null>(null);
  const [pickedPoolAssignmentId, setPickedPoolAssignmentId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<TimetablePreviewTarget | null>(null);
  const [dragSource, setDragSource] = useState<TimetableDragSource>(null);
  const [collision, setCollision] = useState<{
    entryId: string;
    day: number;
    lesson: number;
    occupants: EditorEntry[];
  } | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [simBaseline, setSimBaseline] = useState<EditorEntry[] | null>(null);
  const [draftEntries, setDraftEntries] = useState<EditorEntry[] | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [busyLocal, setBusyLocal] = useState(false);
  const [placementSettings, setPlacementSettings] = useState<TimetablePlacementSettings>(
    DEFAULT_TIMETABLE_PLACEMENT_SETTINGS,
  );
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const placementInFlight = useRef(false);
  const placementProgressToastId = useRef<string | number | null>(null);

  const formatExplored = useCallback((n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  }, []);

  const reportPlacementProgress = useCallback(
    (explored: number) => {
      const msg = `${formatExplored(explored)} olasılık deneniyor…`;
      if (placementProgressToastId.current != null) {
        toast.loading(msg, { id: placementProgressToastId.current });
      } else {
        placementProgressToastId.current = toast.loading(msg);
      }
    },
    [formatExplored],
  );

  const clearPlacementProgress = useCallback(() => {
    if (placementProgressToastId.current != null) {
      toast.dismiss(placementProgressToastId.current);
      placementProgressToastId.current = null;
    }
  }, []);

  useEffect(() => {
    if (!token || !studio?.id) return;
    void fetchPlacementSearchPolicy(token, studio.id)
      .then(setPlacementSettings)
      .catch(() => setPlacementSettings(DEFAULT_TIMETABLE_PLACEMENT_SETTINGS));
  }, [token, studio?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const reloadPrograms = useCallback(
    async (opts?: { selectId?: string; removedId?: string }) => {
      if (!token || !studio) return;
      const list = await listStudioPrograms(token, studio.id);
      setPrograms(list);
      const cur = editor.programId;
      const removed = opts?.removedId;
      const pick =
        opts?.selectId ?? (removed && cur === removed ? list[0]?.id : list.some((p) => p.id === cur) ? cur : list[0]?.id);
      if (pick && pick !== cur) await editor.load(pick, { validation: true });
      onProgramIdChange?.(pick ?? '');
    },
    [token, studio, editor.programId, editor.load, onProgramIdChange],
  );

  useEffect(() => {
    if (!token || !studio) return;
    void Promise.all([
      listStudioPrograms(token, studio.id),
      apiFetch<AuditRow[]>(`/ders-dagit/studios/${studio.id}/audit-log?limit=30`, { token }),
    ]).then(([list, logs]) => {
      setPrograms(list);
      setAudit(logs);
    });
  }, [token, studio]);

  useEffect(() => {
    applyDocumentPrintMode(loadReportPrintMode());
  }, []);

  const printReady = useMemo(() => {
    if (!initialAutoPrint || !editor.ctx || editor.loading) return false;
    if (view === 'all') return true;
    return Boolean(filterId && filterId !== FILTER_ALL);
  }, [initialAutoPrint, editor.ctx, editor.loading, view, filterId]);

  useEffect(() => {
    if (initialAutoPrint) setCompareId('');
  }, [initialAutoPrint]);

  const discardSimulation = useCallback(() => {
    setSimulate(false);
    setSimBaseline(null);
    setDraftEntries(null);
  }, []);

  const startSimulation = useCallback(() => {
    if (!editor.ctx) return;
    if (simulate) {
      discardSimulation();
      return;
    }
    const base = [...editor.ctx.entries];
    setSimBaseline(base);
    setDraftEntries([...base]);
    setSimulate(true);
    toast.message('Deneme modu', {
      description: 'Taşımalar önizlemede; kaydetmeden çıkmak için Vazgeç veya Esc.',
    });
  }, [editor.ctx, simulate, discardSimulation]);

  useEffect(() => {
    if (simulate) discardSimulation();
  }, [editor.programId]);

  const simPending = useMemo(
    () => (simBaseline && draftEntries ? pendingSimulationMoves(simBaseline, draftEntries) : []),
    [simBaseline, draftEntries],
  );

  useEffect(() => {
    if (!simulate || simPending.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [simulate, simPending.length]);

  useEffect(() => {
    if (!token || !studio || programs.length === 0) return;
    const wanted = initialProgramId;
    const exists = wanted && programs.some((p) => p.id === wanted);
    const pick = exists ? wanted! : programs[0]!.id;
    if (wanted && !exists) onProgramIdChange?.(pick);
    if (editor.programId === pick) return;
    void editor.load(pick, { validation: true });
  }, [initialProgramId, programs, token, studio, editor.load, editor.programId, onProgramIdChange]);

  const lastUrlProgramId = useRef('');
  useEffect(() => {
    const id = editor.programId;
    if (!id || id === lastUrlProgramId.current) return;
    lastUrlProgramId.current = id;
    onProgramIdChange?.(id);
  }, [editor.programId, onProgramIdChange]);

  useEffect(() => {
    if (!token || !studio || !compareId) {
      setCompareCtx(null);
      return;
    }
    if (programs.length && !programs.some((p) => p.id === compareId)) {
      setCompareCtx(null);
      return;
    }
    void import('@/lib/ders-dagit-timetable-api').then(({ fetchEditorContext }) =>
      fetchEditorContext(token, studio.id, compareId).then(setCompareCtx).catch(() => setCompareCtx(null)),
    );
  }, [token, studio, compareId, programs]);

  const displayCtx = useMemo(() => {
    if (!editor.ctx) return null;
    if (!simulate || !draftEntries) return editor.ctx;
    const clashes = buildClashesFromEntries(draftEntries);
    return { ...editor.ctx, entries: draftEntries, clashes };
  }, [editor.ctx, simulate, draftEntries]);

  const ctx = displayCtx;

  const pickedUnplaced = useMemo(() => {
    if (!pickedPoolAssignmentId || !ctx) return null;
    return findUnplacedPoolRow(ctx, pickedPoolAssignmentId) ?? null;
  }, [pickedPoolAssignmentId, ctx]);

  const poolPlacementView = useMemo((): 'class' | 'teacher' | null => {
    if (!pickedUnplaced) return null;
    if (pickedUnplaced.user_id && ctx?.teachers.some((t) => t.id === pickedUnplaced.user_id)) {
      return 'teacher';
    }
    return 'class';
  }, [pickedUnplaced, ctx?.teachers]);

  const effectiveDragSource: TimetableDragSource = useMemo(() => {
    if (dragSource) return dragSource;
    if (pickedUnplaced) return { type: 'pool', classSection: pickedUnplaced.class_section };
    return null;
  }, [dragSource, pickedUnplaced]);

  const selectUnplacedLesson = useCallback(
    (row: UnplacedRow) => {
      setPickedEntryId(null);
      setPickedPoolAssignmentId(row.pool_id);
      const hasTeacher =
        !!row.user_id && !!editor.ctx?.teachers.some((t) => t.id === row.user_id);
      if (hasTeacher && row.user_id) {
        setView('teacher');
        setFilterId(row.user_id);
      } else {
        setView('class');
        setFilterId(row.class_section);
      }
    },
    [editor.ctx?.teachers],
  );

  const clearPoolSelection = useCallback(() => {
    setPickedPoolAssignmentId(null);
    setDragSource(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && editor.canUndo && !editor.busy && !simulate) {
        e.preventDefault();
        void editor.undo();
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
      if (e.key === 'Escape') {
        if (simulate) {
          discardSimulation();
        } else if (pickedPoolAssignmentId || pickedEntryId) {
          e.preventDefault();
          clearPoolSelection();
          setPickedEntryId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    editor.canUndo,
    editor.busy,
    editor.undo,
    simulate,
    discardSimulation,
    pickedPoolAssignmentId,
    pickedEntryId,
    clearPoolSelection,
  ]);

  useEffect(() => {
    if (!pickedPoolAssignmentId || !ctx) return;
    if (!ctx.unplaced.some((u) => u.pool_id === pickedPoolAssignmentId)) {
      clearPoolSelection();
    }
  }, [ctx?.unplaced, pickedPoolAssignmentId, clearPoolSelection, ctx]);

  const simClashIds = useMemo(
    () => (draftEntries ? clashEntryIds(draftEntries) : editor.clashIds),
    [draftEntries, editor.clashIds],
  );

  const filterOptions = useMemo(() => {
    if (!editor.ctx || view === 'all') return [];
    const allOpt = { id: FILTER_ALL, label: 'Tümü' };
    if (view === 'class') return [allOpt, ...editor.ctx.class_sections.map((s) => ({ id: s, label: s }))];
    if (view === 'teacher') return [allOpt, ...editor.ctx.teachers.map((t) => ({ id: t.id, label: t.label }))];
    const roomOpts = editor.ctx.rooms.map((r) => ({ id: r.id, label: r.name }));
    if (editor.ctx.entries.some((e) => !e.room_id)) {
      roomOpts.unshift({ id: '__none__', label: '(Derslik yok)' });
    }
    return [allOpt, ...roomOpts];
  }, [editor.ctx, view]);

  const openViewPdfPrint = useCallback(async () => {
    if (!token || !studio?.id || !editor.programId) return;
    if (view !== 'class' && view !== 'teacher' && view !== 'room') return;
    if (!filterId || filterId === FILTER_ALL) {
      toast.error('Yazdırma için şube / öğretmen / derslik seçin.');
      return;
    }
    const label = filterOptions.find((o) => o.id === filterId)?.label ?? filterId;
    try {
      await openScheduleViewPdf(token, studio.id, editor.programId, view, filterId, label, loadReportPrintMode());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF açılamadı');
    }
  }, [token, studio?.id, editor.programId, view, filterId, filterOptions]);

  useEffect(() => {
    if (!printReady) return;
    const t = window.setTimeout(() => {
      void openViewPdfPrint();
    }, 700);
    return () => window.clearTimeout(t);
  }, [printReady, openViewPdfPrint]);

  const filter = useMemo(() => {
    if (view === 'all' || filterId === FILTER_ALL) return undefined;
    if (view !== 'class' && view !== 'teacher' && view !== 'room') return undefined;
    const ok = filterOptions.some((o) => o.id === filterId);
    const id = ok ? filterId : (filterOptions.find((o) => o.id !== FILTER_ALL)?.id ?? '');
    if (!id || id === FILTER_ALL) return undefined;
    return { mode: view, id } as const;
  }, [view, filterId, filterOptions]);

  const effectiveFilter = useMemo(() => {
    const c = displayCtx;
    if (!problemsOnly || !c || view !== 'class') return filter;
    const bad = new Set<string>();
    for (const cl of c.clashes) {
      const e = c.entries.find((x) => x.id === cl.entry_id);
      if (e) bad.add(e.class_section);
    }
    if (!bad.size) return filter;
    const id = filterId && bad.has(filterId) ? filterId : [...bad][0]!;
    return { mode: 'class' as const, id };
  }, [problemsOnly, displayCtx, view, filter, filterId]);

  useEffect(() => {
    if (view === 'all') return;
    const opts = filterOptions;
    setFilterId((current) => {
      if (!opts.length) return '';
      if (initialFilterId && opts.some((o) => o.id === initialFilterId)) return initialFilterId;
      if (initialAutoPrint) {
        const concrete = opts.filter((o) => o.id !== FILTER_ALL);
        if (concrete.length && (!current || current === FILTER_ALL)) return concrete[0]!.id;
      }
      if (!current || !opts.some((o) => o.id === current)) return FILTER_ALL;
      return current;
    });
  }, [editor.programId, view, filterOptions, initialAutoPrint, initialFilterId]);

  const teacherUnavailable = useMemo(() => {
    if (!editor.ctx || view !== 'teacher' || !filterId || filterId === FILTER_ALL) return undefined;
    const t = editor.ctx.teacher_availability.find((x) => x.user_id === filterId);
    return t?.unavailable_periods;
  }, [editor.ctx, view, filterId]);

  const focusClash = useCallback((key: string, entryId: string) => {
    setHighlightSlotKey(key);
    const el =
      gridWrapRef.current?.querySelector(`[data-entry-id="${entryId}"]`) ??
      gridWrapRef.current?.querySelector(`[data-slot-key="${key}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    window.setTimeout(() => setHighlightSlotKey(null), 2500);
  }, []);

  const applyLocalMove = useCallback(
    (entryId: string, day: number, lesson: number, swapWithId?: string) => {
      setDraftEntries((prev) => {
        const base = prev ?? editor.ctx?.entries ?? [];
        const entry = base.find((e) => e.id === entryId);
        if (!entry) return prev;
        if (swapWithId) {
          const other = base.find((e) => e.id === swapWithId);
          if (!other) return prev;
          return base.map((e) => {
            if (e.id === entryId) return { ...e, day_of_week: other.day_of_week, lesson_num: other.lesson_num };
            if (e.id === swapWithId) return { ...e, day_of_week: entry.day_of_week, lesson_num: entry.lesson_num };
            return e;
          });
        }
        const occupant = base.find((e) => e.day_of_week === day && e.lesson_num === lesson && e.id !== entryId);
        if (occupant && !occupant.is_locked) {
          return base.map((e) => {
            if (e.id === entryId) return { ...e, day_of_week: occupant.day_of_week, lesson_num: occupant.lesson_num };
            if (e.id === occupant.id) return { ...e, day_of_week: entry.day_of_week, lesson_num: entry.lesson_num };
            return e;
          });
        }
        const clash = clashAtSlot(base, entryId, day, lesson);
        if (clash) {
          toast.error(clash === 'CLASS_CLASH' ? 'Sınıf çakışması' : 'Öğretmen çakışması');
          return prev;
        }
        if (occupant) return prev;
        return base.map((e) => (e.id === entryId ? { ...e, day_of_week: day, lesson_num: lesson } : e));
      });
    },
    [editor.ctx?.entries],
  );

  const applySimulation = useCallback(async () => {
    if (!draftEntries || !simBaseline || !token || !studio) return;
    if (simClashIds.size > 0) {
      toast.error('Kaydetmeden önce çakışmaları giderin');
      return;
    }
    if (!simPending.length) {
      discardSimulation();
      return;
    }
    setBusyLocal(true);
    try {
      const n = await applySimulationDraft(token, studio.id, editor.programId, simBaseline, draftEntries);
      await editor.load(editor.programId, { validation: true });
      discardSimulation();
      toast.success(n === 1 ? '1 taşıma kaydedildi' : `${n} taşıma kaydedildi`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusyLocal(false);
    }
  }, [
    draftEntries,
    simBaseline,
    token,
    studio,
    editor,
    simClashIds.size,
    simPending.length,
    discardSimulation,
  ]);

  const resetSimulationDraft = useCallback(() => {
    if (!simBaseline) return;
    setDraftEntries([...simBaseline]);
    toast.message('Önizleme sıfırlandı');
  }, [simBaseline]);

  const compareMaps = useMemo(() => {
    if (!compareCtx || !ctx) return null;
    return buildTimetableCompare(ctx.entries, compareCtx.entries);
  }, [compareCtx, ctx]);

  const compareStackMin = useMemo(() => {
    if (!compareCtx || !ctx) return undefined;
    return maxStackedInCell([ctx.entries, compareCtx.entries], effectiveFilter);
  }, [compareCtx, ctx, effectiveFilter]);

  const previewNeighbors = useMemo(() => {
    const c = displayCtx ?? editor.ctx;
    if (!previewTarget || !c) return {};
    if (previewTarget.mode === 'teacher') {
      const list = c.teachers;
      const i = list.findIndex((t) => t.id === previewTarget.id);
      return {
        prev:
          i > 0
            ? {
                mode: 'teacher' as const,
                id: list[i - 1]!.id,
                title: list[i - 1]!.label,
                subtitle: 'Öğretmen',
              }
            : undefined,
        next:
          i >= 0 && i < list.length - 1
            ? {
                mode: 'teacher' as const,
                id: list[i + 1]!.id,
                title: list[i + 1]!.label,
                subtitle: 'Öğretmen',
              }
            : undefined,
      };
    }
    if (previewTarget.mode === 'class') {
      const list = c.class_sections;
      const i = list.indexOf(previewTarget.id);
      return {
        prev:
          i > 0
            ? { mode: 'class' as const, id: list[i - 1]!, title: list[i - 1]!, subtitle: 'Sınıf' }
            : undefined,
        next:
          i >= 0 && i < list.length - 1
            ? { mode: 'class' as const, id: list[i + 1]!, title: list[i + 1]!, subtitle: 'Sınıf' }
            : undefined,
      };
    }
    const list = c.rooms;
    const i = list.findIndex((r) => r.id === previewTarget.id);
    return {
      prev:
        i > 0
          ? { mode: 'room' as const, id: list[i - 1]!.id, title: list[i - 1]!.name, subtitle: 'Derslik' }
          : undefined,
      next:
        i >= 0 && i < list.length - 1
          ? { mode: 'room' as const, id: list[i + 1]!.id, title: list[i + 1]!.name, subtitle: 'Derslik' }
          : undefined,
    };
  }, [previewTarget, displayCtx, editor.ctx]);

  const cellMenuHandlers = useMemo((): TimetableCellMenuHandlers | undefined => {
    if (simulate) return undefined;
    const ctxRef = () => displayCtx ?? editor.ctx;
    const allEntries = () => ctxRef()?.entries ?? [];
    const previewCtx = () => {
      const c = ctxRef();
      if (!c) return undefined;
      return {
        entries: c.entries,
        workDays: c.period.work_days ?? [1, 2, 3, 4, 5],
        maxLesson: c.max_lesson,
      };
    };
    return {
      preview: previewCtx(),
      onEdit: setEditEntry,
      onLock: (id, locked) => void editor.toggleLock(id, locked),
      onDelete: (id) => void editor.removeEntry(id),
      onRemoveAssignmentSlots: (entry) => {
        if (!entry.assignment_id) return;
        const ids = allEntries()
          .filter((e) => e.assignment_id === entry.assignment_id)
          .map((e) => e.id);
        if (!ids.length) return;
        if (!window.confirm(`${ids.length} atama kartı kaldırılsın mı?`)) return;
        void editor.removeEntries(ids, `${ids.length} kart kaldırıldı`);
      },
      onClearSlots: (ids) => {
        if (!ids.length) return;
        if (!window.confirm(`${ids.length} kart silinsin mi?`)) return;
        void editor.removeEntries(ids);
      },
      onChangeRoom: (id, roomId) => void editor.setEntryRoom(id, roomId),
      onNavigateView: (mode, id) => {
        setView(mode);
        setFilterId(id);
      },
      onOpenPreview: setPreviewTarget,
      onFindClass: (entry) => {
        setView('class');
        setFilterId(entry.class_section);
      },
      onFindTeacher: (entry) => {
        if (!entry.user_id) return;
        setView('teacher');
        setFilterId(entry.user_id);
      },
      onFindRoom: (entry) => {
        if (!entry.room_id) return;
        setView('room');
        setFilterId(entry.room_id);
      },
      onMergeDoubles: async (entry) => {
        const c = ctxRef();
        if (!c) return;
        let partner = findConsecutivePartner(entry, c.entries);
        if (!partner) {
          const occupied = c.entries.some(
            (e) => e.day_of_week === entry.day_of_week && e.lesson_num === entry.lesson_num + 1,
          );
          if (occupied) {
            toast.error('Sonraki saat dolu');
            return;
          }
          if (!entry.assignment_id) {
            toast.error('Atama bağlantısı yok');
            return;
          }
          const row = c.unplaced.find((u) => u.assignment_id === entry.assignment_id);
          if (!row?.remaining_hours) {
            toast.error('Atamanın boş saati kalmadı');
            return;
          }
          try {
            await editor.placeUnplaced(entry.assignment_id, entry.day_of_week, entry.lesson_num + 1, {
              silent: true,
            });
          } catch {
            return;
          }
          partner = findConsecutivePartner(entry, editor.ctx?.entries ?? []) ?? null;
        }
        if (!partner) {
          toast.error('Çiftli oluşturulamadı');
          return;
        }
        await editor.toggleLock(entry.id, true);
        await editor.toggleLock(partner.id, true);
        toast.success('Çiftli blok (iki kart kilitli)');
      },
      onSplitDoubles: async (entry) => {
        const partner = findConsecutivePartner(entry, allEntries());
        if (!partner) {
          toast.error('Çiftli blok yok');
          return;
        }
        await editor.toggleLock(entry.id, false);
        await editor.toggleLock(partner.id, false);
        toast.success('Çiftli ayrıldı');
      },
      onOpenAssignments: (entry) => {
        const q = new URLSearchParams();
        q.set('section', entry.class_section);
        if (entry.user_id) q.set('teacher', entry.user_id);
        router.push(`/ders-dagit/studyo/atamalar?${q.toString()}`);
      },
      onOpenValidation: () => router.push('/ders-dagit/studyo/dogrulama'),
    };
  }, [simulate, displayCtx, editor, router]);

  const matrixRowMenuHandlers = useMemo((): TimetableMatrixRowMenuHandlers | undefined => {
    if (simulate) return undefined;
    const allEntries = () => (displayCtx ?? editor.ctx)?.entries ?? [];
    return {
      onFocusTeacher: (teacherId, label) => {
        if (!teacherId) {
          toast.message('Bu satırda bağlı öğretmen hesabı yok');
          return;
        }
        setView('teacher');
        setFilterId(teacherId);
        toast.success(`${label.trim() || 'Öğretmen'} görünümü`);
      },
      onFocusClash: (entryId, slotKey) => {
        focusClash(slotKey, entryId);
        toast.message('Çakışma vurgulandı');
      },
      onLockAll: async (ids, locked) => {
        if (!ids.length) return;
        const list = allEntries();
        let n = 0;
        for (const id of ids) {
          const e = list.find((x) => x.id === id);
          if (!e || !!e.is_locked === locked) continue;
          await editor.toggleLock(id, locked);
          n++;
        }
        toast.success(locked ? `${n} kart kilitlendi` : `${n} kilit açıldı`);
      },
      onClearAll: (ids) => {
        if (!ids.length) return;
        toast(`${ids.length} kart kaldırılsın mı?`, {
          action: {
            label: 'Kaldır',
            onClick: () => {
              void editor.removeEntries(ids).then(() => toast.success(`${ids.length} kart kaldırıldı`));
            },
          },
        });
      },
      onOpenAssignments: (teacherId) => {
        const q = new URLSearchParams();
        if (teacherId) q.set('teacher', teacherId);
        router.push(`/ders-dagit/studyo/atamalar?${q.toString()}`);
        toast.message('Atamalar açılıyor');
      },
    };
  }, [simulate, displayCtx, editor, router, focusClash]);

  const reloadAudit = useCallback(async () => {
    if (!token || !studio) return;
    setAudit(await apiFetch<AuditRow[]>(`/ders-dagit/studios/${studio.id}/audit-log?limit=30`, { token }));
  }, [token, studio]);

  useEffect(() => {
    if (!editor.busy && editor.programId) void reloadAudit();
  }, [editor.busy, editor.programId, reloadAudit]);

  const slotClosuresForCtx = useCallback(
    (c: NonNullable<typeof displayCtx>) =>
      buildSlotClosures(
        c.period.work_days ?? [1, 2, 3, 4, 5],
        c.max_lesson,
        c.grid,
        teacherUnavailable,
      ),
    [teacherUnavailable],
  );

  const executePoolPlace = useCallback(
    async (poolId: string, day: number, lesson: number) => {
      if (placementInFlight.current || editor.busy) return false;
      const c = displayCtx ?? editor.ctx;
      if (!c) return false;
      const parsed = parsePoolDragId(poolId);
      const row = findUnplacedPoolRow(c, poolId);
      if (!parsed || !row) {
        toast.error('Havuz kartı bulunamadı.');
        return false;
      }
      if (simulate) {
        toast.message('Deneme modunda havuzdan yerleştirme kaydedilmez');
        return false;
      }

      placementInFlight.current = true;
      setBusyLocal(true);
      try {
        await yieldToMain();
        const closures = slotClosuresForCtx(c);
        const direct = planPoolPlacement(poolId, day, lesson, c, closures);
        let placeDay = day;
        let placeLesson = lesson;
        let relocations: Array<{ entryId: string; day: number; lesson: number }> = [];

        if (direct.ok) {
          if (direct.relocations?.length) {
            relocations = direct.relocations;
          } else if (direct.relocateEntryId && direct.relocateTo) {
            relocations = [
              {
                entryId: direct.relocateEntryId,
                day: direct.relocateTo.day,
                lesson: direct.relocateTo.lesson,
              },
            ];
          }
          placeDay = direct.day;
          placeLesson = direct.lesson;
        } else {
          await yieldToMain();
          const chain = await planChainPoolPlaceDeep(
            poolId,
            day,
            lesson,
            c,
            closures,
            placementSettings.search_complexity,
            { onProgress: reportPlacementProgress },
          );
          clearPlacementProgress();
          if (chain.ok) {
            relocations = chain.relocations;
          } else {
            toast.error(chain.message || direct.message);
            return false;
          }
        }

        const chunkHours = row.chunk_hours ?? parsed.chunkHours;
        if (relocations.length) {
          const ok = await editor.applyMoves(relocations);
          if (!ok) return false;
        }
        await editor.placeUnplacedChunk(
          parsed.assignmentId,
          placeDay,
          placeLesson,
          chunkHours,
          {
            silent: true,
            classSection: row.class_section,
            removePoolId: poolId,
          },
        );
        const moved = relocations.length > 0;
        if (placeDay !== day || placeLesson !== lesson) {
          toast.success(`Uygun saat bulundu — ${placeLesson}. ders, gün ${placeDay}`);
        } else if (moved) {
          toast.success(
            relocations.length === 1
              ? 'Çakışan ders taşındı, yerleştirildi'
              : `${relocations.length} ders kaydırıldı, yerleştirildi`,
          );
        } else {
          toast.success(chunkHours > 1 ? `${chunkHours} saatlik blok yerleştirildi` : 'Yerleştirildi');
        }
        if (pickedPoolAssignmentId === poolId) {
          setPickedPoolAssignmentId(null);
          setDragSource(null);
        }
        return true;
      } catch {
        return false;
      } finally {
        clearPlacementProgress();
        placementInFlight.current = false;
        setBusyLocal(false);
      }
    },
    [
      displayCtx,
      editor.ctx,
      editor.busy,
      editor.applyMoves,
      editor.placeUnplacedChunk,
      pickedPoolAssignmentId,
      simulate,
      slotClosuresForCtx,
      placementSettings.search_complexity,
      reportPlacementProgress,
      clearPlacementProgress,
    ],
  );

  const placePickedPoolAt = useCallback(
    (day: number, lesson: number) => {
      if (!pickedPoolAssignmentId) return;
      void executePoolPlace(pickedPoolAssignmentId, day, lesson);
    },
    [pickedPoolAssignmentId, executePoolPlace],
  );

  const slotOccupants = useCallback(
    (c: EditorContext, entryId: string, day: number, lesson: number) =>
      c.entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson && e.id !== entryId),
    [],
  );

  const openCollisionDialog = useCallback(
    (entryId: string, day: number, lesson: number, occupants: EditorEntry[]) => {
      if (!occupants.length) return false;
      setCollision({ entryId, day, lesson, occupants });
      return true;
    },
    [],
  );

  const requestMoveAsync = useCallback(
    async (
      entryId: string,
      day: number,
      lesson: number,
      opts?: { silent?: boolean },
    ): Promise<boolean> => {
      const c = displayCtx ?? editor.ctx;
      if (!c) return false;
      const closures = slotClosuresForCtx(c);
      const dragging = c.entries.find((e) => e.id === entryId) ?? null;
      if (!dragging) return false;
      const occupants = slotOccupants(c, entryId, day, lesson);

      if (simulate) {
        if (placementSettings.conflict_mode === 'ask' && occupants.length > 0) {
          openCollisionDialog(entryId, day, lesson, occupants);
          return false;
        }
        if (occupants.length > 1) {
          openCollisionDialog(entryId, day, lesson, occupants);
          return false;
        }
        if (occupants.length === 1) {
          applyLocalMove(entryId, day, lesson, occupants[0]!.id);
          return true;
        }
        applyLocalMove(entryId, day, lesson);
        return true;
      }

      if (dragging.is_locked) {
        toast.error('Kilitli ders taşınamaz.');
        return false;
      }
      if (closureAt(closures, day, lesson)) {
        toast.error('Kapalı saat.');
        return false;
      }
      if (dragging.day_of_week === day && dragging.lesson_num === lesson) return true;

      if (placementSettings.conflict_mode === 'ask' && occupants.length > 0) {
        openCollisionDialog(entryId, day, lesson, occupants);
        return false;
      }

      const applyPlan = async (plan: {
        ok: true;
        relocations: Array<{ entryId: string; day: number; lesson: number }>;
      }) => {
        const moves = finalizeMovesForEntry(plan, entryId, day, lesson);
        const ok = await editor.applyMoves(moves, {
          primaryEntryId: entryId,
          target: { day, lesson },
          silent: opts?.silent,
        });
        if (ok && !opts?.silent) {
          toast.success(
            moves.length === 1 ? 'Taşındı' : `${moves.length} kart kaydırılarak yerleştirildi`,
          );
        }
        return ok;
      };

      if (placementInFlight.current || editor.busy) return false;
      placementInFlight.current = true;
      setBusyLocal(true);
      try {
        await yieldToMain();
        const block = sameDayBlockRun(dragging, c.entries, c.assignment_hints);
        const chain =
          block.length > 1
            ? await planBlockEntryMoveDeep(
                entryId,
                day,
                lesson,
                c,
                closures,
                placementSettings.search_complexity,
                { onProgress: reportPlacementProgress },
              )
            : await planChainEntryMoveDeep(
                entryId,
                day,
                lesson,
                c,
                closures,
                placementSettings.search_complexity,
                { onProgress: reportPlacementProgress },
              );
        clearPlacementProgress();
        if (chain.ok) {
          if (!opts?.silent && chain.explored > 50_000) {
            toast.message(`${formatExplored(chain.explored)} olasılıkta yer bulundu`);
          }
          return await applyPlan(chain);
        }

        if (canPlaceEntryAt(c.entries, entryId, day, lesson, closures, c.assignment_hints)) {
          const ok = await editor.applyMoves([{ entryId, day, lesson }], {
            primaryEntryId: entryId,
            target: { day, lesson },
            silent: opts?.silent,
          });
          if (ok && !opts?.silent) toast.success('Taşındı');
          return ok;
        }

        const smart = planSmartEntryMove(entryId, day, lesson, c, closures);
        if (smart.ok) return await applyPlan(smart);

        if (occupants.length > 0) {
          openCollisionDialog(entryId, day, lesson, occupants);
          return false;
        }

        const v = validateTimetableMove({
          entryId,
          day,
          lesson,
          entries: c.entries,
          closures,
          dragging,
          assignmentHints: c.assignment_hints,
        });
        toast.error(
          chain.message || smart.message || (!v.ok ? v.message : undefined) || 'Yerleştirilemedi',
        );
        return false;
      } finally {
        clearPlacementProgress();
        placementInFlight.current = false;
        setBusyLocal(false);
      }
    },
    [
      displayCtx,
      editor.ctx,
      editor.busy,
      editor.applyMoves,
      simulate,
      applyLocalMove,
      slotClosuresForCtx,
      slotOccupants,
      openCollisionDialog,
      placementSettings.conflict_mode,
      placementSettings.search_complexity,
      reportPlacementProgress,
      clearPlacementProgress,
      formatExplored,
    ],
  );

  const resolveCollisionClearAndPlace = useCallback(async () => {
    if (!collision) return;
    if (collision.occupants.some((o) => o.is_locked)) {
      toast.error('Kilitli ders silinemez.');
      return;
    }
    const removeIds = collision.occupants.map((o) => o.id);
    const { entryId, day, lesson } = collision;
    setCollision(null);
    if (simulate) {
      setDraftEntries((prev) => {
        const base = (prev ?? editor.ctx?.entries ?? []).filter((e) => !removeIds.includes(e.id));
        return base.map((e) =>
          e.id === entryId ? { ...e, day_of_week: day, lesson_num: lesson } : e,
        );
      });
      toast.success('Çakışanlar kaldırıldı, kart yerleştirildi');
      return;
    }
    await editor.removeEntries(removeIds, `${removeIds.length} çakışan havuza alındı`);
    const ok = await editor.applyMoves([{ entryId, day, lesson }], {
      primaryEntryId: entryId,
      target: { day, lesson },
    });
    if (ok) toast.success('Kart yerleştirildi');
  }, [collision, simulate, editor]);

  const resolveCollisionPlaceAnyway = useCallback(async () => {
    if (!collision) return;
    const { entryId, day, lesson } = collision;
    setCollision(null);
    if (simulate) {
      setDraftEntries((prev) => {
        const base = prev ?? editor.ctx?.entries ?? [];
        return base.map((e) =>
          e.id === entryId ? { ...e, day_of_week: day, lesson_num: lesson } : e,
        );
      });
      toast.message('Çelişkili yerleştirme (önizleme)');
      return;
    }
    const ok = await editor.applyMoves([{ entryId, day, lesson }], {
      primaryEntryId: entryId,
      target: { day, lesson },
      ignoreClash: true,
    });
    if (ok) toast.message('Kart yerleştirildi (çelişki var)');
  }, [collision, simulate, editor]);

  const requestMove = useCallback(
    (entryId: string, day: number, lesson: number) => {
      void requestMoveAsync(entryId, day, lesson);
    },
    [requestMoveAsync],
  );

  const emptySlotMenuHandlers = useMemo((): TimetableEmptySlotMenuHandlers | undefined => {
    if (simulate) return undefined;
    const c = displayCtx ?? editor.ctx;
    if (!c) return undefined;
    const preview = {
      entries: c.entries,
      workDays: c.period.work_days ?? [1, 2, 3, 4, 5],
      maxLesson: c.max_lesson,
    };
    return {
      preview,
      filterMode: effectiveFilter?.mode,
      filterId: effectiveFilter?.id,
      onPlaceAt: (day, lesson) => {
        if (pickedPoolAssignmentId) void executePoolPlace(pickedPoolAssignmentId, day, lesson);
        else if (pickedEntryId) requestMove(pickedEntryId, day, lesson);
        else toast.message('Önce havuzdan ders veya tablodan kart seçin');
      },
      onClearColumn: (day) => {
        const ids = entriesInGridDayColumn(c.entries, day, effectiveFilter).map((e) => e.id);
        if (!ids.length) return;
        if (!window.confirm(`${ids.length} kart silinsin mi? (gün sütunu)`)) return;
        void editor.removeEntries(ids);
      },
      onClearSlots: (ids) => {
        if (!ids.length) return;
        if (!window.confirm(`${ids.length} kart silinsin mi? (ders satırı)`)) return;
        void editor.removeEntries(ids);
      },
      onNavigateView: (mode, id) => {
        setView(mode);
        setFilterId(id);
      },
      onOpenPreview: setPreviewTarget,
      onOpenConstraints: () => {
        const sec = effectiveFilter?.mode === 'class' ? effectiveFilter.id : undefined;
        router.push(planlamaIliskileriUrl(sec ? { section: sec } : {}));
      },
    };
  }, [
    simulate,
    displayCtx,
    editor,
    effectiveFilter,
    pickedPoolAssignmentId,
    pickedEntryId,
    executePoolPlace,
    requestMove,
    router,
  ]);

  const gridCommon = (c: NonNullable<typeof displayCtx>) => ({
    entries: c.entries,
    workDays: c.period.work_days ?? [1, 2, 3, 4, 5],
    maxLesson: c.max_lesson,
    lessonSchedule: c.period.lesson_schedule ?? [],
    lessonScheduleWeekend: c.period.lesson_schedule_weekend,
    gridMeta: c.grid ?? EMPTY_GRID,
    teacherUnavailable,
    clashIds: simulate ? simClashIds : editor.clashIds,
    filter: effectiveFilter,
    matrixAxis: compareCtx ? undefined : matrixAxisForView(view, filterId, matrixAxis),
    displayMode: view === 'all' && !effectiveFilter ? ('all' as const) : undefined,
    teachers: c.teachers,
    classSections: c.class_sections,
    rooms: c.rooms,
    zoom,
    highlightSlotKey,
    compareLayout: !!compareCtx,
    compareEntryStatus: compareMaps?.entryById,
    compareSlotStatus: compareMaps?.slotByKey,
    stackMinByCell: compareStackMin,
    cellMenuHandlers: cellMenuHandlers
      ? {
          ...cellMenuHandlers,
          rooms: c.rooms,
          preview: cellMenuHandlers.preview ?? {
            entries: c.entries,
            workDays: c.period.work_days ?? [1, 2, 3, 4, 5],
            maxLesson: c.max_lesson,
          },
        }
      : undefined,
    rowMenuHandlers: matrixRowMenuHandlers,
    emptySlotMenuHandlers,
    onLockEntry: simulate ? undefined : (id: string, locked: boolean) => void editor.toggleLock(id, locked),
    onDeleteEntry: simulate ? undefined : (id: string) => void editor.removeEntry(id),
  });

  const onGridDragEnd = useCallback(
    (ev: DragEndEvent) => {
      setPoolDrag(null);
      setDragLabel(null);
      setDragSource(null);
      if (placementInFlight.current || editor.busy) return;
      const c = displayCtx ?? editor.ctx;
      if (!c) return;
      const over = ev.over ? String(ev.over.id) : '';
      const slotM = /^slot-(\d+)-(\d+)$/.exec(over);
      const matrixM = parseMatrixDropId(over);
      if (!slotM && !matrixM) {
        toast.error('Bırakmak için tablodaki bir saat hücresini hedefleyin.');
        return;
      }
      const day = slotM ? Number(slotM[1]) : matrixM!.day;
      const lesson = slotM ? Number(slotM[2]) : matrixM!.lesson;
      const active = String(ev.active.id);
      const axis = matrixAxisForView(view, filterId, matrixAxis);
      if (matrixM && axis) {
        if (active.startsWith('pool:') || active.startsWith('pool-')) {
          const u = findUnplacedPoolRow(c, active);
          if (
            u &&
            !poolRowMatches(matrixM.rowKey, axis, u.class_section, u.user_id ?? null)
          ) {
            toast.error('Bu satıra bu atama yerleştirilemez (şube/öğretmen uyuşmuyor).');
            return;
          }
        } else {
          const ent = c.entries.find((x) => x.id === active);
          if (ent && !entryMatchesMatrixRow(ent, matrixM.rowKey, axis)) {
            toast.error('Ders yalnızca kendi satırındaki hücreye taşınabilir.');
            return;
          }
        }
      }
      if (active.startsWith('pool:') || active.startsWith('pool-')) {
        void executePoolPlace(active, day, lesson);
        return;
      }
      requestMove(active, day, lesson);
    },
    [displayCtx, editor.ctx, editor.busy, executePoolPlace, requestMove, view, filterId, matrixAxis],
  );

  const editorBusy = editor.busy || busyLocal;
  if (!studio) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => {
        const id = String(e.active.id);
        if (id.startsWith('pool:') || id.startsWith('pool-')) {
          setPoolDrag(id);
          const u = editor.ctx ? findUnplacedPoolRow(editor.ctx, id) : undefined;
          const chunk = u?.chunk_hours ?? 1;
          setDragLabel(
            u
              ? `${u.class_section} · ${u.subject_name}${chunk > 1 ? ` (${chunk} saat)` : ''}`
              : 'Atama',
          );
          setDragSource(u ? { type: 'pool', classSection: u.class_section } : null);
          return;
        }
        const ent = editor.ctx?.entries.find((x) => x.id === id);
        if (ent) {
          const block = sameDayBlockRun(ent, editor.ctx?.entries ?? [], editor.ctx?.assignment_hints);
          const n = block.length;
          setDragLabel(
            n > 1 ? `${ent.class_section} · ${ent.subject} (${n} saat blok)` : `${ent.class_section} · ${ent.subject}`,
          );
          setDragSource({
            type: 'entry',
            entry: ent,
            blockIds: n > 1 ? block.map((b) => b.id) : undefined,
          });
        } else {
          setDragLabel(null);
        }
      }}
      onDragEnd={onGridDragEnd}
      onDragCancel={() => {
        setPoolDrag(null);
        setDragLabel(null);
        setDragSource(null);
        clearPoolSelection();
        setPickedEntryId(null);
      }}
    >
      <div className="space-y-4">
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Program tablosu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <DdSelectField
              label="Program"
              labelClassName="text-xs"
              className="min-w-[160px] flex-1 sm:min-w-[200px] sm:flex-none"
              value={editor.programId}
              onValueChange={(v) => {
                setFilterId(view === 'all' ? '' : FILTER_ALL);
                lastUrlProgramId.current = v;
                onProgramIdChange?.(v);
                void editor.load(v, { validation: true });
              }}
              options={programs.map((p) => ({
                value: p.id,
                label: `${p.name ?? p.id.slice(0, 8)} (${p.status})`,
              }))}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Görünüm</span>
              <div className="flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
                {(
                  [
                    ['all', 'Tümü'],
                    ['class', 'Sınıf'],
                    ['teacher', 'Öğretmen'],
                    ['room', 'Derslik'],
                  ] as const
                ).map(([v, label]) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={view === v ? 'default' : 'ghost'}
                    className={cn(
                      'h-7 px-2.5 text-xs',
                      poolPlacementView === v && pickedUnplaced && 'ring-2 ring-primary ring-offset-1',
                    )}
                    onClick={() => {
                      setView(v);
                      setFilterId(v === 'all' ? '' : FILTER_ALL);
                      if (v === 'all') setMatrixAxis('teacher');
                      else if (v === 'class' || v === 'teacher' || v === 'room') setMatrixAxis(v);
                      if (v !== poolPlacementView) clearPoolSelection();
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {view === 'all' && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Satırlar</span>
                <div className="flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
                  {(
                    [
                      ['teacher', 'Öğretmen'],
                      ['class', 'Sınıf'],
                      ['room', 'Derslik'],
                    ] as const
                  ).map(([v, label]) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={matrixAxis === v ? 'default' : 'ghost'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setMatrixAxis(v)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {view !== 'all' && (
              <DdSelectField
                label="Filtre"
                labelClassName={cn(
                  'text-xs',
                  poolPlacementView === view && pickedUnplaced && 'font-semibold text-primary',
                )}
                className={cn(
                  'min-w-[140px] flex-1 sm:flex-none',
                  poolPlacementView === view &&
                    pickedUnplaced &&
                    'rounded-lg ring-2 ring-primary/50 ring-offset-2',
                )}
                value={filterId}
                onValueChange={setFilterId}
                options={filterOptions.map((o) => ({ value: o.id, label: o.label }))}
              />
            )}
            <DdSelectField
              label="Karşılaştır"
              labelClassName="text-xs"
              className="min-w-[140px] flex-1 sm:flex-none"
              value={compareId}
              onValueChange={setCompareId}
              placeholder="—"
              options={[
                { value: '', label: '—' },
                ...programs
                  .filter((p) => p.id !== editor.programId)
                  .map((p) => ({ value: p.id, label: p.name ?? p.id.slice(0, 8) })),
              ]}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(75, z - 10))}>
              <ZoomOut className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{zoom}%</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(125, z + 10))}>
              <ZoomIn className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!editor.canUndo || editorBusy || simulate} onClick={() => void editor.undo()}>
              <Undo2 className="size-4" />
              Geri al
            </Button>
            <Button
              type="button"
              size="sm"
              variant={simulate ? 'default' : 'outline'}
              className="print:hidden"
              onClick={startSimulation}
            >
              {simulate ? 'Denemeyi kapat' : 'Dene'}
            </Button>
            <label className="flex items-center gap-1.5 text-xs print:hidden">
              <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
              Sorunlu sınıflar
            </label>
            <Button type="button" size="sm" variant="ghost" className="print:hidden" onClick={() => setShowShortcuts(true)}>
              ?
            </Button>
            <Button
              type="button"
              size="sm"
              variant={placementMode === 'click' ? 'default' : 'outline'}
              className="print:hidden"
              onClick={() => {
                setPlacementMode((m) => (m === 'drag' ? 'click' : 'drag'));
                setPickedEntryId(null);
                clearPoolSelection();
              }}
            >
              {placementMode === 'click' ? 'Tıkla-yerleştir' : 'Sürükle-bırak'}
            </Button>
            <TimetablePlacementSettingsMenu
              token={token}
              studioId={studio?.id}
              onChange={setPlacementSettings}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="print:hidden"
              onClick={() => {
                if (view === 'class' || view === 'teacher' || view === 'room') {
                  void openViewPdfPrint();
                  return;
                }
                applyDocumentPrintMode(loadReportPrintMode());
                window.print();
              }}
            >
              <Printer className="size-4" />
              Yazdır
            </Button>
            <ProgramManageBar
              programId={editor.programId}
              program={programs.find((p) => p.id === editor.programId) ?? null}
              onChanged={reloadPrograms}
            />
            {token && editor.programId && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => void downloadDersDagitExport(token, studio.id, editor.programId, 'pdf')}>
                  PDF
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void downloadDersDagitExport(token, studio.id, editor.programId, 'xlsx')}>
                  Excel
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <div className="print:hidden">
          <TimetableQuickLinks />
        </div>

        {editor.loading && !ctx ? (
          <LoadingSpinner label="Program yükleniyor…" />
        ) : ctx ? (
          <>
          <TimetableHealthStrip
            ctx={ctx}
            clashCount={simulate ? simClashIds.size : ctx.clashes.length}
            simulate={simulate}
            pendingMoves={simulate ? simPending.length : 0}
          />
          {simulate && simBaseline && draftEntries && (
            <TimetableSimulationBar
              pending={simPending}
              clashCount={simClashIds.size}
              busy={editorBusy}
              onApply={() => void applySimulation()}
              onDiscard={discardSimulation}
              onReset={resetSimulationDraft}
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <TimetableLegend compareActive={!!compareCtx} compareCounts={compareMaps?.counts} />
              {(effectiveDragSource && (placementMode === 'drag' || pickedUnplaced)) && (
                <p className="text-[10px] text-muted-foreground print:hidden">
                  {pickedUnplaced && placementMode === 'click'
                    ? 'Seçili ders için yeşil hücrelere tıklayın.'
                    : 'Hücre rengine göre bırakın: yeşil uygun, mavi takas, kırmızı çakışma, çizgili gri kapalı.'}
                </p>
              )}
            </div>
            {view !== 'all' && filterId && (
              <p className="text-xs text-muted-foreground">
                {view === 'class' && 'Sınıf'}
                {view === 'teacher' && 'Öğretmen'}
                {view === 'room' && 'Derslik'}
                : <strong className="text-foreground">{filterOptions.find((o) => o.id === filterId)?.label ?? filterId}</strong>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:flex-row">
            <div ref={gridWrapRef} className="timetable-print-wrap min-w-0 max-w-full flex-1 space-y-3 overflow-hidden">
              <TimetablePrintHeader
                schoolName={studio?.name}
                academicYear={studio?.academic_year}
                programName={programs.find((p) => p.id === editor.programId)?.name}
                viewLabel={
                  view === 'class'
                    ? 'Sınıf haftalık ders programı'
                    : view === 'teacher'
                      ? 'Öğretmen haftalık programı'
                      : view === 'room'
                        ? 'Derslik haftalık programı'
                        : 'Haftalık program'
                }
                entityLabel={
                  filterId && filterId !== FILTER_ALL
                    ? (filterOptions.find((o) => o.id === filterId)?.label ?? null)
                    : null
                }
              />
              {initialAutoPrint && view !== 'all' && filterId === FILTER_ALL && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 print:hidden dark:text-amber-100">
                  Yazdırma için bir şube / öğretmen / derslik seçin (filtre).
                </p>
              )}
              {matrixAxisForView(view, filterId, matrixAxis) && (
                <p className="rounded-md border border-border/80 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground print:hidden">
                  Matris görünümü: ders kartını veya alttaki havuzdan sürükleyip hedef hücreye bırakın. Tek şube düzenlemek için{' '}
                  <strong className="text-foreground">Sınıf</strong> görünümünde şube seçin.
                </p>
              )}
              <div className={cn('grid gap-3', compareCtx && !initialAutoPrint && 'lg:grid-cols-2')}>
                <div className="min-w-0">
                  {compareCtx && !initialAutoPrint && (
                    <p className="mb-1 text-xs font-semibold text-foreground">Aktif program</p>
                  )}
                  <TimetableGrid
                    key={`${editor.programId}-${view}-${matrixAxisForView(view, filterId, matrixAxis) ?? effectiveFilter?.id ?? 'one'}`}
                    embedded
                    {...gridCommon(ctx)}
                    editable
                    busy={editorBusy}
                    dragSource={effectiveDragSource}
                    placementMode={placementMode}
                    pickedEntryId={pickedEntryId}
                    onPickEntry={(id) => {
                      setPickedEntryId(id);
                      if (id) clearPoolSelection();
                    }}
                    onMove={requestMove}
                    onDropRejected={(msg) => toast.error(msg)}
                    onSlotClick={(d, l) => {
                      if (pickedPoolAssignmentId) {
                        placePickedPoolAt(d, l);
                        return;
                      }
                      if (pickedEntryId) {
                        requestMove(pickedEntryId, d, l);
                        setPickedEntryId(null);
                      }
                    }}
                    onEditEntry={setEditEntry}
                  />
                </div>
                {compareCtx && !initialAutoPrint && (
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Karşılaştırma</p>
                    <TimetableGrid
                      embedded
                      {...gridCommon(compareCtx)}
                      editable={false}
                      busy
                      teacherUnavailable={undefined}
                      onMove={() => {}}
                      onEditEntry={() => {}}
                    />
                  </div>
                )}
              </div>
              <TimetableUnplacedTray
                unplaced={ctx.unplaced}
                busy={editorBusy || simulate}
                selectedId={pickedPoolAssignmentId}
                onSelect={selectUnplacedLesson}
                onClearSelection={clearPoolSelection}
                actions={{
                  onFocusClass: (row) => {
                    setView('class');
                    setFilterId(row.class_section);
                    selectUnplacedLesson(row);
                  },
                  onFocusTeacher: (row) => {
                    if (!row.user_id) {
                      toast.error('Bu atamada öğretmen yok.');
                      return;
                    }
                    setView('teacher');
                    setFilterId(row.user_id);
                    selectUnplacedLesson(row);
                  },
                  onAutoPlace: (row) => {
                    const c = displayCtx ?? editor.ctx;
                    if (!c) return;
                    const slots = listOkPoolSlotsWithClosures(
                      c,
                      row.class_section,
                      row.user_id ?? null,
                      slotClosuresForCtx(c),
                    );
                    if (!slots[0]) {
                      toast.error('Uygun boş saat bulunamadı.');
                      return;
                    }
                    const s = slots[0]!;
                    void executePoolPlace(row.assignment_id, s.day, s.lesson);
                  },
                  onOpenAssignments: (row) => {
                    const q = new URLSearchParams();
                    q.set('section', row.class_section);
                    if (row.user_id) q.set('teacher', row.user_id);
                    router.push(`/ders-dagit/studyo/atamalar?${q.toString()}`);
                  },
                  onCopyInfo: (row) => {
                    const text = [
                      row.subject_name,
                      row.class_section,
                      row.teacher_label ?? 'Öğretmen yok',
                      `${row.remaining_hours} saat eksik`,
                    ].join(' · ');
                    void navigator.clipboard.writeText(text).then(
                      () => toast.success('Panoya kopyalandı'),
                      () => toast.error('Kopyalanamadı'),
                    );
                  },
                }}
              />
              <p className="text-[10px] text-muted-foreground print:hidden">
                Havuz: sürükle · tıkla · sağ tık menü · Ctrl+Z
              </p>
            </div>
            <div className="shrink-0 print:hidden">
              <TimetableSidebar
                hideUnplaced
                unplaced={ctx.unplaced}
                validation={editor.validation}
                clashes={ctx.clashes}
                entries={ctx.entries}
                fairness={ctx.fairness}
                audit={audit}
                program={ctx.program}
                studioId={studio?.id}
                busy={editorBusy}
                onFocusClash={focusClash}
              />
            </div>
          </div>
          <CollisionResolveDialog
            open={!!collision}
            moving={
              collision
                ? (displayCtx ?? editor.ctx)?.entries.find((e) => e.id === collision.entryId) ?? null
                : null
            }
            day={collision?.day ?? 1}
            lesson={collision?.lesson ?? 1}
            occupants={collision?.occupants ?? []}
            allowIgnoreClash={placementSettings.allow_ignore_clash}
            onClose={() => setCollision(null)}
            onClearConflictsAndPlace={() => void resolveCollisionClearAndPlace()}
            onSwapWith={(targetId) => {
              if (!collision) return;
              if (simulate) {
                applyLocalMove(collision.entryId, collision.day, collision.lesson, targetId);
              } else {
                void editor.moveEntry(collision.entryId, collision.day, collision.lesson, targetId);
              }
              setCollision(null);
            }}
            onPlaceAnyway={
              placementSettings.allow_ignore_clash
                ? () => void resolveCollisionPlaceAnyway()
                : undefined
            }
          />
          </>
        ) : null}

        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Kısayollar</DialogTitle>
            </DialogHeader>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Ctrl+Z — geri al</li>
              <li>? — bu liste</li>
              <li>Esc — deneme modundan vazgeç</li>
              <li>Dene — taşımaları önizle, Kaydet ile yaz</li>
              <li>Çift tık — ders saatini düzenle</li>
              <li>Sağ tık — kart / boş saat menüsü · görünüm önizlemesi</li>
            </ul>
          </DialogContent>
        </Dialog>

        <TimetablePreviewDialog
          open={!!previewTarget}
          onOpenChange={(o) => !o && setPreviewTarget(null)}
          target={previewTarget}
          entries={
            previewTarget
              ? filterEntriesForPreview(
                  (displayCtx ?? editor.ctx)?.entries ?? [],
                  previewTarget.mode,
                  previewTarget.id,
                )
              : []
          }
          workDays={(displayCtx ?? editor.ctx)?.period.work_days ?? [1, 2, 3, 4, 5]}
          maxLesson={(displayCtx ?? editor.ctx)?.max_lesson ?? 8}
          neighbors={previewNeighbors}
          onSelectNeighbor={setPreviewTarget}
          onOpenFullView={(t) => {
            setView(t.mode);
            setFilterId(t.id);
            setPreviewTarget(null);
          }}
        />

        <TimetableEntryEditDialog
          entry={editEntry}
          open={!!editEntry}
          assignment={editAssignment}
          assignmentLoading={editAssignmentLoading}
          rooms={ctx?.rooms ?? []}
          busy={editorBusy}
          hasClash={editEntry ? editor.clashIds.has(editEntry.id) : false}
          blockHint={
            editEntry?.assignment_id && ctx?.assignment_hints?.[editEntry.assignment_id]
              ? (() => {
                  const h = ctx.assignment_hints![editEntry.assignment_id!]!;
                  if (h.block_size < 2) return null;
                  return h.day_distribution?.length
                    ? `Haftalık ${h.day_distribution.join('+')}`
                    : `Blok ${h.block_size} saat`;
                })()
              : null
          }
          onClose={() => setEditEntry(null)}
          onDelete={async () => {
            if (!editEntry) return;
            await editor.removeEntry(editEntry.id);
            setEditEntry(null);
          }}
          onSave={async (data: TimetableEntryEditSave) => {
            if (!editEntry || !token || !studio) return;
            if (data.mode === 'release') {
              if (!editAssignment || !editEntry.assignment_id) {
                toast.error('Atama bulunamadı');
                return;
              }
              const body = assignmentUpsertBodyWithDistribution(editAssignment, data.day_distribution);
              if (data.roomId) body.room_ids = [data.roomId];
              try {
                await apiFetch(`/ders-dagit/studios/${studio.id}/assignments`, {
                  token,
                  method: 'POST',
                  body,
                });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Atama kaydedilemedi');
                return;
              }
              const ids = editor.entries
                .filter((e) => e.assignment_id === editEntry.assignment_id)
                .map((e) => e.id);
              if (ids.length) {
                await editor.removeEntries(ids, 'Dağılım güncellendi — dersler havuza alındı');
              } else {
                toast.success('Dağılım güncellendi');
              }
              if (editor.programId) await editor.reloadEditor(editor.programId);
              setEditEntry(null);
              return;
            }
            const { day, lesson, locked, roomId } = data;
            const moved = editEntry.day_of_week !== day || editEntry.lesson_num !== lesson;
            const roomChanged = (editEntry.room_id ?? '') !== roomId;
            const lockChanged = !!editEntry.is_locked !== locked;
            if (moved) {
              const ok = await requestMoveAsync(editEntry.id, day, lesson, { silent: true });
              if (!ok) return;
            }
            if (lockChanged) await editor.toggleLock(editEntry.id, locked);
            if (roomChanged) await editor.setEntryRoom(editEntry.id, roomId || null);
            setEditEntry(null);
            toast.success('Kart güncellendi');
          }}
        />
      </div>
      <DragOverlay>
        {dragLabel ? (
          <div className="rounded-md border bg-card px-2 py-1 text-xs shadow-lg">{dragLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
