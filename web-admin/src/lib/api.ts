/**
 * Backend API client. Base URL sadece .env'den (API_CONTRACT, KIT_ENTEGRASYON_KURALLARI).
 * İlk çalıştırmada backend henüz ayağa kalkmamış olabilir; bağlantı hatalarında otomatik yeniden deneme yapılır.
 */

import { COOKIE_SESSION_TOKEN } from './auth-session';
import { markSupportModuleDisabledByApi } from './support-module-cache';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

/** Bağlantı hatası sayılacak hata mesajı parçacıkları */
const CONNECTION_ERROR_PATTERNS = ['fetch', 'connection', 'network', 'failed', 'err_connection', 'econnrefused'];

/** Bağlantı hatası mı kontrol et */
function isConnectionError(e: unknown): boolean {
  const msg = String(e instanceof Error ? e.message : e).toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/** Bağlantı hatası için kullanıcıya gösterilecek mesaj */
const CONNECTION_ERROR_MESSAGE =
  'Backend bağlantısı kurulamadı. Önce backend\'i başlatın (backend: npm run start:dev), birkaç saniye bekleyip sayfayı yenileyin.';

export function getApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/, '')}${p}`;
}

/** Bağlantı hatasında tekrar deneme yok (konsolda çoklu ERR_CONNECTION_REFUSED önlenir). */

export interface ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  /** HTTP yanıt kodu (!res.ok) */
  status?: number;
}

export function isApiErrorCode(e: unknown, code: string): boolean {
  return !!e && typeof e === 'object' && 'code' in e && (e as ApiError).code === code;
}

export function isSupportModuleDisabledError(e: unknown): boolean {
  if (isApiErrorCode(e, 'MODULE_DISABLED')) return true;
  const err = e as ApiError;
  if (err?.status === 403 && typeof err.message === 'string' && err.message.includes('Destek modülü şu anda kapalı')) return true;
  return false;
}

/** Kullanıcıya gösterilecek sabit HTTP mesajları (backend İngilizce döndüğünde) */
const HTTP_STATUS_USER_MESSAGE: Record<number, string> = {
  429: 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.',
  503: 'Sunucu geçici olarak yanıt veremiyor. Lütfen tekrar deneyin.',
  502: 'Sunucu bağlantısı kurulamadı.',
  504: 'İstek zaman aşımına uğradı.',
  408: 'İstek zaman aşımına uğradı.',
};

export function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (e instanceof Error && e.name === 'AbortError') return true;
  return false;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = options;
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string>),
  };
  if (token && token !== COOKIE_SESSION_TOKEN) headers['Authorization'] = `Bearer ${token}`;
  if (isFormData) delete headers['Content-Type'];

  try {
    const res = await fetch(getApiUrl(path), {
      ...init,
      headers,
      cache: init.cache ?? 'no-store',
      credentials: init.credentials ?? 'include',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        code?: string;
        details?: Record<string, unknown>;
      };
      const msg = body?.message;
      const fromBody = Array.isArray(msg) ? msg[0] : msg;
      const fallback = res.statusText || 'İstek başarısız';
      const userMsg = HTTP_STATUS_USER_MESSAGE[res.status];
      const text = userMsg ?? fromBody ?? fallback;
      if (body?.code === 'MODULE_DISABLED' || (res.status === 403 && typeof text === 'string' && text.includes('Destek modülü şu anda kapalı'))) {
        markSupportModuleDisabledByApi();
      }
      const err = new Error(text) as ApiError;
      err.code = body?.code;
      err.details = body?.details;
      err.status = res.status;
      throw err;
    }
    return res.json() as Promise<T>;
  } catch (e) {
    if (isAbortError(e)) throw e;
    if (isConnectionError(e)) {
      throw new Error(CONNECTION_ERROR_MESSAGE);
    }
    throw e;
  }
}
