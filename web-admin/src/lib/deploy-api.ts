/** Canlı dağıtım için varsayılan API (NEXT_PUBLIC_API_BASE_URL localhost iken otomatik kullanılır). */
export const LIVE_DEPLOY_API_BASE = 'https://api.uzaedu.com/api';

/**
 * /deploy/* istekleri için API kökü.
 * - NEXT_PUBLIC_DEPLOY_API_BASE_URL doluysa o kullanılır.
 * - Ana API localhost/127.0.0.1 ise canlı API (LIVE_DEPLOY_API_BASE) — böylece localhost’tan sunucu güncellenir.
 * - Aksi halde undefined: normal NEXT_PUBLIC_API_BASE_URL kullanılır.
 */
export function resolveDeployApiBase(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_DEPLOY_API_BASE_URL?.trim();
  if (explicit) return explicit;
  const main = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
  if (/localhost|127\.0\.0\.1/i.test(main)) return LIVE_DEPLOY_API_BASE;
  return undefined;
}
