import { placementAllowed } from './ders-dagit.solver-csp';
import type { SolverAssignment, SolverContext, SolverResult, SolverSlot } from './ders-dagit.solver';
import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import { ruleOn, ruleOnForAssignment } from './ders-dagit.solver-rule-scope';
import { rulesForSection } from './ders-dagit.solver';
import { isStrictRule } from './ders-dagit.rules-merge';
import {
  assignmentBlockPlacementOkForAssignment,
  assignmentPlacementSpec,
  lessonsOnDayConsecutive,
} from './ders-dagit.assignment-blocks';
import {
  assignmentByDayLessons,
  assignmentChunkDays,
  distributionPatternForScoring,
  matchesDayDistributionPattern,
  patternChunkDayAllowed,
  remainingPatternChunks,
} from './ders-dagit.day-distribution';
import { shouldEnforceDistributionPattern } from './ders-dagit.distribution-policy';
import { effectiveMinDaysPerWeek } from './ders-dagit.min-days';
import { placementPatternForAssignment } from './ders-dagit.solver-distribution';
import type { PlacementSearchComplexity } from './ders-dagit.placement-search';
import { generationBudgetFor } from './ders-dagit.placement-search';

type SearchEntry = SolverSlot & { _id: number };

export type AscSearchPriority = 'coverage' | 'balanced' | 'fast';

export type AscSearchMeta = {
  time_ms: number;
  iterations: number;
  accepted: number;
  restarts: number;
  best_unplaced: number;
  best_soft_penalty: number;
};

export type AscSearchOptions = {
  deadline_ms: number;
  priority: AscSearchPriority;
  seed?: SolverResult;
  search_complexity?: PlacementSearchComplexity;
};

type Cost = { unplaced: number; soft_penalty: number };

