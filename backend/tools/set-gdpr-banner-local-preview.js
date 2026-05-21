/**
 * Yerel önizleme: çerez şeridini kısa metin + landing görünümüne çeker.
 * Kullanım (backend): node tools/set-gdpr-banner-local-preview.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const KEY = 'gdpr_config';

(async () => {
  if (process.env.APP_USE_SQLITE === 'true') {
    console.log('SQLite: gdpr_config panelden veya TypeORM ile güncelleyin.');
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
    const res = await client.query('SELECT value FROM app_config WHERE key = $1', [KEY]);
    let cfg = {};
    if (res.rows[0]?.value?.trim()) {
      try {
        cfg = JSON.parse(res.rows[0].value);
      } catch {
        cfg = {};
      }
    }
    cfg.cookie_banner_visual = 'landing';
    cfg.cookie_banner_body_html = null;
    cfg.cookie_banner_enabled = cfg.cookie_banner_enabled !== false;
    const v = String(cfg.consent_version || '1');
    const n = parseInt(v, 10);
    cfg.consent_version = Number.isFinite(n) ? String(n + 1) : `${v}-b`;
    await client.query(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [KEY, JSON.stringify(cfg)],
    );
    console.log('OK gdpr_config -> landing, cookie_banner_body_html=null');
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
