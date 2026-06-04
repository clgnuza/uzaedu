/** Zayıf ağ: son başarılı GET yanıtını kısa süre göster (kullanıcı bazlı anahtar) */

const PREFIX = 'uzaedu-stale:';

export function staleCacheKey(path: string, token: string | null): string {
  const t = token?.slice(0, 12) ?? 'anon';
  return `${PREFIX}${t}:${path}`;
}

export function readStaleJson<T>(key: string, maxAgeMs: number): T | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - at > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeStaleJson<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota */
  }
}
