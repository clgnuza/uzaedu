'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { entryCellColor, entryShortCode } from '@/lib/timetable-colors';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import {
  buildTimetableRows,
  cellSlotKey,
  maxLessonsOnDay,
  scheduleForDay,
  slotHighlightKey,
  type LongBreakDef,
} from '@/lib/timetable-grid-build';
import { buildSlotClosures, closureAt, type SlotClosure } from '@/lib/timetable-slot-closures';
import { dropStatusMessage, validateTimetableMove } from '@/lib/timetable-move-validation';
import {
  computeSlotDropStatus,
  dayHeaderStatus,
  SLOT_CLOSED_STATIC,
  SLOT_STATUS_BADGE,
  SLOT_STATUS_CELL,
  SLOT_STATUS_HEADER,
  type SlotDropStatus,
} from '@/lib/timetable-slot-status';
import { AlertTriangle, Ban, BookOpen, DoorOpen, GripVertical, Lock, User } from 'lucide-react';
import { TimetableCellMenu } from './TimetableCellMenu';
import { TimetableMatrixGrid, type MatrixAxis } from './TimetableMatrixGrid';
import type { CompareEntryStatus, SlotCompareKind } from '@/lib/timetable-compare';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LABELS_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const COMPARE_CHIP_CLASS: Record<CompareEntryStatus['kind'], string> = {
  same: '',
  modified: 'ring-1 ring-amber-500 bg-amber-50/95 dark:bg-amber-950/45',
  moved: 'ring-1 ring-dashed ring-orange-500 bg-orange-50/90 dark:bg-orange-950/40',
  added: 'ring-1 ring-sky-600 bg-sky-50/95 dark:bg-sky-950/45',
  removed: 'ring-1 ring-rose-600 bg-rose-50/95 dark:bg-rose-950/45',
};

const COMPARE_SLOT_CLASS: Record<SlotCompareKind, string> = {
  same: '',
  diff: 'bg-amber-50/25 dark:bg-amber-950/20 ring-1 ring-inset ring-amber-300/45',
  empty: '',
};

function slotId(day: number, lesson: number) {
  return `slot-${day}-${lesson}`;
}

function parseSlot(id: string) {
  const m = /^slot-(\d+)-(\d+)$/.exec(id);
  return m ? { day: Number(m[1]), lesson: Number(m[2]) } : null;
}

function lessonTime(
  schedule: Array<{ lesson_num: number; start_time: string; end_time: string }>,
  lesson: number,
): string | null {
  const row = schedule.find((s) => s.lesson_num === lesson);
  return row ? `${row.start_time}–${row.end_time}` : null;
}

function MetaLine({
  icon: Icon,
  accent,
  children,
}: {
  icon: typeof BookOpen;
  accent: string;
  children: ReactNode;
}) {
  const label = typeof children === 'string' ? children : undefined;
  return (
    <div className="flex min-w-0 items-center gap-1 text-[10px] leading-tight text-foreground/75" title={label}>
      <Icon className="size-2.5 shrink-0" style={{ color: accent }} aria-hidden />
      <span className="truncate">{children}</span>
    </div>
  );
}

