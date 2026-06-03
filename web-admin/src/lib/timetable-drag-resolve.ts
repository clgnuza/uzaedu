import type { EditorContext, EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { clashAtSlot, clashEntryIds } from '@/lib/timetable-clash';
import {
  listRelocationSlotsForEntry,
  type EntryMovePlan,
} from '@/lib/timetable-pool-place';
import { closureAt, type SlotClosure } from '@/lib/timetable-slot-closures';
import { allEntriesRespectAssignmentBlocks } from '@/lib/timetable-assignment-blocks';
import { sameDayBlockRun } from '@/lib/timetable-double-block';
import { validatePoolPlace } from '@/lib/timetable-move-validation';

type Slot = { day: number; lesson: number };
export type TimetableMove = { entryId: string; day: number; lesson: number };

function entriesAtPositions(base: EditorEntry[], positions: Map<string, Slot>): EditorEntry[] {
  return base.map((e) => {
    const p = positions.get(e.id);
    return p ? { ...e, day_of_week: p.day, lesson_num: p.lesson } : e;
  });
}

function positionsFromEntries(entries: EditorEntry[]): Map<string, Slot> {
  return new Map(entries.map((e) => [e.id, { day: e.day_of_week, lesson: e.lesson_num }]));
}

function stateKey(positions: Map<string, Slot>): string {
  return [...positions.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, p]) => `${id}@${p.day},${p.lesson}`)
    .join('|');
}

function placementValid(
  entries: EditorEntry[],
  closures: Map<string, SlotClosure>,
  assignmentHints?: EditorContext['assignment_hints'],
): boolean {
  for (const e of entries) {
    if (closureAt(closures, e.day_of_week, e.lesson_num)) return false;
  }
  if (clashEntryIds(entries).size > 0) return false;
  return allEntriesRespectAssignmentBlocks(entries, assignmentHints);
}

function slotOccupants(
  positions: Map<string, Slot>,
  target: Slot,
  exceptId?: string,
): string[] {
  const ids: string[] = [];
  for (const [id, p] of positions) {
    if (exceptId && id === exceptId) continue;
    if (p.day === target.day && p.lesson === target.lesson) ids.push(id);
  }
  return ids;
}

function applyMove(positions: Map<string, Slot>, move: TimetableMove): Map<string, Slot> {
  const next = new Map(positions);
  next.set(move.entryId, { day: move.day, lesson: move.lesson });
  return next;
}

function applySwap(positions: Map<string, Slot>, aId: string, bId: string): Map<string, Slot> | null {
  const a = positions.get(aId);
  const b = positions.get(bId);
  if (!a || !b) return null;
  const next = new Map(positions);
  next.set(aId, b);
  next.set(bId, a);
  return next;
}

function goalEntryAt(
  positions: Map<string, Slot>,
  entryId: string,
  target: Slot,
  base: EditorEntry[],
  closures: Map<string, SlotClosure>,
  assignmentHints?: EditorContext['assignment_hints'],
): boolean {
  const p = positions.get(entryId);
  if (!p || p.day !== target.day || p.lesson !== target.lesson) return false;
  return placementValid(entriesAtPositions(base, positions), closures, assignmentHints);
}

function poolAtTargetOk(
  assignmentId: string,
  target: Slot,
  base: EditorEntry[],
  positions: Map<string, Slot>,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
): boolean {
  const row = ctx.unplaced.find((u) => u.assignment_id === assignmentId);
  if (!row) return false;
  const entries = entriesAtPositions(base, positions);
  if (!placementValid(entries, closures, ctx.assignment_hints)) return false;
  return validatePoolPlace(
    assignmentId,
    target.day,
    target.lesson,
    entries,
    row.class_section,
    closures,
    row.user_id ?? null,
    ctx.assignment_hints,
  ).ok;
}

