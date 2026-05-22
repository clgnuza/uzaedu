const assert = require('assert');
const { runConstraintSolver } = require('../dist/ders-dagit/ders-dagit.solver');
const { improveWithLocalSearch } = require('../dist/ders-dagit/ders-dagit.local-search');
const { runCspSolver } = require('../dist/ders-dagit/ders-dagit.solver-csp');

const ctx = {
  max_lesson_per_day: 8,
  work_days: [1, 2, 3, 4, 5],
  unavailable: [],
  parallel_groups: new Set(),
  group_modes: new Map(),
  active_rules: { max_two_per_day: { active: true, weight: 10 } },
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
