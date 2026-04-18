/**
 * Yerel/canlı: app_config.welcome_module_config = kod varsayılanı (366 gün) + enabled açık.
 * Çalıştır: npx ts-node -r tsconfig-paths/register tools/seed-welcome-module.ts
 */
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import * as path from 'path';
import { DEFAULT_WELCOME_MODULE } from '../src/app-config/welcome-module.defaults';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const payload = {
    enabled: true,
    by_day: DEFAULT_WELCOME_MODULE.by_day,
    fallback_message: DEFAULT_WELCOME_MODULE.fallback_message,
    cache_ttl_welcome: DEFAULT_WELCOME_MODULE.cache_ttl_welcome,
    popup_enabled: DEFAULT_WELCOME_MODULE.popup_enabled,
    popup_mode: DEFAULT_WELCOME_MODULE.popup_mode,
  };
  const value = JSON.stringify(payload);
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();
  await client.query(
    `INSERT INTO app_config (key, value, "updated_at")
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updated_at" = NOW()`,
    ['welcome_module_config', value],
  );
  await client.end();
  const n = Object.keys(payload.by_day).length;
  console.log('welcome_module_config yazıldı, by_day anahtarı:', n, 'enabled:', payload.enabled);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
