import type { ButterflyExamRules } from './butterfly-exam-rules.types';

export type Slot = { roomId: string; seatIndex: number };

export type RoomSpec = {
  id: string;
  capacity: number;
  /** `'single' | 'pair'` veya JSON dizi string */
  seatLayout?: string | null;
  name?: string;
};

export type SeatingStudent = {
  id: string;
  classId: string | null;
  name?: string | null;
  studentNumber?: string | null;
  gender?: string | null;
};

export type ViolationCounts = {
  adjacent: number;
  skipOne: number;
  gender: number;
  classMix: number;
  backToBack: number;
  cross: number;
  pairRow: number;
  fixedRoom: number;
};

export function butterflySlotKey(roomId: string, seatIndex: number): string {
  return `${roomId}:${seatIndex}`;
}

function classKey(classId: string | null | undefined): string {
  return classId ?? '__none__';
}

export function parseRoomLayout(seatLayout: string | null | undefined): 'single' | 'pair' {
  const s = (seatLayout ?? 'pair').trim();
  if (s === 'single') return 'single';
  if (s.startsWith('[')) {
    try {
      const g = JSON.parse(s) as Array<{ rowType?: string }>;
      if (Array.isArray(g) && g.some((x) => x?.rowType === 'single') && !g.some((x) => x?.rowType === 'pair')) {
        return 'single';
      }
    } catch {
      /* ignore */
    }
  }
  return 'pair';
}

/** Salon içi koltuk dolum sırası (fiziksel indeks dizisi) */
export function seatFillOrder(capacity: number, fillDirection: ButterflyExamRules['fillDirection']): number[] {
  const dir = fillDirection ?? 'ltr';
  if (capacity <= 0) return [];
  if (dir === 'rtl') {
    return Array.from({ length: capacity }, (_, i) => capacity - 1 - i);
  }
  if (dir === 'alternating') {
    const out: number[] = [];
    let lo = 0;
    let hi = capacity - 1;
    while (lo <= hi) {
      out.push(lo);
      if (lo !== hi) out.push(hi);
      lo++;
      hi--;
    }
    return out;
  }
  return Array.from({ length: capacity }, (_, i) => i);
}

/** fillMode + fillDirection ile global slot sırası */
export function buildGlobalSlotOrder(
  rooms: RoomSpec[],
  fillMode: ButterflyExamRules['fillMode'],
  fillDirection: ButterflyExamRules['fillDirection'],
): Slot[] {
  const mode = fillMode ?? 'balanced';
  const dir = fillDirection ?? 'ltr';
  const orderByRoom = new Map<string, number[]>();
  for (const r of rooms) {
    orderByRoom.set(r.id, seatFillOrder(r.capacity, dir));
  }

  if (mode === 'sequential') {
    const slots: Slot[] = [];
    for (const room of rooms) {
      const ord = orderByRoom.get(room.id) ?? [];
      for (const seatIndex of ord) slots.push({ roomId: room.id, seatIndex });
    }
    return slots;
  }

  const maxRounds = rooms.reduce((m, r) => Math.max(m, r.capacity), 0);
  const slots: Slot[] = [];
  for (let k = 0; k < maxRounds; k++) {
    for (const room of rooms) {
      const ord = orderByRoom.get(room.id) ?? [];
      if (k < ord.length) slots.push({ roomId: room.id, seatIndex: ord[k]! });
    }
  }
  return slots;
}

/** Eski API: dengeli + LTR */
export function buildRoundRobinSlots(rooms: { id: string; capacity: number }[]): Slot[] {
  const specs: RoomSpec[] = rooms.map((r) => ({ ...r, seatLayout: 'pair' }));
  return buildGlobalSlotOrder(specs, 'balanced', 'ltr');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortStudents(list: SeatingStudent[], sortOrd: ButterflyExamRules['studentSortOrder']): SeatingStudent[] {
  const x = [...list];
  if (sortOrd === 'random') return shuffle(x);
  if (sortOrd === 'alphabetical') {
    return x.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'tr', { sensitivity: 'base' }));
  }
  return x.sort((a, b) => {
    const sa = String(a.studentNumber ?? '').replace(/\s/g, '');
    const sb = String(b.studentNumber ?? '').replace(/\s/g, '');
    const na = parseInt(sa.replace(/\D/g, ''), 10);
    const nb = parseInt(sb.replace(/\D/g, ''), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return sa.localeCompare(sb, 'tr', { numeric: true });
  });
}