function nowMs(): number {
  return Date.now();
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

/** Kart bölme deseni — gevşet modundan bağımsız (stüdyo/atama deseni). */
function splitPatternForAssignment(a: SolverAssignment, ctx: SolverContext): number[] | null {
  return (
    placementPatternForAssignment(a, effHours(a), ctx) ??
    distributionPatternForScoring(a.weekly_hours, a.options, a.biweekly, ctx.distribution_policy)
  );
}

function slotKey(day: number, lesson: number): string {
  return `${day}:${lesson}`;
}

function occurrenceKey(e: Pick<SolverSlot, 'assignment_id' | 'class_section' | 'day_of_week' | 'lesson_num'>): string {
  return `${e.assignment_id}:${e.class_section}:${e.day_of_week}:${e.lesson_num}`;
}

function assignSectionKey(assignmentId: string, section: string): string {
  return `${assignmentId}:${section}`;
}

function better(a: Cost, b: Cost): boolean {
  if (a.unplaced !== b.unplaced) return a.unplaced < b.unplaced;
  return a.soft_penalty < b.soft_penalty;
}

function ruleWeight(ctx: SolverContext, key: string, section: string, fallback = 5): number {
  const r = rulesForSection(ctx, section)[key];
  if (!r?.active) return 0;
  const w = r.weight ?? fallback;
  return isStrictRule(ctx, key, section) ? Math.max(w, 14) * 100 : w;
}

function isPeMusic(name: string): boolean {
  return /beden|müzik|muzik|spor|fizik\s*etkin/i.test(name);
}

function isPractical(name: string): boolean {
  return /uygulama|atölye|laboratuvar|\blab\b|pratik/i.test(name);
}

function peMusicAllowedDays(ctx: SolverContext, section: string): number[] {
  const p = rulesForSection(ctx, section).meb_pe_music_days?.params as { days?: number[] } | undefined;
  return Array.isArray(p?.days) && p.days.length ? p.days : [2, 4];
}

function maxRunCap(ctx: SolverContext, section: string): number {
  const p = rulesForSection(ctx, section).four_plus_consecutive?.params as { max_run?: number } | undefined;
  const n = Number(p?.max_run ?? 4);
  return n >= 2 && n <= 8 ? Math.floor(n) : 4;
}

function minGapDays(ctx: SolverContext, section: string): number {
  const p = rulesForSection(ctx, section).two_two_day_gap?.params as { min_gap?: number } | undefined;
  const n = Number(p?.min_gap ?? 2);
  return n >= 2 && n <= 6 ? Math.floor(n) : 2;
}

function teacherDayKey(userId: string, day: number): string {
  return `${userId}:${day}`;
}

function buildingOf(ctx: SolverContext, roomId: string | null): string | null {
  if (!roomId) return null;
  return ctx.room_building.get(roomId) ?? null;
}

function countGaps(sortedLessons: number[]): number {
  if (sortedLessons.length < 2) return 0;
  const span = sortedLessons[sortedLessons.length - 1]! - sortedLessons[0]! + 1;
  return Math.max(0, span - sortedLessons.length);
}

type PenaltyIndex = {
  byAssignment: Map<string, number>;
  byTeacher: Map<string, number>;
  total: number;
};

function computeAssignmentPenalty(
  assignment: SolverAssignment,
  entries: SearchEntry[],
  ctx: SolverContext,
): number {
  const section = assignment.class_sections?.[0] ?? '';
  const mine = entries.filter((e) => e.assignment_id === assignment.id);
  if (!mine.length) return 0;

  let penalty = 0;
  const effH = effHours(assignment);
  const scorePattern = distributionPatternForScoring(
    assignment.weekly_hours,
    assignment.options,
    assignment.biweekly,
    ctx.distribution_policy,
  );
  if (scorePattern) {
    const byDayLessons = assignmentByDayLessons(mine, assignment.id);
    const placedHours = [...byDayLessons.values()].reduce((s, lessons) => s + lessons.length, 0);
    if (placedHours >= effH && !matchesDayDistributionPattern(byDayLessons, scorePattern)) {
      penalty += shouldEnforceDistributionPattern(ctx.distribution_policy) ? 28 : 22;
    }
  }

  const blockSpec = assignmentPlacementSpec(assignment.options, assignment.weekly_hours, assignment.biweekly);
  if (mine.length && !assignmentBlockPlacementOkForAssignment(mine, assignment.id, blockSpec)) {
    penalty += 24;
  }

  const byDayLessons = assignmentByDayLessons(mine, assignment.id);
  const daysUsed = byDayLessons.size;

  if (ruleOnForAssignment(ctx, 'distribute_week', section, assignment) && assignment.weekly_hours >= 3) {
    const minDays = effectiveMinDaysPerWeek(assignment, placementPatternForAssignment(assignment, effH, ctx));
    if (minDays != null && daysUsed < minDays) penalty += ruleWeight(ctx, 'distribute_week', section, 10);
  }

  for (const [, lessons] of byDayLessons) {
    if (ruleOnForAssignment(ctx, 'max_two_per_day', section, assignment) && lessons.length > 2) {
      penalty += ruleWeight(ctx, 'max_two_per_day', section, 10);
    }
    if (ruleOnForAssignment(ctx, 'max_one_per_day', section, assignment) && lessons.length > 1) {
      penalty += ruleWeight(ctx, 'max_one_per_day', section, 8);
    }
    if (ruleOnForAssignment(ctx, 'same_day_consecutive', section, assignment) && lessons.length >= 2) {
      if (!lessonsOnDayConsecutive(lessons)) {
        penalty += ruleWeight(ctx, 'same_day_consecutive', section, 10);
      }
    }
  }
  if (ruleOnForAssignment(ctx, 'two_same_day', section, assignment) && effH === 2 && daysUsed > 1) {
    penalty += ruleWeight(ctx, 'two_same_day', section, 8);
  }
  if (
    ruleOnForAssignment(ctx, 'two_not_same_day', section, assignment) &&
    effH === 2 &&
    [...byDayLessons.values()].some((lessons) => lessons.length > 1)
  ) {
    penalty += ruleWeight(ctx, 'two_not_same_day', section, 7);
  }
  if (ruleOnForAssignment(ctx, 'two_not_consecutive_days', section, assignment) && effH === 2) {
    const dows = [...byDayLessons.keys()].sort((x, y) => x - y);
    for (let i = 1; i < dows.length; i++) {
      if (dows[i]! - dows[i - 1]! === 1) {
        penalty += ruleWeight(ctx, 'two_not_consecutive_days', section, 7);
        break;
      }
    }
  }
  if (ruleOnForAssignment(ctx, 'two_two_day_gap', section, assignment) && effH === 2) {
    const dows = [...byDayLessons.keys()].sort((x, y) => x - y);
    const gap = minGapDays(ctx, section);
    for (let i = 1; i < dows.length; i++) {
      if (dows[i]! - dows[i - 1]! < gap) {
        penalty += ruleWeight(ctx, 'two_two_day_gap', section, 7);
        break;
      }
    }
  }
  for (const [, lessons] of byDayLessons) {
    if (ruleOnForAssignment(ctx, 'four_plus_consecutive', section, assignment) && lessons.length >= 2) {
      let run = 1;
      let maxRun = 1;
      for (let i = 1; i < lessons.length; i++) {
        if (lessons[i] === lessons[i - 1]! + 1) run++;
        else run = 1;
        maxRun = Math.max(maxRun, run);
      }
      if (maxRun >= maxRunCap(ctx, section)) penalty += ruleWeight(ctx, 'four_plus_consecutive', section, 5);
    }
    if (ruleOnForAssignment(ctx, 'min_two_per_day', section, assignment) && effH >= 2 && lessons.length === 1) {
      // Tek ders varsa ve 2+ tercih ediliyorsa; ikinci ders yok => ceza.
      penalty += ruleWeight(ctx, 'min_two_per_day', section, 6);
    }
  }

  if (ruleOn(ctx, 'meb_pe_music_days', section) && isPeMusic(assignment.subject_name)) {
    const allowed = peMusicAllowedDays(ctx, section);
    if (mine.some((e) => !allowed.includes(e.day_of_week))) penalty += ruleWeight(ctx, 'meb_pe_music_days', section, 8);
  }
  if (ruleOn(ctx, 'meb_theory_am_practical_pm', section) && isPractical(assignment.subject_name)) {
    if (mine.some((e) => e.lesson_num <= ctx.lunch_after_lesson)) {
      penalty += ruleWeight(ctx, 'meb_theory_am_practical_pm', section, 8);
    }
  }

  if (ruleOn(ctx, 'minimize_work_days', section) && assignment.teacher_ids[0]) {
    const tDays = new Set(mine.map((e) => e.day_of_week));
    penalty += tDays.size * ruleWeight(ctx, 'minimize_work_days', section, 8) * 0.2;
  }

  if (mine.length && ruleOnForAssignment(ctx, 'important_early', section, assignment)) {
    for (const e of mine) {
      if (e.lesson_num > 5) penalty += ruleWeight(ctx, 'important_early', section, 4);
    }
  }

  return penalty;
}

function computeTeacherPenalty(userId: string, entries: SearchEntry[], ctx: SolverContext): number {
  if (!userId) return 0;
  let penalty = 0;

  if (ruleOn(ctx, 'minimize_teacher_gaps', '')) {
    for (let d = 1; d <= 7; d++) {
      const dayLessons = entries
        .filter((e) => e.user_id === userId && e.day_of_week === d)
        .map((e) => e.lesson_num)
        .sort((a, b) => a - b);
      const gaps = countGaps(dayLessons);
      if (gaps > 0) penalty += gaps * ruleWeight(ctx, 'minimize_teacher_gaps', '', 12) * 0.5;
    }
  }

  if (ruleOn(ctx, 'minimize_building_moves', '') && ctx.room_building.size > 0) {
    const byDay = new Map<number, SearchEntry[]>();
    for (const e of entries) {
      if (e.user_id !== userId) continue;
      const arr = byDay.get(e.day_of_week) ?? [];
      arr.push(e);
      byDay.set(e.day_of_week, arr);
    }
    for (const slots of byDay.values()) {
      const buildings = slots
        .sort((a, b) => a.lesson_num - b.lesson_num)
        .map((s) => buildingOf(ctx, s.room_id))
        .filter(Boolean) as string[];
      let moves = 0;
      for (let i = 1; i < buildings.length; i++) {
        if (buildings[i] !== buildings[i - 1]) moves++;
      }
      if (moves > 0) penalty += moves * ruleWeight(ctx, 'minimize_building_moves', '', 6) * 0.3;
    }
  }

  return penalty;
}

function computePenaltyIndex(
  assignments: SolverAssignment[],
  entries: SearchEntry[],
  ctx: SolverContext,
): PenaltyIndex {
  const byAssignment = new Map<string, number>();
  const byTeacher = new Map<string, number>();

  let total = 0;
  for (const a of assignments) {
    const p = computeAssignmentPenalty(a, entries, ctx);
    byAssignment.set(a.id, p);
    total += p;
  }
  const teacherIds = new Set(entries.map((e) => e.user_id).filter(Boolean) as string[]);
  for (const tid of teacherIds) {
    const p = computeTeacherPenalty(tid, entries, ctx);
    byTeacher.set(tid, p);
    total += p;
  }
  return { byAssignment, byTeacher, total };
}

type SearchState = {
  nextId: number;
  entries: Map<number, SearchEntry>;
  entryIds: number[];
  bySlot: Map<string, Set<number>>;
  byAssignment: Map<string, Set<number>>;
  byTeacher: Map<string, Set<number>>;
  occMult: Map<string, number>;
  haveByAssignSection: Map<string, number>;
  requiredByAssignSection: Map<string, number>;
  unplaced: number;
  penalties: PenaltyIndex;
};

function listEntries(state: SearchState): SearchEntry[] {
  return state.entryIds.map((id) => state.entries.get(id)!).filter(Boolean);
}

function addIndexSet(map: Map<string, Set<number>>, key: string, id: number) {
  const s = map.get(key) ?? new Set<number>();
  s.add(id);
  map.set(key, s);
}

function removeIndexSet(map: Map<string, Set<number>>, key: string, id: number) {
  const s = map.get(key);
  if (!s) return;
  s.delete(id);
  if (!s.size) map.delete(key);
}

function updateUnplacedForAssignSection(
  state: SearchState,
  key: string,
  prevHave: number,
  nextHave: number,
) {
  const req = state.requiredByAssignSection.get(key) ?? 0;
  const prevDef = Math.max(0, req - prevHave);
  const nextDef = Math.max(0, req - nextHave);
  state.unplaced += nextDef - prevDef;
}

function bumpOccurrence(state: SearchState, e: SearchEntry, delta: 1 | -1) {
  const occ = occurrenceKey(e);
  const prev = state.occMult.get(occ) ?? 0;
  const next = prev + delta;
  if (next <= 0) state.occMult.delete(occ);
  else state.occMult.set(occ, next);

  // Unique occurrence affects haveByAssignSection once.
  if (prev === 0 && next > 0) {
    const k = assignSectionKey(e.assignment_id, e.class_section);
    const prevHave = state.haveByAssignSection.get(k) ?? 0;
    const nextHave = prevHave + 1;
    state.haveByAssignSection.set(k, nextHave);
    updateUnplacedForAssignSection(state, k, prevHave, nextHave);
  } else if (prev > 0 && next === 0) {
    const k = assignSectionKey(e.assignment_id, e.class_section);
    const prevHave = state.haveByAssignSection.get(k) ?? 0;
    const nextHave = Math.max(0, prevHave - 1);
    state.haveByAssignSection.set(k, nextHave);
    updateUnplacedForAssignSection(state, k, prevHave, nextHave);
  }
}

function pushEntry(state: SearchState, e: Omit<SearchEntry, '_id'>): number {
  const id = state.nextId++;
  const ne: SearchEntry = { ...e, _id: id };
  state.entries.set(id, ne);
  state.entryIds.push(id);
  addIndexSet(state.byAssignment, ne.assignment_id, id);
  if (ne.user_id) addIndexSet(state.byTeacher, ne.user_id, id);
  const sk = slotKey(ne.day_of_week, ne.lesson_num);
  addIndexSet(state.bySlot, sk, id);
  bumpOccurrence(state, ne, 1);
  return id;
}

function removeEntry(state: SearchState, id: number): SearchEntry | null {
  const e = state.entries.get(id);
  if (!e) return null;
  state.entries.delete(id);

  const pos = state.entryIds.indexOf(id);
  if (pos >= 0) {
    const last = state.entryIds[state.entryIds.length - 1]!;
    state.entryIds[pos] = last;
    state.entryIds.pop();
  }

  removeIndexSet(state.byAssignment, e.assignment_id, id);
  if (e.user_id) removeIndexSet(state.byTeacher, e.user_id, id);
  removeIndexSet(state.bySlot, slotKey(e.day_of_week, e.lesson_num), id);
  bumpOccurrence(state, e, -1);
  return e;
}

function rebuildPenaltyFor(state: SearchState, assignmentsById: Map<string, SolverAssignment>, affectedAssignments: Set<string>, affectedTeachers: Set<string>, ctx: SolverContext) {
  const entries = listEntries(state);
  let total = state.penalties.total;
  for (const aid of affectedAssignments) {
    const a = assignmentsById.get(aid);
    if (!a) continue;
    const prev = state.penalties.byAssignment.get(aid) ?? 0;
    const next = computeAssignmentPenalty(a, entries, ctx);
    state.penalties.byAssignment.set(aid, next);
    total += next - prev;
  }
  for (const tid of affectedTeachers) {
    const prev = state.penalties.byTeacher.get(tid) ?? 0;
    const next = computeTeacherPenalty(tid, entries, ctx);
    state.penalties.byTeacher.set(tid, next);
    total += next - prev;
  }
  state.penalties.total = total;
}

function buildInitialState(
  assignments: SolverAssignment[],
  ctx: SolverContext,
  seedEntries: SolverSlot[],
): SearchState {
  const requiredByAssignSection = new Map<string, number>();
  for (const a of assignments) {
    const secs = a.class_sections?.length ? a.class_sections : [''];
    const h = effHours(a);
    for (const sec of secs) {
      const k = assignSectionKey(a.id, sec);
      requiredByAssignSection.set(k, (requiredByAssignSection.get(k) ?? 0) + h);
    }
  }

  const state: SearchState = {
    nextId: 1,
    entries: new Map(),
    entryIds: [],
    bySlot: new Map(),
    byAssignment: new Map(),
    byTeacher: new Map(),
    occMult: new Map(),
    haveByAssignSection: new Map(),
    requiredByAssignSection,
    unplaced: 0,
    penalties: { byAssignment: new Map(), byTeacher: new Map(), total: 0 },
  };

  // Init have = 0
  for (const k of requiredByAssignSection.keys()) state.haveByAssignSection.set(k, 0);
  // Init unplaced = sum(req)
  for (const [k, req] of requiredByAssignSection) {
    updateUnplacedForAssignSection(state, k, req, 0);
  }

  for (const e of seedEntries.filter(Boolean)) {
    pushEntry(state, {
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      class_section: e.class_section,
      subject: e.subject,
      user_id: e.user_id,
      assignment_id: e.assignment_id,
      room_id: e.room_id ?? null,
      group_id: e.group_id ?? null,
    });
  }

  state.penalties = computePenaltyIndex(assignments, listEntries(state), ctx);
  return state;
}

function randomCandidateSlot(ctx: SolverContext): { day: number; lesson: number } | null {
  const days = ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5];
  if (!days.length) return null;
  const day = days[randInt(days.length)]!;
  const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
  const all = Array.from({ length: dayMax }, (_, i) => i + 1).filter((n) => !ctx.blocked_lesson_nums.has(n));
  if (!all.length) return null;
  const lesson = all[randInt(all.length)]!;
  return { day, lesson };
}

