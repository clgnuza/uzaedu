/**
 * Tek bir .sql dosyasını PostgreSQL'de çalıştırır.
 * Kullanım: node tools/run-single-migration.js migrations/20260513120000_yolluk_seed_xls_2026.sql
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const rel = process.argv[2];
if (!rel) {
  console.error('Kullanım: node tools/run-single-migration.js <migrations/dosya.sql>');
  process.exit(1);
}

const full = path.isAbsolute(rel) ? rel : path.join(__dirname, '..', rel);
if (!fs.existsSync(full)) {
  console.error('Dosya yok:', full);
  process.exit(1);
}

(async () => {
  if (process.env.APP_USE_SQLITE === 'true') {
    console.log('skip (APP_USE_SQLITE=true)');
    return;
  }
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
  await client.connect();
  try {
    const sql = fs.readFileSync(full, 'utf8');
    console.log('running', path.basename(full));
    await client.query(sql);
    console.log('OK');
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
