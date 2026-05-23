'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useTimetableEditor } from '@/hooks/use-timetable-editor';
import { TimetableGrid, type TimetableDragSource } from './TimetableGrid';
import { TimetableSidebar } from './TimetableSidebar';
import { CollisionResolveDialog } from './CollisionResolveDialog';
import { TimetableEntryEditDialog } from './TimetableEntryEditDialog';
import { TimetableUnplacedTray } from './TimetableUnplacedTray';
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
import { patchEntry } from '@/lib/ders-dagit-timetable-api';
import { slotHighlightKey } from '@/lib/timetable-grid-build';
import { buildTimetableCompare, maxStackedInCell } from '@/lib/timetable-compare';
import { buildSlotClosures } from '@/lib/timetable-slot-closures';
import { validatePoolPlace, validateTimetableMove } from '@/lib/timetable-move-validation';
import { clashAtSlot, clashEntryIds } from '@/lib/timetable-clash';
import {
  applySimulationDraft,
  buildClashesFromEntries,
  pendingSimulationMoves,
} from '@/lib/timetable-simulation';
import { toast } from 'sonner';
import { applyDocumentPrintMode } from '@/components/ders-dagit/ReportPrintSettings';
import { loadReportPrintMode } from '@/lib/ders-dagit-report-settings';
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
  const [poolDrag, setPoolDrag] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [highlightSlotKey, setHighlightSlotKey] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<'drag' | 'click'>('drag');
  const [pickedEntryId, setPickedEntryId] = useState<string | null>(null);
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
  const gridWrapRef = useRef<HTMLDivElement>(null);

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
      if (pick && pick !== cur) await editor.load(pick);
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
      if (e.key === 'Escape' && simulate) {
        discardSimulation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor.canUndo, editor.busy, editor.undo, simulate, discardSimulation]);

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
    const pid = initialProgramId ?? programs[0]?.id;
    if (pid && pid !== editor.programId) void editor.load(pid);
  }, [initialProgramId, programs, editor.programId, editor.load]);

  useEffect(() => {
    if (editor.programId) onProgramIdChange?.(editor.programId);
  }, [editor.programId, onProgramIdChange]);

  useEffect(() => {
    if (!token || !studio || !compareId) {
      setCompareCtx(null);
      return;
    }
    void import('@/lib/ders-dagit-timetable-api').then(({ fetchEditorContext }) =>
      fetchEditorContext(token, studio.id, compareId).then(setCompareCtx),
    );
  }, [token, studio, compareId]);

  const displayCtx = useMemo(() => {
    if (!editor.ctx) return null;
    if (!simulate || !draftEntries) return editor.ctx;
    const clashes = buildClashesFromEntries(draftEntries);
    return { ...editor.ctx, entries: draftEntries, clashes };
  }, [editor.ctx, simulate, draftEntries]);

  const ctx = displayCtx;

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
    if (!opts.length) {
      if (filterId) setFilterId('');
      return;
    }
    if (initialFilterId && opts.some((o) => o.id === initialFilterId)) {
      if (filterId !== initialFilterId) setFilterId(initialFilterId);
      return;
    }
    if (initialAutoPrint) {
      const concrete = opts.filter((o) => o.id !== FILTER_ALL);
      if (concrete.length && (!filterId || filterId === FILTER_ALL)) {
        setFilterId(concrete[0]!.id);
        return;
      }
    }
    if (!filterId || !opts.some((o) => o.id === filterId)) {
      setFilterId(FILTER_ALL);
    }
  }, [editor.programId, view, filterOptions, filterId, initialAutoPrint, initialFilterId]);

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
        const clash = clashAtSlot(base, entryId, day, lesson);
        if (clash) {
          toast.error(clash === 'CLASS_CLASH' ? 'Sınıf çakışması' : 'Öğretmen çakışması');
          return prev;
        }
        const occupant = base.find((e) => e.day_of_week === day && e.lesson_num === lesson && e.id !== entryId);
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
      await editor.load(editor.programId);
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
    onLockEntry: simulate ? undefined : (id: string, locked: boolean) => void editor.toggleLock(id, locked),
    onDeleteEntry: simulate ? undefined : (id: string) => void editor.removeEntry(id),
  });

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

  const requestMove = useCallback(
    (entryId: string, day: number, lesson: number) => {
      const c = displayCtx ?? editor.ctx;
      if (!c) return;
      const closures = slotClosuresForCtx(c);
      const dragging = c.entries.find((e) => e.id === entryId) ?? null;
      const v = validateTimetableMove({
        entryId,
        day,
        lesson,
        entries: c.entries,
        closures,
        dragging,
      });
      if (!v.ok) {
        toast.error(v.message);
        return;
      }
      const occupants = c.entries.filter(
        (e) => e.day_of_week === day && e.lesson_num === lesson && e.id !== entryId,
      );
      if (simulate) {
        if (occupants.length === 1) {
          applyLocalMove(entryId, day, lesson, occupants[0]!.id);
          return;
        }
        if (occupants.length > 1) {
          setCollision({ entryId, day, lesson, occupants });
          return;
        }
        applyLocalMove(entryId, day, lesson);
        return;
      }
      if (occupants.length > 1) {
        setCollision({ entryId, day, lesson, occupants });
        return;
      }
      void editor.moveEntry(entryId, day, lesson);
    },
    [displayCtx, editor.ctx, editor.moveEntry, simulate, applyLocalMove, slotClosuresForCtx],
  );

  const onGridDragEnd = useCallback(
    (ev: DragEndEvent) => {
      setPoolDrag(null);
      setDragLabel(null);
      setDragSource(null);
      const c = displayCtx ?? editor.ctx;
      if (!c) return;
      const over = ev.over ? String(ev.over.id) : '';
      const m = /^slot-(\d+)-(\d+)$/.exec(over);
      if (!m) {
        toast.error('Bırakmak için tablodaki bir saat hücresini hedefleyin.');
        return;
      }
      const day = Number(m[1]);
      const lesson = Number(m[2]);
      const active = String(ev.active.id);
      const closures = slotClosuresForCtx(c);
      if (active.startsWith('pool-')) {
        const assignmentId = active.slice(5);
        const unplaced = c.unplaced.find((u) => u.assignment_id === assignmentId);
        const section = unplaced?.class_section ?? '';
        const v = validatePoolPlace(assignmentId, day, lesson, c.entries, section, closures);
        if (!v.ok) {
          toast.error(v.message);
          return;
        }
        if (!simulate) void editor.placeUnplaced(assignmentId, day, lesson);
        else toast.message('Deneme modunda havuzdan yerleştirme kaydedilmez');
        return;
      }
      requestMove(active, day, lesson);
    },
    [displayCtx, editor.ctx, editor.placeUnplaced, requestMove, simulate, slotClosuresForCtx],
  );

  const editorBusy = editor.busy || busyLocal;
  if (!studio) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => {
        const id = String(e.active.id);
        if (id.startsWith('pool-')) {
          setPoolDrag(id);
          setDragLabel('Atama');
          const aid = id.slice(5);
          const u = editor.ctx?.unplaced.find((x) => x.assignment_id === aid);
          setDragSource(u ? { type: 'pool', classSection: u.class_section } : null);
          return;
        }
        const ent = editor.ctx?.entries.find((x) => x.id === id);
        setDragLabel(ent ? `${ent.class_section} · ${ent.subject}` : null);
        if (ent) setDragSource({ type: 'entry', entry: ent });
      }}
      onDragEnd={onGridDragEnd}
      onDragCancel={() => {
        setPoolDrag(null);
        setDragLabel(null);
        setDragSource(null);
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
                void editor.load(v);
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
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setView(v);
                      setFilterId(v === 'all' ? '' : FILTER_ALL);
                      if (v === 'all') setMatrixAxis('teacher');
                      else if (v === 'class' || v === 'teacher' || v === 'room') setMatrixAxis(v);
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
                labelClassName="text-xs"
                className="min-w-[140px] flex-1 sm:flex-none"
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
              }}
            >
              {placementMode === 'click' ? 'Tıkla-yerleştir' : 'Sürükle-bırak'}
            </Button>
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
              {dragSource && placementMode === 'drag' && (
                <p className="text-[10px] text-muted-foreground print:hidden">
                  Hücre rengine göre bırakın: yeşil uygun, mavi takas, kırmızı çakışma, çizgili gri kapalı. İmleci hücre üstünde tutunca açıklama görünür.
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
            <div ref={gridWrapRef} className="timetable-print-wrap min-w-0 flex-1 space-y-3">
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
                    dragSource={dragSource}
                    placementMode={placementMode}
                    pickedEntryId={pickedEntryId}
                    onPickEntry={setPickedEntryId}
                    onMove={requestMove}
                    onDropRejected={(msg) => toast.error(msg)}
                    onSlotClick={(d, l) => {
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
              <TimetableUnplacedTray unplaced={ctx.unplaced} busy={editorBusy || simulate} />
              <p className="text-[10px] text-muted-foreground print:hidden">
                Yeşil/mavi/kırmızı = sürüklerken hücre · sağ tık · çift tık · Ctrl+Z
                {placementMode === 'click' ? ' · kart seç → hücre tıkla' : ''}
              </p>
            </div>
            <div className="print:hidden">
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
            moving={collision ? editor.ctx?.entries.find((e) => e.id === collision.entryId) ?? null : null}
            occupants={collision?.occupants ?? []}
            onClose={() => setCollision(null)}
            onSwapWith={(targetId) => {
              if (!collision) return;
              if (simulate) {
                applyLocalMove(collision.entryId, collision.day, collision.lesson, targetId);
              } else {
                void editor.moveEntry(collision.entryId, collision.day, collision.lesson, targetId);
              }
              setCollision(null);
            }}
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
              <li>Sağ tık — kart menüsü</li>
            </ul>
          </DialogContent>
        </Dialog>

        <TimetableEntryEditDialog
          entry={editEntry}
          open={!!editEntry}
          rooms={ctx?.rooms ?? []}
          busy={editorBusy}
          onClose={() => setEditEntry(null)}
          onDelete={async () => {
            if (!editEntry) return;
            await editor.removeEntry(editEntry.id);
            setEditEntry(null);
          }}
          onSave={async ({ day, lesson, locked, roomId }) => {
            if (!editEntry || !token || !studio) return;
            const moved = editEntry.day_of_week !== day || editEntry.lesson_num !== lesson;
            const roomChanged = (editEntry.room_id ?? '') !== roomId;
            const lockChanged = !!editEntry.is_locked !== locked;
            if (moved) await editor.moveEntry(editEntry.id, day, lesson);
            if (lockChanged) await editor.toggleLock(editEntry.id, locked);
            if (roomChanged) {
              await patchEntry(token, studio.id, editor.programId, editEntry.id, {
                room_id: roomId || null,
              });
              await editor.load(editor.programId);
            }
            setEditEntry(null);
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
