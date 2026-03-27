import type { WebExtrasPublic } from '@/lib/web-extras-public';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
const STORAGE_KEY = 'ogretmenpro_web_extras_support_enabled';

function webExtrasUrl(): string {
  return `${baseUrl.replace(/\/$/, '')}/content/web-extras`;
}

function readStoredSupport(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredSupport(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

let supportEnabledCache: boolean | null = null;
let supportEnabledPromise: Promise<boolean> | null = null;
/** /tickets vb. 403 MODULE_DISABLED sonrası web-extras gecikse bile kapalı say */
let disabledByTicketsApi = false;

export function markSupportModuleDisabledByApi(): void {
  disabledByTicketsApi = true;
  supportEnabledCache = false;
  writeStoredSupport(false);
}

export function getSupportEnabledSnapshot(): boolean | null {
  if (disabledByTicketsApi) return false;
  if (supportEnabledCache !== null) return supportEnabledCache;
  return readStoredSupport();
}

async function fetchWebExtrasOnce(): Promise<boolean> {
  try {
    const res = await fetch(webExtrasUrl(), { cache: 'no-store' });
    if (res.status === 429) {
      const fallback = supportEnabledCache ?? readStoredSupport() ?? true;
      supportEnabledCache = fallback;
      return fallback;
    }
    if (!res.ok) {
      supportEnabledCache = supportEnabledCache ?? readStoredSupport() ?? true;
      return supportEnabledCache;
    }
    const data = (await res.json()) as WebExtrasPublic | null;
    supportEnabledCache = data?.support_enabled ?? true;
    if (supportEnabledCache) disabledByTicketsApi = false;
    writeStoredSupport(supportEnabledCache);
    return supportEnabledCache;
  } catch {
    supportEnabledCache = supportEnabledCache ?? readStoredSupport() ?? true;
    return supportEnabledCache;
  }
}

export async function fetchWebExtrasSupportEnabled(): Promise<boolean> {
  if (disabledByTicketsApi) return false;
  if (supportEnabledCache !== null) return supportEnabledCache;
  supportEnabledPromise ??= (async () => {
    try {
      return await fetchWebExtrasOnce();
    } catch {
      supportEnabledCache = supportEnabledCache ?? readStoredSupport() ?? true;
      return supportEnabledCache;
    } finally {
      supportEnabledPromise = null;
    }
  })();
  return supportEnabledPromise;
}