/** Sürükle-bırak: kompakt ama okunaklı iki satırlı kart */
function CompactChipBody({
  entry,
  viewMode,
  colors,
}: {
  entry: EditorEntry;
  viewMode?: 'class' | 'teacher' | 'room' | 'all';
  colors: { border: string; text: string };
}) {
  const subLine = [entry.teacher_label, entry.room_name].filter(Boolean).join(' · ');

  if (viewMode === 'teacher') {
    return (
      <>
        <div className="flex min-w-0 items-center gap-1">
          <span
            className="shrink-0 rounded px-1 py-px text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: colors.border }}
          >
            {entry.class_section.replace(/\s+/g, '').slice(0, 5)}
          </span>
          <span className="min-w-0 truncate text-[10px] font-bold leading-tight" style={{ color: colors.text }}>
            {entry.subject}
          </span>
        </div>
        {entry.room_name ? (
          <p className="mt-0.5 truncate text-[9px] leading-tight opacity-75">{entry.room_name}</p>
        ) : null}
      </>
    );
  }

  if (viewMode === 'room') {
    return (
      <>
        <p className="truncate text-[10px] font-bold leading-tight" style={{ color: colors.text }}>
          {entry.class_section}
        </p>
        <p className="mt-0.5 truncate text-[9px] leading-tight opacity-75">{entry.subject}</p>
        {entry.teacher_label ? (
          <p className="truncate text-[9px] leading-tight opacity-65">{entry.teacher_label}</p>
        ) : null}
      </>
    );
  }

  if (viewMode === 'all' || !viewMode) {
    return (
      <>
        <p className="truncate text-[10px] font-bold leading-tight tracking-tight" style={{ color: colors.text }}>
          {entryShortCode(entry)}
        </p>
        <p className="mt-0.5 truncate text-[9px] leading-tight opacity-75">{entry.subject}</p>
      </>
    );
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-1">
        <BookOpen className="size-2.5 shrink-0" style={{ color: colors.border }} aria-hidden />
        <span className="min-w-0 truncate text-[10px] font-bold leading-tight" style={{ color: colors.text }}>
          {entry.subject}
        </span>
      </div>
      {subLine ? <p className="mt-0.5 truncate pl-3.5 text-[9px] leading-tight opacity-75">{subLine}</p> : null}
    </>
  );
}

/** Karşılaştırma: metin kırpılmadan iki satıra kadar */
function CompareChipBody({
  entry,
  viewMode,
  colors,
}: {
  entry: EditorEntry;
  viewMode?: 'class' | 'teacher' | 'room' | 'all';
  colors: { border: string; text: string };
}) {
  const subLine = [entry.teacher_label, entry.room_name].filter(Boolean).join(' · ');
  if (viewMode === 'teacher') {
    return (
      <>
        <p className="line-clamp-2 break-words text-[8px] font-bold leading-tight" style={{ color: colors.text }}>
          {entry.class_section}
        </p>
        <p className="line-clamp-2 break-words text-[7px] leading-tight opacity-80">{entry.subject}</p>
      </>
    );
  }
  if (viewMode === 'room') {
    return (
      <>
        <p className="line-clamp-2 break-words text-[8px] font-bold leading-tight" style={{ color: colors.text }}>
          {entry.class_section}
        </p>
        <p className="line-clamp-2 break-words text-[7px] leading-tight opacity-80">{entry.subject}</p>
      </>
    );
  }
  if (viewMode === 'all' || !viewMode) {
    return (
      <>
        <p className="line-clamp-1 break-words text-[8px] font-bold leading-tight" style={{ color: colors.text }}>
          {entryShortCode(entry)}
        </p>
        <p className="line-clamp-2 break-words text-[7px] leading-tight opacity-80">{entry.subject}</p>
      </>
    );
  }
  return (
    <>
      <p className="line-clamp-2 break-words text-[8px] font-bold leading-tight" style={{ color: colors.text }}>
        {entry.subject}
      </p>
      {subLine ? (
        <p className="line-clamp-2 break-words text-[7px] leading-tight opacity-75">{subLine}</p>
      ) : null}
    </>
  );
}

