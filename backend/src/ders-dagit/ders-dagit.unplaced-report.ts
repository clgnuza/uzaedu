import { remainingPatternChunks } from './ders-dagit.day-distribution';
import { shouldEnforceDistributionPattern } from './ders-dagit.distribution-policy';
import { placementAllowed } from './ders-dagit.solver-csp';
import { placementPatternForAssignment } from './ders-dagit.solver-distribution';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

export type UnplacedPlacementRow = {
  assignment_id: string;
  subject: string;
  class_section: string;
  teacher_id: string | null;
  teacher_name: string;
  missing_hours: number;
  pattern: string | null;
  pattern_remain: string | null;
  free_single_slots: number;
  /** Sınıf şubesinde ardışık iki boş saat (öğretmen bakılmaz). */
  class_block2_slots: number;
  /** Tek dersi bir saat ileri/geri kaydırınca açılabilecek 2'li çift sayısı (sınıf). */
  shiftable_block2_slots: number;
  /** Şu anki programda öğretmen+sınıf ile yerleştirilebilir ardışık çift. */
  free_block2_slots: number;
  href: string;
};

export type UnplacedTeacherSummary = {
  teacher_id: string | null;
  teacher_name: string;
  missing_hours: number;
  card_count: number;
};

export type UnplacedPlacementReport = {
  total_missing_hours: number;
  card_count: number;
  rows: UnplacedPlacementRow[];
  by_teacher: UnplacedTeacherSummary[];
  recommendations: string[];
};

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

function sectionHoursPlaced(
  entries: SolverSlot[],
  assignmentId: string,
  classSection: string,
): number {
  const keys = new Set<string>();
  for (const e of entries) {
    if (e.assignment_id !== assignmentId || e.class_section !== classSection) continue;
    keys.add(`${e.day_of_week}:${e.lesson_num}`);
  }
  return keys.size;
}

function shortSection(label: string): string {
  return label.replace(/^AMP\s*-\s*/i, '').trim();
}

function sectionOccupied(
  entries: SolverSlot[],
  classSection: string,
  day: number,
  lesson: number,
): boolean {
  return entries.some(
    (e) => e.class_section === classSection && e.day_of_week === day && e.lesson_num === lesson,
  );
}

function dayLessonRange(ctx: SolverContext, day: number): { start: number; end: number } {
  const end = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
  return { start: 1, end };
}

/** Sınıf şubesinde yan yana iki boş ders saati. */
function countClassBlock2Slots(
  entries: SolverSlot[],
  classSection: string,
  ctx: SolverContext,
): number {
  let n = 0;
  const days = ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5];
  for (const day of days) {
    const { end } = dayLessonRange(ctx, day);
    for (let start = 1; start <= end - 1; start++) {
      if (ctx.blocked_lesson_nums.has(start) || ctx.blocked_lesson_nums.has(start + 1)) continue;
      if (
        !sectionOccupied(entries, classSection, day, start) &&
        !sectionOccupied(entries, classSection, day, start + 1)
      ) {
        n++;
      }
    }
  }
  return n;
}

/** [.][X] veya [X][.] çiftinde X’i hemen sonraki/önceki boş saate kaydırınca çift blok açılır. */
function countShiftableBlock2Slots(
  entries: SolverSlot[],
  classSection: string,
  ctx: SolverContext,
): number {
  let n = 0;
  const days = ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5];
  for (const day of days) {
    const { end } = dayLessonRange(ctx, day);
    for (let start = 1; start <= end - 1; start++) {
      if (ctx.blocked_lesson_nums.has(start) || ctx.blocked_lesson_nums.has(start + 1)) continue;
      const occA = sectionOccupied(entries, classSection, day, start);
      const occB = sectionOccupied(entries, classSection, day, start + 1);
      if (occA === occB) continue;
      const dest = occA ? start + 2 : start - 1;
      if (dest < 1 || dest > end) continue;
      if (ctx.blocked_lesson_nums.has(dest)) continue;
      if (sectionOccupied(entries, classSection, day, dest)) continue;
      n++;
    }
  }
  return n;
}

function countFreeSlots(
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  a: SolverAssignment,
  classSection: string,
  uid: string | null,
  ctx: SolverContext,
): { freeSingle: number; freeBlock2: number } {
  let freeSingle = 0;
  let freeBlock2 = 0;
  const days = ctx.work_days?.length ? ctx.work_days : [1, 2, 3, 4, 5];
  for (const day of days) {
    const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (ctx.blocked_lesson_nums.has(lesson)) continue;
      const occ = new Map(occupied);
      const slot = entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
      if (slot.length) occ.set(`${day}:${lesson}`, slot);
      if (placementAllowed(entries, occ, a, classSection, day, lesson, uid, ctx)) freeSingle++;
    }
    for (let start = 1; start <= dayMax - 1; start++) {
      const occ = new Map(occupied);
      for (let i = 0; i < 2; i++) {
        const les = start + i;
        const slot = entries.filter((e) => e.day_of_week === day && e.lesson_num === les);
        if (slot.length) occ.set(`${day}:${les}`, slot);
      }
      if (
        placementAllowed(entries, occ, a, classSection, day, start, uid, ctx) &&
        placementAllowed(entries, occ, a, classSection, day, start + 1, uid, ctx)
      ) {
        freeBlock2++;
      }
    }
  }
  return { freeSingle, freeBlock2 };
}

