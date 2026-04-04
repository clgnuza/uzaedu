/**
 * Yerel app_config -> SQL (UPSERT). Çıktıyı dosyaya yönlendirip canlıda psql ile içe aktarın.
 * UYARI: API anahtarları, R2 şifreleri vb. içerir; dosyayı güvenli tutun.
 *
 *   node tools/export-app-config-sql.cjs ../app-config-import.sql
 *   # sunucuda: psql ... -f app-config-import.sql
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function esc(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
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
  const { rows } = await client.query(
    'SELECT key, value, updated_at FROM app_config ORDER BY key',
  );
  const outPath = process.argv[2]?.trim();
  const lines = [];
  lines.push('-- app_config upsert; rows: ' + rows.length);
  lines.push('BEGIN;');
  for (const r of rows) {
    const upd = r.updated_at
      ? `${esc(new Date(r.updated_at).toISOString())}::timestamptz`
      : 'NOW()';
    lines.push(
      `INSERT INTO app_config (key, value, updated_at) VALUES (${esc(r.key)}, ${esc(r.value)}, ${upd}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`,
    );
  }
  lines.push('COMMIT;');
  const text = lines.join('\n') + '\n';
  if (outPath) {
    fs.writeFileSync(outPath, Buffer.from(text, 'utf8'));
    console.error('Yazıldı:', path.resolve(outPath), '(' + rows.length + ' satır)');
  } else {
    process.stdout.write(text);
  }
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
