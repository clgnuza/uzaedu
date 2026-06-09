export const RETURN_PATH_STORAGE_KEY = 'ogp_return_path';

/** Giriş sonrası anasayfaya / auth sayfalarına geri dönüş döngüsü oluşturmasın. */
function isUsableReturnPath(path: string): boolean {
  const p = (path.split('?')[0] || '/').replace(/\/$/, '') || '/';
  if (p === '/') return false;
  if (p === '/moduller' || p.startsWith('/moduller/')) return false;
  if (p === '/login' || p.startsWith('/login/')) return false;
  if (p === '/register' || p.startsWith('/register/')) return false;
  if (p === '/forgot-password' || p.startsWith('/forgot-password/')) return false;
  if (p === '/reset-password') return false;
  if (p === '/verify-school-email') return false;
  return path.startsWith('/') && !path.startsWith('//');
}

export function rememberReturnPath(fullPath: string): void {
  if (typeof window === 'undefined') return;
  if (!isUsableReturnPath(fullPath)) return;
  try {
    sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, fullPath);
  } catch {
    /* private mode */
  }
}

/** `redirect` query güvenli iç yol ise öncelik; yoksa son ziyaret; yoksa varsayılan. */
export function getPostLoginRedirect(redirectQuery: string | null | undefined, fallback = '/dashboard'): string {
  const q = redirectQuery?.trim();
  if (q && isUsableReturnPath(q)) return q;
  if (typeof window !== 'undefined') {
    try {
      const last = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY);
      if (last && isUsableReturnPath(last)) return last;
    } catch {
      /* noop */
    }
  }
  return fallback;
}
