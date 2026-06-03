import { linkGenerationViolations } from './ders-dagit.generation-hints';
import { applySoftRulePenalties, type RuleViolationDetail } from './ders-dagit.solver-rules';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

export type ScoreDeductionFocus = {
  type: 'assignment' | 'clash' | 'unplaced' | 'rules';
  assignment_id?: string;
  subject?: string;
  class_section?: string;
  rule_key?: string;
};

export type ScoreDeduction = {
  id: string;
  title: string;
  subtitle?: string;
  /** Satır sağındaki özet kutucuk (şube, eksik saat, kural özeti). */
  aside?: string;
  points: number;
  href?: string;
  focus?: ScoreDeductionFocus;
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
    // Teacher clash: aynı öğretmen aynı slota birden fazla ders.
    const byTeacher = new Map<string, SolverSlot[]>();
    for (const s of slots) {
      if (!s.user_id) continue;
      const arr = byTeacher.get(s.user_id) ?? [];
      arr.push(s);
      byTeacher.set(s.user_id, arr);
    }
    for (const tSlots of byTeacher.values()) {
      if (tSlots.length <= 1) continue;
      const gid = tSlots[0]?.group_id ?? null;
      const gMode = gid ? ctx.group_modes.get(gid) : undefined;
      const sameGroup = gid && tSlots.every((x) => x.group_id === gid);
      const allowed = sameGroup && (gMode === 'teacher_multi_class' || gMode === 'subgroups');
      if (!allowed) {
        clashCount++;
        break;
      }
    }

    // Class clash: aynı şube aynı slota birden fazla ders (co_teach aynı assignment ise sorun değil).
    const byClass = new Map<string, SolverSlot[]>();
    for (const s of slots) {
      const arr = byClass.get(s.class_section) ?? [];
      arr.push(s);
      byClass.set(s.class_section, arr);
    }
    for (const cSlots of byClass.values()) {
      if (cSlots.length <= 1) continue;
      const sameAssignment = cSlots.every((x) => x.assignment_id === cSlots[0]!.assignment_id);
      if (!sameAssignment) {
        clashCount++;
        break;
      }
    }
  }
  return clashCount;
}

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

function focusFromDetail(d: RuleViolationDetail): ScoreDeductionFocus {
  return {
    type: 'assignment',
    assignment_id: d.assignment_id,
    subject: d.subject,
    class_section: d.class_section || undefined,
    rule_key: d.rule_key,
  };
}

function asideFromViolationText(text: string, detail?: RuleViolationDetail): string | undefined {
  const hour = text.match(/(\d+)\s*saat\s+yerleşmedi/i);
  if (hour) return `${hour[1]} saat`;
  if (detail?.class_section) return detail.class_section;
  const colon = text.indexOf(':');
  if (colon > 0) {
    const tail = text.slice(colon + 1).trim();
    if (!tail) return undefined;
    return tail.length <= 36 ? tail : `${tail.slice(0, 34)}…`;
  }
  return undefined;
}

function findAssignment(assignments: SolverAssignment[], subject: string): SolverAssignment | undefined {
  const matches = assignments.filter((a) => a.subject_name === subject);
  return matches.length === 1 ? matches[0] : undefined;
}

function focusFromViolationText(text: string, assignments: SolverAssignment[]): ScoreDeductionFocus | undefined {
  const colon = text.indexOf(':');
  if (colon <= 0) return undefined;
  const subject = text.slice(0, colon).trim();
  if (!subject) return undefined;
  const matches = assignments.filter((a) => a.subject_name === subject);
  if (matches.length !== 1) return matches.length ? { type: 'assignment', subject } : undefined;
  const a = matches[0]!;
  return {
    type: 'assignment',
    assignment_id: a.id,
    subject: a.subject_name,
    class_section: a.class_sections?.[0] || undefined,
  };
}

/** Üretim puanı ile aynı formül; 100’e neden ulaşılamadığını madde madde döner. */
export function buildProgramScoreBreakdown(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
  violations: string[],
): ProgramScoreBreakdown {
  const target = assignments.reduce(
    (s, a) => s + effHours(a) * Math.max(1, a.class_sections?.length ?? 1),
    0,
  );
  const uniquePlaced = new Set(entries.map((e) => `${e.assignment_id}:${e.class_section}:${e.day_of_week}:${e.lesson_num}`)).size;
  const failed = Math.max(0, target - uniquePlaced);
  const soft = applySoftRulePenalties(entries, assignments, ctx);
  const detailByMessage = new Map(soft.violation_details.map((d) => [d.message, d]));
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
      aside: `${failed} saat`,
      points: failed * 3,
      href: '/ders-dagit/studyo/atamalar',
      focus: { type: 'unplaced' },
    });
  }

  if (clashCount > 0) {
    deductions.push({
      id: nextId(),
      title: 'Öğretmen veya sınıf çakışması',
      subtitle: `${clashCount} çakışan slot (−10 puan / çakışma)`,
      aside: `${clashCount} slot`,
      points: clashCount * 10,
      href: '/ders-dagit/studyo/program',
      focus: { type: 'clash' },
    });
  }

  const linked = linkGenerationViolations(violations);
  for (let i = 0; i < linked.length; i++) {
    const { text, href } = linked[i]!;
    const strict = strictSet.has(text);
    const detail = detailByMessage.get(text);
    const focus = detail ? focusFromDetail(detail) : focusFromViolationText(text, assignments);
    const subject = text.includes(':') ? text.slice(0, text.indexOf(':')).trim() : '';
    const assignment = detail
      ? assignments.find((a) => a.id === detail.assignment_id)
      : subject
        ? findAssignment(assignments, subject)
        : undefined;
    deductions.push({
      id: nextId(),
      title: text,
      subtitle: strict ? 'Açık zorunlu kural (−2 liste + −50 zorunlu)' : 'Kural / kısıt ihlali (−2 puan)',
      aside:
        asideFromViolationText(text, detail) ??
        (assignment?.class_sections?.[0] ? assignment.class_sections[0] : undefined),
      points: 2 + (strict ? 50 : 0),
      href,
      focus,
    });
  }

  const RULE_PENALTY_HINT: Record<string, number> = {
    day_distribution: 22,
    block_lessons: 24,
    same_day_consecutive: 10,
    teacher_unavailable: 16,
    assignment_unavailable: 14,
    two_same_day: 8,
    distribute_week: 10,
  };
  for (const d of soft.violation_details) {
    const pts = RULE_PENALTY_HINT[d.rule_key] ?? 8;
    deductions.push({
      id: nextId(),
      title: d.message,
      subtitle: 'Kural ihlali',
      aside: d.class_section || undefined,
      points: pts,
      href: '/ders-dagit/studyo/kurallar',
      focus: focusFromDetail(d),
    });
  }
  const penaltyPts = Math.round(soft.penalty);
  const listedPts = soft.violation_details.reduce((s, d) => s + (RULE_PENALTY_HINT[d.rule_key] ?? 8), 0);
  const remainder = Math.max(0, penaltyPts - listedPts);
  if (remainder > 0) {
    deductions.push({
      id: nextId(),
      title: 'Diğer tercih / öğretmen kuralları',
      subtitle: 'Boşluk, bina, MEB vb. ağırlıklı toplam',
      points: remainder,
      href: '/ders-dagit/studyo/kurallar',
      focus: { type: 'rules' },
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