function missingHoursForPick(state: SearchState, pick: string): number {
  const req = state.requiredByAssignSection.get(pick) ?? 0;
  const have = state.haveByAssignSection.get(pick) ?? 0;
  return Math.max(0, req - have);
}

function entryIdsProtectedFromEject(
  state: SearchState,
  ids: number[],
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): boolean {
  if (!shouldEnforceDistributionPattern(ctx.distribution_policy)) return false;
  const all = listEntries(state);
  for (const oid of ids) {
    const oe = state.entries.get(oid);
    if (!oe) continue;
    const oa = assignmentsById.get(oe.assignment_id);
    if (!oa) continue;
    const pat = distributionPatternForScoring(
      oa.weekly_hours,
      oa.options,
      oa.biweekly,
      ctx.distribution_policy,
    );
    if (!pat) continue;
    const byDay = assignmentByDayLessons(all, oa.id);
    if (matchesDayDistributionPattern(byDay, pat)) return true;
  }
  return false;
}

/** enforce_pattern: kapsama artışı desen cezasını büyütmemeli. */
function patternEnforceAccept(current: Cost, next: Cost): boolean {
  if (next.unplaced < current.unplaced && next.soft_penalty <= current.soft_penalty) return true;
  if (next.unplaced === current.unplaced && next.soft_penalty < current.soft_penalty) return true;
  return false;
}