function orderedMovable(
  ctx: EditorContext,
  positions: Map<string, Slot>,
  target: Slot,
  focusEntryId?: string,
): EditorEntry[] {
  const movable = ctx.entries.filter((e) => !e.is_locked);
  const atTarget = new Set(slotOccupants(positions, target, focusEntryId));
  const focus = focusEntryId ? movable.find((e) => e.id === focusEntryId) : undefined;

  const score = (e: EditorEntry): number => {
    const p = positions.get(e.id);
    if (!p) return 50;
    if (atTarget.has(e.id)) return 0;
    if (e.id === focusEntryId) return 2;
    if (focus && p.day === target.day && p.lesson === target.lesson) return 1;
    return 10;
  };

  return [...movable].sort((a, b) => score(a) - score(b));
}

function runPlacementBfs(
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
  isGoal: (positions: Map<string, Slot>) => boolean,
  opts?: { maxDepth?: number; maxNodes?: number; focusEntryId?: string; target?: Slot },
): EntryMovePlan {
  const maxDepth = opts?.maxDepth ?? 12;
  const maxNodes = opts?.maxNodes ?? 16000;
  const workDays = ctx.period.work_days?.length ? ctx.period.work_days : [1, 2, 3, 4, 5];
  const lessonsPerDay = ctx.grid?.lessons_per_day_by_dow ?? {};
  const target = opts?.target;

  const start = positionsFromEntries(ctx.entries);
  if (isGoal(start)) return { ok: true, relocations: [] };

  type Node = { positions: Map<string, Slot>; moves: TimetableMove[] };
  const visited = new Set<string>();
  const queue: Node[] = [{ positions: start, moves: [] }];
  visited.add(stateKey(start));

  let explored = 0;

  while (queue.length > 0 && explored < maxNodes) {
    const node = queue.shift()!;
    explored++;

    if (isGoal(node.positions)) {
      return { ok: true, relocations: node.moves };
    }
    if (node.moves.length >= maxDepth) continue;

    if (opts?.focusEntryId && target) {
      const fId = opts.focusEntryId;
      const fCur = node.positions.get(fId);
      if (fCur) {
        for (const oId of slotOccupants(node.positions, target, fId)) {
          const o = ctx.entries.find((x) => x.id === oId);
          if (!o || o.is_locked) continue;
          const swapped = applySwap(node.positions, fId, oId);
          if (!swapped) continue;
          const swapEntries = entriesAtPositions(ctx.entries, swapped);
          if (!placementValid(swapEntries, closures, ctx.assignment_hints)) continue;
          const swapKey = stateKey(swapped);
          if (visited.has(swapKey)) continue;
          visited.add(swapKey);
          queue.push({
            positions: swapped,
            moves: [
              ...node.moves,
              { entryId: oId, day: fCur.day, lesson: fCur.lesson },
              { entryId: fId, day: target.day, lesson: target.lesson },
            ],
          });
        }
      }
    }

    const entries = entriesAtPositions(ctx.entries, node.positions);
    const movable = orderedMovable(ctx, node.positions, target ?? { day: 0, lesson: 0 }, opts?.focusEntryId);

    for (const e of movable) {
      const cur = node.positions.get(e.id);
      if (!cur) continue;

      const others = entries.filter((x) => x.id !== e.id);
      let targets = listRelocationSlotsForEntry(
        { ...e, day_of_week: cur.day, lesson_num: cur.lesson },
        others,
        closures,
        workDays,
        ctx.max_lesson,
        lessonsPerDay,
        target,
        ctx.assignment_hints,
      );
      if (target) {
        targets = targets.filter((t) => !(t.day === target.day && t.lesson === target.lesson));
      }
      if (targets.length > 32) targets = targets.slice(0, 32);

      for (const t of targets) {
        if (t.day === cur.day && t.lesson === cur.lesson) continue;

        const move: TimetableMove = { entryId: e.id, day: t.day, lesson: t.lesson };
        const nextPos = applyMove(node.positions, move);
        const nextEntries = entriesAtPositions(ctx.entries, nextPos);
        if (!placementValid(nextEntries, closures, ctx.assignment_hints)) continue;

        const key = stateKey(nextPos);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ positions: nextPos, moves: [...node.moves, move] });
        }
      }
    }
  }

  return { ok: false, message: 'Bu saate yer açılamadı — başka saat deneyin.' };
}

