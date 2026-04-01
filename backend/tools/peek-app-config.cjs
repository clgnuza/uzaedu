/** Sunucu/yerel: app_config satır sayısı ve anahtar listesi (şifre yok). */
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
  const c = await client.query('SELECT count(*)::int AS n FROM app_config');
  console.log('app_config rows:', c.rows[0].n);
  const keys = await client.query(
    'SELECT key, length(value) AS value_len, updated_at FROM app_config ORDER BY key',
  );
  for (const r of keys.rows) {
    console.log(r.key, 'len=', r.value_len, 'at', r.updated_at?.toISOString?.() ?? r.updated_at);
  }
  for (const t of ['users', 'schools']) {
    try {
      const n = await client.query(`SELECT count(*)::int AS n FROM ${t}`);
      console.log(t + ' rows:', n.rows[0].n);
    } catch {
      console.log(t + ': (tablo yok veya erişim yok)');
    }
  }
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