function ChipStatusIcons({
  entry,
  hasClash,
  noRoom,
  compact,
}: {
  entry: EditorEntry;
  hasClash: boolean;
  noRoom: boolean;
  compact?: boolean;
}) {
  const iconCls = compact ? 'size-2.5' : 'size-2.5';
  return (
    <div className={cn('flex shrink-0 items-center', compact ? 'gap-0.5' : 'flex-col gap-0.5')}>
      {hasClash && (
        <span className="rounded-full bg-destructive p-0.5 text-white shadow-sm" title="Çakışma">
          <AlertTriangle className={iconCls} aria-hidden />
        </span>
      )}
      {noRoom && (
        <span className="rounded-full bg-background/95 p-0.5 shadow-sm ring-1 ring-border/50" title="Derslik yok">
          <DoorOpen className={cn(iconCls, 'text-muted-foreground')} aria-hidden />
        </span>
      )}
      {entry.is_locked && (
        <span className="rounded-full bg-amber-100 p-0.5 shadow-sm ring-1 ring-amber-300/60" title="Kilitli">
          <Lock className={cn(iconCls, 'text-amber-800')} aria-hidden />
        </span>
      )}
    </div>
  );
}

function CellChip({
  entry,
  viewMode,
  editable,
  busy,
  hasClash,
  noRoom,
  highlighted,
  picked,
  placementMode,
  compareLayout,
  compareStatus,
  onEdit,
  onContextMenu,
  onPick,
}: {
  entry: EditorEntry;
  viewMode?: 'class' | 'teacher' | 'room' | 'all';
  editable: boolean;
  busy: boolean;
  hasClash: boolean;
  noRoom: boolean;
  highlighted: boolean;
  picked: boolean;
  placementMode: 'drag' | 'click';
  compareLayout?: boolean;
  compareStatus?: CompareEntryStatus;
  onEdit: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPick: () => void;
}) {
  const colors = entryCellColor(entry, viewMode);
  const compact = compareLayout || placementMode === 'drag';
  const chipTitle = [
    entry.subject,
    entry.class_section,
    entry.teacher_label,
    entry.room_name,
    compareStatus?.hint,
  ]
    .filter(Boolean)
    .join(' · ');
  const dragDisabled =
    !editable || busy || !!entry.is_locked || placementMode === 'click';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
    disabled: dragDisabled,
  });
  return (
    <div
      ref={setNodeRef}
      data-entry-id={entry.id}
      data-slot-key={slotHighlightKey(entry.day_of_week, entry.lesson_num)}
      {...(editable && !entry.is_locked && !busy && placementMode === 'drag'
        ? { ...attributes, ...listeners }
        : {})}
      onClick={(e) => {
        if (placementMode !== 'click' || !editable || busy || entry.is_locked) return;
        e.stopPropagation();
        onPick();
      }}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      title={chipTitle}
      className={cn(
        'group relative overflow-hidden border border-black/[0.08] text-left',
        compact ? 'mb-0.5 rounded-md shadow-sm' : 'mb-1.5 rounded-lg shadow-sm',
        'transition-[box-shadow,transform,opacity] duration-150',
        editable && !entry.is_locked && placementMode === 'drag' && 'cursor-grab touch-manipulation active:cursor-grabbing hover:shadow',
        placementMode === 'click' && editable && !entry.is_locked && 'cursor-pointer hover:-translate-y-px hover:shadow-md',
        isDragging && 'scale-[0.98] opacity-50 shadow-none',
        hasClash && (compact ? 'ring-1 ring-destructive' : 'ring-2 ring-destructive/75'),
        highlighted && (compact ? 'ring-1 ring-primary' : 'ring-2 ring-primary ring-offset-1'),
        picked && (compact ? 'ring-1 ring-sky-500' : 'ring-2 ring-sky-500 ring-offset-1'),
        entry.is_locked && 'opacity-95',
        compareStatus && COMPARE_CHIP_CLASS[compareStatus.kind],
      )}
      style={{
        borderLeftWidth: compact ? 3 : 4,
        borderLeftColor: colors.border,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {compact ? (
        <div className="flex min-w-0 items-start gap-0.5 px-1 py-0.5">
          <div className="min-w-0 flex-1">
            {compareLayout ? (
              <CompareChipBody entry={entry} viewMode={viewMode} colors={colors} />
            ) : (
              <CompactChipBody entry={entry} viewMode={viewMode} colors={colors} />
            )}
          </div>
          <ChipStatusIcons entry={entry} hasClash={hasClash} noRoom={noRoom} compact />
        </div>
      ) : (
        <>
          <div className="space-y-1 p-2 pr-6">
            {viewMode === 'class' && (
              <>
                <div className="flex min-w-0 items-center gap-1.5" title={entry.subject}>
                  <BookOpen className="size-3 shrink-0" style={{ color: colors.border }} aria-hidden />
                  <span className="truncate text-xs font-semibold leading-tight">{entry.subject}</span>
                </div>
                {entry.teacher_label && <MetaLine icon={User} accent={colors.border}>{entry.teacher_label}</MetaLine>}
                {entry.room_name && <MetaLine icon={DoorOpen} accent={colors.border}>{entry.room_name}</MetaLine>}
              </>
            )}
            {viewMode === 'teacher' && (
              <>
                <div className="flex min-w-0 items-center gap-1.5" title={entry.class_section}>
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold"
                    style={{ backgroundColor: colors.border, color: '#fff' }}
                  >
                    {entry.class_section.replace(/\s+/g, '').slice(0, 4)}
                  </span>
                  <span className="truncate text-xs font-semibold leading-tight">{entry.class_section}</span>
                </div>
                <MetaLine icon={BookOpen} accent={colors.border}>{entry.subject}</MetaLine>
                {entry.room_name && <MetaLine icon={DoorOpen} accent={colors.border}>{entry.room_name}</MetaLine>}
              </>
            )}
            {viewMode === 'room' && (
              <>
                <div className="min-w-0 truncate text-xs font-semibold leading-tight" title={`${entry.class_section} · ${entry.subject}`}>
                  <span>{entry.class_section}</span>
                  <span className="font-normal opacity-70"> · {entry.subject}</span>
                </div>
                {entry.teacher_label && <MetaLine icon={User} accent={colors.border}>{entry.teacher_label}</MetaLine>}
              </>
            )}
            {(viewMode === 'all' || !viewMode) && (
              <>
                <div className="truncate text-xs font-bold tracking-tight" title={entryShortCode(entry)}>
                  {entryShortCode(entry)}
                </div>
                <MetaLine icon={BookOpen} accent={colors.border}>{entry.subject}</MetaLine>
                {entry.teacher_label && <MetaLine icon={User} accent={colors.border}>{entry.teacher_label}</MetaLine>}
              </>
            )}
          </div>
          <div className="absolute right-1 top-1">
            <ChipStatusIcons entry={entry} hasClash={hasClash} noRoom={noRoom} />
            {editable && !entry.is_locked && placementMode === 'drag' && (
              <GripVertical
                className="mt-0.5 size-3 text-foreground/25 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DropSlot({
  day,
  lesson,
  disabled,
  closure,
  dropStatus,
  isDragging,
  flash,
  placementMode,
  onSlotClick,
  empty,
  compareLayout,
  compareSlotKind,
  stackMin,
  children,
}: {
  day: number;
  lesson: number;
  disabled: boolean;
  closure?: SlotClosure;
  dropStatus: SlotDropStatus | null;
  isDragging: boolean;
  flash: boolean;
  placementMode: 'drag' | 'click';
  onSlotClick?: () => void;
  empty?: boolean;
  compareLayout?: boolean;
  compareSlotKind?: SlotCompareKind;
  stackMin?: number;
  children: React.ReactNode;
}) {
  const isClosed = !!closure;
  const effectiveStatus: SlotDropStatus | null = isClosed ? 'forbidden' : dropStatus;
  const forb = effectiveStatus === 'forbidden';
  const { isOver, setNodeRef } = useDroppable({
    id: slotId(day, lesson),
    disabled: disabled || forb,
  });
  const hint =
    isDragging && effectiveStatus
      ? dropStatusMessage(effectiveStatus, closure)
      : closure?.label;

  const stackStyle =
    compareLayout && stackMin && stackMin > 1
      ? { minHeight: `${stackMin * 1.35 + 0.35}rem` }
      : undefined;

  return (
    <td
      ref={setNodeRef}
      data-slot-key={slotHighlightKey(day, lesson)}
      title={hint}
      style={stackStyle}
      onClick={() => {
        if (placementMode === 'click' && onSlotClick && !disabled && !forb) onSlotClick();
      }}
      className={cn(
        'relative border border-border align-top transition-colors',
        compareLayout
          ? 'min-w-[3.25rem] max-w-none p-px'
          : 'min-w-[4.5rem] max-w-[6rem] p-0.5',
        compareSlotKind && COMPARE_SLOT_CLASS[compareSlotKind],
        isClosed && !isDragging && SLOT_CLOSED_STATIC,
        isDragging && effectiveStatus && SLOT_STATUS_CELL[effectiveStatus],
        flash && 'animate-pulse ring-2 ring-primary ring-offset-1',
        placementMode === 'click' && !disabled && !forb && 'cursor-cell',
        !disabled && !forb && isOver && effectiveStatus === 'ok' && 'ring-2 ring-inset ring-emerald-500/70',
        !disabled && !forb && isOver && effectiveStatus === 'swap' && 'ring-2 ring-inset ring-sky-500/80',
        !disabled && forb && isOver && 'ring-2 ring-inset ring-zinc-500/50',
      )}
    >
      {isClosed && empty && (
        <div className="flex min-h-[2.25rem] flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center">
          <Ban className="size-3 text-zinc-500 dark:text-zinc-400" aria-hidden />
          <span className="text-[8px] font-semibold leading-tight text-zinc-600 dark:text-zinc-300">
            {closure.label.split('(')[0]?.trim() || 'Kapalı'}
          </span>
        </div>
      )}
      {isDragging && effectiveStatus && (effectiveStatus !== 'ok' || isOver) && (
        <span
          className={cn(
            'pointer-events-none absolute right-0.5 top-0.5 z-10 rounded px-1 py-px text-[7px] font-bold uppercase tracking-wide',
            effectiveStatus === 'ok' && 'bg-emerald-600 text-white',
            effectiveStatus === 'forbidden' && 'bg-zinc-600 text-white',
            effectiveStatus === 'occupied' && 'bg-red-600 text-white',
            effectiveStatus === 'swap' && 'bg-sky-600 text-white',
            effectiveStatus === 'same' && 'bg-primary text-primary-foreground',
          )}
        >
          {effectiveStatus === 'ok' && isOver ? 'Bırak' : SLOT_STATUS_BADGE[effectiveStatus]}
        </span>
      )}
      {children}
    </td>
  );
}

export type TimetableDragSource =
  | { type: 'entry'; entry: EditorEntry }
  | { type: 'pool'; classSection: string }
  | null;

export function TimetableGrid({
  entries,
  workDays,
  maxLesson,
  lessonSchedule,
  lessonScheduleWeekend,
  gridMeta,
  teacherUnavailable,
  editable = true,
  busy = false,
  clashIds,
  filter,
  displayMode,
  matrixAxis,
  teachers,
  classSections,
  rooms,
  zoom = 100,
  highlightSlotKey,
  dragSource = null,
  placementMode = 'drag',
  pickedEntryId = null,
  onPickEntry,
  onMove,
  onSlotClick,
  onEditEntry,
  onLockEntry,
  onDeleteEntry,
  onDropRejected,
  embedded = false,
  compareLayout = false,
  compareEntryStatus,
  compareSlotStatus,
  stackMinByCell,
}: {
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
  lessonSchedule: Array<{ lesson_num: number; start_time: string; end_time: string }>;
  lessonScheduleWeekend?: Array<{ lesson_num: number; start_time: string; end_time: string }> | null;
  gridMeta?: {
    blocked_lesson_nums: number[];
    long_breaks: LongBreakDef[];
    lessons_per_day_by_dow: Record<string, number>;
  };
  teacherUnavailable?: Array<{ day_of_week: number; lesson_num?: number }>;
  editable?: boolean;
  busy?: boolean;
  clashIds: Set<string>;
  filter?: { mode: 'class' | 'teacher' | 'room'; id: string };
  /** Filtre yokken (önizleme) hücre düzeni */
  displayMode?: 'class' | 'teacher' | 'room' | 'all';
  /** Tümü görünümü: satır ekseni (öğretmen / sınıf / derslik matrisi) */
  matrixAxis?: MatrixAxis;
  teachers?: Array<{ id: string; label: string }>;
  classSections?: string[];
  rooms?: Array<{ id: string; name: string }>;
  zoom?: number;
  highlightSlotKey?: string | null;
  dragSource?: TimetableDragSource;
  placementMode?: 'drag' | 'click';
  pickedEntryId?: string | null;
  onPickEntry?: (id: string | null) => void;
  onMove: (entryId: string, day: number, lesson: number) => void;
  onSlotClick?: (day: number, lesson: number) => void;
  onEditEntry: (entry: EditorEntry) => void;
  onLockEntry?: (entryId: string, locked: boolean) => void;
  onDeleteEntry?: (entryId: string) => void;
  /** Sürükle-bırak reddedildiğinde (toast vb.) */
  onDropRejected?: (message: string) => void;
  embedded?: boolean;
  /** Yan yana karşılaştırma: dar hücre, metin sığdırma, fark vurgusu */
  compareLayout?: boolean;
  compareEntryStatus?: Map<string, CompareEntryStatus>;
  compareSlotStatus?: Map<string, SlotCompareKind>;
  stackMinByCell?: Map<string, number>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ entry: EditorEntry; x: number; y: number } | null>(null);
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];

  const draggingEntry =
    dragSource?.type === 'entry' ? dragSource.entry : activeId ? entries.find((e) => e.id === activeId) ?? null : null;
  const poolClassSection = dragSource?.type === 'pool' ? dragSource.classSection : null;

  const visible = useMemo(() => {
    if (!filter) return entries;
    if (filter.mode === 'class') return entries.filter((e) => e.class_section === filter.id);
    if (filter.mode === 'teacher') return entries.filter((e) => e.user_id === filter.id);
    if (filter.id === '__none__') return entries.filter((e) => !e.room_id);
    return entries.filter((e) => e.room_id === filter.id);
  }, [entries, filter]);

  const byKey = useMemo(() => {
    const m = new Map<string, EditorEntry[]>();
    for (const e of visible) {
      const k = `${e.day_of_week}-${e.lesson_num}`;
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    }
    return m;
  }, [visible]);

  const slotClosures = useMemo(
    () => buildSlotClosures(days, maxLesson, gridMeta, teacherUnavailable),
    [days, maxLesson, gridMeta, teacherUnavailable],
  );
  const forbiddenSlots = useMemo(() => new Set(slotClosures.keys()), [slotClosures]);

  const rows = useMemo(
    () =>
      buildTimetableRows(maxLesson, gridMeta?.long_breaks ?? []),
    [maxLesson, gridMeta],
  );

  const isDragging = !!(draggingEntry || poolClassSection);
  const tableView = filter?.mode ?? displayMode ?? 'all';
  const chipView = tableView;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const handleEnd = (ev: DragEndEvent) => {
    setActiveId(null);
    const slot = ev.over ? parseSlot(String(ev.over.id)) : null;
    if (busy) return;
    if (!slot) {
      onDropRejected?.('Bırakmak için tablodaki bir saat hücresini hedefleyin.');
      return;
    }
    const entryId = String(ev.active.id);
    if (entryId.startsWith('pool-')) return;
    const dragEntry = entries.find((e) => e.id === entryId) ?? null;
    const v = validateTimetableMove({
      entryId,
      day: slot.day,
      lesson: slot.lesson,
      entries,
      closures: slotClosures,
      dragging: dragEntry,
    });
    if (!v.ok) {
      onDropRejected?.(v.message);
      return;
    }
    onMove(entryId, slot.day, slot.lesson);
  };

  if (!filter && matrixAxis) {
    return (
      <TimetableMatrixGrid
        entries={entries}
        workDays={workDays}
        maxLesson={maxLesson}
        axis={matrixAxis}
        teachers={teachers}
        classSections={classSections}
        rooms={rooms}
        clashIds={clashIds}
        zoom={zoom}
      />
    );
  }

  const grid = (
    <div
      className={cn(
        'timetable-print-root overflow-auto rounded-xl border bg-card shadow-sm',
        tableView === 'class' && 'border-slate-200',
        tableView === 'teacher' && 'border-violet-200',
        tableView === 'room' && 'border-emerald-200',
        tableView === 'all' && 'border-border',
      )}
      style={{ zoom: (compareLayout ? Math.min(zoom, 92) : zoom) / 100 }}
      data-timetable-view={tableView}
      data-compare-layout={compareLayout || undefined}
    >
      <table
        className={cn(
          'w-full border-collapse text-xs',
          compareLayout ? 'min-w-[400px]' : 'min-w-[560px]',
        )}
      >
        <thead
          className={cn(
            'sticky top-0 z-10 backdrop-blur-sm',
            tableView === 'class' && 'bg-slate-800 text-white',
            tableView === 'teacher' && 'bg-violet-900 text-white',
            tableView === 'room' && 'bg-emerald-900 text-white',
            tableView === 'all' && 'bg-muted/95 text-foreground',
          )}
        >
          <tr>
            <th
              className={cn(
                'sticky left-0 z-20 border p-1.5 text-left text-[10px] font-semibold',
                tableView === 'class' && 'border-slate-700 bg-slate-800',
                tableView === 'teacher' && 'border-violet-800 bg-violet-900',
                tableView === 'room' && 'border-emerald-800 bg-emerald-900',
                tableView === 'all' && 'border-border bg-muted/95',
              )}
            >
              Saat
            </th>
            {days.map((d) => {
              const hs = isDragging
                ? dayHeaderStatus(draggingEntry, poolClassSection, d, maxLesson, entries, forbiddenSlots)
                : null;
              return (
                <th
                  key={d}
                  className={cn(
                    'border p-1.5 text-[10px] font-semibold transition-colors',
                    tableView === 'class' && 'border-slate-700',
                    tableView === 'teacher' && 'border-violet-800',
                    tableView === 'room' && 'border-emerald-800',
                    tableView === 'all' && 'border-border',
                    hs && SLOT_STATUS_HEADER[hs],
                  )}
                >
                  {tableView === 'class' ? (DAY_LABELS_FULL[d - 1] ?? d) : (DAY_LABELS[d - 1] ?? d)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.kind === 'lunch') {
              return (
                <tr key={`lunch-${idx}`} className="bg-amber-50/50 dark:bg-amber-950/25">
                  <td className="sticky left-0 z-10 border border-border bg-amber-100/80 p-2 text-[10px] font-medium dark:bg-amber-950/50">
                    {row.label}
                  </td>
                  {days.map((day) => (
                    <td
                      key={day}
                      className="border border-border bg-amber-50/40 px-1 py-2 text-center text-[10px] font-medium text-amber-800 dark:text-amber-200"
                    >
                      Öğle
                    </td>
                  ))}
                </tr>
              );
            }
            const lesson = row.lessonNum;
            return (
              <tr key={`lesson-${lesson}`}>
                <td className="sticky left-0 z-10 border border-border bg-muted/40 p-1 font-medium whitespace-nowrap">
                  <div className="text-[10px]">{lesson}. ders</div>
                  {days[0] != null && (
                    <div className="text-[8px] font-normal text-muted-foreground">
                      {lessonTime(
                        scheduleForDay(days[0], lessonSchedule, lessonScheduleWeekend),
                        lesson,
                      ) ?? ''}
                    </div>
                  )}
                </td>
                {days.map((day) => {
                  const dayMax = maxLessonsOnDay(
                    day,
                    maxLesson,
                    gridMeta?.lessons_per_day_by_dow ?? {},
                  );
                  if (lesson > dayMax) {
                    return (
                      <td
                        key={day}
                        title="Bu gün için ders saati yok"
                        className={cn(
                          'border border-border p-1 text-center text-[9px] font-medium text-zinc-600 dark:text-zinc-300',
                          SLOT_CLOSED_STATIC,
                        )}
                      >
                        <Ban className="mx-auto mb-0.5 size-3 opacity-60" aria-hidden />
                        Kapalı
                      </td>
                    );
                  }
                  const cellKey = cellSlotKey(day, lesson);
                  const domKey = slotHighlightKey(day, lesson);
                  const closure = closureAt(slotClosures, day, lesson);
                  const cells = byKey.get(cellKey) ?? [];
                  const dropStatus = isDragging
                    ? computeSlotDropStatus(draggingEntry, poolClassSection, day, lesson, entries, forbiddenSlots)
                    : null;
                  return (
                    <DropSlot
                      key={day}
                      day={day}
                      lesson={lesson}
                      disabled={!editable || busy}
                      closure={closure}
                      dropStatus={dropStatus}
                      isDragging={isDragging}
                      empty={cells.length === 0}
                      flash={highlightSlotKey === domKey}
                      placementMode={placementMode}
                      compareLayout={compareLayout}
                      compareSlotKind={compareSlotStatus?.get(`${day}:${lesson}`)}
                      stackMin={stackMinByCell?.get(cellKey)}
                      onSlotClick={
                        onSlotClick ? () => onSlotClick(day, lesson) : undefined
                      }
                    >
                      {cells.map((c) => (
                        <CellChip
                          key={c.id}
                          entry={c}
                          viewMode={chipView}
                          editable={editable}
                          busy={busy}
                          hasClash={clashIds.has(c.id)}
                          noRoom={!c.room_id}
                          highlighted={highlightSlotKey === domKey}
                          picked={pickedEntryId === c.id}
                          placementMode={placementMode}
                          compareLayout={compareLayout}
                          compareStatus={compareEntryStatus?.get(c.id)}
                          onEdit={() => onEditEntry(c)}
                          onPick={() => onPickEntry?.(pickedEntryId === c.id ? null : c.id)}
                          onContextMenu={(e) => {
                            if (!editable) return;
                            e.preventDefault();
                            setMenu({ entry: c, x: e.clientX, y: e.clientY });
                          }}
                        />
                      ))}
                    </DropSlot>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {menu && onLockEntry && onDeleteEntry && (
        <TimetableCellMenu
          entry={menu.entry}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onEdit={() => {
            onEditEntry(menu.entry);
            setMenu(null);
          }}
          onLock={(locked) => {
            onLockEntry(menu.entry.id, locked);
            setMenu(null);
          }}
          onDelete={() => {
            onDeleteEntry(menu.entry.id);
            setMenu(null);
          }}
        />
      )}
    </div>
  );

  if (!editable) return grid;

  const overlayEntry = draggingEntry ?? (activeId ? entries.find((e) => e.id === activeId) : null);

  const overlay = (
    <DragOverlay>
      {overlayEntry ? (
        <div className="rounded-md border bg-card px-2 py-1 text-xs shadow-lg">
          {overlayEntry.class_section} · {overlayEntry.subject}
        </div>
      ) : poolClassSection ? (
        <div className="rounded-md border border-dashed border-primary px-2 py-1 text-xs shadow-lg">
          {poolClassSection}
        </div>
      ) : null}
    </DragOverlay>
  );

  if (embedded) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {grid}
      {overlay}
    </DndContext>
  );
}