export function finalizeMovesForEntry(
  plan: EntryMovePlan & { ok: true },
  entryId: string,
  day: number,
  lesson: number,
): TimetableMove[] {
  const atTarget = plan.relocations.some(
    (m) => m.entryId === entryId && m.day === day && m.lesson === lesson,
  );
  const moves = atTarget ? plan.relocations : [...plan.relocations, { entryId, day, lesson }];
  return orderMovesForApply(moves, entryId, { day, lesson });
}

/** İki dersin yerlerini değiştiriyorsa tek swap API çağrısı gerekir (sıralı PATCH çakışır). */
export function detectSwapPair(
  moves: TimetableMove[],
  entries: EditorEntry[],
): { a: string; b: string } | null {
  if (moves.length !== 2) return null;
  const [m0, m1] = moves;
  const ea = entries.find((e) => e.id === m0.entryId);
  const eb = entries.find((e) => e.id === m1.entryId);
  if (!ea || !eb || m0.entryId === m1.entryId) return null;
  const swaps =
    m0.day === eb.day_of_week &&
    m0.lesson === eb.lesson_num &&
    m1.day === ea.day_of_week &&
    m1.lesson === ea.lesson_num;
  return swaps ? { a: m0.entryId, b: m1.entryId } : null;
}

/** Hedef slot boşaltılmadan sürüklenen ders oraya PATCH edilmemeli. */
export function orderMovesForApply(
  moves: TimetableMove[],
  primaryEntryId: string,
  target: Slot,
  initial?: EditorEntry[],
): TimetableMove[] {
  if (moves.length <= 1) return moves;
  const pos = initial ? positionsFromEntries(initial) : null;
  const startedAtTarget = pos
    ? new Set(slotOccupants(pos, target, primaryEntryId))
    : new Set<string>();

  const vacating: TimetableMove[] = [];
  const other: TimetableMove[] = [];
  const toTarget: TimetableMove[] = [];

  for (const m of moves) {
    if (m.entryId === primaryEntryId && m.day === target.day && m.lesson === target.lesson) {
      toTarget.push(m);
    } else if (startedAtTarget.has(m.entryId)) {
      vacating.push(m);
    } else {
      other.push(m);
    }
  }
  return [...vacating, ...other, ...toTarget];
}

/**
 * Sürüklenen dersi hedefe yerleştir: tüm kilitsiz kartlar (farklı sınıf dahil) kaydırılabilir.
 */
export function planChainEntryMove(
  entryId: string,
  targetDay: number,
  targetLesson: number,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
  opts?: { maxDepth?: number; maxNodes?: number },
): EntryMovePlan {
  const target: Slot = { day: targetDay, lesson: targetLesson };

  const entry = ctx.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, message: 'Ders bulunamadı.' };
  if (entry.is_locked) return { ok: false, message: 'Kilitli ders taşınamaz.' };
  if (closureAt(closures, targetDay, targetLesson)) {
    return { ok: false, message: 'Kapalı saat.' };
  }

  const lockedAtTarget = ctx.entries.some(
    (e) =>
      e.id !== entryId &&
      e.is_locked &&
      e.day_of_week === targetDay &&
      e.lesson_num === targetLesson,
  );
  if (lockedAtTarget) {
    return { ok: false, message: 'Hedef saatte kilitli ders var.' };
  }

  return runPlacementBfs(
    ctx,
    closures,
    (positions) => goalEntryAt(positions, entryId, target, ctx.entries, closures, ctx.assignment_hints),
    { ...opts, focusEntryId: entryId, target },
  );
}

export function planChainPoolPlace(
  assignmentId: string,
  targetDay: number,
  targetLesson: number,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
  opts?: { maxDepth?: number; maxNodes?: number },
): EntryMovePlan {
  const row = ctx.unplaced.find((u) => u.assignment_id === assignmentId);
  if (!row) return { ok: false, message: 'Atama bulunamadı.' };
  if (closureAt(closures, targetDay, targetLesson)) {
    return { ok: false, message: 'Kapalı saat.' };
  }

  const lockedAtTarget = ctx.entries.some(
    (e) =>
      e.is_locked && e.day_of_week === targetDay && e.lesson_num === targetLesson,
  );
  if (lockedAtTarget) {
    return { ok: false, message: 'Hedef saatte kilitli ders var.' };
  }

  const target: Slot = { day: targetDay, lesson: targetLesson };
  return runPlacementBfs(
    ctx,
    closures,
    (positions) => poolAtTargetOk(assignmentId, target, ctx.entries, positions, ctx, closures),
    { ...opts, target },
  );
}