/** Eksik saatleri tek tek değil, desen bloğu olarak yerleştirmeyi dene. */
function tryInsertPatternChunk(
  state: SearchState,
  a: SolverAssignment,
  classSection: string,
  uid: string | null,
  chunkSize: number,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; inserted: number[] } | null {
  if (chunkSize < 1) return null;
  const days = ctx.work_days?.length ? [...ctx.work_days] : [1, 2, 3, 4, 5];
  shuffleInPlace(days);
  const entriesNow = listEntries(state);
  const priorChunkDays = assignmentChunkDays(entriesNow, a.id);
  for (const day of days) {
    if (!patternChunkDayAllowed(priorChunkDays, day)) continue;
    const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
    const starts =
      chunkSize === 1
        ? Array.from({ length: dayMax }, (_, i) => i + 1).filter((n) => !ctx.blocked_lesson_nums.has(n))
        : Array.from({ length: Math.max(0, dayMax - chunkSize + 1) }, (_, i) => i + 1);
    shuffleInPlace(starts);
    for (const start of starts) {
      if (chunkSize >= 2 && ctx.blocked_lesson_nums.has(start)) continue;
      const occupied = new Map<string, SolverSlot[]>();
      let ok = true;
      for (let i = 0; i < chunkSize; i++) {
        const lesson = start + i;
        const remain = entriesNow.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
        if (remain.length) occupied.set(slotKey(day, lesson), remain);
        if (!placementAllowed(entriesNow, occupied, a, classSection, day, lesson, uid, ctx)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const inserted: number[] = [];
      const apply = () => {
        for (let i = 0; i < chunkSize; i++) {
          const id = pushEntry(state, {
            day_of_week: day,
            lesson_num: start + i,
            class_section: classSection,
            subject: a.subject_name,
            user_id: uid,
            assignment_id: a.id,
            room_id: a.room_ids?.[0] ?? null,
            group_id: a.group_id ?? null,
          });
          inserted.push(id);
        }
      };
      const undo = () => {
        for (const id of inserted) removeEntry(state, id);
      };
      return { apply, undo, inserted };
    }
  }
  return null;
}

/** Ardışık desen bloğu için slotları boşaltıp yerleştir (tek saatlik insert yerine). */
function tryInsertPatternChunkWithEjection(
  state: SearchState,
  a: SolverAssignment,
  classSection: string,
  uid: string | null,
  chunkSize: number,
  ctx: SolverContext,
  assignmentsById: Map<string, SolverAssignment>,
): { apply: () => void; undo: () => void; inserted: number[] } | null {
  const days = ctx.work_days?.length ? [...ctx.work_days] : [1, 2, 3, 4, 5];
  shuffleInPlace(days);
  const entriesNow = listEntries(state);
  const priorChunkDays = assignmentChunkDays(entriesNow, a.id);
  for (const day of days) {
    if (!patternChunkDayAllowed(priorChunkDays, day)) continue;
    const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
    const tryStarts =
      chunkSize === 1
        ? Array.from({ length: dayMax }, (_, i) => i + 1).filter((n) => !ctx.blocked_lesson_nums.has(n))
        : Array.from({ length: Math.max(0, dayMax - chunkSize + 1) }, (_, i) => i + 1);
    shuffleInPlace(tryStarts);
    for (const start of tryStarts) {
      if (chunkSize >= 2 && ctx.blocked_lesson_nums.has(start)) continue;
      if (chunkSize === 1) {
        const set = state.bySlot.get(slotKey(day, start));
        const flat = set ? [...set] : [];
        const tryEject: number[][] = [[]];
        if (flat.length) {
          shuffleInPlace(flat);
          tryEject.push(...flat.slice(0, 5).map((x) => [x]));
        }
        for (const ejectIds of tryEject) {
          if (entryIdsProtectedFromEject(state, ejectIds, assignmentsById, ctx)) continue;
          const rest = entriesNow.filter((e) => !ejectIds.includes(e._id));
          const occupied = new Map<string, SolverSlot[]>();
          const remain = rest.filter((e) => e.day_of_week === day && e.lesson_num === start);
          if (remain.length) occupied.set(slotKey(day, start), remain);
          if (!placementAllowed(rest, occupied, a, classSection, day, start, uid, ctx)) continue;
          const inserted: number[] = [];
          const removed: SearchEntry[] = [];
          const apply = () => {
            for (const oid of ejectIds) {
              const oe = removeEntry(state, oid);
              if (oe) removed.push(oe);
            }
            const id = pushEntry(state, {
              day_of_week: day,
              lesson_num: start,
              class_section: classSection,
              subject: a.subject_name,
              user_id: uid,
              assignment_id: a.id,
              room_id: a.room_ids?.[0] ?? null,
              group_id: a.group_id ?? null,
            });
            inserted.push(id);
          };
          const undo = () => {
            for (const id of inserted) removeEntry(state, id);
            for (const r of removed) {
              pushEntry(state, {
                day_of_week: r.day_of_week,
                lesson_num: r.lesson_num,
                class_section: r.class_section,
                subject: r.subject,
                user_id: r.user_id,
                assignment_id: r.assignment_id,
                room_id: r.room_id,
                group_id: r.group_id,
              });
            }
          };
          return { apply, undo, inserted };
        }
        continue;
      }
      const slotIds: number[][] = [];
      for (let i = 0; i < chunkSize; i++) {
        const lesson = start + i;
        const set = state.bySlot.get(slotKey(day, lesson));
        slotIds.push(set ? [...set] : []);
      }
      const flat = slotIds.flat();
      const tryEject: number[][] = [[]];
      if (flat.length) {
        shuffleInPlace(flat);
        tryEject.push(...flat.slice(0, 5).map((x) => [x]));
        for (let i = 0; i < Math.min(3, flat.length); i++) {
          for (let j = i + 1; j < Math.min(i + 4, flat.length); j++) {
            tryEject.push([flat[i]!, flat[j]!]);
          }
        }
      }
      for (const ejectIds of tryEject) {
        if (entryIdsProtectedFromEject(state, ejectIds, assignmentsById, ctx)) continue;
        const rest = entriesNow.filter((e) => !ejectIds.includes(e._id));
        const occupied = new Map<string, SolverSlot[]>();
        let ok = true;
        for (let i = 0; i < chunkSize; i++) {
          const lesson = start + i;
          const remain = rest.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
          if (remain.length) occupied.set(slotKey(day, lesson), remain);
          if (!placementAllowed(rest, occupied, a, classSection, day, lesson, uid, ctx)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const inserted: number[] = [];
        const removed: SearchEntry[] = [];
        const apply = () => {
          for (const oid of ejectIds) {
            const oe = removeEntry(state, oid);
            if (oe) removed.push(oe);
          }
          for (let i = 0; i < chunkSize; i++) {
            const id = pushEntry(state, {
              day_of_week: day,
              lesson_num: start + i,
              class_section: classSection,
              subject: a.subject_name,
              user_id: uid,
              assignment_id: a.id,
              room_id: a.room_ids?.[0] ?? null,
              group_id: a.group_id ?? null,
            });
            inserted.push(id);
          }
        };
        const undo = () => {
          for (const id of inserted) removeEntry(state, id);
          for (const r of removed) {
            pushEntry(state, {
              day_of_week: r.day_of_week,
              lesson_num: r.lesson_num,
              class_section: r.class_section,
              subject: r.subject,
              user_id: r.user_id,
              assignment_id: r.assignment_id,
              room_id: r.room_id,
              group_id: r.group_id,
            });
          }
        };
        return { apply, undo, inserted };
      }
    }
  }
  return null;
}

function makeMissingPickList(state: SearchState): string[] {
  const out: string[] = [];
  for (const [k, req] of state.requiredByAssignSection) {
    const have = state.haveByAssignSection.get(k) ?? 0;
    const def = Math.max(0, req - have);
    for (let i = 0; i < Math.min(3, def); i++) out.push(k);
  }
  return out;
}

type SearchMove = {
  apply: () => void;
  undo: () => void;
  affectedAssignments: Set<string>;
  affectedTeachers: Set<string>;
};

function sectionOccupiedInState(
  state: SearchState,
  classSection: string,
  day: number,
  lesson: number,
): boolean {
  const set = state.bySlot.get(slotKey(day, lesson));
  if (!set) return false;
  for (const id of set) {
    const e = state.entries.get(id);
    if (e?.class_section === classSection) return true;
  }
  return false;
}

function findSectionEntry(
  state: SearchState,
  classSection: string,
  day: number,
  lesson: number,
): SearchEntry | null {
  const set = state.bySlot.get(slotKey(day, lesson));
  if (!set) return null;
  for (const id of set) {
    const e = state.entries.get(id);
    if (e?.class_section === classSection) return e;
  }
  return null;
}

function teacherOccupiedInState(
  state: SearchState,
  userId: string,
  day: number,
  lesson: number,
): boolean {
  const set = state.bySlot.get(slotKey(day, lesson));
  if (!set) return false;
  for (const id of set) {
    const e = state.entries.get(id);
    if (e?.user_id === userId) return true;
  }
  return false;
}

function findTeacherEntry(
  state: SearchState,
  userId: string,
  day: number,
  lesson: number,
): SearchEntry | null {
  const set = state.bySlot.get(slotKey(day, lesson));
  if (!set) return null;
  for (const id of set) {
    const e = state.entries.get(id);
    if (e?.user_id === userId) return e;
  }
  return null;
}

function canMoveEntry(
  state: SearchState,
  entry: SearchEntry,
  toDay: number,
  toLesson: number,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): boolean {
  if (entry.day_of_week === toDay && entry.lesson_num === toLesson) return false;
  const a = assignmentsById.get(entry.assignment_id);
  if (!a) return false;
  const rest = listEntries(state).filter((x) => x._id !== entry._id);
  const occupied = new Map<string, SolverSlot[]>();
  const remain = rest.filter((x) => x.day_of_week === toDay && x.lesson_num === toLesson);
  if (remain.length) occupied.set(slotKey(toDay, toLesson), remain);
  return placementAllowed(rest, occupied, a, entry.class_section, toDay, toLesson, entry.user_id, ctx);
}

function chunkSizeForMissing(
  state: SearchState,
  a: SolverAssignment,
  pick: string,
  ctx: SolverContext,
): number {
  const missing = missingHoursForPick(state, pick);
  if (missing <= 0) return 0;
  const pattern = splitPatternForAssignment(a, ctx);
  if (pattern) {
    const remain = remainingPatternChunks(
      a.id,
      listEntries(state).map((e) => ({
        assignment_id: e.assignment_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
      })),
      pattern,
    ).filter((c) => c <= missing);
    if (remain.length) return remain[0]!;
  }
  return missing >= 2 ? 2 : 1;
}

function blockPlacementFeasible(
  entries: SearchEntry[],
  a: SolverAssignment,
  classSection: string,
  uid: string | null,
  day: number,
  start: number,
  chunkSize: number,
  ctx: SolverContext,
): boolean {
  const occupied = new Map<string, SolverSlot[]>();
  for (let i = 0; i < chunkSize; i++) {
    const lesson = start + i;
    const remain = entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
    if (remain.length) occupied.set(slotKey(day, lesson), remain);
    if (!placementAllowed(entries, occupied, a, classSection, day, lesson, uid, ctx)) return false;
  }
  return true;
}

function allWorkSlots(ctx: SolverContext): Array<{ day: number; lesson: number }> {
  const out: Array<{ day: number; lesson: number }> = [];
  const days = ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5];
  for (const day of days) {
    const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (!ctx.blocked_lesson_nums.has(lesson)) out.push({ day, lesson });
    }
  }
  return out;
}

/** Sınıf tablosunda tek ders kaydırarak 2'li blok aç + eksik kartı yerleştir. */
function proposeClassShiftForBlock2(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): SearchMove | null {
  const picks = shuffleInPlace([...makeMissingPickList(state)]);
  for (const pick of picks) {
    const [assignmentId, classSection] = pick.split(':');
    const a = assignmentsById.get(assignmentId);
    if (!a) continue;
    const missing = missingHoursForPick(state, pick);
    if (missing < 1) continue;
    const uid = a.teacher_ids?.[0] ?? null;
    const chunkSize = Math.min(missing, chunkSizeForMissing(state, a, pick, ctx));
    if (chunkSize < 2) continue;

    const days = shuffleInPlace([...(ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5])]);
    for (const day of days) {
      const end = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
      const starts = shuffleInPlace(Array.from({ length: Math.max(0, end - chunkSize + 1) }, (_, i) => i + 1));
      for (const start of starts) {
        if (ctx.blocked_lesson_nums.has(start) || ctx.blocked_lesson_nums.has(start + 1)) continue;
          const occA = sectionOccupiedInState(state, classSection, day, start);
          const occB = sectionOccupiedInState(state, classSection, day, start + 1);
          if (occA === occB) continue;
          const dest = occA ? start + 2 : start - 1;
          if (dest < 1 || dest > end || ctx.blocked_lesson_nums.has(dest)) continue;
          if (sectionOccupiedInState(state, classSection, day, dest)) continue;
          const srcLesson = occA ? start : start + 1;
          const shiftEntry = findSectionEntry(state, classSection, day, srcLesson);
          if (!shiftEntry) continue;
          if (!canMoveEntry(state, shiftEntry, day, dest, assignmentsById, ctx)) continue;

          const entriesAfterShift = listEntries(state)
            .filter((x) => x._id !== shiftEntry._id)
            .concat([{ ...shiftEntry, day_of_week: day, lesson_num: dest }]);
          if (!blockPlacementFeasible(entriesAfterShift, a, classSection, uid, day, start, chunkSize, ctx)) {
            continue;
          }

          const shiftBefore = { day: shiftEntry.day_of_week, lesson: shiftEntry.lesson_num };
          const inserted: number[] = [];
          const apply = () => {
            removeIndexSet(state.bySlot, slotKey(shiftEntry.day_of_week, shiftEntry.lesson_num), shiftEntry._id);
            bumpOccurrence(state, shiftEntry, -1);
            shiftEntry.day_of_week = day;
            shiftEntry.lesson_num = dest;
            addIndexSet(state.bySlot, slotKey(day, dest), shiftEntry._id);
            bumpOccurrence(state, shiftEntry, 1);
            for (let i = 0; i < chunkSize; i++) {
              inserted.push(
                pushEntry(state, {
                  day_of_week: day,
                  lesson_num: start + i,
                  class_section: classSection,
                  subject: a.subject_name,
                  user_id: uid,
                  assignment_id: a.id,
                  room_id: a.room_ids?.[0] ?? null,
                  group_id: a.group_id ?? null,
                }),
              );
            }
          };
          const undo = () => {
            for (const id of inserted) removeEntry(state, id);
            removeIndexSet(state.bySlot, slotKey(shiftEntry.day_of_week, shiftEntry.lesson_num), shiftEntry._id);
            bumpOccurrence(state, shiftEntry, -1);
            shiftEntry.day_of_week = shiftBefore.day;
            shiftEntry.lesson_num = shiftBefore.lesson;
            addIndexSet(state.bySlot, slotKey(shiftBefore.day, shiftBefore.lesson), shiftEntry._id);
            bumpOccurrence(state, shiftEntry, 1);
          };
          const affectedAssignments = new Set<string>([a.id, shiftEntry.assignment_id]);
          const affectedTeachers = new Set<string>(
            [uid ?? '', shiftEntry.user_id ?? ''].filter(Boolean) as string[],
          );
        return { apply, undo, affectedAssignments, affectedTeachers };
      }
    }
  }
  return null;
}

/** Sınıfta boş 2'li var; öğretmeni engelleyen dersi kaydır + eksik kartı yerleştir. */
function proposeTeacherUnblockForBlock2(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): SearchMove | null {
  const picks = shuffleInPlace([...makeMissingPickList(state)]);
  for (const pick of picks) {
    const [assignmentId, classSection] = pick.split(':');
    const a = assignmentsById.get(assignmentId);
    if (!a) continue;
    const missing = missingHoursForPick(state, pick);
    if (missing < 1) continue;
    const uid = a.teacher_ids?.[0] ?? null;
    if (!uid) continue;
    const chunkSize = Math.min(missing, chunkSizeForMissing(state, a, pick, ctx));
    if (chunkSize < 1) continue;

    const days = shuffleInPlace([...(ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5])]);
    for (const day of days) {
      const end = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
      const starts =
        chunkSize >= 2
          ? shuffleInPlace(Array.from({ length: Math.max(0, end - 1) }, (_, i) => i + 1))
          : shuffleInPlace(Array.from({ length: end }, (_, i) => i + 1));
      for (const start of starts) {
        if (chunkSize >= 2) {
          if (ctx.blocked_lesson_nums.has(start) || ctx.blocked_lesson_nums.has(start + 1)) continue;
          if (
            sectionOccupiedInState(state, classSection, day, start) ||
            sectionOccupiedInState(state, classSection, day, start + 1)
          ) {
            continue;
          }
        } else if (sectionOccupiedInState(state, classSection, day, start)) {
          continue;
        }

        const blockLessons =
          chunkSize >= 2
            ? [start, start + 1].filter((l) => teacherOccupiedInState(state, uid, day, l))
            : teacherOccupiedInState(state, uid, day, start)
              ? [start]
              : [];
        if (!blockLessons.length) continue;

        const entriesNow = listEntries(state);
        if (blockPlacementFeasible(entriesNow, a, classSection, uid, day, start, chunkSize, ctx)) continue;

        for (const blockLesson of blockLessons) {
          const blocker = findTeacherEntry(state, uid, day, blockLesson);
          if (!blocker) continue;
          const blockerA = assignmentsById.get(blocker.assignment_id);
          if (!blockerA) continue;

          const destSlots = shuffleInPlace(allWorkSlots(ctx));
          for (const { day: destDay, lesson: destLesson } of destSlots) {
            if (destDay === day && destLesson === blockLesson) continue;
            if (chunkSize >= 2 && destDay === day && (destLesson === start || destLesson === start + 1)) {
              continue;
            }
            if (!canMoveEntry(state, blocker, destDay, destLesson, assignmentsById, ctx)) continue;

            const entriesAfterMove = listEntries(state)
              .filter((x) => x._id !== blocker._id)
              .concat([{ ...blocker, day_of_week: destDay, lesson_num: destLesson }]);
            if (!blockPlacementFeasible(entriesAfterMove, a, classSection, uid, day, start, chunkSize, ctx)) {
              continue;
            }

            const blockerBefore = { day: blocker.day_of_week, lesson: blocker.lesson_num };
            const inserted: number[] = [];
            const apply = () => {
              removeIndexSet(state.bySlot, slotKey(blocker.day_of_week, blocker.lesson_num), blocker._id);
              bumpOccurrence(state, blocker, -1);
              blocker.day_of_week = destDay;
              blocker.lesson_num = destLesson;
              addIndexSet(state.bySlot, slotKey(destDay, destLesson), blocker._id);
              bumpOccurrence(state, blocker, 1);
              for (let i = 0; i < chunkSize; i++) {
                inserted.push(
                  pushEntry(state, {
                    day_of_week: day,
                    lesson_num: start + i,
                    class_section: classSection,
                    subject: a.subject_name,
                    user_id: uid,
                    assignment_id: a.id,
                    room_id: a.room_ids?.[0] ?? null,
                    group_id: a.group_id ?? null,
                  }),
                );
              }
            };
            const undo = () => {
              for (const id of inserted) removeEntry(state, id);
              removeIndexSet(state.bySlot, slotKey(blocker.day_of_week, blocker.lesson_num), blocker._id);
              bumpOccurrence(state, blocker, -1);
              blocker.day_of_week = blockerBefore.day;
              blocker.lesson_num = blockerBefore.lesson;
              addIndexSet(state.bySlot, slotKey(blockerBefore.day, blockerBefore.lesson), blocker._id);
              bumpOccurrence(state, blocker, 1);
            };
            const affectedAssignments = new Set<string>([a.id, blocker.assignment_id]);
            const affectedTeachers = new Set<string>([uid]);
            return { apply, undo, affectedAssignments, affectedTeachers };
          }
        }
      }
    }
  }
  return null;
}

