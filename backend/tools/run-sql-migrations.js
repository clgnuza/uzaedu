/**
 * backend/migrations/*.sql dosyalarını alfabetik sırada PostgreSQL'de çalıştırır.
 * Canlı deploy: server-deploy.sh içinden (APP_USE_SQLITE ise atlanır).
 * .env: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  if (process.env.APP_USE_SQLITE === 'true') {
    console.log('[migrate:sql] skip (APP_USE_SQLITE=true)');
    return;
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[migrate:sql] no migrations directory');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate:sql] no .sql files');
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
    for (const f of files) {
      const full = path.join(migrationsDir, f);
      const sql = fs.readFileSync(full, 'utf8');
      console.log('[migrate:sql] running', f);
      await client.query(sql);
    }
    console.log('[migrate:sql] OK', files.length, 'file(s)');
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('[migrate:sql]', e);
  process.exit(1);
});
