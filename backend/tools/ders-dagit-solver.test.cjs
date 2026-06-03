const assert = require('assert');
const { runConstraintSolver } = require('../dist/ders-dagit/ders-dagit.solver');
const { improveWithLocalSearch } = require('../dist/ders-dagit/ders-dagit.local-search');
const { runCspSolver } = require('../dist/ders-dagit/ders-dagit.solver-csp');
const { runAscLikeSearch } = require('../dist/ders-dagit/ders-dagit.search');

const ctx = {
  max_lesson_per_day: 8,
  work_days: [1, 2, 3, 4, 5],
  unavailable: [],
  parallel_groups: new Set(),
  group_modes: new Map(),
  active_rules: { max_two_per_day: { active: true, weight: 10 } },
  section_rules: new Map(),
  teacher_limits: [
    {
      user_id: 't1',
      max_per_day: 6,
      max_weekly: 30,
      min_weekly: 10,
      min_work_days: 2,
      max_work_days: 5,
      allow_am_pm_gap: true,
    },
  ],
  room_required: false,
  room_building: new Map(),
  building_travel_gap: 0,
  no_building_same_day: false,
  blocked_lesson_nums: new Set(),
  max_lesson_by_day: new Map([[1, 8], [2, 8], [3, 8], [4, 8], [5, 8]]),
  lunch_after_lesson: 4,
  room_constraints: new Map(),
  building_travel_matrix: new Map([['b1:b2', 2]]),
  school_profile: { type: 'anadolu_lise', internship_days: [], internship_sections: [] },
  dual_education_enabled: false,
  pm_first_lesson: 5,
  section_shift: new Map(),
  teacher_shift: new Map(),
  group_member_sections: new Map(),
  section_schedules: new Map(),
  section_internship_from_profiles: new Map(),
  studio_period: { work_days: [1, 2, 3, 4, 5], long_breaks: [{ after_lesson: 4, blocked_slots: 1 }], lessons_per_day_by_dow: {} },
};

const assignments = [
  {
    id: 'a1',
    class_sections: ['5A'],
    subject_name: 'Matematik',
    weekly_hours: 4,
    teacher_ids: ['t1'],
    group_id: null,
    room_ids: [],
    max_per_day: 2,
    min_days_per_week: 2,
    fixed_slots: [],
    place_first: false,
  },
];

const { expandAssignmentsForSolver } = require('../dist/ders-dagit/ders-dagit.solver-input');
const multi = expandAssignmentsForSolver([
  {
    ...assignments[0],
    id: 'm1',
    weekly_hours: 4,
    teacher_ids: ['t1', 't2'],
    options: {},
  },
]);
assert.strictEqual(multi.length, 2, 'split multi-teacher');
assert.strictEqual(multi[0].weekly_hours + multi[1].weekly_hours, 4, 'hours sum');

const r = runConstraintSolver(assignments, ctx);
assert.ok(r.placed >= 3, `placed ${r.placed}`);
assert.ok(r.score > 0, 'score');

