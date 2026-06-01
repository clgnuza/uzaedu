/**
 * Demo okulda Test Öğretmen (teacher@demo.local) dışındaki @demo.local öğretmenleri siler.
 *
 *   node tools/remove-demo-teachers.cjs
 *   node tools/remove-demo-teachers.cjs --dry-run
 */
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEMO_SCHOOL_NAMES = ['Ankara Çankaya Demo Lisesi', 'Demo Okulu'];
const KEEP_EMAIL = 'teacher@demo.local';
const dryRun = process.argv.includes('--dry-run');

function pgClient() {
  return new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
}

(async () => {
  const client = pgClient();
  await client.connect();

  const schools = await client.query(`SELECT id, name FROM schools WHERE name = ANY($1::text[])`, [
    DEMO_SCHOOL_NAMES,
  ]);
  if (!schools.rowCount) {
    console.log('Demo okul bulunamadı.');
    await client.end();
    return;
  }
  const schoolIds = schools.rows.map((s) => s.id);

  const targets = await client.query(
    `SELECT id, email, display_name
     FROM users
     WHERE school_id = ANY($1::uuid[])
       AND role = 'teacher'
       AND lower(trim(email)) <> lower(trim($2))
       AND lower(trim(email)) LIKE '%@demo.local'`,
    [schoolIds, KEEP_EMAIL],
  );

  if (!targets.rowCount) {
    console.log('Silinecek demo öğretmen yok.');
    await client.end();
    return;
  }

  console.log(
    'Silinecek:',
    targets.rows.map((r) => `${r.display_name} <${r.email}>`).join('\n  '),
  );

  if (dryRun) {
    console.log('(--dry-run, DB değişmedi)');
    await client.end();
    return;
  }

  const ids = targets.rows.map((r) => r.id);

  await client.query(`DELETE FROM duty_coverage WHERE covered_by_user_id = ANY($1::uuid[])`, [ids]);
  await client.query(
    `DELETE FROM duty_log WHERE old_user_id = ANY($1::uuid[]) OR new_user_id = ANY($1::uuid[]) OR performed_by = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(
    `DELETE FROM duty_swap_request WHERE requested_by_user_id = ANY($1::uuid[]) OR proposed_user_id = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(`DELETE FROM duty_preference WHERE user_id = ANY($1::uuid[])`, [ids]);
  await client.query(`DELETE FROM duty_absence WHERE user_id = ANY($1::uuid[])`, [ids]);
  await client.query(
    `DELETE FROM duty_slot WHERE user_id = ANY($1::uuid[]) OR reassigned_from_user_id = ANY($1::uuid[])`,
    [ids],
  );
  await client.query(`DELETE FROM butterfly_module_teachers WHERE user_id = ANY($1::uuid[])`, [ids]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
  console.log('Silindi:', ids.length, 'öğretmen. Kalan:', KEEP_EMAIL);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
