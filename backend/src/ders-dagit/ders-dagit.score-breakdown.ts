import { linkGenerationViolations } from './ders-dagit.generation-hints';
import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

export type ScoreDeduction = {
  id: string;
  title: string;
  subtitle?: string;
  points: number;
  href?: string;
};

export type ProgramScoreBreakdown = {
  score: number;
  max_score: 100;
  points_to_full: number;
  deductions: ScoreDeduction[];
};

function countClashes(entries: SolverSlot[], ctx: SolverContext): number {
  const occupied = new Map<string, SolverSlot[]>();
  for (const e of entries) {
    const key = `${e.day_of_week}:${e.lesson_num}`;
    const arr = occupied.get(key) ?? [];
    arr.push(e);
    occupied.set(key, arr);
  }
  let clashCount = 0;
  for (const [, slots] of occupied) {
    const teachers = new Set(slots.map((s) => s.user_id).filter(Boolean));
    const classes = new Set(slots.map((s) => s.class_section));
    const gid = slots[0]?.group_id;
    const gMode = gid ? ctx.group_modes.get(gid) : undefined;
    const subgroupOk = gMode === 'subgroups' && gid && slots.every((s) => s.group_id === gid);
    if (!subgroupOk && teachers.size < slots.filter((s) => s.user_id).length) clashCount++;
    if (classes.size < slots.length && !subgroupOk) clashCount++;
  }
  return clashCount;
}

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

/** Üretim puanı ile aynı formül; 100’e neden ulaşılamadığını madde madde döner. */
export function buildProgramScoreBreakdown(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
  violations: string[],
): ProgramScoreBreakdown {
  const target = assignments.reduce((s, a) => s + effHours(a), 0);
  const failed = Math.max(0, target - entries.length);
  const soft = applySoftRulePenalties(entries, assignments, ctx);
  const clashCount = countClashes(entries, ctx);
  const strictSet = new Set(soft.strict_violations);

  const score = Math.round(
    Math.max(
      0,
      100 -
        failed * 3 -
        violations.length * 2 -
        clashCount * 10 -
        soft.penalty -
        soft.strict_violations.length * 50,
    ),
  );

  const deductions: ScoreDeduction[] = [];
  let id = 0;
  const nextId = () => `d-${++id}`;

  if (failed > 0) {
    deductions.push({
      id: nextId(),
      title: 'Yerleşmeyen ders saati',
      subtitle: `${failed} saat programa sığmadı (−3 puan / saat)`,
      points: failed * 3,
      href: '/ders-dagit/studyo/atamalar',
    });
  }

  if (clashCount > 0) {
    deductions.push({
      id: nextId(),
      title: 'Öğretmen veya sınıf çakışması',
      subtitle: `${clashCount} çakışan slot (−10 puan / çakışma)`,
      points: clashCount * 10,
      href: '/ders-dagit/studyo/program',
    });
  }

  const linked = linkGenerationViolations(violations);
  for (let i = 0; i < linked.length; i++) {
    const { text, href } = linked[i]!;
    const strict = strictSet.has(text);
    deductions.push({
      id: nextId(),
      title: text,
      subtitle: strict ? 'Açık zorunlu kural (−2 liste + −50 zorunlu)' : 'Kural / kısıt ihlali (−2 puan)',
      points: 2 + (strict ? 50 : 0),
      href,
    });
  }

  const penaltyPts = Math.round(soft.penalty);
  if (penaltyPts > 0) {
    deductions.push({
      id: nextId(),
      title: 'Tercih kuralları öncelik cezası',
      subtitle: 'Açık yumuşak kuralların ağırlıklı toplamı',
      points: penaltyPts,
      href: '/ders-dagit/studyo/kurallar',
    });
  }

  deductions.sort((a, b) => b.points - a.points);

  return {
    score,
    max_score: 100,
    points_to_full: Math.max(0, 100 - score),
    deductions,
  };
}
