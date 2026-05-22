'use client';

import { useMemo, useState } from 'react';
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
import { subjectColor } from '@/lib/timetable-colors';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import {
  buildForbiddenSlots,
  buildTimetableRows,
  maxLessonsOnDay,
  scheduleForDay,
  slotHighlightKey,
  type LongBreakDef,
} from '@/lib/timetable-grid-build';
import {
  computeSlotDropStatus,
  dayHeaderStatus,
  SLOT_STATUS_CELL,
  SLOT_STATUS_HEADER,
  type SlotDropStatus,
} from '@/lib/timetable-slot-status';
import { Lock, GripVertical } from 'lucide-react';
import { TimetableCellMenu } from './TimetableCellMenu';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

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

function CellChip({
  entry,
  editable,
  busy,
  hasClash,
  noRoom,
  highlighted,
  picked,
  placementMode,
  onEdit,
  onContextMenu,
  onPick,
}: {
  entry: EditorEntry;
  editable: boolean;
  busy: boolean;
  hasClash: boolean;
  noRoom: boolean;
  highlighted: boolean;
  picked: boolean;
  placementMode: 'drag' | 'click';
  onEdit: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPick: () => void;
}) {
  const colors = subjectColor(entry.subject);
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
      className={cn(
        'group relative mb-0.5 rounded-md border px-1.5 py-1 text-[10px] leading-tight shadow-sm transition-shadow',
        editable && !entry.is_locked && placementMode === 'drag' && 'cursor-grab touch-manipulation active:cursor-grabbing',
        placementMode === 'click' && editable && !entry.is_locked && 'cursor-pointer',
        isDragging && 'opacity-40',
        hasClash && 'ring-2 ring-destructive',
        highlighted && 'ring-2 ring-primary ring-offset-1',
        picked && 'ring-2 ring-sky-500 ring-offset-1',
        entry.is_locked && 'opacity-80',
      )}
      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
    >
      {hasClash && <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l bg-destructive" aria-hidden />}
      {noRoom && <span className="absolute right-0 top-0 bottom-0 w-1 rounded-r border border-border bg-white" aria-hidden />}
      {editable && !entry.is_locked && placementMode === 'drag' && (
        <GripVertical className="absolute left-0.5 top-0.5 size-3 opacity-40" aria-hidden />
      )}
      {entry.is_locked && <Lock className="absolute right-0.5 top-0.5 size-3 text-amber-700" />}
      <div className="font-semibold pl-3">{entry.class_section}</div>
      <div className="truncate pl-3">{entry.subject}</div>
      {entry.teacher_label && <div className="truncate pl-3 opacity-80">{entry.teacher_label}</div>}
      {entry.room_name && <div className="truncate pl-3 opacity-70">{entry.room_name}</div>}
    </div>
  );
}

