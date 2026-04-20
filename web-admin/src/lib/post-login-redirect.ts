export const RETURN_PATH_STORAGE_KEY = 'ogp_return_path';

export function rememberReturnPath(fullPath: string): void {
  if (typeof window === 'undefined') return;
  if (!fullPath.startsWith('/') || fullPath.startsWith('//')) return;
  try {
    sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, fullPath);
  } catch {
    /* private mode */
  }
}

/** `redirect` query güvenli iç yol ise öncelik; yoksa son ziyaret; yoksa varsayılan. */
export function getPostLoginRedirect(redirectQuery: string | null | undefined, fallback = '/dashboard'): string {
  const q = redirectQuery?.trim();
  if (q && q.startsWith('/') && !q.startsWith('//')) return q;
  if (typeof window !== 'undefined') {
    try {
      const last = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY);
      if (last?.startsWith('/') && !last.startsWith('//')) return last;
    } catch {
      /* noop */
    }
  }
  return fallback;
}