/** Sabit öğrenci sırası → listedeki sıra; özel ihtiyaç; diğerleri studentSortOrder ile */
export function buildPlacementPool(pool: SeatingStudent[], rules: ButterflyExamRules): SeatingStudent[] {
  const pinOrder = rules.pinnedStudentIds ?? [];
  const pinSet = new Set(pinOrder);
  const sortOrd = rules.studentSortOrder ?? 'student_number';
  const snIds = rules.specialNeedsStudentIds ?? [];
  const snSet = new Set(snIds);

  const pinnedOrdered = pinOrder.map((id) => pool.find((s) => s.id === id)).filter((s): s is SeatingStudent => s != null);
  const rest = pool.filter((s) => !pinSet.has(s.id));

  const specialInRest = rules.specialNeedsInFront && snSet.size > 0 ? rest.filter((s) => snSet.has(s.id)) : [];
  const nonSpecialRest = rules.specialNeedsInFront && snSet.size > 0 ? rest.filter((s) => !snSet.has(s.id)) : rest;

  const sortUnpinned = (list: SeatingStudent[]) => sortStudents(list, sortOrd);

  if (rules.prioritizePinned && pinOrder.length > 0) {
    const tail =
      rules.specialNeedsInFront && specialInRest.length
        ? [...sortUnpinned(specialInRest), ...sortUnpinned(nonSpecialRest)]
        : sortUnpinned(rest);
    return [...pinnedOrdered, ...tail];
  }

  if (rules.specialNeedsInFront && specialInRest.length) {
    return [...sortUnpinned(specialInRest), ...sortUnpinned(nonSpecialRest)];
  }

  return sortUnpinned(pool);
}

function prepareGreedyPoolList(ordered: SeatingStudent[], rules: ButterflyExamRules): SeatingStudent[] {
  const pinOrder = rules.pinnedStudentIds ?? [];
  const pinSet = new Set(pinOrder);
  if (rules.studentSortOrder !== 'random') return ordered;
  if (rules.prioritizePinned && pinOrder.length > 0) {
    const pinned = ordered.filter((s) => pinSet.has(s.id));
    const rest = shuffle(ordered.filter((s) => !pinSet.has(s.id)));
    return [...pinned, ...rest];
  }
  return shuffle(ordered);
}

function genderNorm(g: string | null | undefined): 'm' | 'f' | null {
  if (!g) return null;
  const x = g.trim().toLowerCase();
  if (['m', 'male', 'e', 'erkek', 'boy'].includes(x)) return 'm';
  if (['f', 'female', 'k', 'kız', 'kiz', 'girl'].includes(x)) return 'f';
  return null;
}

function genderConflict(a: string | null | undefined, b: string | null | undefined): boolean {
  const ga = genderNorm(a);
  const gb = genderNorm(b);
  if (!ga || !gb) return false;
  return ga !== gb;
}

function constraintSet(rules: ButterflyExamRules): Set<string> {
  return new Set(rules.constraints ?? []);
}

function pairPartner(seatIndex: number, capacity: number): number | null {
  const row = Math.floor(seatIndex / 2);
  const col = seatIndex % 2;
  const partner = row * 2 + (1 - col);
  return partner >= 0 && partner < capacity ? partner : null;
}

function crossSeatIndex(seatIndex: number, capacity: number, layout: 'single' | 'pair'): number | null {
  if (layout !== 'pair') return null;
  const row = Math.floor(seatIndex / 2);
  const col = seatIndex % 2;
  const j = 2 * (row + 1) + (1 - col);
  return j >= 0 && j < capacity ? j : null;
}