function proposeCoveragePrepMoves(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): SearchMove | null {
  const prep = [
    () => proposeClassShiftForBlock2(state, assignmentsById, ctx),
    () => proposeTeacherUnblockForBlock2(state, assignmentsById, ctx),
    () => proposeInsertWithEjection(state, assignmentsById, ctx),
  ];
  shuffleInPlace(prep);
  for (const fn of prep) {
    const m = fn();
    if (m) return m;
  }
  return proposeInsertWithEjection(state, assignmentsById, ctx);
}

function proposeInsertWithEjection(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> } | null {
  const pickList = makeMissingPickList(state);
  if (!pickList.length) return null;
  const pick = pickList[randInt(pickList.length)]!;
  const [assignmentId, classSection] = pick.split(':');
  const a = assignmentsById.get(assignmentId);
  if (!a) return null;
  const uid = a.teacher_ids?.[0] ?? null;
  const protectPattern = shouldEnforceDistributionPattern(ctx.distribution_policy);

  const missing = missingHoursForPick(state, pick);
  const pattern = splitPatternForAssignment(a, ctx);
  if (pattern && missing > 0) {
    const remainChunks = remainingPatternChunks(
      a.id,
      listEntries(state).map((e) => ({
        assignment_id: e.assignment_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
      })),
      pattern,
    )
      .filter((c) => c <= missing)
      .sort((x, y) => (missing <= 1 || x === 1 ? x - y : y - x));
    for (const chunk of remainChunks) {
      const chunkMove =
        tryInsertPatternChunk(state, a, classSection, uid, chunk, ctx) ??
        tryInsertPatternChunkWithEjection(state, a, classSection, uid, chunk, ctx, assignmentsById);
      if (!chunkMove) continue;
      const affectedAssignments = new Set<string>([a.id]);
      const affectedTeachers = new Set<string>([uid ?? ''].filter(Boolean) as string[]);
      return {
        apply: chunkMove.apply,
        undo: chunkMove.undo,
        affectedAssignments,
        affectedTeachers,
      };
    }
    const remainAfter = remainingPatternChunks(
      a.id,
      listEntries(state).map((e) => ({
        assignment_id: e.assignment_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
      })),
      pattern,
    );
    const onlySinglesLeft =
      remainAfter.length > 0 && remainAfter.every((c) => c === 1) && missing <= remainAfter.length;
    if (protectPattern && remainAfter.some((c) => c >= 2) && !onlySinglesLeft) return null;
  }

  const entriesNow = listEntries(state);

  // Önce uygun BOŞ slotları (ejection'sız) sistematik tara — yoğun programda
  // rastgele slot seçimi boşluğu çok nadir yakaladığından kapsama düşüyordu.
  const days = ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5];
  const slotCandidates: Array<{ day: number; lesson: number }> = [];
  for (const day of days) {
    const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (ctx.blocked_lesson_nums.has(lesson)) continue;
      slotCandidates.push({ day, lesson });
    }
  }
  shuffleInPlace(slotCandidates);

  let chosen: { day: number; lesson: number; eject: number[] } | null = null;

  // 1) Boş yerleştirme (eject yok).
  for (const { day, lesson } of slotCandidates) {
    const occupied = new Map<string, SolverSlot[]>();
    const remainSlot = entriesNow.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
    if (remainSlot.length) occupied.set(slotKey(day, lesson), remainSlot);
    if (placementAllowed(entriesNow, occupied, a, classSection, day, lesson, uid, ctx)) {
      chosen = { day, lesson, eject: [] };
      break;
    }
  }

  // 2) Boş bulunamadıysa az sayıda slotta ejection dene.
  if (!chosen) {
    for (const { day, lesson } of slotCandidates.slice(0, 40)) {
      const slotSet = state.bySlot.get(slotKey(day, lesson));
      const occupants = slotSet ? [...slotSet] : [];
      shuffleInPlace(occupants);
      const tryIds: number[][] = [
        ...occupants.slice(0, 4).map((x) => [x]),
        ...occupants.slice(0, 3).flatMap((x, i) =>
          occupants.slice(i + 1, i + 4).map((y) => [x, y]),
        ),
      ];
      for (const ejectIds of tryIds) {
        if (entryIdsProtectedFromEject(state, ejectIds, assignmentsById, ctx)) continue;
        const rest = entriesNow.filter((e) => !ejectIds.includes(e._id));
        const occupied = new Map<string, SolverSlot[]>();
        const remainSlot = rest.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
        if (remainSlot.length) occupied.set(slotKey(day, lesson), remainSlot);
        if (placementAllowed(rest, occupied, a, classSection, day, lesson, uid, ctx)) {
          chosen = { day, lesson, eject: ejectIds };
          break;
        }
      }
      if (chosen) break;
    }
  }
  if (!chosen) return null;
  const { day, lesson } = chosen;
  const chosenEject = chosen.eject;

  const inserted: { id: number }[] = [];
  const removed: SearchEntry[] = [];
  const apply = () => {
    for (const oid of chosenEject) {
      const oe = removeEntry(state, oid);
      if (oe) removed.push(oe);
    }
    const id = pushEntry(state, {
      day_of_week: day,
      lesson_num: lesson,
      class_section: classSection,
      subject: a.subject_name,
      user_id: uid,
      assignment_id: a.id,
      room_id: a.room_ids?.[0] ?? null,
      group_id: a.group_id ?? null,
    });
    inserted.push({ id });
  };
  const undo = () => {
    for (const it of inserted) removeEntry(state, it.id);
    for (const r of removed) {
      pushEntry(state, {
        day_of_week: r.day_of_week,
        lesson_num: r.lesson_num,
        class_section: r.class_section,
        subject: r.subject,
        user_id: r.user_id,
        assignment_id: r.assignment_id,
        room_id: r.room_id,
        group_id: r.group_id,
      });
    }
  };

  const affectedAssignments = new Set<string>([a.id, ...removed.map((x) => x.assignment_id)]);
  const affectedTeachers = new Set<string>([uid ?? '', ...removed.map((x) => x.user_id ?? '')].filter(Boolean) as string[]);
  return { apply, undo, affectedAssignments, affectedTeachers };
}

