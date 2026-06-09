/**
 * Backend API client. Base URL: resolve-api-base (env / aynı host + port).
 * Bağlantı reddi / ağ hatasında tek deneme (tarayıcı konsolunda 4x tekrar ve kırmızı gürültü oluşmaz).
 */

import { COOKIE_SESSION_TOKEN } from './auth-session';
import { getSessionBearer } from './session-bearer';
import { markSupportModuleDisabledByApi } from './support-module-cache';
import {
  dispatchModuleActivationRequired,
  shouldDispatchModuleActivationForCurrentPath,
} from './module-activation-events';
import { resolveDefaultApiBase } from './resolve-api-base';

export { resolveDefaultApiBase } from './resolve-api-base';

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

/** Bağlantı hatası mı (HTTP yanıtı yok; fetch reject) */
function isConnectionError(e: unknown): boolean {
  const withStatus = e as { status?: number };
  if (typeof withStatus?.status === 'number' && withStatus.status > 0) return false;
  if (e instanceof TypeError) return true;
  const msg = String(e instanceof Error ? e.message : e).toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/** Bağlantı hatası için kullanıcıya gösterilecek mesaj */
const CONNECTION_ERROR_MESSAGE =
  'Backend bağlantısı kurulamadı. Önce backend\'i başlatın (backend: npm run start:dev), birkaç saniye bekleyip sayfayı yenileyin.';

/** Bağlantı reddi sonrası arka plan tekrarlarını kesmek (konsolda aynı URL için tekrarlayan net::ERR_ gürültüsü). */
let apiUnavailableUntil = 0;

export function shouldSkipOptionalApiCalls(): boolean {
  return Date.now() < apiUnavailableUntil;
}

export function registerApiUnavailable(ms: number): void {
  apiUnavailableUntil = Math.max(apiUnavailableUntil, Date.now() + ms);
}

export function clearApiUnavailable(): void {
  apiUnavailableUntil = 0;
}

export function getApiUrl(path: string): string {
  return buildApiUrl(path, resolveDefaultApiBase());
}

/** İsteğe bağlı farklı API kökü (ör. yerel geliştirmede sadece /deploy için canlı API). */
export function buildApiUrl(path: string, apiRoot: string): string {
  const root = apiRoot.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}${p}`;
}

export interface ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  /** HTTP yanıt kodu (!res.ok) */
  status?: number;
}

export function isApiErrorCode(e: unknown, code: string): boolean {
  return !!e && typeof e === 'object' && 'code' in e && (e as ApiError).code === code;
}

/** Okul girişinde öğretmen hesabı; öğretmen girişinde okul yöneticisi (auth.service) */
export const AUTH_WRONG_PORTAL_TEACHER_LOGIN = 'WRONG_PORTAL_USE_TEACHER_LOGIN';
export const AUTH_WRONG_PORTAL_SCHOOL_LOGIN = 'WRONG_PORTAL_USE_SCHOOL_LOGIN';

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

/** JSON gövde; fetch öncesi stringify edilir (FormData/Blob hariç). */
export type ApiJsonBody = Record<string, unknown> | unknown[];

function shouldStringifyBody(
  body: BodyInit | ApiJsonBody | null | undefined,
): body is ApiJsonBody {
  if (body == null) return false;
  if (typeof body === 'string') return false;
  if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  if (body instanceof URLSearchParams) return false;
  return typeof body === 'object';
}

export function formatApiErrorMessage(msg: unknown): string | undefined {
  if (typeof msg === 'string') {
    const t = msg.trim();
    return t || undefined;
  }
  if (Array.isArray(msg)) {
    const parts = msg
      .map((x) => {
        if (typeof x === 'string') return x.trim();
        if (x && typeof x === 'object' && 'message' in x) {
          const m = (x as { message?: unknown }).message;
          return typeof m === 'string' ? m.trim() : undefined;
        }
        return undefined;
      })
      .filter((x): x is string => !!x);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (msg && typeof msg === 'object' && 'message' in msg) {
    return formatApiErrorMessage((msg as { message?: unknown }).message);
  }
  return undefined;
}

/** fetch için istemci süre sınırı (AbortSignal.timeout yoksa polyfill). */
export function createFetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  token?: string | null;
  apiBase?: string | null;
  body?: BodyInit | ApiJsonBody | null;
  /** false: çevrimdışıyken kuyruğa alma */
  offlineQueue?: boolean;
};

/** apiFetch ile aynı Bearer / çerez oturumu mantığı (dosya indirme vb.). */
export function buildApiAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token && token !== COOKIE_SESSION_TOKEN) {
    headers.Authorization = `Bearer ${token}`;
  } else if (token === COOKIE_SESSION_TOKEN || token == null) {
    const bearer = getSessionBearer();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  }
  return headers;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { token, apiBase, offlineQueue, ...init } = options;
  const requestBase =
    (apiBase != null && String(apiBase).trim() !== '' ? String(apiBase).trim() : null) ?? resolveDefaultApiBase();
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string>),
    ...buildApiAuthHeaders(token),
  };
  if (isFormData) delete headers['Content-Type'];

  let body = init.body;
  if (shouldStringifyBody(body)) {
    body = JSON.stringify(body);
  }

  try {
    const res = await fetch(buildApiUrl(path, requestBase), {
      ...init,
      body,
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
      const fromBody = formatApiErrorMessage(body?.message);
      const fallback = res.statusText || 'İstek başarısız';
      const userMsg = HTTP_STATUS_USER_MESSAGE[res.status];
      const text = userMsg ?? fromBody ?? fallback;
      if (body?.code === 'MODULE_DISABLED' || (res.status === 403 && typeof text === 'string' && text.includes('Destek modülü şu anda kapalı'))) {
        markSupportModuleDisabledByApi();
      }
      const err = new Error(text) as ApiError;
      err.code = body?.code;
      const rawIssues = (body as { issues?: unknown }).issues;
      const rawViolations = (body as { violations?: unknown }).violations;
      err.details = body?.details ?? {};
      if (Array.isArray(rawIssues) && rawIssues.length) {
        err.details = { ...err.details, issues: rawIssues };
      }
      if (Array.isArray(rawViolations) && rawViolations.length) {
        err.details = { ...err.details, violations: rawViolations };
      }
      if (!Object.keys(err.details).length) err.details = undefined;
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
    clearApiUnavailable();
    const text = await res.text();
    if (!text.trim()) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  } catch (e) {
    if (isAbortError(e)) throw e;
    if (isConnectionError(e)) {
      registerApiUnavailable(15_000);
      const method = (init.method ?? 'GET').toUpperCase();
      const mayQueue =
        offlineQueue !== false &&
        !isFormData &&
        (typeof body === 'string' || body == null) &&
        typeof window !== 'undefined';
      if (mayQueue) {
        try {
          const { canQueueOfflineMethod, canQueueOfflinePath, enqueueOfflineRequest } = await import(
            './pwa-offline-queue'
          );
          if (canQueueOfflineMethod(method) && canQueueOfflinePath(path)) {
            const queueHeaders: Record<string, string> = {};
            if (headers.Authorization) queueHeaders.Authorization = headers.Authorization;
            if (headers['Content-Type']) queueHeaders['Content-Type'] = headers['Content-Type'];
            await enqueueOfflineRequest({
              path,
              apiBase: requestBase,
              method,
              headers: queueHeaders,
              body: typeof body === 'string' ? body : null,
            });
            throw new Error('Çevrimdışı kaydedildi. Bağlantı gelince otomatik gönderilir.');
          }
        } catch (qe) {
          if (qe instanceof Error && qe.message.includes('Çevrimdışı kaydedildi')) throw qe;
        }
      }
      throw new Error(CONNECTION_ERROR_MESSAGE);
    }
    throw e;
  }
}
