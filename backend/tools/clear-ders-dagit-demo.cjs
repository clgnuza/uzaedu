/**
 * Demo okul DersDağıt verilerini temizler (program, atama, ders, grup, seçmeli havuz).
 * node tools/clear-ders-dagit-demo.cjs
 * node tools/clear-ders-dagit-demo.cjs --all-studios   (tüm stüdyolar)
 */
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEMO_SCHOOL_NAMES = ['Ankara Çankaya Demo Lisesi', 'Demo Okulu'];
const allStudios = process.argv.includes('--all-studios');

function pgClient() {
  return new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
}

async function clearStudio(client, studioId) {
  const studioIds = [studioId];
  const inStudios = `($1)`;
  const params = [studioId];

  const delEntry = await client.query(
    `DELETE FROM ders_dagit_program_entry
     WHERE program_id IN (SELECT id FROM ders_dagit_program WHERE studio_id = $1)`,
    params,
  );
  const delProg = await client.query(`DELETE FROM ders_dagit_program WHERE studio_id = $1`, params);
  const delJob = await client.query(`DELETE FROM ders_dagit_generation_job WHERE studio_id = $1`, params);
  const delAt = await client.query(
    `DELETE FROM ders_dagit_assignment_teacher
     WHERE assignment_id IN (SELECT id FROM ders_dagit_assignment WHERE studio_id = $1)`,
    params,
  );
  const delAsg = await client.query(`DELETE FROM ders_dagit_assignment WHERE studio_id = $1`, params);
  const delPool = await client.query(`DELETE FROM ders_dagit_elective_pool WHERE studio_id = $1`, params);
  const delGrp = await client.query(`DELETE FROM ders_dagit_group WHERE studio_id = $1`, params);
  const delSub = await client.query(`DELETE FROM ders_dagit_subject WHERE studio_id = $1`, params);
  const delPref = await client.query(`DELETE FROM ders_dagit_preference WHERE studio_id = $1`, params);
  const delReq = await client.query(`DELETE FROM ders_dagit_request WHERE studio_id = $1`, params);
  const delProf = await client.query(`DELETE FROM ders_dagit_class_profile WHERE studio_id = $1`, params);

  await client.query(
    `UPDATE ders_dagit_studio SET settings = COALESCE(settings, '{}'::jsonb)
       - 'ttkb_seed_at' - 'ttkb_elective_seed_at' - 'ttkb_catalog_names' - 'elective_ttkb_names'
     WHERE id = $1`,
    params,
  );

  return {
    program_entries: delEntry.rowCount,
    programs: delProg.rowCount,
    jobs: delJob.rowCount,
    assignments: delAsg.rowCount,
    elective_pools: delPool.rowCount,
    groups: delGrp.rowCount,
    subjects: delSub.rowCount,
    class_profiles: delProf.rowCount,
    preferences: delPref.rowCount,
    requests: delReq.rowCount,
  };
}

(async () => {
  const client = pgClient();
  await client.connect();

  let studios;
  if (allStudios) {
    studios = (await client.query(`SELECT id, name, school_id FROM ders_dagit_studio ORDER BY created_at`)).rows;
  } else {
    const schools = await client.query(
      `SELECT id, name FROM schools WHERE name = ANY($1::text[])`,
      [DEMO_SCHOOL_NAMES],
    );
    if (!schools.rowCount) {
      console.log('Demo okul bulunamadı:', DEMO_SCHOOL_NAMES.join(', '));
      await client.end();
      return;
    }
    console.log(
      'Okullar:',
      schools.rows.map((s) => s.name).join(', '),
    );
    studios = (
      await client.query(
        `SELECT id, name, school_id FROM ders_dagit_studio WHERE school_id = ANY($1::uuid[])`,
        [schools.rows.map((s) => s.id)],
      )
    ).rows;
  }

  if (!studios.length) {
    console.log('Temizlenecek stüdyo yok.');
    await client.end();
    return;
  }

  for (const st of studios) {
    console.log('\nStüdyo:', st.name || st.id);
    const r = await clearStudio(client, st.id);
    console.log(r);
  }

  console.log('\nDemo DersDağıt verisi temizlendi.');
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
