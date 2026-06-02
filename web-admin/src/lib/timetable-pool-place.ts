import type { EditorContext, EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { maxLessonsOnDay } from '@/lib/timetable-grid-build';
import { validatePoolPlace, validateTimetableMove } from '@/lib/timetable-move-validation';
import { closureAt, type SlotClosure } from '@/lib/timetable-slot-closures';
import { computeSlotDropStatus } from '@/lib/timetable-slot-status';

export function parsePoolAssignmentId(activeId: string): string | null {
  if (!activeId.startsWith('pool-')) return null;
  return activeId.slice(5);
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

export type PoolPlaceAttemptResult =
  | {
      ok: true;
      day: number;
      lesson: number;
      relocateEntryId?: string;
      relocateTo?: { day: number; lesson: number };
    }
  | { ok: false; message: string };

/** Önce hedef, sonra takas için yer açma, sonra uygun başka saat dene. */
export function planPoolPlacement(
  assignmentId: string,
  day: number,
  lesson: number,
  ctx: EditorContext,
  closures: Map<string, SlotClosure>,
): PoolPlaceAttemptResult {
  const unplaced = ctx.unplaced.find((u) => u.assignment_id === assignmentId);
  const section = unplaced?.class_section ?? '';
  const teacherId = unplaced?.user_id ?? null;

  const can = (d: number, l: number) =>
    validatePoolPlace(assignmentId, d, l, ctx.entries, section, closures, teacherId).ok;

  if (can(day, lesson)) return { ok: true, day, lesson };

  const occupants = ctx.entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
  if (occupants.length === 1) {
    const occ = occupants[0]!;
    if (!occ.is_locked && occ.class_section !== section) {
      const workDays = ctx.period.work_days?.length ? ctx.period.work_days : [1, 2, 3, 4, 5];
      const relocTargets = listMoveTargetsForEntry(
        occ,
        ctx.entries,
        closures,
        workDays,
        ctx.max_lesson,
        ctx.grid?.lessons_per_day_by_dow ?? {},
        { day, lesson },
      );
      if (relocTargets.length > 0) {
        const relocateTo = relocTargets[0]!;
        return {
          ok: true,
          day,
          lesson,
          relocateEntryId: occ.id,
          relocateTo,
        };
      }
    }
  }

  const slots = listOkPoolSlotsWithClosures(ctx, section, teacherId, closures, { day, lesson });
  const alt = slots.find((s) => !(s.day === day && s.lesson === lesson));
  if (alt) return { ok: true, day: alt.day, lesson: alt.lesson };

  return {
    ok: false,
    message:
      slots.length === 0
        ? 'Uygun boş saat bulunamadı. Kuralları veya müsaitlikleri kontrol edin.'
        : 'Bu saate yerleştirilemedi. Yeşil bir hücreye bırakın.',
  };
}
