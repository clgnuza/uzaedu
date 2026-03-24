/**
 * Tüm okullara TYMM MEB varsayılan sınıf ve dersleri ekler.
 * Çalıştırma: cd backend && npm run seed-classes-subjects
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { env } from '../src/config/env';
import { DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '../src/config/default-classes-subjects';

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: env.db.host,
    port: env.db.port,
    username: env.db.username,
    password: env.db.password,
    database: env.db.database,
  });

  await ds.initialize();

  const schools = (await ds.query('SELECT id FROM schools')) as { id: string }[];
  if (!schools || schools.length === 0) {
    console.log('Veritabanında okul bulunamadı.');
    await ds.destroy();
    return;
  }

  console.log(`${schools.length} okula sınıf ve ders ekleniyor...`);

  let totalClassesAdded = 0;
  let totalSubjectsAdded = 0;

  for (const { id: schoolId } of schools) {
    const existingClasses = (await ds.query(
      'SELECT name FROM school_classes WHERE school_id = $1',
      [schoolId],
    )) as { name: string }[];
    const existingSubjects = (await ds.query(
      'SELECT code, name FROM school_subjects WHERE school_id = $1',
      [schoolId],
    )) as { code: string | null; name: string }[];
    const existingClassNames = new Set(existingClasses.map((r) => r.name));
    const existingSubjectCodes = new Set(
      existingSubjects.filter((s) => s.code).map((s) => s.code as string),
    );
    const existingSubjectNames = new Set(existingSubjects.map((s) => s.name));

    let classesAdded = 0;
    let subjectsAdded = 0;

    for (const d of DEFAULT_CLASSES) {
      if (existingClassNames.has(d.name)) continue;
      await ds.query(
        `INSERT INTO school_classes (id, school_id, name, grade, section, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
        [schoolId, d.name, d.grade, d.section],
      );
      existingClassNames.add(d.name);
      classesAdded++;
    }

    for (const d of DEFAULT_SUBJECTS) {
      const byCode = d.code && existingSubjectCodes.has(d.code);
      const byName = existingSubjectNames.has(d.name);
      if (byCode || byName) continue;
      await ds.query(
        `INSERT INTO school_subjects (id, school_id, name, code, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
        [schoolId, d.name, d.code],
      );
      existingSubjectCodes.add(d.code);
      existingSubjectNames.add(d.name);
      subjectsAdded++;
    }

    totalClassesAdded += classesAdded;
    totalSubjectsAdded += subjectsAdded;
  }

  console.log(`Tamamlandı. Toplam eklenen: ${totalClassesAdded} sınıf, ${totalSubjectsAdded} ders.`);
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
