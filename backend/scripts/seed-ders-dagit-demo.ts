/**
 * Demo okul — DersDağıt stüdyo kurulumu + program üretimi.
 * npm run seed:ders-dagit-demo
 * npm run seed:ders-dagit-demo -- --no-generate
 */
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module';
import { DersDagitService } from '../src/ders-dagit/ders-dagit.service';
import { DEMO_SCHOOL_NAMES_FOR_QUERY } from '../src/seed/demo-school.constants';
import { DEMO_CREDENTIALS } from '../src/seed/demo-credentials';
import { School } from '../src/schools/entities/school.entity';
import { User } from '../src/users/entities/user.entity';
import { UserRole, UserStatus } from '../src/types/enums';
import type { DersDagitRoom } from '../src/ders-dagit/entities/ders-dagit-room.entity';

const DEMO_EXTRA_TEACHERS = [
  'teacher2@demo.local',
  'teacher3@demo.local',
  'teacher4@demo.local',
  'teacher5@demo.local',
  'teacher6@demo.local',
] as const;

const DEMO_SECTIONS = ['9/A', '9/B'] as const;

async function ensureDemoTeachers(userRepo: Repository<User>, schoolId: string): Promise<string[]> {
  const hash = await bcrypt.hash(DEMO_CREDENTIALS.teacher.password, 10);
  const emails = [DEMO_CREDENTIALS.teacher.email, ...DEMO_EXTRA_TEACHERS];
  const ids: string[] = [];
  for (const email of emails) {
    let u = await userRepo.findOne({ where: { email } });
    if (!u) {
      u = userRepo.create({
        email,
        display_name: email.split('@')[0]!.replace('.', ' '),
        role: UserRole.teacher,
        school_id: schoolId,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
        status: UserStatus.active,
      });
      await userRepo.save(u);
      console.log(`  + ogretmen: ${email}`);
    } else if (u.school_id !== schoolId || u.role !== UserRole.teacher) {
      u.school_id = schoolId;
      u.role = UserRole.teacher;
      if (!u.passwordHash) u.passwordHash = hash;
      await userRepo.save(u);
    }
    ids.push(u.id);
  }
  return ids;
}

function roomForSection(rooms: DersDagitRoom[], section: string): string | undefined {
  const s = section.toLocaleLowerCase('tr');
  const hit = rooms.find((r) => {
    const allowed = r.allowed_class_sections ?? [];
    if (allowed.some((x) => x.toLocaleLowerCase('tr') === s)) return true;
    return r.name.trim().toLocaleLowerCase('tr') === s;
  });
  return hit?.id;
}

function pickTeacher(teachers: string[], load: Map<string, number>, hours: number): string {
  let best = teachers[0]!;
  let bestLoad = Infinity;
  for (const t of teachers) {
    const l = load.get(t) ?? 0;
    if (l < bestLoad) {
      bestLoad = l;
      best = t;
    }
  }
  load.set(best, (load.get(best) ?? 0) + hours);
  return best;
}

async function main() {
  const noGenerate = process.argv.includes('--no-generate');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(DersDagitService);
    const schoolRepo = app.get<Repository<School>>(getRepositoryToken(School));
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

    const school = await schoolRepo.findOne({
      where: { name: In([...DEMO_SCHOOL_NAMES_FOR_QUERY]) },
    });
    if (!school) {
      throw new Error('Demo okul bulunamadi. Once seed calistirin.');
    }

    const admin =
      (await userRepo.findOne({ where: { email: DEMO_CREDENTIALS.school_admin.email } })) ??
      (await userRepo.findOne({ where: { school_id: school.id, role: UserRole.school_admin } }));
    if (!admin) throw new Error('school_admin@demo.local bulunamadi.');

    console.log(`Okul: ${school.name} (${school.id})`);
    await ensureDemoTeachers(userRepo, school.id);

    const studio = await svc.getOrCreateStudio(school.id, admin.id);
    console.log(`Studyo: ${studio.name} (${studio.id})`);

    await svc.updateSchoolProfile(studio.id, school.id, { type: 'anadolu_lise' });
    await svc.updatePeriodConfig(studio.id, school.id, {
      period: {
        work_days: [1, 2, 3, 4, 5],
        lessons_per_day_by_dow: { '1': 8, '2': 8, '3': 8, '4': 8, '5': 8 },
        long_breaks: [{ after_lesson: 4, label: 'Ogle', blocked_slots: 1 }],
      },
      dual_education: { enabled: false },
    });

    const existingProfiles = await svc.listClassProfiles(studio.id);
    for (const p of existingProfiles) {
      await svc.deleteClassProfile(p.id, studio.id);
    }
    await svc.upsertClassProfile(studio.id, {
      name: '9. Sinif (demo)',
      class_sections: [...DEMO_SECTIONS],
      max_lessons_per_day: 8,
      sort_order: 0,
    });

    await svc.syncTeachersFromSchool(studio.id, school.id);
    await svc.syncExtraLessonParamsToTeachers(studio.id, school.id, admin.id);

    const ttkb = await svc.seedFromTtkb(studio.id, school.id, admin.id, {
      replace: true,
      sync_assignments: true,
    });
    console.log(`TTKB: ${ttkb.subject_count} ders, ${ttkb.assignments_created} yeni atama`);

    const roomsResult = await svc.autoCreateRoomsFromClassSections(school.id, studio.id);
    console.log(`Derslik: +${roomsResult.created}, atlanan ${roomsResult.skipped}`);
    const rooms = await svc.listRooms(school.id);

    const teacherRows = await svc.listTeacherConfigs(studio.id);
    const teacherIds = teacherRows.map((t) => t.user_id);
    const assignments = await svc.listAssignments(studio.id);
    const load = new Map<string, number>();
    let linked = 0;
    for (const a of assignments) {
      const sec = a.class_sections?.[0];
      const hrs = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      const tid = pickTeacher(teacherIds, load, hrs);
      const roomId = sec ? roomForSection(rooms, sec) : undefined;
      await svc.upsertAssignment(studio.id, {
        id: a.id,
        teacher_ids: [tid],
        room_ids: roomId ? [roomId] : (a.room_ids ?? []),
      });
      linked++;
    }
    console.log(`Atama: ${linked} baglandi`);

    const issues = await svc.runValidation(studio.id);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length) {
      console.error('Dogrulama hatalari:');
      for (const e of errors) console.error(`  [${e.code}] ${e.message}`);
      process.exitCode = 1;
      return;
    }

    if (noGenerate) {
      console.log('Kurulum tamam (--no-generate)');
      return;
    }

    const gen = await svc.generatePrograms(studio.id, school.id, admin.id, {
      duration_sec: 120,
      versions: 1,
      use_csp: false,
    });
    const prog = gen.programs[0];
    console.log(`Program: ${prog?.name ?? prog?.id} skor=${prog?.score ?? '?'}`);
    console.log(`Studyo ID: ${studio.id}`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