/** Tek hamle yeterliyse doğrula. */
export function canPlaceEntryAt(
  entries: EditorEntry[],
  entryId: string,
  day: number,
  lesson: number,
  closures: Map<string, SlotClosure>,
  assignmentHints?: EditorContext['assignment_hints'],
): boolean {
  if (closureAt(closures, day, lesson)) return false;
  const projected = entries.map((e) =>
    e.id === entryId ? { ...e, day_of_week: day, lesson_num: lesson } : e,
  );
  return placementValid(projected, closures, assignmentHints);
}

/** Blok ders: tüm ardışık kartlar aynı kaydırma ile hedefe gider. */
export function planBlockEntryMove(
  entryId: string,
  targetDay: number,
  targetLesson: number,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
): EntryMovePlan {
  const entry = ctx.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, message: 'Ders bulunamadı.' };
  const block = sameDayBlockRun(entry, ctx.entries, ctx.assignment_hints);
  if (block.length <= 1) {
    return planChainEntryMove(entryId, targetDay, targetLesson, ctx, closures);
  }

  const sorted = [...block].sort((a, b) => a.lesson_num - b.lesson_num);
  const lead = sorted[0]!;
  const offset = targetLesson - lead.lesson_num;
  const blockIds = new Set(sorted.map((e) => e.id));

  const directMoves: TimetableMove[] = sorted.map((e) => ({
    entryId: e.id,
    day: targetDay,
    lesson: e.lesson_num + offset,
  }));

  let directOk = true;
  for (const m of directMoves) {
    if (closureAt(closures, m.day, m.lesson)) {
      directOk = false;
      break;
    }
  }
  if (directOk) {
    for (const m of directMoves) {
      const occ = ctx.entries.filter(
        (e) =>
          e.day_of_week === m.day && e.lesson_num === m.lesson && !blockIds.has(e.id),
      );
      if (occ.length) {
        directOk = false;
        break;
      }
    }
  }
  if (directOk) {
    let projected = ctx.entries;
    for (const m of directMoves) {
      projected = projected.map((e) =>
        e.id === m.entryId ? { ...e, day_of_week: m.day, lesson_num: m.lesson } : e,
      );
    }
    if (placementValid(projected, closures, ctx.assignment_hints) && clashEntryIds(projected).size === 0) {
      return {
        ok: true,
        relocations: orderMovesForApply(directMoves, lead.id, { day: targetDay, lesson: targetLesson }, ctx.entries),
      };
    }
  }

  const chain = planChainEntryMove(lead.id, targetDay, targetLesson, ctx, closures);
  if (!chain.ok) return chain;

  const baseMoves = finalizeMovesForEntry(chain, lead.id, targetDay, targetLesson);
  const leadOrig = ctx.entries.find((e) => e.id === lead.id)!;
  const leadDest =
    baseMoves.find((m) => m.entryId === lead.id) ?? {
      entryId: lead.id,
      day: targetDay,
      lesson: targetLesson,
    };
  const deltaD = leadDest.day - leadOrig.day_of_week;
  const deltaL = leadDest.lesson - leadOrig.lesson_num;

  const moves: TimetableMove[] = baseMoves.filter((m) => !blockIds.has(m.entryId));
  for (const e of sorted) {
    moves.push({
      entryId: e.id,
      day: e.day_of_week + deltaD,
      lesson: e.lesson_num + deltaL,
    });
  }

  let projected = ctx.entries;
  for (const m of moves) {
    projected = projected.map((e) =>
      e.id === m.entryId ? { ...e, day_of_week: m.day, lesson_num: m.lesson } : e,
    );
  }
  if (!placementValid(projected, closures, ctx.assignment_hints) || clashEntryIds(projected).size > 0) {
    return { ok: false, message: 'Blok bu konuma yerleşemez.' };
  }

  return {
    ok: true,
    relocations: orderMovesForApply(moves, lead.id, { day: leadDest.day, lesson: leadDest.lesson }, ctx.entries),
  };
}
