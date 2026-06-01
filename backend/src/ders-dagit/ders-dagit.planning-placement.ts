import { relationDefinition, type PlanningRelationRow } from './ders-dagit.planning-relations';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

function relationAppliesToSection(row: PlanningRelationRow, section: string): boolean {
  if (row.sections_mode === 'all') return true;
  return row.sections.includes(section);
}

function assignmentInRelation(row: PlanningRelationRow, a: SolverAssignment): boolean {
  if (!a.subject_id || !row.subject_ids.includes(a.subject_id)) return false;
  const section = a.class_sections?.[0] ?? '';
  return relationAppliesToSection(row, section);
}

function slotsForSubject(
  entries: SolverSlot[],
  ctx: SolverContext,
  subjectId: string,
  section: string,
): SolverSlot[] {
  const bySubject = ctx.assignment_subjects;
  if (!bySubject) return [];
  return entries.filter((e) => {
    if (e.class_section !== section) return false;
    return bySubject.get(e.assignment_id) === subjectId;
  });
}

function weekOrder(day: number, lesson: number): number {
  return day * 100 + lesson;
}

function blockedLessons(row: PlanningRelationRow): number[] {
  const raw = row.params?.blocked_lessons ?? row.params?.lessons;
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => n >= 1 && n <= 12);
  }
  const one = Number(row.params?.max);
  if (Number.isFinite(one) && one >= 1 && one <= 12) return [Math.floor(one)];
  return [];
}

/** Plan Kartı — catalog_key olmayan çoklu ders ilişkileri. */
export function planningPlacementBlocked(
  entries: SolverSlot[],
  ctx: SolverContext,
  a: SolverAssignment,
  day: number,
  lesson: number,
): boolean {
  const relations = ctx.planning_relations;
  if (!relations?.length || !a.subject_id) return false;
  const section = a.class_sections?.[0] ?? '';
  if (!section) return false;

  for (const row of relations) {
    if (!row.active || !assignmentInRelation(row, a)) continue;
    const def = relationDefinition(row);
    if (def && !def.solver_supported) continue;
    const ruleId = row.rule_id;

    if (ruleId === 'adv_same_hour' && row.subject_ids.length >= 2) {
      for (const otherId of row.subject_ids) {
        if (otherId === a.subject_id) continue;
        const other = slotsForSubject(entries, ctx, otherId, section);
        if (other.some((e) => e.day_of_week === day && e.lesson_num === lesson)) {
          return true;
        }
      }
    }

    if (ruleId === 'adv_a_before_b_week' && row.subject_ids.length >= 2) {
      const [subA, subB] = row.subject_ids;
      const order = weekOrder(day, lesson);
      if (a.subject_id === subB) {
        for (const e of slotsForSubject(entries, ctx, subA!, section)) {
          if (weekOrder(e.day_of_week, e.lesson_num) >= order) return true;
        }
      }
      if (a.subject_id === subA) {
        for (const e of slotsForSubject(entries, ctx, subB!, section)) {
          if (weekOrder(e.day_of_week, e.lesson_num) <= order) return true;
        }
      }
    }

    if (ruleId === 'adv_no_start_hour' || ruleId === 'adv_no_end_hour') {
      if (blockedLessons(row).includes(lesson)) return true;
    }
  }

  return false;
}
