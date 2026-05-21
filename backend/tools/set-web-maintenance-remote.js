/**
 * Canlı DB: web_extras_config.maintenance_enabled (JWT gerekmez; sunucuda çalıştırın).
 * Kullanım: node tools/set-web-maintenance-remote.js --on|--off
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const KEY = 'web_extras_config';
const mode = process.argv[2];
if (mode !== '--on' && mode !== '--off') {
  console.error('Kullanım: node tools/set-web-maintenance-remote.js --on|--off');
  process.exit(1);
}
const enabled = mode === '--on';
const msg = process.env.PROD_MAINTENANCE_MESSAGE_HTML?.trim();

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
    const res = await client.query('SELECT value FROM app_config WHERE key = $1', [KEY]);
    let cfg = { maintenance_enabled: false };
    const raw = res.rows[0]?.value;
    if (raw?.trim()) {
      try {
        cfg = { ...cfg, ...JSON.parse(raw) };
      } catch {
        /* keep defaults */
      }
    }
    cfg.maintenance_enabled = enabled;
    if (enabled && msg) cfg.maintenance_message_html = msg;
    await client.query(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [KEY, JSON.stringify(cfg)],
    );
    console.log(`OK maintenance_enabled=${enabled}`);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
