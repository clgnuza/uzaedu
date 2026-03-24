/**
 * SQL dosyasını UTF-8 olarak okuyup PostgreSQL'e gönderir (Türkçe bozulmasını önler).
 * Kullanım (backend klasöründen): node tools/run-sql-utf8.cjs migrations/seed-bilsem-cografya-puy-outcomes.sql
 */
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const rel = process.argv[2];
if (!rel) {
  console.error('Kullanım: node tools/run-sql-utf8.cjs <migrations/...sql>');
  process.exit(1);
}
const sqlPath = path.isAbsolute(rel) ? rel : path.join(__dirname, '..', rel);
if (!fs.existsSync(sqlPath)) {
  console.error('Dosya yok:', sqlPath);
  process.exit(1);
}

(async () => {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  console.log('OK (UTF-8):', sqlPath);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