function genderNeighborIndices(
  layout: 'single' | 'pair',
  capacity: number,
  seatIndex: number,
): number[] {
  const s = new Set<number>();
  if (layout === 'single') {
    if (seatIndex > 0) s.add(seatIndex - 1);
    if (seatIndex + 1 < capacity) s.add(seatIndex + 1);
  } else {
    const p = pairPartner(seatIndex, capacity);
    if (p != null) s.add(p);
    if (seatIndex > 0) s.add(seatIndex - 1);
    if (seatIndex + 1 < capacity) s.add(seatIndex + 1);
  }
  return [...s];
}

type Ctx = {
  rules: ButterflyExamRules;
  studentsById: Map<string, SeatingStudent>;
  roomLayout: Map<string, 'single' | 'pair'>;
  roomCapacity: Map<string, number>;
  fixedClassRoomIds: Map<string, Set<string>>;
  constraints: Set<string>;
};

function occupant(assignment: Map<string, string>, roomId: string, seatIndex: number): string | undefined {
  return assignment.get(butterflySlotKey(roomId, seatIndex));
}

function placementPenalty(
  assignment: Map<string, string>,
  roomId: string,
  seatIndex: number,
  studentId: string,
  ctx: Ctx,
): number {
  const { rules, studentsById, roomLayout, roomCapacity, fixedClassRoomIds, constraints } = ctx;
  const cap = roomCapacity.get(roomId) ?? 0;
  const layout = roomLayout.get(roomId) ?? 'pair';
  const ck = classKey(studentsById.get(studentId)?.classId);

  let p = 0;

  if (rules.sameClassAdjacent === 'forbid' && seatIndex > 0) {
    const prevId = occupant(assignment, roomId, seatIndex - 1);
    if (prevId && classKey(studentsById.get(prevId)?.classId) === ck && ck !== '__none__') p += 1;
  }
  if (rules.sameClassSkipOne === 'forbid' && seatIndex > 1) {
    const prev2 = occupant(assignment, roomId, seatIndex - 2);
    if (prev2 && classKey(studentsById.get(prev2)?.classId) === ck && ck !== '__none__') p += 1;
  }

  if (rules.genderRule === 'cannot_sit_adjacent') {
    const st = studentsById.get(studentId);
    let gHit = false;
    for (const ni of genderNeighborIndices(layout, cap, seatIndex)) {
      const oid = occupant(assignment, roomId, ni);
      if (!oid) continue;
      if (genderConflict(st?.gender, studentsById.get(oid)?.gender)) {
        gHit = true;
        break;
      }
    }
    if (gHit) p += 1;
  }

  if (rules.classMix === 'cannot_mix') {
    for (let i = 0; i < cap; i++) {
      if (i === seatIndex) continue;
      const oid = occupant(assignment, roomId, i);
      if (!oid) continue;
      const ock = classKey(studentsById.get(oid)?.classId);
      if (ock !== '__none__' && ck !== '__none__' && ock !== ck) {
        p += 1;
        break;
      }
    }
  }

  if (constraints.has('no_back_to_back') && layout === 'pair') {
    const j = seatIndex + 2;
    if (j < cap && seatIndex % 2 === j % 2) {
      const oid = occupant(assignment, roomId, j);
      if (oid && classKey(studentsById.get(oid)?.classId) === ck && ck !== '__none__') p += 1;
    }
  }

  if (constraints.has('no_cross') && layout === 'pair') {
    const ci = crossSeatIndex(seatIndex, cap, layout);
    if (ci != null) {
      const oid = occupant(assignment, roomId, ci);
      if (oid && classKey(studentsById.get(oid)?.classId) === ck && ck !== '__none__') p += 1;
    }
  }

  if (constraints.has('single_in_pair_row') && layout === 'pair') {
    const partner = pairPartner(seatIndex, cap);
    if (partner != null) {
      const oid = occupant(assignment, roomId, partner);
      if (oid && classKey(studentsById.get(oid)?.classId) === ck && ck !== '__none__') p += 1;
    }
  }

  const cid = studentsById.get(studentId)?.classId;
  if (cid && ctx.fixedClassRoomIds.has(cid)) {
    const allowed = ctx.fixedClassRoomIds.get(cid)!;
    if (!allowed.has(roomId)) p += 1;
  }

  return p;
}