function buildRecommendations(
  rows: UnplacedPlacementRow[],
  byTeacher: UnplacedTeacherSummary[],
  total: number,
  ctx: SolverContext,
): string[] {
  const rec: string[] = [];
  if (!rows.length) return rec;

  const dominant = byTeacher.filter((t) => t.missing_hours > 0).sort((a, b) => b.missing_hours - a.missing_hours);
  if (dominant.length === 1 && dominant[0]!.missing_hours >= total * 0.8) {
    rec.push(
      `Eksik saatlerin büyük kısmı «${dominant[0]!.teacher_name}» öğretmenine bağlı — en az bir sınıfı başka öğretmene verin veya haftalık yükünü düşürün.`,
    );
  } else if (dominant[0] && dominant[0].missing_hours >= 5) {
    rec.push(
      `«${dominant[0].teacher_name}» için ${dominant[0].missing_hours} saat eksik — bu öğretmenin atamalarını gözden geçirin.`,
    );
  }

  const needsConsecutive = rows.some(
    (r) =>
      r.missing_hours >= 2 &&
      r.free_block2_slots === 0 &&
      r.class_block2_slots === 0 &&
      r.shiftable_block2_slots === 0 &&
      (r.pattern?.includes('2') || r.pattern?.includes('3')),
  );
  if (needsConsecutive) {
    rec.push(
      'Kartlar ardışık blok deseni istiyor (2, 3+2, 2+2+1 …); sınıfta yan yana boş çift yok. Kartları bölmeyin — programı gevşetin.',
    );
  }

  const classHasTeacherBlocked = rows.some(
    (r) =>
      r.missing_hours >= 2 &&
      r.free_block2_slots === 0 &&
      (r.class_block2_slots > 0 || r.shiftable_block2_slots > 0) &&
      (r.pattern?.includes('2') || r.pattern?.includes('3')),
  );
  if (classHasTeacherBlocked) {
    rec.push(
      'Sınıf tablosunda boş çift veya tek dersi bir saat kaydırarak açılabilecek çift var; «2\'li müsait» 0 ise öğretmen o saatlerde başka yerde — dersi kaydırın veya öğretmeni değiştirin.',
    );
  }

  rec.push('Üretimde öncelik: Kapsama; süre en az 180 sn deneyin.');

  if (shouldEnforceDistributionPattern(ctx.distribution_policy)) {
    rec.push(
      'Son çare: Kurulum → dağılım politikasında «çakışmada deseni gevşet» (eksik azalabilir; desen garantisi zayıflar).',
    );
  }

  return rec;
}

/** Yerleşmeyen atama kartları — üretim sonrası uyarı tablosu (kart bölünmez). */
export function buildUnplacedPlacementReport(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
  teacherNameById: Map<string, string> = new Map(),
): UnplacedPlacementReport | null {
  const occupied = new Map<string, SolverSlot[]>();
  for (const e of entries) {
    const key = `${e.day_of_week}:${e.lesson_num}`;
    const arr = occupied.get(key) ?? [];
    arr.push(e);
    occupied.set(key, arr);
  }

  const rows: UnplacedPlacementRow[] = [];
  for (const a of assignments) {
    const req = effHours(a);
    const secs = a.class_sections?.length ? a.class_sections : [''];
    for (const sec of secs) {
      const missing = req - sectionHoursPlaced(entries, a.id, sec);
      if (missing <= 0) continue;
      const pat = placementPatternForAssignment(a, req, ctx);
      const remain = pat
        ? remainingPatternChunks(
            a.id,
            entries.map((e) => ({
              assignment_id: e.assignment_id,
              day_of_week: e.day_of_week,
              lesson_num: e.lesson_num,
            })),
            pat,
          )
        : [];
      const uid = a.teacher_ids?.[0] ?? null;
      const { freeSingle, freeBlock2 } = countFreeSlots(entries, occupied, a, sec, uid, ctx);
      const classBlock2 = countClassBlock2Slots(entries, sec, ctx);
      const shiftableBlock2 = countShiftableBlock2Slots(entries, sec, ctx);
      rows.push({
        assignment_id: a.id,
        subject: a.subject_name,
        class_section: shortSection(sec),
        teacher_id: uid,
        teacher_name: (uid && teacherNameById.get(uid)) || uid || '—',
        missing_hours: missing,
        pattern: pat?.join('+') ?? null,
        pattern_remain: remain.length ? remain.join('+') : null,
        free_single_slots: freeSingle,
        class_block2_slots: classBlock2,
        shiftable_block2_slots: shiftableBlock2,
        free_block2_slots: freeBlock2,
        href: '/ders-dagit/studyo/atamalar',
      });
    }
  }

  if (!rows.length) return null;

  rows.sort((x, y) => y.missing_hours - x.missing_hours || x.free_block2_slots - y.free_block2_slots);

  const byTeacherMap = new Map<string, UnplacedTeacherSummary>();
  for (const r of rows) {
    const key = r.teacher_id ?? '__none__';
    const cur = byTeacherMap.get(key) ?? {
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name,
      missing_hours: 0,
      card_count: 0,
    };
    cur.missing_hours += r.missing_hours;
    cur.card_count += 1;
    byTeacherMap.set(key, cur);
  }
  const by_teacher = [...byTeacherMap.values()].sort((a, b) => b.missing_hours - a.missing_hours);
  const total_missing_hours = rows.reduce((s, r) => s + r.missing_hours, 0);

  return {
    total_missing_hours,
    card_count: rows.length,
    rows,
    by_teacher,
    recommendations: buildRecommendations(rows, by_teacher, total_missing_hours, ctx),
  };
}