function proposeRandomMove(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> } | null {
  if (!state.entryIds.length) return null;
  const id = state.entryIds[randInt(state.entryIds.length)]!;
  const e = state.entries.get(id);
  if (!e) return null;
  const a = assignmentsById.get(e.assignment_id);
  if (!a) return null;

  const cand = randomCandidateSlot(ctx);
  if (!cand) return null;
  const { day, lesson } = cand;
  if (day === e.day_of_week && lesson === e.lesson_num) return null;

  // Hard-feasible mi?
  const rest = listEntries(state).filter((x) => x._id !== id);
  const occupied = new Map<string, SolverSlot[]>();
  const remainSlot = rest.filter((x) => x.day_of_week === day && x.lesson_num === lesson);
  if (remainSlot.length) occupied.set(slotKey(day, lesson), remainSlot);
  if (!placementAllowed(rest, occupied, a, e.class_section, day, lesson, e.user_id, ctx)) return null;

  const before = { ...e };
  const apply = () => {
    // Remove from indices and re-add with new slot.
    removeIndexSet(state.bySlot, slotKey(e.day_of_week, e.lesson_num), id);
    bumpOccurrence(state, e, -1);

    e.day_of_week = day;
    e.lesson_num = lesson;

    addIndexSet(state.bySlot, slotKey(e.day_of_week, e.lesson_num), id);
    bumpOccurrence(state, e, 1);
  };
  const undo = () => {
    removeIndexSet(state.bySlot, slotKey(e.day_of_week, e.lesson_num), id);
    bumpOccurrence(state, e, -1);
    e.day_of_week = before.day_of_week;
    e.lesson_num = before.lesson_num;
    addIndexSet(state.bySlot, slotKey(e.day_of_week, e.lesson_num), id);
    bumpOccurrence(state, e, 1);
  };

  const affectedAssignments = new Set<string>([a.id]);
  const affectedTeachers = new Set<string>([e.user_id ?? ''].filter(Boolean) as string[]);
  return { apply, undo, affectedAssignments, affectedTeachers };
}

function proposeSwapMove(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> } | null {
  if (state.entryIds.length < 2) return null;
  const id1 = state.entryIds[randInt(state.entryIds.length)]!;
  let id2 = state.entryIds[randInt(state.entryIds.length)]!;
  if (id1 === id2) return null;
  const e1 = state.entries.get(id1);
  const e2 = state.entries.get(id2);
  if (!e1 || !e2) return null;
  if (e1.day_of_week === e2.day_of_week && e1.lesson_num === e2.lesson_num) return null;

  const a1 = assignmentsById.get(e1.assignment_id);
  const a2 = assignmentsById.get(e2.assignment_id);
  if (!a1 || !a2) return null;

  const rest = listEntries(state).filter((x) => x._id !== id1 && x._id !== id2);

  const occ = new Map<string, SolverSlot[]>();
  const slotA = slotKey(e1.day_of_week, e1.lesson_num);
  const slotB = slotKey(e2.day_of_week, e2.lesson_num);
  const remA = rest.filter((x) => slotKey(x.day_of_week, x.lesson_num) === slotA);
  const remB = rest.filter((x) => slotKey(x.day_of_week, x.lesson_num) === slotB);
  if (remA.length) occ.set(slotA, remA);
  if (remB.length) occ.set(slotB, remB);

  const ok1 = placementAllowed(rest, occ, a1, e1.class_section, e2.day_of_week, e2.lesson_num, e1.user_id, ctx);
  if (!ok1) return null;
  const ok2 = placementAllowed(rest, occ, a2, e2.class_section, e1.day_of_week, e1.lesson_num, e2.user_id, ctx);
  if (!ok2) return null;

  const before1 = { ...e1 };
  const before2 = { ...e2 };
  const apply = () => {
    // Update indices + occurrences for both.
    removeIndexSet(state.bySlot, slotKey(e1.day_of_week, e1.lesson_num), id1);
    bumpOccurrence(state, e1, -1);
    removeIndexSet(state.bySlot, slotKey(e2.day_of_week, e2.lesson_num), id2);
    bumpOccurrence(state, e2, -1);

    const d1 = e1.day_of_week;
    const l1 = e1.lesson_num;
    e1.day_of_week = e2.day_of_week;
    e1.lesson_num = e2.lesson_num;
    e2.day_of_week = d1;
    e2.lesson_num = l1;

    addIndexSet(state.bySlot, slotKey(e1.day_of_week, e1.lesson_num), id1);
    bumpOccurrence(state, e1, 1);
    addIndexSet(state.bySlot, slotKey(e2.day_of_week, e2.lesson_num), id2);
    bumpOccurrence(state, e2, 1);
  };
  const undo = () => {
    removeIndexSet(state.bySlot, slotKey(e1.day_of_week, e1.lesson_num), id1);
    bumpOccurrence(state, e1, -1);
    removeIndexSet(state.bySlot, slotKey(e2.day_of_week, e2.lesson_num), id2);
    bumpOccurrence(state, e2, -1);

    e1.day_of_week = before1.day_of_week;
    e1.lesson_num = before1.lesson_num;
    e2.day_of_week = before2.day_of_week;
    e2.lesson_num = before2.lesson_num;

    addIndexSet(state.bySlot, slotKey(e1.day_of_week, e1.lesson_num), id1);
    bumpOccurrence(state, e1, 1);
    addIndexSet(state.bySlot, slotKey(e2.day_of_week, e2.lesson_num), id2);
    bumpOccurrence(state, e2, 1);
  };

  const affectedAssignments = new Set<string>([e1.assignment_id, e2.assignment_id]);
  const affectedTeachers = new Set<string>(
    [e1.user_id ?? '', e2.user_id ?? ''].filter(Boolean) as string[],
  );
  return { apply, undo, affectedAssignments, affectedTeachers };
}

function violatesBuildingRulesForRoomChange(
  rest: SearchEntry[],
  ctx: SolverContext,
  userId: string,
  day: number,
  lesson: number,
  newRoomId: string | null,
): boolean {
  const newB = buildingOf(ctx, newRoomId);
  const sameDay = rest.filter((e) => e.user_id === userId && e.day_of_week === day);
  if (ctx.no_building_same_day && newB) {
    for (const e of sameDay) {
      const b = buildingOf(ctx, e.room_id);
      if (b && b !== newB) return true;
    }
  }
  if (newB) {
    for (const e of sameDay) {
      const b = buildingOf(ctx, e.room_id);
      if (!b || b === newB) continue;
      const gap =
        ctx.building_travel_matrix.get(`${b}:${newB}`) ??
        ctx.building_travel_matrix.get(`${newB}:${b}`) ??
        ctx.building_travel_gap;
      if (gap > 0 && Math.abs(e.lesson_num - lesson) < gap) return true;
    }
  }
  return false;
}

function roomAllows(
  ctx: SolverContext,
  roomId: string | null,
  a: SolverAssignment,
  userId: string | null,
  classSection: string,
): boolean {
  if (!roomId) return true;
  const c = ctx.room_constraints.get(roomId);
  if (!c) return true;
  if (c.subjects?.length && !c.subjects.includes(a.subject_name)) return false;
  if (c.sections?.length && !c.sections.includes(classSection)) return false;
  if (c.teachers?.length && userId && !c.teachers.includes(userId)) return false;
  return true;
}

function proposeRoomMove(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> } | null {
  if (!state.entryIds.length) return null;
  const id = state.entryIds[randInt(state.entryIds.length)]!;
  const e = state.entries.get(id);
  if (!e) return null;
  const a = assignmentsById.get(e.assignment_id);
  if (!a) return null;
  const rooms = (a.room_ids ?? []).filter(Boolean);
  if (rooms.length < 2) return null;
  const candidates = rooms.filter((r) => r !== (e.room_id ?? null));
  if (!candidates.length) return null;
  const newRoomId = candidates[randInt(candidates.length)] ?? null;

  if (!roomAllows(ctx, newRoomId, a, e.user_id, e.class_section)) return null;
  if (e.user_id) {
    const rest = listEntries(state).filter((x) => x._id !== id);
    if (violatesBuildingRulesForRoomChange(rest, ctx, e.user_id, e.day_of_week, e.lesson_num, newRoomId)) return null;
  }

  const before = e.room_id ?? null;
  const apply = () => {
    e.room_id = newRoomId;
  };
  const undo = () => {
    e.room_id = before;
  };
  const affectedAssignments = new Set<string>([a.id]);
  const affectedTeachers = new Set<string>([e.user_id ?? ''].filter(Boolean) as string[]);
  return { apply, undo, affectedAssignments, affectedTeachers };
}

