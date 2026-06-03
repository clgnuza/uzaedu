import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

/** Program hücresi durumu */
export type SlotDropStatus = 'ok' | 'forbidden' | 'occupied' | 'swap' | 'same';

/** Statik kapalı hücre (sürükleme yokken) */
export const SLOT_CLOSED_STATIC =
  'bg-zinc-200/70 dark:bg-zinc-800/60 ring-1 ring-inset ring-zinc-400/35 dark:ring-zinc-600/50 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.04)_5px,rgba(0,0,0,0.04)_10px)] dark:[background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.04)_5px,rgba(255,255,255,0.04)_10px)]';

export const SLOT_STATUS_CELL: Record<SlotDropStatus, string> = {
  ok: 'bg-emerald-50/90 dark:bg-emerald-950/40 ring-1 ring-inset ring-emerald-400/40',
  forbidden:
    'bg-zinc-300/50 dark:bg-zinc-700/55 ring-2 ring-inset ring-zinc-500/45 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(0,0,0,0.07)_4px,rgba(0,0,0,0.07)_8px)]',
  occupied: 'bg-red-100/95 dark:bg-red-950/50 ring-2 ring-inset ring-red-400/55',
  swap: 'bg-sky-100/95 dark:bg-sky-950/45 ring-2 ring-inset ring-sky-500/55',
  same: 'bg-primary/15 ring-1 ring-inset ring-primary/40',
};

export const SLOT_STATUS_HEADER: Record<SlotDropStatus, string> = {
  ok: 'text-emerald-800 dark:text-emerald-200',
  forbidden: 'text-zinc-600 dark:text-zinc-300',
  occupied: 'text-red-800 dark:text-red-200',
  swap: 'text-sky-800 dark:text-sky-200',
  same: 'text-primary',
};

export const SLOT_STATUS_BADGE: Record<SlotDropStatus, string> = {
  ok: 'Uygun',
  forbidden: 'Kapalı',
  occupied: 'Çakışma',
  swap: 'Takas',
  same: 'Aynı',
};

const STATUS_WORST_ORDER: SlotDropStatus[] = ['forbidden', 'occupied', 'swap', 'ok', 'same'];

function worstStatus(a: SlotDropStatus, b: SlotDropStatus): SlotDropStatus {
  return STATUS_WORST_ORDER.indexOf(a) <= STATUS_WORST_ORDER.indexOf(b) ? a : b;
}

export function computeSlotDropStatus(
  dragging: EditorEntry | null,
  poolClassSection: string | null,
  day: number,
  lesson: number,
  entries: EditorEntry[],
  forbidden: Set<string>,
  excludeEntryIds?: Set<string>,
): SlotDropStatus {
  const key = `${day}-${lesson}`;
  if (forbidden.has(key)) return 'forbidden';
  if (!dragging && !poolClassSection) return 'ok';

  if (dragging && dragging.day_of_week === day && dragging.lesson_num === lesson) {
    return 'same';
  }

  const atSlot = entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
  const others = dragging
    ? atSlot.filter((e) => e.id !== dragging.id && !excludeEntryIds?.has(e.id))
    : atSlot.filter((e) => !excludeEntryIds?.has(e.id));

  if (dragging) {
    for (const o of others) {
      const sameAssignment =
        !!dragging.assignment_id &&
        dragging.assignment_id === o.assignment_id;
      if (o.class_section === dragging.class_section && !sameAssignment) return 'occupied';
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

/** Blok sürükleme: hedef hücre = bloğun ilk saati; tüm ardışık slotlar kontrol edilir. */
export function computeBlockDropStatus(
  dragging: EditorEntry,
  blockIds: string[],
  targetDay: number,
  targetLesson: number,
  entries: EditorEntry[],
  forbidden: Set<string>,
): SlotDropStatus {
  const block = entries
    .filter((e) => blockIds.includes(e.id))
    .sort((a, b) => a.lesson_num - b.lesson_num);
  if (block.length <= 1) {
    return computeSlotDropStatus(dragging, null, targetDay, targetLesson, entries, forbidden);
  }
  const exclude = new Set(blockIds);
  const offset = targetLesson - block[0]!.lesson_num;
  let worst: SlotDropStatus = 'ok';
  for (const e of block) {
    const s = computeSlotDropStatus(
      dragging,
      null,
      targetDay,
      e.lesson_num + offset,
      entries,
      forbidden,
      exclude,
    );
    worst = worstStatus(worst, s);
  }
  return worst;
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
