import {
  patchEntry,
  swapEntries,
  type EditorEntry,
  type EditorContext,
} from '@/lib/ders-dagit-timetable-api';
import { dayLabel } from '@/lib/ders-dagit-labels';

export type SimPendingMove = {
  entryId: string;
  fromDay: number;
  fromLesson: number;
  toDay: number;
  toLesson: number;
};

export function pendingSimulationMoves(baseline: EditorEntry[], draft: EditorEntry[]): SimPendingMove[] {
  const out: SimPendingMove[] = [];
  for (const d of draft) {
    const o = baseline.find((e) => e.id === d.id);
    if (!o) continue;
    if (o.day_of_week === d.day_of_week && o.lesson_num === d.lesson_num) continue;
    out.push({
      entryId: d.id,
      fromDay: o.day_of_week,
      fromLesson: o.lesson_num,
      toDay: d.day_of_week,
      toLesson: d.lesson_num,
    });
  }
  return out;
}

export function slotLabel(day: number, lesson: number): string {
  return `${dayLabel(day)} · ${lesson}. saat`;
}

export function partitionSimulationSwaps(moves: SimPendingMove[]): {
  swaps: [string, string][];
  patches: SimPendingMove[];
} {
  const used = new Set<string>();
  const swaps: [string, string][] = [];
  for (const m of moves) {
    if (used.has(m.entryId)) continue;
    const partner = moves.find(
      (p) =>
        p.entryId !== m.entryId &&
        !used.has(p.entryId) &&
        p.toDay === m.fromDay &&
        p.toLesson === m.fromLesson &&
        p.fromDay === m.toDay &&
        p.fromLesson === m.toLesson,
    );
    if (!partner) continue;
    swaps.push([m.entryId, partner.entryId]);
    used.add(m.entryId);
    used.add(partner.entryId);
  }
  const patches = moves.filter((m) => !used.has(m.entryId));
  return { swaps, patches };
}

export function buildClashesFromEntries(entries: EditorEntry[]): EditorContext['clashes'] {
  const clashes: EditorContext['clashes'] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.day_of_week !== b.day_of_week || a.lesson_num !== b.lesson_num) continue;
      if (a.class_section === b.class_section) {
        const msg = `Sınıf çakışması (${a.class_section})`;
        clashes.push({
          entry_id: a.id,
          code: 'CLASS_CLASH',
          message: msg,
          day_of_week: a.day_of_week,
          lesson_num: a.lesson_num,
        });
        clashes.push({
          entry_id: b.id,
          code: 'CLASS_CLASH',
          message: msg,
          day_of_week: b.day_of_week,
          lesson_num: b.lesson_num,
        });
      }
      if (a.user_id && b.user_id && a.user_id === b.user_id) {
        const msg = 'Öğretmen çakışması';
        clashes.push({
          entry_id: a.id,
          code: 'TEACHER_CLASH',
          message: msg,
          day_of_week: a.day_of_week,
          lesson_num: a.lesson_num,
        });
        clashes.push({
          entry_id: b.id,
          code: 'TEACHER_CLASH',
          message: msg,
          day_of_week: b.day_of_week,
          lesson_num: b.lesson_num,
        });
      }
    }
  }
  return clashes;
}

export async function applySimulationDraft(
  token: string,
  studioId: string,
  programId: string,
  baseline: EditorEntry[],
  draft: EditorEntry[],
): Promise<number> {
  const moves = pendingSimulationMoves(baseline, draft);
  if (!moves.length) return 0;
  const { swaps, patches } = partitionSimulationSwaps(moves);
  for (const [a, b] of swaps) {
    await swapEntries(token, studioId, programId, a, b);
  }
  for (const m of patches) {
    await patchEntry(token, studioId, programId, m.entryId, {
      day_of_week: m.toDay,
      lesson_num: m.toLesson,
    });
  }
  return swaps.length + patches.length;
}