function proposeBlockMove(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> } | null {
  if (!state.entryIds.length) return null;
  const id = state.entryIds[randInt(state.entryIds.length)]!;
  const e = state.entries.get(id);
  if (!e) return null;
  const a = assignmentsById.get(e.assignment_id);
  if (!a) return null;
  const spec = assignmentPlacementSpec(a.options, a.weekly_hours, a.biweekly);
  const blockSize = spec.block_size >= 2 ? spec.block_size : 0;
  if (blockSize < 2 || blockSize > 4) return null;

  // Aynı gün ardışık blok var mı?
  const mineIds = state.byAssignment.get(a.id);
  if (!mineIds?.size) return null;
  const mine = [...mineIds].map((x) => state.entries.get(x)!).filter(Boolean);
  const sameDay = mine.filter(
    (x) =>
      x.class_section === e.class_section &&
      x.user_id === e.user_id &&
      x.day_of_week === e.day_of_week,
  );
  const lessons = sameDay.map((x) => x.lesson_num).sort((x, y) => x - y);
  if (!lessons.length) return null;
  const startCandidates: number[] = [];
  for (let i = 0; i <= lessons.length - blockSize; i++) {
    let ok = true;
    for (let j = 1; j < blockSize; j++) {
      if (lessons[i + j]! !== lessons[i]! + j) {
        ok = false;
        break;
      }
    }
    if (ok) startCandidates.push(lessons[i]!);
  }
  if (!startCandidates.length) return null;
  const start = startCandidates[randInt(startCandidates.length)]!;
  const block = sameDay
    .filter((x) => x.lesson_num >= start && x.lesson_num < start + blockSize)
    .sort((x, y) => x.lesson_num - y.lesson_num);
  if (block.length !== blockSize) return null;

  // Yeni slot ara
  const cand = randomCandidateSlot(ctx);
  if (!cand) return null;
  const { day, lesson } = cand;
  const newStart = lesson;
  const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
  if (newStart + blockSize - 1 > dayMax) return null;
  if (Array.from({ length: blockSize }, (_, i) => newStart + i).some((n) => ctx.blocked_lesson_nums.has(n))) return null;

  const rest = listEntries(state).filter((x) => !block.some((b) => b._id === x._id));
  const occ = new Map<string, SolverSlot[]>();
  for (let i = 0; i < blockSize; i++) {
    const k = slotKey(day, newStart + i);
    const rem = rest.filter((x) => slotKey(x.day_of_week, x.lesson_num) === k);
    if (rem.length) occ.set(k, rem);
  }
  for (let i = 0; i < blockSize; i++) {
    if (!placementAllowed(rest, occ, a, e.class_section, day, newStart + i, e.user_id, ctx)) return null;
  }

  const before = block.map((x) => ({ id: x._id, day: x.day_of_week, lesson: x.lesson_num }));
  const apply = () => {
    for (const b of block) {
      removeIndexSet(state.bySlot, slotKey(b.day_of_week, b.lesson_num), b._id);
      bumpOccurrence(state, b, -1);
    }
    for (let i = 0; i < blockSize; i++) {
      const b = block[i]!;
      b.day_of_week = day;
      b.lesson_num = newStart + i;
    }
    for (const b of block) {
      addIndexSet(state.bySlot, slotKey(b.day_of_week, b.lesson_num), b._id);
      bumpOccurrence(state, b, 1);
    }
  };
  const undo = () => {
    for (const b of block) {
      removeIndexSet(state.bySlot, slotKey(b.day_of_week, b.lesson_num), b._id);
      bumpOccurrence(state, b, -1);
    }
    for (const prev of before) {
      const b = state.entries.get(prev.id);
      if (!b) continue;
      b.day_of_week = prev.day;
      b.lesson_num = prev.lesson;
    }
    for (const b of block) {
      addIndexSet(state.bySlot, slotKey(b.day_of_week, b.lesson_num), b._id);
      bumpOccurrence(state, b, 1);
    }
  };

  const affectedAssignments = new Set<string>([a.id]);
  const affectedTeachers = new Set<string>([e.user_id ?? ''].filter(Boolean) as string[]);
  return { apply, undo, affectedAssignments, affectedTeachers };
}

function proposeKempeTeacherSwapMove(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  ctx: SolverContext,
): { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> } | null {
  const teacherIds = [...state.byTeacher.keys()];
  if (!teacherIds.length) return null;
  const userId = teacherIds[randInt(teacherIds.length)]!;
  const ids = [...(state.byTeacher.get(userId) ?? new Set<number>())];
  if (ids.length < 2) return null;
  const e1 = state.entries.get(ids[randInt(ids.length)]!);
  const e2 = state.entries.get(ids[randInt(ids.length)]!);
  if (!e1 || !e2) return null;
  if (e1.day_of_week === e2.day_of_week && e1.lesson_num === e2.lesson_num) return null;

  const slotA = slotKey(e1.day_of_week, e1.lesson_num);
  const slotB = slotKey(e2.day_of_week, e2.lesson_num);

  const groupA = ids.map((id) => state.entries.get(id)!).filter(Boolean).filter((e) => slotKey(e.day_of_week, e.lesson_num) === slotA);
  const groupB = ids.map((id) => state.entries.get(id)!).filter(Boolean).filter((e) => slotKey(e.day_of_week, e.lesson_num) === slotB);
  if (!groupA.length || !groupB.length) return null;

  const moving = [...groupA, ...groupB];
  const movingIds = new Set(moving.map((x) => x._id));
  const rest = listEntries(state).filter((x) => !movingIds.has(x._id));

  const occ = new Map<string, SolverSlot[]>();
  const remA = rest.filter((x) => slotKey(x.day_of_week, x.lesson_num) === slotA);
  const remB = rest.filter((x) => slotKey(x.day_of_week, x.lesson_num) === slotB);
  if (remA.length) occ.set(slotA, remA);
  if (remB.length) occ.set(slotB, remB);

  // Sıralı yerleştirme ile fizibilite kontrolü.
  const workEntries: SolverSlot[] = [...rest];
  const workOcc = new Map<string, SolverSlot[]>(occ);

  const tryPlace = (a: SolverAssignment, e: SearchEntry, toDay: number, toLesson: number): boolean => {
    const key = slotKey(toDay, toLesson);
    const occArr = workOcc.get(key) ?? [];
    const occMap = new Map<string, SolverSlot[]>();
    if (occArr.length) occMap.set(key, occArr);
    if (!placementAllowed(workEntries, occMap, a, e.class_section, toDay, toLesson, e.user_id, ctx)) return false;
    const placed: SolverSlot = { ...e, day_of_week: toDay, lesson_num: toLesson };
    workEntries.push(placed);
    const nextArr = [...occArr, placed];
    workOcc.set(key, nextArr);
    return true;
  };

  for (const e of groupA) {
    const a = assignmentsById.get(e.assignment_id);
    if (!a) return null;
    if (!tryPlace(a, e, e2.day_of_week, e2.lesson_num)) return null;
  }
  for (const e of groupB) {
    const a = assignmentsById.get(e.assignment_id);
    if (!a) return null;
    if (!tryPlace(a, e, e1.day_of_week, e1.lesson_num)) return null;
  }

  const before = moving.map((x) => ({ id: x._id, day: x.day_of_week, lesson: x.lesson_num }));
  const apply = () => {
    for (const m of moving) {
      removeIndexSet(state.bySlot, slotKey(m.day_of_week, m.lesson_num), m._id);
      bumpOccurrence(state, m, -1);
    }
    for (const m of groupA) {
      m.day_of_week = e2.day_of_week;
      m.lesson_num = e2.lesson_num;
    }
    for (const m of groupB) {
      m.day_of_week = e1.day_of_week;
      m.lesson_num = e1.lesson_num;
    }
    for (const m of moving) {
      addIndexSet(state.bySlot, slotKey(m.day_of_week, m.lesson_num), m._id);
      bumpOccurrence(state, m, 1);
    }
  };
  const undo = () => {
    for (const m of moving) {
      removeIndexSet(state.bySlot, slotKey(m.day_of_week, m.lesson_num), m._id);
      bumpOccurrence(state, m, -1);
    }
    for (const prev of before) {
      const m = state.entries.get(prev.id);
      if (!m) continue;
      m.day_of_week = prev.day;
      m.lesson_num = prev.lesson;
    }
    for (const m of moving) {
      addIndexSet(state.bySlot, slotKey(m.day_of_week, m.lesson_num), m._id);
      bumpOccurrence(state, m, 1);
    }
  };

  const affectedAssignments = new Set<string>(moving.map((x) => x.assignment_id));
  const affectedTeachers = new Set<string>([userId]);
  return { apply, undo, affectedAssignments, affectedTeachers };
}

