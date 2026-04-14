import type { ButterflyExamRules } from './butterfly-exam-rules.types';

export type Slot = { roomId: string; seatIndex: number };

/** Salon kapasitelerine göre round-robin sıra: önce tüm salonların 1. sırası, sonra 2. sıra… */
export function buildRoundRobinSlots(rooms: { id: string; capacity: number }[]): Slot[] {
  const maxR = rooms.reduce((m, r) => Math.max(m, r.capacity), 0);
  const slots: Slot[] = [];
  for (let round = 0; round < maxR; round++) {
    for (const room of rooms) {
      if (round < room.capacity) slots.push({ roomId: room.id, seatIndex: round });
    }
  }
  return slots;
}

export function butterflySlotKey(roomId: string, seatIndex: number): string {
  return `${roomId}:${seatIndex}`;
}

function classKey(classId: string | null | undefined): string {
  return classId ?? '__none__';
}

export type SeatingStudent = { id: string; classId: string | null };

export function computeSeating(
  rooms: { id: string; capacity: number }[],
  students: SeatingStudent[],
  rules: ButterflyExamRules,
  occupiedSlots: Map<string, string>,
  /** slot -> studentId (locked/pinned önceden dolu) */
  preset: Map<string, string>,
): { slotOrder: Slot[]; assignment: Map<string, string>; violations: { adjacent: number; skipOne: number } } {
  const slotOrder = buildRoundRobinSlots(rooms);
  const classOf = (sid: string) => students.find((s) => s.id === sid)?.classId ?? null;

  const assignment = new Map<string, string>();
  for (const [k, v] of preset) assignment.set(k, v);

  const pool = students.filter((s) => !Array.from(preset.values()).includes(s.id));
  let poolIdx = 0;

  const tryPlace = (slot: Slot, studentId: string) => {
    assignment.set(butterflySlotKey(slot.roomId, slot.seatIndex), studentId);
  };

  const hasViolationAt = (roomId: string, seatIndex: number, studentId: string): { adj: boolean; skip: boolean } => {
    const ck = classKey(classOf(studentId));
    let adj = false;
    let skip = false;
    if (rules.sameClassAdjacent === 'forbid' && seatIndex > 0) {
      const prevId = assignment.get(butterflySlotKey(roomId, seatIndex - 1));
      if (prevId && classKey(classOf(prevId)) === ck && ck !== '__none__') adj = true;
    }
    if (rules.sameClassSkipOne === 'forbid' && seatIndex > 1) {
      const prev2 = assignment.get(butterflySlotKey(roomId, seatIndex - 2));
      if (prev2 && classKey(classOf(prev2)) === ck && ck !== '__none__') skip = true;
    }
    return { adj, skip };
  };

  const countViolations = (): { adjacent: number; skipOne: number } => {
    let adjacent = 0;
    let skipOne = 0;
    for (const [key, sid] of assignment) {
      const [roomId, si] = key.split(':');
      const seatIndex = parseInt(si, 10);
      const v = hasViolationAt(roomId, seatIndex, sid);
      if (v.adj) adjacent += 1;
      if (v.skip) skipOne += 1;
    }
    return { adjacent, skipOne };
  };

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /** Boş slotlar (preset + occupied hariç) */
  const freeSlotsAll = slotOrder.filter((s) => {
    const k = butterflySlotKey(s.roomId, s.seatIndex);
    return !preset.has(k) && !occupiedSlots.has(k);
  });
  const useSlots = freeSlotsAll.slice(0, pool.length);

  const mode = rules.distributionMode ?? 'constraint_greedy';

  if (mode === 'round_robin') {
    for (const slot of useSlots) {
      if (poolIdx >= pool.length) break;
      tryPlace(slot, pool[poolIdx++]!.id);
    }
  } else {
    /** Greedy: mümkünse kural ihlali olmayan öğrenci */
    let poolList = shuffle(pool);
    for (const slot of useSlots) {
      if (poolList.length === 0) break;
      let chosen = -1;
      for (let i = 0; i < poolList.length; i++) {
        const sid = poolList[i]!.id;
        const v = hasViolationAt(slot.roomId, slot.seatIndex, sid);
        const bad = (rules.sameClassAdjacent === 'forbid' && v.adj) || (rules.sameClassSkipOne === 'forbid' && v.skip);
        if (!bad) {
          chosen = i;
          break;
        }
      }
      if (chosen === -1) chosen = 0;
      const st = poolList.splice(chosen, 1)[0]!;
      tryPlace(slot, st.id);
    }
  }

  if (mode === 'swap_optimize' || mode === 'constraint_greedy') {
    const keys = [...assignment.keys()];
    let best = countViolations().adjacent + countViolations().skipOne;
    for (let iter = 0; iter < 4000; iter++) {
      if (best === 0) break;
      if (keys.length < 2) break;
      const i = Math.floor(Math.random() * keys.length);
      let j = Math.floor(Math.random() * keys.length);
      if (i === j) j = (j + 1) % keys.length;
      const ki = keys[i]!;
      const kj = keys[j]!;
      if (preset.has(ki) || preset.has(kj)) continue;
      const si = assignment.get(ki)!;
      const sj = assignment.get(kj)!;
      assignment.set(ki, sj);
      assignment.set(kj, si);
      const sc = countViolations().adjacent + countViolations().skipOne;
      if (sc < best) best = sc;
      else {
        assignment.set(ki, si);
        assignment.set(kj, sj);
      }
    }
  }

  return { slotOrder, assignment, violations: countViolations() };
}
