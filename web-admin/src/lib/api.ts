/**
 * Backend API client. Base URL sadece .env'den (API_CONTRACT, KIT_ENTEGRASYON_KURALLARI).
 * İlk çalıştırmada backend henüz ayağa kalkmamış olabilir; bağlantı hatalarında otomatik yeniden deneme yapılır.
 */

import { COOKIE_SESSION_TOKEN } from './auth-session';
import { markSupportModuleDisabledByApi } from './support-module-cache';
import {
  dispatchModuleActivationRequired,
  shouldDispatchModuleActivationForCurrentPath,
} from './module-activation-events';

/** Aynı makinedeki backend: tarayıcı hangi hosttan açıldıysa (LAN, emülatör 10.0.2.2, localhost) API de o host + APP_PORT. */
function isLikelyDevMachineHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
}

export function resolveDefaultApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    const p = process.env.NEXT_PUBLIC_API_PORT?.trim() || '4000';
    if (isLikelyDevMachineHost(h)) {
      return `http://${h}:${p}/api`;
    }
  }
  return 'http://localhost:4000/api';
}

/** Bağlantı hatası sayılacak hata mesajı parçacıkları (HTTP yanıtı alındıysa buraya düşmez) */
const CONNECTION_ERROR_PATTERNS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'load failed',
  'network request failed',
  'connection',
  'err_connection',
  'econnrefused',
  'connection refused',
  'econnreset',
  'etimedout',
  'socket hang up',
];

/** Bağlantı hatası mı kontrol et */
function isConnectionError(e: unknown): boolean {
  const withStatus = e as { status?: number };
  if (typeof withStatus?.status === 'number' && withStatus.status > 0) return false;
  const msg = String(e instanceof Error ? e.message : e).toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/** Bağlantı hatası için kullanıcıya gösterilecek mesaj */
const CONNECTION_ERROR_MESSAGE =
  'Backend bağlantısı kurulamadı. Önce backend\'i başlatın (backend: npm run start:dev), birkaç saniye bekleyip sayfayı yenileyin.';

export function getApiUrl(path: string): string {
  return buildApiUrl(path, resolveDefaultApiBase());
}

/** İsteğe bağlı farklı API kökü (ör. yerel geliştirmede sadece /deploy için canlı API). */
export function buildApiUrl(path: string, apiRoot: string): string {
  const root = apiRoot.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}${p}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  /** HTTP yanıt kodu (!res.ok) */
  status?: number;
}

export function isApiErrorCode(e: unknown, code: string): boolean {
  return !!e && typeof e === 'object' && 'code' in e && (e as ApiError).code === code;
}

export function isModuleActivationRequiredError(e: unknown): boolean {
  return isApiErrorCode(e, 'MODULE_ACTIVATION_REQUIRED');
}

export function isSupportModuleDisabledError(e: unknown): boolean {
  if (isApiErrorCode(e, 'MODULE_DISABLED')) return true;
  const err = e as ApiError;
  if (err?.status === 403 && typeof err.message === 'string' && err.message.includes('Destek modülü şu anda kapalı')) return true;
  return false;
}

/** Kullanıcıya gösterilecek sabit HTTP mesajları (backend İngilizce döndüğünde) */
const HTTP_STATUS_USER_MESSAGE: Record<number, string> = {
  402: 'Bu işlem için modül etkinleştirmesi veya ek bakiye gerekebilir.',
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
  options: RequestInit & { token?: string | null; apiBase?: string | null } = {}
): Promise<T> {
  const { token, apiBase, ...init } = options;
  const requestBase =
    (apiBase != null && String(apiBase).trim() !== '' ? String(apiBase).trim() : null) ?? resolveDefaultApiBase();
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string>),
  };
  if (token && token !== COOKIE_SESSION_TOKEN) headers['Authorization'] = `Bearer ${token}`;
  if (isFormData) delete headers['Content-Type'];

  const maxAttempts = 4;
  let lastConn: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(buildApiUrl(path, requestBase), {
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
        if (
          body?.code === 'MODULE_ACTIVATION_REQUIRED' &&
          typeof window !== 'undefined' &&
          shouldDispatchModuleActivationForCurrentPath(window.location.pathname, body.details)
        ) {
          dispatchModuleActivationRequired({
            code: body.code,
            message: text,
            details: body.details,
          });
        }
        throw err;
      }
      return res.json() as Promise<T>;
    } catch (e) {
      if (isAbortError(e)) throw e;
      if (isConnectionError(e)) {
        lastConn = e;
        if (attempt < maxAttempts) {
          await sleep(400 * attempt);
          continue;
        }
        throw new Error(CONNECTION_ERROR_MESSAGE);
      }
      throw e;
    }
  }
  throw lastConn instanceof Error ? lastConn : new Error(CONNECTION_ERROR_MESSAGE);
}