const dist22 = [
  {
    ...assignments[0],
    id: 'dist22',
    weekly_hours: 4,
    min_days_per_week: 2,
    max_per_day: 2,
    options: { day_distribution: [2, 2], block_lessons: 2 },
  },
];
const rd = runConstraintSolver(dist22, ctx);
assert.strictEqual(rd.placed, 4, `2+2 placed ${rd.placed}`);
const {
  assignmentByDayLessons,
  distinctPatternPermutations,
  matchesDayDistributionPattern,
} = require('../dist/ders-dagit/ders-dagit.day-distribution');
const perms221 = distinctPatternPermutations([2, 2, 1]);
assert.strictEqual(perms221.length, 3, '2+2+1 has 3 day orders');
const m = new Map([[1, [1, 2]], [3, [3, 4]], [5, [6]]]);
assert.ok(matchesDayDistributionPattern(m, [2, 2, 1]), '1+2+2 multiset matches 2+2+1');
const byDayLessons = new Map();
for (const e of rd.entries) {
  const arr = byDayLessons.get(e.day_of_week) ?? [];
  arr.push(e.lesson_num);
  byDayLessons.set(e.day_of_week, arr);
}
assert.ok(matchesDayDistributionPattern(byDayLessons, [2, 2]), 'haftalık 2+2 ardışık');
const dupRows = [
  { assignment_id: 'dup2', day_of_week: 2, lesson_num: 3 },
  { assignment_id: 'dup2', day_of_week: 2, lesson_num: 3 },
  { assignment_id: 'dup2', day_of_week: 2, lesson_num: 4 },
  { assignment_id: 'dup2', day_of_week: 2, lesson_num: 4 },
];
const dupMap = assignmentByDayLessons(dupRows, 'dup2');
assert.ok(matchesDayDistributionPattern(dupMap, [2]), 'çoklu şube satırı tek 2 blok sayılır');
const { remainingPatternChunks: remainChunks } = require('../dist/ders-dagit/ders-dagit.day-distribution');
const orphan1 = [
  { assignment_id: 'o1', day_of_week: 1, lesson_num: 1 },
];
assert.deepStrictEqual(remainChunks('o1', orphan1, [2, 2, 1]), [2, 2], 'kısmi 1 saat → 4 saat kalan bloklar');
const sameDay22 = [
  { assignment_id: 'd22', day_of_week: 2, lesson_num: 1 },
  { assignment_id: 'd22', day_of_week: 2, lesson_num: 2 },
  { assignment_id: 'd22', day_of_week: 2, lesson_num: 3 },
  { assignment_id: 'd22', day_of_week: 2, lesson_num: 4 },
];
assert.deepStrictEqual(remainChunks('d22', sameDay22, [2, 2, 1]), [1], 'aynı gün 4 ardışık = 2+2 tüketildi, kalan 1');
const { inferDayDistribution, distributionPresetsForMode } = require('../dist/ders-dagit/ders-dagit.day-distribution');
assert.deepStrictEqual(inferDayDistribution(2, {}, false, 'blocks'), [2], 'blok modu 2 saat → [2]');
assert.deepStrictEqual(distributionPresetsForMode(2, 'blocks')[0], [2], 'blok preset sırası');

function assertNoSplitSameDay(entries, assignmentId) {
  const byDay = new Map();
  for (const e of entries) {
    if (e.assignment_id !== assignmentId) continue;
    const arr = byDay.get(e.day_of_week) ?? [];
    arr.push(e.lesson_num);
    byDay.set(e.day_of_week, arr);
  }
  for (const lessons of byDay.values()) {
    if (lessons.length < 2) continue;
    const s = [...lessons].sort((a, b) => a - b);
    for (let i = 1; i < s.length; i++) {
      assert.strictEqual(s[i], s[i - 1] + 1, `split same day: ${s.join(',')}`);
    }
  }
}
assertNoSplitSameDay(rd.entries, 'dist22');

const pattern221 = [
  {
    ...assignments[0],
    id: 'p221',
    subject_name: 'Uygulama',
    weekly_hours: 5,
    max_per_day: 3,
    min_days_per_week: 3,
    options: { day_distribution: [2, 2, 1] },
  },
];
const rp = runConstraintSolver(pattern221, ctx);
assertNoSplitSameDay(rp.entries, 'p221');

const r2 = improveWithLocalSearch(assignments, ctx, 8);
assert.ok(r2.placed >= r.placed - 1, 'local search');

const biweekly = [
  {
    ...assignments[0],
    id: 'a2',
    weekly_hours: 4,
    biweekly: true,
    min_days_per_week: 1,
  },
];
const rb = runConstraintSolver(biweekly, ctx);
assert.ok(rb.placed <= 2, `biweekly effective hours ${rb.placed}`);

const blocked = [
  {
    ...assignments[0],
    id: 'a3',
    unavailable_periods: [{ day_of_week: 1, lesson_num: 1 }],
  },
];
const r3 = runConstraintSolver(blocked, ctx);
assert.ok(!r3.entries.some((e) => e.day_of_week === 1 && e.lesson_num === 1), 'unavailable slot');

const rc = runCspSolver(assignments, ctx, 50_000);
assert.ok(rc.placed >= r.placed - 1, 'csp');

const { linkGenerationViolations } = require('../dist/ders-dagit/ders-dagit.generation-hints');
const links = linkGenerationViolations(['Matematik: 1 saat yerleşmedi']);
assert.ok(links[0].href, 'violation link');