function countAllViolations(assignment: Map<string, string>, ctx: Ctx): ViolationCounts {
  const v: ViolationCounts = {
    adjacent: 0,
    skipOne: 0,
    gender: 0,
    classMix: 0,
    backToBack: 0,
    cross: 0,
    pairRow: 0,
    fixedRoom: 0,
  };
  const { rules, studentsById, roomLayout, roomCapacity, fixedClassRoomIds, constraints } = ctx;

  for (const [key, studentId] of assignment) {
    const colon = key.lastIndexOf(':');
    const roomId = key.slice(0, colon);
    const seatIndex = parseInt(key.slice(colon + 1), 10);
    const cap = roomCapacity.get(roomId) ?? 0;
    const layout = roomLayout.get(roomId) ?? 'pair';
    const ck = classKey(studentsById.get(studentId)?.classId);
    const st = studentsById.get(studentId);

    if (rules.sameClassAdjacent === 'forbid' && seatIndex > 0) {
      const prevId = occupant(assignment, roomId, seatIndex - 1);
      if (prevId && classKey(studentsById.get(prevId)?.classId) === ck && ck !== '__none__') v.adjacent += 1;
    }
    if (rules.sameClassSkipOne === 'forbid' && seatIndex > 1) {
      const prev2 = occupant(assignment, roomId, seatIndex - 2);
      if (prev2 && classKey(studentsById.get(prev2)?.classId) === ck && ck !== '__none__') v.skipOne += 1;
    }

    if (rules.genderRule === 'cannot_sit_adjacent') {
      let gHit = false;
      for (const ni of genderNeighborIndices(layout, cap, seatIndex)) {
        const oid = occupant(assignment, roomId, ni);
        if (!oid || oid === studentId) continue;
        if (genderConflict(st?.gender, studentsById.get(oid)?.gender)) {
          gHit = true;
          break;
        }
      }
      if (gHit) v.gender += 1;
    }

    if (constraints.has('no_back_to_back') && layout === 'pair') {
      const j = seatIndex + 2;
      if (j < cap && seatIndex % 2 === j % 2) {
        const oid = occupant(assignment, roomId, j);
        if (oid && classKey(studentsById.get(oid)?.classId) === ck && ck !== '__none__') v.backToBack += 1;
      }
    }

    if (constraints.has('no_cross') && layout === 'pair') {
      const ci = crossSeatIndex(seatIndex, cap, layout);
      if (ci != null && ci > seatIndex) {
        const oid = occupant(assignment, roomId, ci);
        if (oid && classKey(studentsById.get(oid)?.classId) === ck && ck !== '__none__') v.cross += 1;
      }
    }

    if (constraints.has('single_in_pair_row') && layout === 'pair') {
      const partner = pairPartner(seatIndex, cap);
      if (partner != null && partner > seatIndex) {
        const oid = occupant(assignment, roomId, partner);
        if (oid && classKey(studentsById.get(oid)?.classId) === ck && ck !== '__none__') v.pairRow += 1;
      }
    }

    const cid = st?.classId ?? null;
    if (cid && fixedClassRoomIds.has(cid)) {
      const allowed = fixedClassRoomIds.get(cid)!;
      if (!allowed.has(roomId)) v.fixedRoom += 1;
    }
  }

  if (rules.classMix === 'cannot_mix') {
    const roomClassSets = new Map<string, Set<string>>();
    const roomCounts = new Map<string, number>();
    for (const [key, sid] of assignment) {
      const colon = key.lastIndexOf(':');
      const roomId = key.slice(0, colon);
      const ck = classKey(studentsById.get(sid)?.classId);
      if (ck === '__none__') continue;
      if (!roomClassSets.has(roomId)) roomClassSets.set(roomId, new Set());
      roomClassSets.get(roomId)!.add(ck);
      roomCounts.set(roomId, (roomCounts.get(roomId) ?? 0) + 1);
    }
    for (const [rid, set] of roomClassSets) {
      if (set.size > 1) v.classMix += roomCounts.get(rid) ?? 0;
    }
  }

  return v;
}