function DropSlot({
  day,
  lesson,
  disabled,
  dropStatus,
  flash,
  placementMode,
  onSlotClick,
  children,
}: {
  day: number;
  lesson: number;
  disabled: boolean;
  dropStatus: SlotDropStatus | null;
  flash: boolean;
  placementMode: 'drag' | 'click';
  onSlotClick?: () => void;
  children: React.ReactNode;
}) {
  const forb = dropStatus === 'forbidden';
  const { isOver, setNodeRef } = useDroppable({
    id: slotId(day, lesson),
    disabled: disabled || forb,
  });
  return (
    <td
      ref={setNodeRef}
      data-slot-key={slotHighlightKey(day, lesson)}
      onClick={() => {
        if (placementMode === 'click' && onSlotClick && !disabled && !forb) onSlotClick();
      }}
      className={cn(
        'min-w-[5.5rem] border border-border p-0.5 align-top transition-colors',
        dropStatus && SLOT_STATUS_CELL[dropStatus],
        flash && 'animate-pulse ring-2 ring-primary ring-offset-1',
        placementMode === 'click' && !disabled && !forb && 'cursor-cell',
        !disabled && !forb && isOver && 'ring-2 ring-inset ring-primary/60',
      )}
    >
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
  embedded = false,
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
  embedded?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ entry: EditorEntry; x: number; y: number } | null>(null);
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];

  const draggingEntry =
    dragSource?.type === 'entry' ? dragSource.entry : activeId ? entries.find((e) => e.id === activeId) ?? null : null;
  const poolClassSection = dragSource?.type === 'pool' ? dragSource.classSection : null;

  const visible = useMemo(() => {
    if (!filter?.id) return entries;
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

  const forbiddenSlots = useMemo(
    () =>
      buildForbiddenSlots(
        days,
        maxLesson,
        gridMeta?.blocked_lesson_nums ?? [],
        teacherUnavailable,
      ),
    [days, maxLesson, gridMeta, teacherUnavailable],
  );

  const rows = useMemo(
    () =>
      buildTimetableRows(
        maxLesson,
        gridMeta?.blocked_lesson_nums ?? [],
        gridMeta?.long_breaks ?? [],
      ),
    [maxLesson, gridMeta],
  );

  const isDragging = !!(draggingEntry || poolClassSection);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const handleEnd = (ev: DragEndEvent) => {
    setActiveId(null);
    const slot = ev.over ? parseSlot(String(ev.over.id)) : null;
    if (!slot || busy) return;
    const entryId = String(ev.active.id);
    if (entryId.startsWith('pool-')) return;
    if (forbiddenSlots.has(`${slot.day}-${slot.lesson}`)) return;
    onMove(entryId, slot.day, slot.lesson);
  };

  const grid = (
    <div
      className="timetable-print-root overflow-auto rounded-lg border border-border bg-card"
      style={{ zoom: zoom / 100 }}
    >
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
          <tr>
            <th className="sticky left-0 z-20 border border-border bg-muted/95 p-2 text-left">Saat</th>
            {days.map((d) => {
              const hs = isDragging
                ? dayHeaderStatus(draggingEntry, poolClassSection, d, maxLesson, entries, forbiddenSlots)
                : null;
              return (
                <th
                  key={d}
                  className={cn(
                    'border border-border p-2 font-semibold transition-colors',
                    hs && SLOT_STATUS_HEADER[hs],
                  )}
                >
                  {DAY_LABELS[d - 1] ?? d}
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
                <td className="sticky left-0 z-10 border border-border bg-muted/40 p-2 font-medium whitespace-nowrap">
                  <div>{lesson}. ders</div>
                  {days[0] != null && (
                    <div className="text-[9px] font-normal text-muted-foreground">
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
                      <td key={day} className="border border-border bg-muted/30 p-1 text-center text-[9px] text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  const key = slotHighlightKey(day, lesson);
                  const forb = forbiddenSlots.has(key);
                  const cells = byKey.get(key) ?? [];
                  const dropStatus = isDragging
                    ? computeSlotDropStatus(draggingEntry, poolClassSection, day, lesson, entries, forbiddenSlots)
                    : null;
                  return (
                    <DropSlot
                      key={day}
                      day={day}
                      lesson={lesson}
                      disabled={!editable || busy}
                      dropStatus={forb ? 'forbidden' : dropStatus}
                      flash={highlightSlotKey === key}
                      placementMode={placementMode}
                      onSlotClick={
                        onSlotClick ? () => onSlotClick(day, lesson) : undefined
                      }
                    >
                      {forb && !cells.length ? (
                        <span className="block py-2 text-center text-[9px] text-muted-foreground">Kapalı</span>
                      ) : null}
                      {cells.map((c) => (
                        <CellChip
                          key={c.id}
                          entry={c}
                          editable={editable}
                          busy={busy}
                          hasClash={clashIds.has(c.id)}
                          noRoom={!c.room_id}
                          highlighted={highlightSlotKey === key}
                          picked={pickedEntryId === c.id}
                          placementMode={placementMode}
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
