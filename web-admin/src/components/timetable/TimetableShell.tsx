'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useTimetableEditor } from '@/hooks/use-timetable-editor';
import { TimetableGrid, type TimetableDragSource } from './TimetableGrid';
import { TimetableSidebar } from './TimetableSidebar';
import { CollisionResolveDialog } from './CollisionResolveDialog';
import { TimetableUnplacedTray } from './TimetableUnplacedTray';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSelect, DdSelectField } from '@/components/ders-dagit/dd-select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiFetch } from '@/lib/api';
import { listStudioPrograms, type DdProgramRow } from '@/lib/ders-dagit-program-api';
import { ProgramManageBar } from './ProgramManageBar';
import { downloadDersDagitExport } from '@/lib/ders-dagit-api';
import { cn } from '@/lib/utils';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { Undo2, ZoomIn, ZoomOut, Printer } from 'lucide-react';
import { DndContext, DragOverlay, pointerWithin, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { TimetableLegend } from './TimetableLegend';
import { TimetableQuickLinks } from './TimetableQuickLinks';
import { TimetableHealthStrip } from './TimetableHealthStrip';
import { patchEntry } from '@/lib/ders-dagit-timetable-api';
import { buildForbiddenSlots, slotHighlightKey } from '@/lib/timetable-grid-build';
import { clashAtSlot, clashEntryIds } from '@/lib/timetable-clash';
import { toast } from 'sonner';
import './timetable-print.css';

type ProgramRow = DdProgramRow;
type AuditRow = { id: string; action: string; user_label: string | null; created_at: string };

const EMPTY_GRID = {
  blocked_lesson_nums: [] as number[],
  long_breaks: [] as Array<{ after_lesson: number; label?: string }>,
  lessons_per_day_by_dow: {} as Record<string, number>,
};

type ViewMode = 'class' | 'teacher' | 'room' | 'all';

export function TimetableShell({
  initialProgramId,
  compareProgramId,
  initialView,
  onProgramIdChange,
}: {
  initialProgramId?: string;
  compareProgramId?: string;
  initialView?: ViewMode;
  onProgramIdChange?: (id: string) => void;
}) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const editor = useTimetableEditor(token, studio?.id ?? null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [view, setView] = useState<ViewMode>(initialView ?? 'class');
  const [filterId, setFilterId] = useState('');
  const [zoom, setZoom] = useState(100);
  const [compareId, setCompareId] = useState(compareProgramId ?? '');
  const [compareCtx, setCompareCtx] = useState<typeof editor.ctx>(null);
  const [editEntry, setEditEntry] = useState<EditorEntry | null>(null);
  const [editDay, setEditDay] = useState(1);
  const [editLesson, setEditLesson] = useState(1);
  const [editLock, setEditLock] = useState(false);
  const [editRoomId, setEditRoomId] = useState('');
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
        setSimulate(false);
        setDraftEntries(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor.canUndo, editor.busy, editor.undo, simulate]);

  useEffect(() => {
    if (simulate && editor.ctx) setDraftEntries([...editor.ctx.entries]);
    else setDraftEntries(null);
  }, [simulate, editor.programId]);

  useEffect(() => {
    const pid = initialProgramId ?? programs[0]?.id;
    if (pid && pid !== editor.programId) void editor.load(pid);
  }, [initialProgramId, programs, editor.programId, editor.load]);

  useEffect(() => {
    if (editor.programId) onProgramIdChange?.(editor.programId);
  }, [editor.programId, onProgramIdChange]);

  useEffect(() => {
    if (editor.programId && !filterId) {
      const first = editor.ctx?.class_sections[0];
      if (first) setFilterId(first);
    }
  }, [editor.programId, editor.ctx, filterId]);

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
    return { ...editor.ctx, entries: draftEntries };
  }, [editor.ctx, simulate, draftEntries]);

  const simClashIds = useMemo(
    () => (draftEntries ? clashEntryIds(draftEntries) : editor.clashIds),
    [draftEntries, editor.clashIds],
  );

  const filter = useMemo(() => {
    if (view === 'all' || !filterId) return undefined;
    return { mode: view, id: filterId } as const;
  }, [view, filterId]);

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

  const filterOptions = useMemo(() => {
    if (!editor.ctx) return [];
    if (view === 'class') return editor.ctx.class_sections.map((s) => ({ id: s, label: s }));
    if (view === 'teacher') return editor.ctx.teachers.map((t) => ({ id: t.id, label: t.label }));
    const roomOpts = editor.ctx.rooms.map((r) => ({ id: r.id, label: r.name }));
    if (editor.ctx.entries.some((e) => !e.room_id)) {
      roomOpts.unshift({ id: '__none__', label: '(Derslik yok)' });
    }
    return roomOpts;
  }, [editor.ctx, view]);

  const teacherUnavailable = useMemo(() => {
    if (!editor.ctx || view !== 'teacher' || !filterId) return undefined;
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
    if (!draftEntries || !editor.ctx) return;
    const orig = editor.ctx.entries;
    setBusyLocal(true);
    try {
      for (const d of draftEntries) {
        const o = orig.find((e) => e.id === d.id);
        if (o && (o.day_of_week !== d.day_of_week || o.lesson_num !== d.lesson_num)) {
          await editor.moveEntry(d.id, d.day_of_week, d.lesson_num);
        }
      }
      setSimulate(false);
      setDraftEntries(null);
      toast.success('Simülasyon uygulandı');
    } finally {
      setBusyLocal(false);
    }
  }, [draftEntries, editor]);

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
    zoom,
    highlightSlotKey,
    onLockEntry: simulate ? undefined : (id: string, locked: boolean) => void editor.toggleLock(id, locked),
    onDeleteEntry: simulate ? undefined : (id: string) => void editor.removeEntry(id),
  });

  useEffect(() => {
    const first = filterOptions[0]?.id;
    if (first && view !== 'all') setFilterId(first);
  }, [view, filterOptions]);

  const reloadAudit = useCallback(async () => {
    if (!token || !studio) return;
    setAudit(await apiFetch<AuditRow[]>(`/ders-dagit/studios/${studio.id}/audit-log?limit=30`, { token }));
  }, [token, studio]);

  useEffect(() => {
    if (!editor.busy && editor.programId) void reloadAudit();
  }, [editor.busy, editor.programId, reloadAudit]);

  const requestMove = useCallback(
    (entryId: string, day: number, lesson: number) => {
      const c = displayCtx ?? editor.ctx;
      if (!c) return;
      const forb = buildForbiddenSlots(
        c.period.work_days ?? [1, 2, 3, 4, 5],
        c.max_lesson,
        teacherUnavailable,
      );
      if (forb.has(`${day}-${lesson}`)) {
        toast.error('Bu saat kapalı veya uygun değil.');
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
    [displayCtx, editor.ctx, editor.moveEntry, teacherUnavailable, simulate, applyLocalMove],
  );

  const onGridDragEnd = useCallback(
    (ev: DragEndEvent) => {
      setPoolDrag(null);
      setDragLabel(null);
      setDragSource(null);
      const over = ev.over ? String(ev.over.id) : '';
      const m = /^slot-(\d+)-(\d+)$/.exec(over);
      if (!m) return;
      const day = Number(m[1]);
      const lesson = Number(m[2]);
      const active = String(ev.active.id);
      if (active.startsWith('pool-')) {
        const c = editor.ctx;
        if (c) {
          const occ = c.entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
          if (occ.length > 1) {
            toast.error('Saat dolu — önce bir dersi taşıyın veya takas seçin.');
            return;
          }
        }
        if (!simulate) void editor.placeUnplaced(active.slice(5), day, lesson);
        return;
      }
      requestMove(active, day, lesson);
    },
    [editor.placeUnplaced, editor.ctx, requestMove, simulate],
  );

  const ctx = displayCtx;
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Program tablosu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <DdSelectField
              label="Program"
              labelClassName="text-xs"
              className="min-w-[160px] flex-1 sm:min-w-[200px] sm:flex-none"
              value={editor.programId}
              onValueChange={(v) => void editor.load(v)}
              options={programs.map((p) => ({
                value: p.id,
                label: `${p.name ?? p.id.slice(0, 8)} (${p.status})`,
              }))}
            />
            <DdSelectField
              label="Görünüm"
              labelClassName="text-xs"
              className="min-w-[120px]"
              value={view}
              onValueChange={(v) => setView(v as ViewMode)}
              options={[
                { value: 'class', label: 'Sınıf' },
                { value: 'teacher', label: 'Öğretmen' },
                { value: 'room', label: 'Derslik' },
                { value: 'all', label: 'Tümü' },
              ]}
            />
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
              onClick={() => setSimulate((s) => !s)}
            >
              {simulate ? 'Simülasyon açık' : 'Simülasyon'}
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
            <Button type="button" size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
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
        <TimetableQuickLinks />

        {editor.loading && !ctx ? (
          <LoadingSpinner label="Program yükleniyor…" />
        ) : ctx ? (
          <>
          <TimetableHealthStrip ctx={ctx} clashCount={simulate ? simClashIds.size : ctx.clashes.length} simulate={simulate} />
          {simulate && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button type="button" size="sm" onClick={() => void applySimulation()} disabled={editorBusy}>
                Değişiklikleri uygula
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSimulate(false);
                  setDraftEntries(null);
                }}
              >
                İptal (Esc)
              </Button>
            </div>
          )}
          <TimetableLegend />
          <div className="flex flex-col gap-4 lg:flex-row">
            <div ref={gridWrapRef} className="min-w-0 flex-1 space-y-3">
              <div className={cn('grid gap-3', compareCtx && 'lg:grid-cols-2')}>
                <div className="min-w-0">
                  {compareCtx && (
                    <p className="mb-1 text-xs font-semibold text-foreground">Aktif program</p>
                  )}
                  <TimetableGrid
                    embedded
                    {...gridCommon(ctx)}
                    editable
                    busy={editorBusy}
                    dragSource={dragSource}
                    placementMode={placementMode}
                    pickedEntryId={pickedEntryId}
                    onPickEntry={setPickedEntryId}
                    onMove={requestMove}
                    onSlotClick={(d, l) => {
                      if (pickedEntryId) {
                        requestMove(pickedEntryId, d, l);
                        setPickedEntryId(null);
                      }
                    }}
                    onEditEntry={(e) => {
                      setEditEntry(e);
                      setEditDay(e.day_of_week);
                      setEditLesson(e.lesson_num);
                      setEditLock(!!e.is_locked);
                      setEditRoomId(e.room_id ?? '');
                    }}
                  />
                </div>
                {compareCtx && (
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
            <TimetableSidebar
              hideUnplaced
              unplaced={ctx.unplaced}
              validation={editor.validation}
              clashes={ctx.clashes}
              entries={ctx.entries}
              fairness={ctx.fairness}
              audit={audit}
              busy={editorBusy}
              onFocusClash={focusClash}
            />
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
              <li>Esc — simülasyonu iptal</li>
              <li>Çift tık — ders saatini düzenle</li>
              <li>Sağ tık — kart menüsü</li>
            </ul>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ders saatini düzenle</DialogTitle>
            </DialogHeader>
            {editEntry && (
              <div className="space-y-3 text-sm">
                <p>
                  {editEntry.class_section} · {editEntry.subject}
                </p>
                <div className="flex gap-2">
                  <div>
                    <Label>Gün</Label>
                    <Input type="number" min={1} max={7} value={editDay} onChange={(e) => setEditDay(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Saat</Label>
                    <Input type="number" min={1} value={editLesson} onChange={(e) => setEditLesson(Number(e.target.value))} />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editLock} onChange={(e) => setEditLock(e.target.checked)} />
                  Kilitli
                </label>
                {ctx && ctx.rooms.length > 0 && (
                  <DdSelectField
                    label="Derslik"
                    labelClassName="text-xs"
                    value={editRoomId}
                    onValueChange={setEditRoomId}
                    placeholder="—"
                    options={[
                      { value: '', label: '—' },
                      ...ctx.rooms.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                  />
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              {editEntry && (
                <>
                  <Button type="button" variant="destructive" size="sm" onClick={() => void editor.removeEntry(editEntry.id).then(() => setEditEntry(null))}>
                    Sil
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      if (!editEntry || !token || !studio) return;
                      const moved =
                        editEntry.day_of_week !== editDay || editEntry.lesson_num !== editLesson;
                      const roomChanged = (editEntry.room_id ?? '') !== editRoomId;
                      const lockChanged = !!editEntry.is_locked !== editLock;
                      if (moved) await editor.moveEntry(editEntry.id, editDay, editLesson);
                      if (lockChanged) await editor.toggleLock(editEntry.id, editLock);
                      if (roomChanged) {
                        await patchEntry(token, studio.id, editor.programId, editEntry.id, {
                          room_id: editRoomId || null,
                        });
                        await editor.load(editor.programId);
                      }
                      setEditEntry(null);
                    }}
                  >
                    Kaydet
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <DragOverlay>
        {dragLabel ? (
          <div className="rounded-md border bg-card px-2 py-1 text-xs shadow-lg">{dragLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
