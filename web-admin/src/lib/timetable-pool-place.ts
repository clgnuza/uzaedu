import type { EditorContext, EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { clashAtSlot } from '@/lib/timetable-clash';
import { maxLessonsOnDay } from '@/lib/timetable-grid-build';
import type { AssignmentPlacementHint } from '@/lib/timetable-assignment-blocks';
import { assignmentBlockPlacementOk, resolvePlacementHint } from '@/lib/timetable-assignment-blocks';
import { validatePoolPlace, validateTimetableMove } from '@/lib/timetable-move-validation';
import { closureAt, type SlotClosure } from '@/lib/timetable-slot-closures';
import { computeSlotDropStatus } from '@/lib/timetable-slot-status';
import type { ParsedPoolDragId } from '@/lib/timetable-pool-id';
import { parsePoolDragId } from '@/lib/timetable-pool-id';
import { findUnplacedPoolRow } from '@/lib/timetable-unplaced-pool';

export { parsePoolDragId, parsePoolAssignmentId } from '@/lib/timetable-pool-id';

function poolChunkLessons(start: number, chunkHours: number): number[] {
  return Array.from({ length: chunkHours }, (_, i) => start + i);
}

function canPlacePoolChunk(
  assignmentId: string,
  classSection: string,
  teacherId: string | null,
  day: number,
  startLesson: number,
  chunkHours: number,
  entries: EditorEntry[],
  closures: Map<string, SlotClosure>,
  assignmentHints?: Record<string, AssignmentPlacementHint>,
): boolean {
  for (const lesson of poolChunkLessons(startLesson, chunkHours)) {
    if (closureAt(closures, day, lesson)) return false;
    const v = validatePoolPlace(
      assignmentId,
      day,
      lesson,
      entries,
      classSection,
      closures,
      teacherId,
      assignmentHints,
    );
    if (!v.ok) return false;
  }
  return true;
}

function conflictsInChunk(
  entries: EditorEntry[],
  day: number,
  startLesson: number,
  chunkHours: number,
): EditorEntry[] {
  const seen = new Set<string>();
  const out: EditorEntry[] = [];
  for (const lesson of poolChunkLessons(startLesson, chunkHours)) {
    for (const e of entries) {
      if (e.day_of_week === day && e.lesson_num === lesson && !seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
    }
  }
  return out;
}

function forbiddenKeys(closures: Map<string, SlotClosure>): Set<string> {
  return new Set(closures.keys());
}

export function listOkPoolSlotsWithClosures(
  ctx: EditorContext,
  classSection: string,
  teacherId: string | null,
  closures: Map<string, SlotClosure>,
  prefer?: { day: number; lesson: number },
): Array<{ day: number; lesson: number }> {
  const workDays = ctx.period.work_days?.length ? ctx.period.work_days : [1, 2, 3, 4, 5];
  const forbidden = forbiddenKeys(closures);
  const out: Array<{ day: number; lesson: number; dist: number }> = [];
  for (const day of workDays) {
    const dayMax = maxLessonsOnDay(day, ctx.max_lesson, ctx.grid?.lessons_per_day_by_dow ?? {});
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (closureAt(closures, day, lesson)) continue;
      const status = computeSlotDropStatus(null, classSection, day, lesson, ctx.entries, forbidden);
      if (status !== 'ok') continue;
      if (
        teacherId &&
        ctx.entries.some(
          (e) => e.day_of_week === day && e.lesson_num === lesson && e.user_id === teacherId,
        )
      ) {
        continue;
      }
      const dist = prefer
        ? Math.abs(day - prefer.day) * 20 + Math.abs(lesson - prefer.lesson)
        : 0;
      out.push({ day, lesson, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.map(({ day, lesson }) => ({ day, lesson }));
}

/** Zincir taşıma: yalnız kapalı saat + sınıf/öğretmen çakışması (minimum müdahale). */
export function listRelocationSlotsForEntry(
  entry: EditorEntry,
  entries: EditorEntry[],
  closures: Map<string, SlotClosure>,
  workDays: number[],
  maxLesson: number,
  lessonsPerDay: Record<string, number>,
  prefer?: { day: number; lesson: number },
  assignmentHints?: Record<string, AssignmentPlacementHint>,
): Array<{ day: number; lesson: number }> {
  const out: Array<{ day: number; lesson: number; dist: number }> = [];
  for (const day of workDays) {
    const dayMax = maxLessonsOnDay(day, maxLesson, lessonsPerDay);
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (entry.day_of_week === day && entry.lesson_num === lesson) continue;
      if (closureAt(closures, day, lesson)) continue;
      if (clashAtSlot(entries, entry.id, day, lesson)) continue;
      const hint = resolvePlacementHint(entry, assignmentHints, entries);
      if (!assignmentBlockPlacementOk(entry, day, lesson, entries, hint)) continue;
      const dist = prefer
        ? Math.abs(day - prefer.day) * 20 + Math.abs(lesson - prefer.lesson)
        : 0;
      out.push({ day, lesson, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.map(({ day, lesson }) => ({ day, lesson }));
}

/** Taşınabilir ders için uygun hedef hücreler. */
export function listMoveTargetsForEntry(
  entry: EditorEntry,
  entries: EditorEntry[],
  closures: Map<string, SlotClosure>,
  workDays: number[],
  maxLesson: number,
  lessonsPerDay: Record<string, number>,
  prefer?: { day: number; lesson: number },
): Array<{ day: number; lesson: number }> {
  const out: Array<{ day: number; lesson: number; dist: number }> = [];
  for (const day of workDays) {
    const dayMax = maxLessonsOnDay(day, maxLesson, lessonsPerDay);
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (entry.day_of_week === day && entry.lesson_num === lesson) continue;
      const v = validateTimetableMove({
        entryId: entry.id,
        day,
        lesson,
        entries,
        closures,
        dragging: entry,
      });
      if (!v.ok) continue;
      const dist = prefer
        ? Math.abs(day - prefer.day) * 20 + Math.abs(lesson - prefer.lesson)
        : 0;
      out.push({ day, lesson, dist });
    }
  }
  out.sort((a, b) => a.dist - b.dist);
  return out.map(({ day, lesson }) => ({ day, lesson }));
}

export type EntryMovePlan =
  | { ok: true; relocations: Array<{ entryId: string; day: number; lesson: number }> }
  | { ok: false; message: string };

/**
 * Tablo içi taşıma için akıllı yer açma: hedef slotta `entry` ile çakışan
 * (aynı sınıf veya aynı öğretmen) kilitsiz dersleri başka uygun saate taşır.
 * Tüm çakışanlar taşınabiliyorsa relocation listesi döner; biri sıkışırsa ok:false.
 */
export function planSmartEntryMove(
  entryId: string,
  day: number,
  lesson: number,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
): EntryMovePlan {
  const entry = ctx.entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, message: 'Ders bulunamadı.' };
  if (closureAt(closures, day, lesson)) return { ok: false, message: 'Kapalı saat.' };

  /** Hedef slottaki tüm dersler (başka sınıf / öğretmen dahil) taşınır. */
  const conflicts = ctx.entries.filter(
    (e) => e.id !== entryId && e.day_of_week === day && e.lesson_num === lesson,
  );
  if (conflicts.length === 0) return { ok: true, relocations: [] };
  if (conflicts.some((c) => c.is_locked)) {
    return { ok: false, message: 'Hedef saatte kilitli ders var; otomatik yer açılamadı.' };
  }

  const workDays = ctx.period.work_days?.length ? ctx.period.work_days : [1, 2, 3, 4, 5];
  const lessonsPerDay = ctx.grid?.lessons_per_day_by_dow ?? {};
  // Taşınan ders hedefe gidecek; relocate ararken onu hedeften çıkarmış say.
  let working: EditorEntry[] = ctx.entries.map((e) =>
    e.id === entryId ? { ...e, day_of_week: day, lesson_num: lesson } : e,
  );
  const relocations: Array<{ entryId: string; day: number; lesson: number }> = [];

  for (const conf of conflicts) {
    const others = working.filter((e) => e.id !== conf.id);
    const targets = listRelocationSlotsForEntry(
      conf,
      others,
      closures,
      workDays,
      ctx.max_lesson,
      lessonsPerDay,
      { day, lesson },
      ctx.assignment_hints,
    ).filter((t) => !(t.day === day && t.lesson === lesson));
    if (!targets.length) {
      return { ok: false, message: 'Hedef saate yer açılamadı.' };
    }
    const to = targets[0]!;
    relocations.push({ entryId: conf.id, day: to.day, lesson: to.lesson });
    working = working.map((e) =>
      e.id === conf.id ? { ...e, day_of_week: to.day, lesson_num: to.lesson } : e,
    );
  }

  return { ok: true, relocations };
}

export type PoolPlaceAttemptResult =
  | {
      ok: true;
      day: number;
      lesson: number;
      relocateEntryId?: string;
      relocateTo?: { day: number; lesson: number };
      relocations?: Array<{ entryId: string; day: number; lesson: number }>;
    }
  | { ok: false; message: string };

function tryRelocateChunkConflicts(
  conflicts: EditorEntry[],
  working: EditorEntry[],
  day: number,
  lesson: number,
  chunkHours: number,
  closures: Map<string, SlotClosure>,
  ctx: EditorContext,
): Array<{ entryId: string; day: number; lesson: number }> | null {
  const workDays = ctx.period.work_days?.length ? ctx.period.work_days : [1, 2, 3, 4, 5];
  const lessonsPerDay = ctx.grid?.lessons_per_day_by_dow ?? {};
  const relocations: Array<{ entryId: string; day: number; lesson: number }> = [];
  const blocked = new Set(
    poolChunkLessons(lesson, chunkHours).map((l) => `${day}:${l}`),
  );

  for (const conf of conflicts) {
    if (conf.is_locked) return null;
    const others = working.filter((e) => e.id !== conf.id);
    const targets = listRelocationSlotsForEntry(
      conf,
      others,
      closures,
      workDays,
      ctx.max_lesson,
      lessonsPerDay,
      { day, lesson },
      ctx.assignment_hints,
    ).filter((t) => !blocked.has(`${t.day}:${t.lesson}`));
    if (!targets.length) return null;
    const to = targets[0]!;
    relocations.push({ entryId: conf.id, day: to.day, lesson: to.lesson });
    working = working.map((e) =>
      e.id === conf.id ? { ...e, day_of_week: to.day, lesson_num: to.lesson } : e,
    );
  }
  return relocations;
}

/** Önce hedef, çakışanları kaydır (sınıf dahil), sonra uygun başka saat dene. */
export function planPoolPlacement(
  poolKey: string | ParsedPoolDragId,
  day: number,
  lesson: number,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
): PoolPlaceAttemptResult {
  const parsed = typeof poolKey === 'string' ? parsePoolDragId(poolKey) : poolKey;
  if (!parsed) return { ok: false, message: 'Geçersiz havuz kartı.' };
  const row = findUnplacedPoolRow(ctx, poolKey);
  const section = row?.class_section ?? parsed.classSection;
  const teacherId = row?.user_id ?? null;
  const assignmentId = parsed.assignmentId;
  const chunkHours = row?.chunk_hours ?? parsed.chunkHours;

  const dayMax = maxLessonsOnDay(day, ctx.max_lesson, ctx.grid?.lessons_per_day_by_dow ?? {});
  if (lesson + chunkHours - 1 > dayMax) {
    return { ok: false, message: `${chunkHours} saatlik blok bu günde sığmıyor.` };
  }

  const tryAt = (d: number, start: number, entries: EditorEntry[]): PoolPlaceAttemptResult | null => {
    if (
      !canPlacePoolChunk(
        assignmentId,
        section,
        teacherId,
        d,
        start,
        chunkHours,
        entries,
        closures,
        ctx.assignment_hints,
      )
    ) {
      return null;
    }
    return { ok: true, day: d, lesson: start };
  };

  const direct = tryAt(day, lesson, ctx.entries);
  if (direct) return direct;

  let working = [...ctx.entries];
  const conflicts = conflictsInChunk(working, day, lesson, chunkHours);
  if (conflicts.length) {
    const relocations = tryRelocateChunkConflicts(
      conflicts,
      working,
      day,
      lesson,
      chunkHours,
      closures,
      ctx,
    );
    if (relocations) {
      for (const r of relocations) {
        working = working.map((e) =>
          e.id === r.entryId ? { ...e, day_of_week: r.day, lesson_num: r.lesson } : e,
        );
      }
      const after = tryAt(day, lesson, working);
      if (after) {
        const first = relocations[0]!;
        if (relocations.length === 1) {
          return {
            ok: true,
            day,
            lesson,
            relocateEntryId: first.entryId,
            relocateTo: { day: first.day, lesson: first.lesson },
          };
        }
        return { ok: true, day, lesson, relocations };
      }
    }
  }

  const slots = listOkPoolSlotsWithClosures(ctx, section, teacherId, closures, { day, lesson });
  for (const s of slots) {
    if (s.day === day && s.lesson === lesson) continue;
    const alt = tryAt(s.day, s.lesson, ctx.entries);
    if (alt) return alt;
    const altConflicts = conflictsInChunk(ctx.entries, s.day, s.lesson, chunkHours);
    if (!altConflicts.length) continue;
    const reloc = tryRelocateChunkConflicts(
      altConflicts,
      [...ctx.entries],
      s.day,
      s.lesson,
      chunkHours,
      closures,
      ctx,
    );
    if (reloc) {
      const after = tryAt(s.day, s.lesson, ctx.entries);
      if (after) {
        const first = reloc[0]!;
        return {
          ok: true,
          day: s.day,
          lesson: s.lesson,
          relocateEntryId: first.entryId,
          relocateTo: { day: first.day, lesson: first.lesson },
          relocations: reloc.length > 1 ? reloc : undefined,
        };
      }
    }
  }

  return {
    ok: false,
    message:
      slots.length === 0
        ? 'Uygun boş saat bulunamadı. Kuralları veya müsaitlikleri kontrol edin.'
        : 'Bu saate yerleştirilemedi. Yeşil bir hücreye bırakın.',
  };
}
