const BLOCKED_PREFIXES = ['/tv', '/bakim', '/login', '/register'];

/** Push / harici kaynaklardan gelen yolları güvenli uygulama içi URL yapar */
export function sanitizeInAppPath(pathOrUrl: string, origin: string): string {
  try {
    const u = new URL(pathOrUrl, origin);
    if (u.origin !== origin) return '/bildirimler';
    const path = u.pathname || '/';
    if (BLOCKED_PREFIXES.some((b) => path === b || path.startsWith(`${b}/`))) {
      return '/dashboard';
    }
    return `${path}${u.search}${u.hash}`;
  } catch {
    return '/bildirimler';
  }
}
