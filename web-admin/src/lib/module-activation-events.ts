import { getMarketModuleKeyForPath } from '@/config/module-market-route';

export const MODULE_ACTIVATION_REQUIRED_EVENT = 'ogretmenpro:module-activation-required';

/** Market’te etkinleştirme sonrası tüm modül sayfalarının durumu yenilensin */
export const MODULE_ACTIVATION_REFRESH_EVENT = 'ogretmenpro:module-activation-refresh';

export type ModuleActivationRequiredDetail = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

/** Ana sayfa vb. arka plan isteklerinde global uyarı açılmasın; yalnız ilgili modül rotasındayken dialog gösterilsin. */
export function shouldDispatchModuleActivationForCurrentPath(
  pathname: string,
  details?: Record<string, unknown>,
): boolean {
  const n = (pathname.split('?')[0] || '').trim();
  const normalized = n === '/' || n === '' ? '/dashboard' : n;
  const current = getMarketModuleKeyForPath(normalized);
  if (!current || !details) return false;
  const single = details.module;
  if (typeof single === 'string' && single === current) return true;
  const multi = details.modules;
  if (Array.isArray(multi) && multi.some((m) => typeof m === 'string' && m === current)) return true;
  return false;
}

export function dispatchModuleActivationRequired(detail: ModuleActivationRequiredDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MODULE_ACTIVATION_REQUIRED_EVENT, { detail }));
}
