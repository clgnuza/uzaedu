require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DersDagitService } = require('../dist/ders-dagit/ders-dagit.service');
const { expandAssignmentsForSolver } = require('../dist/ders-dagit/ders-dagit.solver-input');
const { placementPatternForAssignment } = require('../dist/ders-dagit/ders-dagit.solver-distribution');
const {
  assignmentDayDistribution,
  isValidDayDistribution,
  inferDayDistribution,
} = require('../dist/ders-dagit/ders-dagit.day-distribution');
const { assignmentBlockLessons } = require('../dist/ders-dagit/ders-dagit.school-profile');
const { assignmentPlacementSpec } = require('../dist/ders-dagit/ders-dagit.assignment-blocks');

const STUDIO = process.argv[2] || '1d812fc1-6a57-47b5-bf72-f22edafeeb2a';
const SCHOOL = '71b0646e-7f6a-469a-9039-b831f109c2b3';

function effH(a) {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const svc = app.get(DersDagitService);
  const ctx = await svc.buildSolverContext(STUDIO, SCHOOL);
  const raw = await svc.listAssignments(STUDIO);
  const policy = ctx.distribution_policy;
  const issues = [];
  let withDist = 0;
  let withBlock = 0;

  for (const a of raw) {
    const need = effH(a);
    const dist = assignmentDayDistribution(a.options);
    const block = assignmentBlockLessons(a.options);
    const spec = assignmentPlacementSpec(a.options, a.weekly_hours, a.biweekly);
    const valid = dist && isValidDayDistribution(dist, need);
    if (valid) withDist++;
    if (block >= 2) withBlock++;
    const inferred = inferDayDistribution(a.weekly_hours, a.options, a.biweekly, policy?.mode ?? 'blocks');
    const si = expandAssignmentsForSolver([
      {
        id: a.id,
        class_sections: a.class_sections,
        subject_name: a.subject_name,
        weekly_hours: a.weekly_hours,
        teacher_ids: a.teacher_ids ?? [],
        options: a.options,
        biweekly: a.biweekly,
      },
    ]);
    const pat = placementPatternForAssignment(si[0], effH(si[0]), ctx);

    const maxChunk = dist?.length ? Math.max(...dist) : 0;
    if (block >= 2 && valid && maxChunk !== block) {
      issues.push({
        type: 'block_mismatch',
        subject: a.subject_name,
        sections: a.class_sections?.[0],
        block_lessons: block,
        max_in_dist: maxChunk,
        dist: dist.join('+'),
      });
    }
    if (valid && pat && pat.join('+') !== dist.join('+')) {
      issues.push({
        type: 'pattern_ne_solver',
        subject: a.subject_name,
        stored: dist.join('+'),
        solver: pat.join('+'),
      });
    }
    if (!valid && !block && need >= 2 && policy?.enforce_pattern) {
      issues.push({
        type: 'no_stored_infer',
        subject: a.subject_name,
        need,
        inferred: inferred.join('+'),
        solver: pat?.join('+') ?? '—',
      });
    }
    if (spec.day_distribution && valid && spec.day_distribution.join('+') !== dist.join('+')) {
      issues.push({ type: 'spec_mismatch', subject: a.subject_name });
    }
  }

  console.log({
    studio: STUDIO,
    policy,
    assignments: raw.length,
    with_day_distribution: withDist,
    with_block_lessons: withBlock,
    issues: issues.length,
  });
  if (issues.length) console.table(issues.slice(0, 30));
  await app.close();
})();
