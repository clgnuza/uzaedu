/**
 * Demo / Kertenkele seed öğrencilerini siler.
 *
 * Kullanım:
 *   node tools/remove-butterfly-demo-students.js
 *     → Demo okul (Ankara Çankaya Demo Lisesi / Demo Okulu): önce 9-A…12-C şubelerindeki
 *       öğrenciler; bu şube yoksa okuldaki TÜM öğrenciler (demo okul yedek temizlik).
 *   node tools/remove-butterfly-demo-students.js <school_id>
 *     → Verilen okulda yalnızca 9-A…12-C şubelerindeki öğrenciler (DİKKAT: gerçek şubeler silinir).
 *   node tools/remove-butterfly-demo-students.js --all-demo-school
 *     → İsimle eşleşen demo okulda school_id eşleşen tüm öğrencileri siler.
 */
require('dotenv').config();
const { Client } = require('pg');

const DEMO_SCHOOL_NAMES = ['Ankara Çankaya Demo Lisesi', 'Demo Okulu'];

const DEMO_CLASS_NAMES = [
  '9-A', '9-B', '9-C',
  '10-A', '10-B', '10-C',
  '11-A', '11-B', '11-C',
  '12-A', '12-B', '12-C',
];

async function resolveDemoSchool(client) {
  const demo = await client.query(
    `SELECT id, name FROM schools WHERE name = ANY($1::text[]) ORDER BY created_at LIMIT 1`,
    [DEMO_SCHOOL_NAMES],
  );
  return demo.rows[0] ?? null;
}

async function clearTeacherStudentListsForSchool(client, schoolId) {
  const r = await client.query(
    `UPDATE teacher_student_lists SET student_ids = '[]'::jsonb WHERE school_id = $1`,
    [schoolId],
  );
  return r.rowCount ?? 0;
}

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
  await client.connect();

  const argv = process.argv.slice(2);
  const allDemoSchool = argv.includes('--all-demo-school');
  const schoolArg = argv.find((a) => !a.startsWith('--'))?.trim();

  let sid;
  let schoolName;

  if (allDemoSchool) {
    const row = await resolveDemoSchool(client);
    if (!row) {
      console.error('Demo okul bulunamadı:', DEMO_SCHOOL_NAMES.join(', '));
      process.exit(1);
    }
    sid = row.id;
    schoolName = row.name;
  } else if (schoolArg) {
    const r = await client.query('SELECT id, name FROM schools WHERE id = $1', [schoolArg]);
    if (!r.rows.length) {
      console.error('Okul bulunamadı:', schoolArg);
      process.exit(1);
    }
    sid = r.rows[0].id;
    schoolName = r.rows[0].name;
  } else {
    const demoRow = await resolveDemoSchool(client);
    if (demoRow) {
      const has = await client.query(
        `SELECT 1 FROM school_classes WHERE school_id = $1 AND name = ANY($2::text[]) LIMIT 1`,
        [demoRow.id, DEMO_CLASS_NAMES],
      );
      sid = demoRow.id;
      schoolName = demoRow.name;
      if (!has.rows.length) {
        console.log('(Demo okulda 9-A…12-C yok; bu okuldaki tüm öğrenciler silinecek)');
      }
    }
    if (!sid) {
      const cand = await client.query(
        `SELECT sc.school_id AS id, s.name, COUNT(*)::int AS n
         FROM school_classes sc
         JOIN schools s ON s.id = sc.school_id
         WHERE sc.name = ANY($1::text[])
         GROUP BY sc.school_id, s.name
         ORDER BY n DESC, s.name
         LIMIT 3`,
        [DEMO_CLASS_NAMES],
      );
      if (cand.rows.length === 1) {
        sid = cand.rows[0].id;
        schoolName = cand.rows[0].name;
        console.log('(Demo isim eşleşmesi yok; tek aday okul seçildi)');
      } else if (cand.rows.length > 1) {
        console.error('Birden fazla okulda 9-A…12-C şubeleri var. Silmek için:');
        console.error('  node tools/remove-butterfly-demo-students.js <school_id>');
        console.error('veya demo okul için:');
        console.error('  node tools/remove-butterfly-demo-students.js --all-demo-school');
        for (const row of cand.rows) console.error(`  ${row.id}  ${row.name}  (${row.n} şube)`);
        process.exit(1);
      } else {
        console.error(
          'Demo okul ve 9-A…12-C şubesi bulunamadı. Okul id: node tools/remove-butterfly-demo-students.js <school_id>',
        );
        process.exit(1);
      }
    }
  }

  console.log(`Okul: ${schoolName} (${sid})`);

  if (allDemoSchool) {
    const nLists = await clearTeacherStudentListsForSchool(client, sid);
    if (nLists) console.log('Öğretmen değerlendirme listeleri (student_ids) temizlendi:', nLists);
    const del = await client.query(`DELETE FROM students WHERE school_id = $1 RETURNING id`, [sid]);
    console.log('Silinen öğrenci (tümü):', del.rowCount);
    await client.end();
    return;
  }

  const cls = await client.query(
    `SELECT id, name FROM school_classes
     WHERE school_id = $1 AND name = ANY($2::text[])`,
    [sid, DEMO_CLASS_NAMES],
  );

  if (cls.rows.length) {
    console.log('Şubeler (Kertenkele seed):', DEMO_CLASS_NAMES.join(', '));
    console.log('Bulunan sınıf sayısı:', cls.rows.length);
    const classIds = cls.rows.map((x) => x.id);
    const del = await client.query(
      `DELETE FROM students WHERE school_id = $1 AND class_id = ANY($2::uuid[]) RETURNING id`,
      [sid, classIds],
    );
    console.log('Silinen öğrenci:', del.rowCount);
    await client.end();
    return;
  }

  if (!schoolArg && (await resolveDemoSchool(client))?.id === sid) {
    const nLists = await clearTeacherStudentListsForSchool(client, sid);
    if (nLists) console.log('Öğretmen değerlendirme listeleri (student_ids) temizlendi:', nLists);
    const del = await client.query(`DELETE FROM students WHERE school_id = $1 RETURNING id`, [sid]);
    console.log('Silinen öğrenci (demo okul — tüm sınıflar):', del.rowCount);
    await client.end();
    return;
  }

  console.log('Eşleşen 9-A…12-C sınıfı yok; silinecek öğrenci yok (okul id ile --all-demo-school kullanın).');
  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
