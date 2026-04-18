/** Ortak API kökü — api.ts ve support-module-cache vb. aynı host/port mantığını kullanır (döngüsel import yok). */

function isLikelyDevMachineHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
}

/** `localhost` → IPv6 önceliği olan istemcilerde Nest (IPv4) kaçırılabilir. */
function devApiHost(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0') return '127.0.0.1';
  return hostname;
}

export function resolveDefaultApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    const p = process.env.NEXT_PUBLIC_API_PORT?.trim() || '4000';
    if (isLikelyDevMachineHost(h)) {
      return `http://${devApiHost(h)}:${p}/api`;
    }
  }
  return 'http://127.0.0.1:4000/api';
}