function violationScore(v: ViolationCounts): number {
  return (
    v.adjacent +
    v.skipOne +
    v.gender +
    v.classMix +
    v.backToBack +
    v.cross +
    v.pairRow +
    v.fixedRoom
  );
}

export function computeSeating(
  rooms: RoomSpec[],
  students: SeatingStudent[],
  rules: ButterflyExamRules,
  occupiedSlots: Map<string, string>,
  preset: Map<string, string>,
  opts?: { fixedClassRoomIds?: Map<string, Set<string>> },
): { slotOrder: Slot[]; assignment: Map<string, string>; violations: ViolationCounts } {
  const slotOrder = buildGlobalSlotOrder(rooms, rules.fillMode, rules.fillDirection);
  const studentsById = new Map(students.map((s) => [s.id, s]));
  const roomLayout = new Map(rooms.map((r) => [r.id, parseRoomLayout(r.seatLayout ?? undefined)]));
  const roomCapacity = new Map(rooms.map((r) => [r.id, r.capacity]));
  const fixedClassRoomIds = opts?.fixedClassRoomIds ?? new Map<string, Set<string>>();
  const constraints = constraintSet(rules);

  const ctx: Ctx = { rules, studentsById, roomLayout, roomCapacity, fixedClassRoomIds, constraints };

  const assignment = new Map<string, string>();
  for (const [k, v] of preset) assignment.set(k, v);

  const pool = students.filter((s) => !Array.from(preset.values()).includes(s.id));

  const tryPlace = (slot: Slot, studentId: string) => {
    assignment.set(butterflySlotKey(slot.roomId, slot.seatIndex), studentId);
  };

  const freeSlotsAll = slotOrder.filter((s) => {
    const k = butterflySlotKey(s.roomId, s.seatIndex);
    return !preset.has(k) && !occupiedSlots.has(k);
  });
  const useSlots = freeSlotsAll.slice(0, pool.length);

  const placementPool = buildPlacementPool(pool, rules);
  const mode = rules.distributionMode ?? 'constraint_greedy';

  if (mode === 'round_robin') {
    let idx = 0;
    for (const slot of useSlots) {
      if (idx >= placementPool.length) break;
      tryPlace(slot, placementPool[idx++]!.id);
    }
  } else {
    let poolList = prepareGreedyPoolList(placementPool, rules);
    for (const slot of useSlots) {
      if (poolList.length === 0) break;
      let chosen = -1;
      let bestP = Infinity;
      for (let i = 0; i < poolList.length; i++) {
        const sid = poolList[i]!.id;
        const pen = placementPenalty(assignment, slot.roomId, slot.seatIndex, sid, ctx);
        if (pen === 0) {
          chosen = i;
          break;
        }
        if (pen < bestP) {
          bestP = pen;
          chosen = i;
        }
      }
      if (chosen === -1) chosen = 0;
      const st = poolList.splice(chosen, 1)[0]!;
      tryPlace(slot, st.id);
    }
  }

  const pinSwapBlock = new Set(rules.pinnedStudentIds ?? []);

  if (mode === 'swap_optimize' || mode === 'constraint_greedy') {
    const keys = [...assignment.keys()];
    let best = violationScore(countAllViolations(assignment, ctx));
    for (let iter = 0; iter < 8000; iter++) {
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
      if (pinSwapBlock.has(si) || pinSwapBlock.has(sj)) continue;
      assignment.set(ki, sj);
      assignment.set(kj, si);
      const sc = violationScore(countAllViolations(assignment, ctx));
      if (sc < best) best = sc;
      else {
        assignment.set(ki, si);
        assignment.set(kj, sj);
      }
    }
  }

  return { slotOrder, assignment, violations: countAllViolations(assignment, ctx) };
}
