/**
 * main.ts içindeki diğer importlardan ÖNCE çalışmalı (.env process.env'e yazılır).
 */
import { config } from 'dotenv';
import { resolve } from 'path';

const paths = [
  resolve(__dirname, '..', '.env'),
  resolve(process.cwd(), '.env'),
];

/** main.ts log için: hangi .env yüklendi */
export let loadedEnvPath: string | null = null;

for (const p of paths) {
  const r = config({ path: p });
  if (!r.error) {
    loadedEnvPath = p;
    break;
  }
}

if (process.env.APP_ENV === 'local' || !process.env.APP_ENV) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
