const assert = require('assert');
const { runConstraintSolver } = require('../dist/ders-dagit/ders-dagit.solver');
const { improveWithLocalSearch } = require('../dist/ders-dagit/ders-dagit.local-search');

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
  blocked_lesson_nums: new Set([5]),
  max_lesson_by_day: new Map([[1, 8], [2, 8], [3, 8], [4, 8], [5, 8]]),
  lunch_after_lesson: 4,
  room_constraints: new Map(),
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

const r = runConstraintSolver(assignments, ctx);
assert.ok(r.placed >= 3, `placed ${r.placed}`);
assert.ok(r.score > 0, 'score');

const r2 = improveWithLocalSearch(assignments, ctx, 8);
assert.ok(r2.placed >= r.placed - 1, 'local search');

console.log('ders-dagit-solver.test OK', { placed: r2.placed, score: r2.score });
