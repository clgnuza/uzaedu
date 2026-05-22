/**
 * Pardus .deb/ZIP paket üretimi — API/panel URL (resolve-api-base ile döngüsel import yok).
 */
import { resolveDefaultApiBase } from './resolve-api-base';

export function normalizeHttpBaseUrl(raw: string, panelOrigin?: string): string {
  const t = raw.trim();
  if (!t) throw new Error('API kök adresi boş.');
  if (/^https?:\/\//i.test(t)) {
    return t.replace(/\/+$/, '');
  }
  if (!t.includes('://') && /^[a-z0-9.-]+\//i.test(t)) {
    return normalizeHttpBaseUrl(`https://${t}`, panelOrigin);
  }
  const base = (panelOrigin || (typeof window !== 'undefined' ? window.location.origin : ''))
    .trim()
    .replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) {
    throw new Error('Panel adresi gerekli; göreli API yolu çözümlenemedi.');
  }
  const path = t.startsWith('/') ? t : `/${t}`;
  return `${base}${path}`.replace(/\/+$/, '');
}

export function normalizePanelOrigin(origin?: string): string {
  const o = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(o)) {
    throw new Error('Panel adresi geçersiz (http veya https olmalı).');
  }
  return o;
}

export function resolveSmartBoardPackApiBase(panelOrigin: string): string {
  return normalizeHttpBaseUrl(resolveDefaultApiBase(), panelOrigin);
}

const PACK_BUILD_TIMEOUT_MS = 45_000;

export function withPackBuildTimeout<T>(promise: Promise<T>, label = 'Paket'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(
        new Error(
          `${label} üretimi ${PACK_BUILD_TIMEOUT_MS / 1000} sn içinde bitmedi. Sayfayı yenileyip tekrar deneyin (Chrome/Edge önerilir).`,
        ),
      );
    }, PACK_BUILD_TIMEOUT_MS);
    promise.then(
      (v) => {
        globalThis.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        globalThis.clearTimeout(timer);
        reject(e);
      },
    );
  });
}
