import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

/** aSc benzeri hücre durumu */
export type SlotDropStatus = 'ok' | 'forbidden' | 'occupied' | 'swap' | 'same';

export const SLOT_STATUS_CELL: Record<SlotDropStatus, string> = {
  ok: 'bg-emerald-50/80 dark:bg-emerald-950/30',
  forbidden: 'bg-muted/70',
  occupied: 'bg-red-50/90 dark:bg-red-950/40',
  swap: 'bg-sky-50/90 dark:bg-sky-950/35 ring-1 ring-inset ring-sky-400/50',
  same: 'bg-primary/10',
};

export const SLOT_STATUS_HEADER: Record<SlotDropStatus, string> = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  forbidden: 'text-muted-foreground',
  occupied: 'text-red-700 dark:text-red-300',
  swap: 'text-sky-700 dark:text-sky-300',
  same: 'text-primary',
};

export function computeSlotDropStatus(
  dragging: EditorEntry | null,
  poolClassSection: string | null,
  day: number,
  lesson: number,
  entries: EditorEntry[],
  forbidden: Set<string>,
): SlotDropStatus {
  const key = `${day}-${lesson}`;
  if (forbidden.has(key)) return 'forbidden';
  if (!dragging && !poolClassSection) return 'ok';

  if (dragging && dragging.day_of_week === day && dragging.lesson_num === lesson) {
    return 'same';
  }

  const atSlot = entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
  const others = dragging ? atSlot.filter((e) => e.id !== dragging.id) : atSlot;

  if (dragging) {
    for (const o of others) {
      if (o.class_section === dragging.class_section) return 'occupied';
      if (dragging.user_id && o.user_id === dragging.user_id) return 'occupied';
    }
    if (others.length > 0) return 'swap';
    return 'ok';
  }

  if (poolClassSection && others.some((o) => o.class_section === poolClassSection)) {
    return 'occupied';
  }
  if (others.length > 0) return 'swap';
  return 'ok';
}

/** Sütun başlığı: o günün tüm slotlarında en kötü durum */
export function dayHeaderStatus(
  dragging: EditorEntry | null,
  poolClassSection: string | null,
  day: number,
  maxLesson: number,
  entries: EditorEntry[],
  forbidden: Set<string>,
): SlotDropStatus {
  if (!dragging && !poolClassSection) return 'ok';
  const order: SlotDropStatus[] = ['forbidden', 'occupied', 'swap', 'ok', 'same'];
  let worst: SlotDropStatus = 'ok';
  for (let lesson = 1; lesson <= maxLesson; lesson++) {
    const s = computeSlotDropStatus(dragging, poolClassSection, day, lesson, entries, forbidden);
    if (order.indexOf(s) < order.indexOf(worst)) worst = s;
  }
  return worst;
}