function hasHardPlacementClash(state: SearchState): boolean {
  const classOcc = new Set<string>();
  const teacherOcc = new Set<string>();
  for (const e of listEntries(state)) {
    const k1 = `${e.day_of_week}:${e.lesson_num}:c:${e.class_section}`;
    if (classOcc.has(k1)) return true;
    classOcc.add(k1);
    if (e.user_id) {
      const k2 = `${e.day_of_week}:${e.lesson_num}:t:${e.user_id}`;
      if (teacherOcc.has(k2)) return true;
      teacherOcc.add(k2);
    }
  }
  return false;
}

function tryAcceptMove(
  state: SearchState,
  assignmentsById: Map<string, SolverAssignment>,
  move: { apply: () => void; undo: () => void; affectedAssignments: Set<string>; affectedTeachers: Set<string> },
  ctx: SolverContext,
  current: Cost,
  accept: (next: Cost) => boolean,
): { next: Cost; accepted: boolean } {
  move.apply();
  if (hasHardPlacementClash(state)) {
    move.undo();
    return { next: current, accepted: false };
  }
  rebuildPenaltyFor(state, assignmentsById, move.affectedAssignments, move.affectedTeachers, ctx);
  const next: Cost = { unplaced: state.unplaced, soft_penalty: Math.round(state.penalties.total) };
  const ok = accept(next);
  if (!ok) {
    move.undo();
    rebuildPenaltyFor(state, assignmentsById, move.affectedAssignments, move.affectedTeachers, ctx);
    return { next: current, accepted: false };
  }
  return { next, accepted: true };
}

export function runAscLikeSearch(
  assignments: SolverAssignment[],
  ctx: SolverContext,
  opts: AscSearchOptions,
): { result: SolverResult; meta: AscSearchMeta } {
  const start = nowMs();
  const deadline = start + Math.max(1_000, opts.deadline_ms);
  const assignmentsById = new Map(assignments.map((a) => [a.id, a]));

  const seedEntries = opts.seed?.entries ?? [];
  const state = buildInitialState(assignments, ctx, seedEntries);

  let current: Cost = { unplaced: state.unplaced, soft_penalty: Math.round(state.penalties.total) };
  let best = current;
  let bestEntries = listEntries(state);

  const genBudget = generationBudgetFor(opts.search_complexity ?? 'large');
  const lahcBase = opts.priority === 'fast' ? 80 : opts.priority === 'coverage' ? 220 : 140;
  const lahcL = Math.max(60, Math.round(lahcBase * genBudget.ascLahcMul));
  const history = Array.from({ length: lahcL }, () => current.soft_penalty);

  let iterations = 0;
  let accepted = 0;
  let restarts = 0;

  const acceptPhaseA = (next: Cost) => {
    if (shouldEnforceDistributionPattern(ctx.distribution_policy)) {
      if (next.unplaced < current.unplaced) return true;
      return patternEnforceAccept(current, next);
    }
    if (better(next, current)) return true;
    const p = opts.priority === 'coverage' ? 0.25 : 0.12;
    if (next.unplaced > current.unplaced) return Math.random() < p * 0.2;
    if (next.unplaced === current.unplaced && next.soft_penalty > current.soft_penalty) return Math.random() < p;
    return false;
  };

  const acceptPhaseB = (next: Cost) => {
    if (next.unplaced > 0) return acceptPhaseA(next);
    if (next.soft_penalty < current.soft_penalty) {
      history[iterations % lahcL] = next.soft_penalty;
      return true;
    }
    const i = iterations % lahcL;
    const ref = history[i] ?? current.soft_penalty;
    if (next.soft_penalty < ref) {
      history[i] = next.soft_penalty;
      return true;
    }
    if (next.soft_penalty === ref) return Math.random() < 0.04;
    return false;
  };

  while (nowMs() < deadline) {
    iterations++;

    const phaseA = current.unplaced > 0;
    const enforcePattern = shouldEnforceDistributionPattern(ctx.distribution_policy);
    const tryMoves = () => {
      if (phaseA) {
        const prep = proposeCoveragePrepMoves(state, assignmentsById, ctx);
        if (prep) return prep;
      }
      const fns = phaseA
        ? [
            () => proposeClassShiftForBlock2(state, assignmentsById, ctx),
            () => proposeTeacherUnblockForBlock2(state, assignmentsById, ctx),
            () => proposeInsertWithEjection(state, assignmentsById, ctx),
            () => proposeBlockMove(state, assignmentsById, ctx),
            () => proposeKempeTeacherSwapMove(state, assignmentsById, ctx),
            ...(enforcePattern
              ? [
                  () => proposeKempeTeacherSwapMove(state, assignmentsById, ctx),
                  () => proposeBlockMove(state, assignmentsById, ctx),
                ]
              : [
                  () => proposeSwapMove(state, assignmentsById, ctx),
                  () => proposeRandomMove(state, assignmentsById, ctx),
                ]),
            () => proposeRoomMove(state, assignmentsById, ctx),
          ]
        : [
            () => proposeBlockMove(state, assignmentsById, ctx),
            ...(enforcePattern
              ? [() => proposeKempeTeacherSwapMove(state, assignmentsById, ctx)]
              : [
                  () => proposeSwapMove(state, assignmentsById, ctx),
                  () => proposeKempeTeacherSwapMove(state, assignmentsById, ctx),
                  () => proposeRandomMove(state, assignmentsById, ctx),
                ]),
            () => proposeRoomMove(state, assignmentsById, ctx),
          ];
      shuffleInPlace(fns);
      for (const fn of fns) {
        const m = fn();
        if (m) return m;
      }
      return null;
    };
    const move = tryMoves();
    if (!move) break;

    const accept = phaseA ? acceptPhaseA : acceptPhaseB;
    const res = tryAcceptMove(state, assignmentsById, move, ctx, current, accept);
    if (res.accepted) {
      accepted++;
      current = res.next;
      if (better(current, best)) {
        best = current;
        bestEntries = listEntries(state).map((e) => ({ ...e }));
      }
    }

    // Basit diversify/restart: uzun süre iyileşme yoksa.
    if (
      !shouldEnforceDistributionPattern(ctx.distribution_policy) &&
      iterations % genBudget.ascRestartEvery === 0 &&
      !better(current, best)
    ) {
      restarts++;
      for (let k = 0; k < genBudget.ascDiversifyMoves; k++) {
        const m = proposeRandomMove(state, assignmentsById, ctx);
        if (!m) break;
        m.apply();
        rebuildPenaltyFor(state, assignmentsById, m.affectedAssignments, m.affectedTeachers, ctx);
        current = { unplaced: state.unplaced, soft_penalty: Math.round(state.penalties.total) };
      }
    }
  }

  if (shouldEnforceDistributionPattern(ctx.distribution_policy) && best.unplaced > 0 && nowMs() < deadline) {
    const finishState = buildInitialState(assignments, ctx, bestEntries);
    let finishCur: Cost = {
      unplaced: finishState.unplaced,
      soft_penalty: Math.round(finishState.penalties.total),
    };
    let finishBest = finishCur;
    let finishEntries = bestEntries.map((e) => ({ ...e }));
    let stagnant = 0;
    const finishStagnantCap = Math.round(
      (opts.priority === 'coverage' ? 280 : 160) * genBudget.ascFinishStagnantCapMul,
    );
    while (nowMs() < deadline && finishState.unplaced > 0 && stagnant < finishStagnantCap) {
      const move = proposeCoveragePrepMoves(finishState, assignmentsById, ctx);
      if (!move) {
        stagnant++;
        continue;
      }
      move.apply();
      if (hasHardPlacementClash(finishState)) {
        move.undo();
        stagnant++;
        continue;
      }
      rebuildPenaltyFor(
        finishState,
        assignmentsById,
        move.affectedAssignments,
        move.affectedTeachers,
        ctx,
      );
      const next: Cost = {
        unplaced: finishState.unplaced,
        soft_penalty: Math.round(finishState.penalties.total),
      };
      if (next.unplaced >= finishCur.unplaced) {
        move.undo();
        rebuildPenaltyFor(
          finishState,
          assignmentsById,
          move.affectedAssignments,
          move.affectedTeachers,
          ctx,
        );
        stagnant++;
      } else {
        finishCur = next;
        stagnant = 0;
        if (better(next, finishBest)) {
          finishBest = next;
          finishEntries = listEntries(finishState).map((e) => ({ ...e }));
        }
      }
    }
    if (finishBest.unplaced < best.unplaced) {
      best = finishBest;
      bestEntries = finishEntries;
    }
  }

  // Final: daha açıklayıcı violations için mevcut fonksiyon.
  const finalSoft = applySoftRulePenalties(bestEntries, assignments, ctx);
  const violations: string[] = [...(opts.seed?.violations ?? [])];
  violations.push(...finalSoft.violations);

  // Unplaced tahmini: required - unique occurrences
  const result: SolverResult = {
    entries: bestEntries,
    placed: bestEntries.length,
    failed: best.unplaced,
    violations,
    score: Math.max(0, 100 - best.unplaced * 3 - Math.round(finalSoft.penalty)),
  };

  const meta: AscSearchMeta = {
    time_ms: nowMs() - start,
    iterations,
    accepted,
    restarts,
    best_unplaced: best.unplaced,
    best_soft_penalty: Math.round(finalSoft.penalty),
  };
  return { result, meta };
}

