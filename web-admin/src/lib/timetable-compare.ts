import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export type CompareEntryKind = 'same' | 'modified' | 'moved' | 'added' | 'removed';

export type CompareEntryStatus = {
  kind: CompareEntryKind;
  hint?: string;
};

export type SlotCompareKind = 'same' | 'diff' | 'empty';

function entryLogicalKey(e: EditorEntry): string {
  if (e.assignment_id) return `a:${e.assignment_id}`;
  return `x:${e.class_section}\0${e.subject}\0${e.user_id ?? ''}`;
}

function entrySlotKey(e: EditorEntry): string {
  return `${e.day_of_week}:${e.lesson_num}`;
}

function fieldsDiffer(a: EditorEntry, b: EditorEntry): boolean {
  return (
    a.subject !== b.subject ||
    a.class_section !== b.class_section ||
    a.user_id !== b.user_id ||
    a.room_id !== b.room_id ||
    (a.teacher_label ?? '') !== (b.teacher_label ?? '')
  );
}

/** Aktif (sol) ve karşılaştırma (sağ) programı arasında fark haritası. */
export function buildTimetableCompare(
  baseline: EditorEntry[],
  other: EditorEntry[],
): {
  entryById: Map<string, CompareEntryStatus>;
  slotByKey: Map<string, SlotCompareKind>;
  counts: { same: number; modified: number; moved: number; added: number; removed: number };
} {
  const otherByLogical = new Map<string, EditorEntry>();
  const baselineByLogical = new Map<string, EditorEntry>();
  for (const e of other) otherByLogical.set(entryLogicalKey(e), e);
  for (const e of baseline) baselineByLogical.set(entryLogicalKey(e), e);

  const entryById = new Map<string, CompareEntryStatus>();
  const slotByKey = new Map<string, SlotCompareKind>();
  const counts = { same: 0, modified: 0, moved: 0, added: 0, removed: 0 };

  const markSlot = (sk: string, kind: SlotCompareKind) => {
    const cur = slotByKey.get(sk);
    if (!cur || cur === 'same') slotByKey.set(sk, kind);
    else if (cur !== 'diff' && kind !== 'same') slotByKey.set(sk, 'diff');
    else if (kind === 'diff') slotByKey.set(sk, 'diff');
  };

  const setPair = (left: EditorEntry, right: EditorEntry | null, status: CompareEntryStatus) => {
    entryById.set(left.id, status);
    if (right) entryById.set(right.id, status);
  };

  for (const e of baseline) {
    const lk = entryLogicalKey(e);
    const sk = entrySlotKey(e);
    const match = otherByLogical.get(lk);
    if (!match) {
      setPair(e, null, { kind: 'removed', hint: 'Karşılaştırmada yok' });
      markSlot(sk, 'diff');
      counts.removed++;
      continue;
    }
    const msk = entrySlotKey(match);
    if (sk !== msk) {
      const hint =
        `G${match.day_of_week} · ${match.lesson_num}. saat ↔ G${e.day_of_week} · ${e.lesson_num}. saat`;
      setPair(e, match, { kind: 'moved', hint });
      markSlot(sk, 'diff');
      markSlot(msk, 'diff');
      counts.moved++;
    } else if (fieldsDiffer(e, match)) {
      setPair(e, match, { kind: 'modified', hint: 'İçerik farklı' });
      markSlot(sk, 'diff');
      counts.modified++;
    } else {
      setPair(e, match, { kind: 'same' });
      markSlot(sk, 'same');
      counts.same++;
    }
  }

  for (const e of other) {
    const lk = entryLogicalKey(e);
    if (baselineByLogical.has(lk)) continue;
    entryById.set(e.id, { kind: 'added', hint: 'Yalnız karşılaştırmada' });
    markSlot(entrySlotKey(e), 'diff');
    counts.added++;
  }

  return { entryById, slotByKey, counts };
}

export function maxStackedInCell(
  lists: EditorEntry[][],
  filter?: { mode: 'class' | 'teacher' | 'room'; id: string },
): Map<string, number> {
  const out = new Map<string, number>();
  const visible = (list: EditorEntry[]) => {
    if (!filter) return list;
    if (filter.mode === 'class') return list.filter((e) => e.class_section === filter.id);
    if (filter.mode === 'teacher') return list.filter((e) => e.user_id === filter.id);
    if (filter.id === '__none__') return list.filter((e) => !e.room_id);
    return list.filter((e) => e.room_id === filter.id);
  };
  for (const list of lists) {
    const perCell = new Map<string, number>();
    for (const e of visible(list)) {
      const k = `${e.day_of_week}-${e.lesson_num}`;
      perCell.set(k, (perCell.get(k) ?? 0) + 1);
    }
    for (const [k, n] of perCell) {
      out.set(k, Math.max(out.get(k) ?? 0, n));
    }
  }
  return out;
}
