import { env } from './env';

/** Yerel ağ / emülatör (10.0.2.2) — Next dev portlarından gelen isteklere izin */
export function isLocalLanDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    if (!['3000', '3001', '3002'].includes(port)) return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
  } catch {
    return false;
  }
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (env.corsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  if (['local', 'development'].includes(env.nodeEnv) && isLocalLanDevOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}