const blockCtx = {
  ...ctx,
  school_profile: { type: 'mtal', internship_days: [3], internship_sections: ['12-A'] },
};
const blockAssign = [
  {
    ...assignments[0],
    id: 'blk',
    weekly_hours: 4,
    options: { block_lessons: 4, place_on_days: [1, 2] },
    class_sections: ['12-A'],
  },
];
const rb2 = runConstraintSolver(blockAssign, blockCtx);
assert.ok(
  !rb2.entries.some((e) => e.day_of_week === 3 && e.class_section === '12-A'),
  'internship day blocked',
);

console.log('ders-dagit-solver.test OK', { placed: r2.placed, score: r2.score, csp: rc.placed });

// Soft kural bloklamasın: important_early artık placementBlocked ile kilitlemez.
const lateOnlyCtx = {
  ...ctx,
  max_lesson_per_day: 6,
  max_lesson_by_day: new Map([[1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]),
  blocked_lesson_nums: new Set([1, 2, 3, 4, 5]),
  active_rules: { ...ctx.active_rules, important_early: { active: true, weight: 6 } },
};
const lateOnlyAssign = [
  {
    ...assignments[0],
    id: 'late1',
    weekly_hours: 1,
    max_per_day: null,
    min_days_per_week: null,
  },
];
const rl = runConstraintSolver(lateOnlyAssign, lateOnlyCtx);
assert.strictEqual(rl.placed, 1, 'important_early should not block only late slot');
assert.ok(rl.entries.some((e) => e.lesson_num === 6), 'placed in late slot');

// ASC-benzeri arama: hard-feasible kalmalı.
const small = [
  {
    id: 'sa',
    class_sections: ['5A'],
    subject_name: 'Fen',
    weekly_hours: 3,
    teacher_ids: ['t1'],
    group_id: null,
    room_ids: [],
    max_per_day: 2,
    min_days_per_week: 2,
    fixed_slots: [],
    place_first: false,
    options: {},
  },
  {
    id: 'sb',
    class_sections: ['5A'],
    subject_name: 'Türkçe',
    weekly_hours: 3,
    teacher_ids: ['t2'],
    group_id: null,
    room_ids: [],
    max_per_day: 2,
    min_days_per_week: 2,
    fixed_slots: [],
    place_first: false,
    options: {},
  },
];
const seed = runConstraintSolver(small, ctx);
const run = runAscLikeSearch(small, ctx, { deadline_ms: 250, priority: 'fast', seed });
assert.ok(run.meta && run.meta.iterations >= 0, 'search meta');

// Kurallar sayfasında gizlenen anahtarlar kapalı olsa bile planlama ilişkisi dağıtımda etkinleşir.
const { mergePlanningRelationsIntoRules, validatePlanningRelationsForGenerate } = require('../dist/ders-dagit/ders-dagit.rules-merge');
const { buildDefaultRuleState } = require('../dist/ders-dagit/ders-dagit.rules');
const { ruleOnForAssignment } = require('../dist/ders-dagit/ders-dagit.solver-rule-scope');

const studioOff = buildDefaultRuleState();
for (const key of [
  'distribute_week',
  'max_two_per_day',
  'two_same_day',
  'same_day_consecutive',
  'two_not_same_day',
  'minimize_teacher_gaps',
]) {
  studioOff[key] = { active: false, weight: 10 };
}
const planningRow = {
  id: 'pr-dist',
  active: true,
  kind: 'simple',
  rule_id: 'distribute_week',
  importance: 'normal',
  subject_ids: ['sub-mat'],
  subject_labels: ['Matematik'],
  sections_mode: 'all',
  sections: [],
  sort_order: 0,
};
const merged = mergePlanningRelationsIntoRules(
  studioOff,
  [{ id: 'prof1', class_sections: ['5A'], rules: null }],
  [planningRow],
);
assert.strictEqual(merged.studio_rules.distribute_week?.active, true, 'planning turns distribute_week on');
const planCtx = {
  ...ctx,
  active_rules: merged.studio_rules,
  section_rules: merged.section_rules,
  strict_rule_keys_global: new Set(),
  strict_rule_keys_by_section: new Map(),
};
const matAssign = {
  id: 'pm',
  class_sections: ['5A'],
  subject_id: 'sub-mat',
  subject_name: 'Matematik',
  weekly_hours: 4,
  teacher_ids: ['t1'],
  group_id: null,
  room_ids: [],
  max_per_day: 2,
  min_days_per_week: 2,
  fixed_slots: [],
  place_first: false,
  options: {},
};
const muzAssign = { ...matAssign, id: 'pz', subject_id: 'sub-muz', subject_name: 'Müzik' };
assert.ok(ruleOnForAssignment(planCtx, 'distribute_week', '5A', matAssign), 'scoped to planning subjects');
assert.ok(!ruleOnForAssignment(planCtx, 'distribute_week', '5A', muzAssign), 'other subject not forced');
const rPlan = runConstraintSolver([matAssign, muzAssign], planCtx);
assert.ok(rPlan.placed >= 5, `planning merge allows generate path placed=${rPlan.placed}`);
assert.strictEqual(
  validatePlanningRelationsForGenerate([{ ...planningRow, importance: 'strict' }]).length,
  0,
  'supported strict planning does not block generate',
);
const occ = new Set();
for (const e of run.result.entries) {
  const k1 = `${e.day_of_week}:${e.lesson_num}:c:${e.class_section}`;
  assert.ok(!occ.has(k1), 'no class clash');
  occ.add(k1);
  if (e.user_id) {
    const k2 = `${e.day_of_week}:${e.lesson_num}:t:${e.user_id}`;
    assert.ok(!occ.has(k2), 'no teacher clash');
    occ.add(k2);
  }
}

// Yoğun kapsama: 5 gün × 6 saat = 30 slot; 30 saatlik tek sınıf tam dolmalı.
const denseCtx = {
  ...ctx,
  max_lesson_per_day: 6,
  max_lesson_by_day: new Map([[1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]),
  blocked_lesson_nums: new Set(),
  studio_period: { work_days: [1, 2, 3, 4, 5], long_breaks: [], lessons_per_day_by_dow: {} },
  active_rules: {},
  teacher_limits: [],
};
const denseAssignments = [
  { subject: 'Mat', t: 't1', h: 6 },
  { subject: 'Türkçe', t: 't2', h: 6 },
  { subject: 'Fen', t: 't3', h: 5 },
  { subject: 'Sosyal', t: 't4', h: 5 },
  { subject: 'İng', t: 't5', h: 4 },
  { subject: 'Beden', t: 't6', h: 4 },
].map((x, i) => ({
  id: `d${i}`,
  class_sections: ['9A'],
  subject_id: `sub-d${i}`,
  subject_name: x.subject,
  weekly_hours: x.h,
  teacher_ids: [x.t],
  group_id: null,
  room_ids: [],
  max_per_day: 2,
  min_days_per_week: 1,
  fixed_slots: [],
  place_first: false,
  options: {},
}));
const denseTarget = denseAssignments.reduce((s, a) => s + a.weekly_hours, 0);
const denseSeed = runConstraintSolver(denseAssignments, denseCtx);
const denseRun = runAscLikeSearch(denseAssignments, denseCtx, {
  deadline_ms: 1500,
  priority: 'coverage',
  seed: denseSeed,
});
assert.strictEqual(
  denseRun.result.failed,
  0,
  `dense coverage should place all ${denseTarget}h (failed=${denseRun.result.failed})`,
);
assert.strictEqual(denseRun.result.entries.length, denseTarget, 'dense placed count');

const enforceCtx = {
  ...ctx,
  distribution_policy: { mode: 'blocks', enforce_pattern: true, relax_on_conflict: false },
};
const enforceAssign = [
  {
    ...assignments[0],
    id: 'enf22',
    weekly_hours: 4,
    max_per_day: 2,
    min_days_per_week: 2,
    options: { day_distribution: [2, 2], block_lessons: 2 },
  },
];
const enfSeed = runConstraintSolver(enforceAssign, enforceCtx);
const enfRun = runAscLikeSearch(enforceAssign, enforceCtx, {
  deadline_ms: 800,
  priority: 'balanced',
  seed: enfSeed,
});
const enfByDay = assignmentByDayLessons(enfRun.result.entries, 'enf22');
assert.ok(
  matchesDayDistributionPattern(enfByDay, [2, 2]),
  `enforce_pattern ASC keeps 2+2 observed=${[...enfByDay.values()].map((l) => l.length)}`,
);
assertNoSplitSameDay(enfRun.result.entries, 'enf22');
