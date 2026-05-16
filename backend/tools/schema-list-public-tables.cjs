/**
 * public şemasındaki tablo adlarını satır satır yazar.
 * SCHEMA_ENV_PATH=/path/to/.env (yoksa ../.env)
 */
const path = require('path');
const { Client } = require('pg');

const envPath = process.env.SCHEMA_ENV_PATH || path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath, quiet: true });

(async () => {
  if (process.env.APP_USE_SQLITE === 'true') {
    console.error('[schema-list] Postgres değil (APP_USE_SQLITE=true)');
    process.exit(2);
  }
  const c = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
  await c.connect();
  try {
    const r = await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    for (const row of r.rows) process.stdout.write(row.tablename + '\n');
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
