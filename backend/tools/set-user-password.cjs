/**
 * Yerel / sunucu: .env ile Postgres'e bağlanıp kullanıcı şifresini bcrypt ile yazar.
 * Kullanım (backend klasöründen): node tools/set-user-password.cjs <email> <yeni_şifre>
 */
const path = require('path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const email = process.argv[2];
const password = process.argv[3];
if (!email?.trim() || !password) {
  console.error('Kullanım: node tools/set-user-password.cjs <email> <yeni_şifre>');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 10);
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();
  const norm = email.trim().toLowerCase();
  const sel = await client.query(
    `SELECT email, role, status FROM users WHERE lower(trim(email)) = $1`,
    [norm],
  );
  if (sel.rows.length === 0) {
    console.error('Kullanıcı bulunamadı (e-posta kontrol edin).');
    process.exit(1);
  }
  const u = sel.rows[0];
  if (u.status !== 'active') {
    console.error(
      `Kullanıcı durumu "${u.status}" — giriş için veritabanında status=active olmalı (manuel düzeltin).`,
    );
    process.exit(1);
  }
  const r = await client.query(`UPDATE users SET password_hash = $1 WHERE lower(trim(email)) = $2`, [
    hash,
    norm,
  ]);
  console.log('OK, güncellenen:', r.rowCount);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
