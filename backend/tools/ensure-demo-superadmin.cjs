/**
 * Demo süper admin yoksa ekler, varsa şifreyi seed/demo-credentials ile eşitler.
 * Kullanım (backend): node tools/ensure-demo-superadmin.cjs
 */
const path = require('path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const EMAIL = 'superadmin@demo.local';
const DISPLAY = 'Süper Admin';
const PASSWORD = 'Su1n^qV4%pX9dK8*hL0j';

(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();
  const up = await client.query(
    `UPDATE users SET password_hash = $1, status = 'active' WHERE lower(trim(email)) = lower(trim($2))`,
    [hash, EMAIL],
  );
  if (up.rowCount > 0) {
    console.log('OK güncellendi:', up.rowCount);
    await client.end();
    return;
  }
  await client.query(
    `INSERT INTO users (email, display_name, role, school_id, status, password_hash, teacher_school_membership, teacher_public_name_masked, firebase_uid)
     VALUES ($1, $2, 'superadmin', NULL, 'active', $3, 'none', true, NULL)`,
    [EMAIL, DISPLAY, hash],
  );
  console.log('OK eklendi: superadmin@demo.local');
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
