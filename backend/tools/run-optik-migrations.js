/**
 * Optik oturum/tarama migration'ları (sırayla).
 * Kullanım: cd backend && node tools/run-optik-migrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ORDER = [
  'add-optik-scan-results.sql',
  'add-optik-exam-sessions.sql',
  'add-optik-session-integrations.sql',
];

(async () => {
  if (process.env.APP_USE_SQLITE === 'true') {
    console.log('[optik-migrate] skip (APP_USE_SQLITE=true)');
    return;
  }
  const dir = path.join(__dirname, '..', 'migrations');
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
  await client.connect();
  try {
    for (const f of ORDER) {
      const full = path.join(dir, f);
      if (!fs.existsSync(full)) throw new Error(`Missing ${f}`);
      console.log('[optik-migrate]', f);
      await client.query(fs.readFileSync(full, 'utf8'));
    }
    console.log('[optik-migrate] OK');
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('[optik-migrate]', e.message || e);
  process.exit(1);
});
