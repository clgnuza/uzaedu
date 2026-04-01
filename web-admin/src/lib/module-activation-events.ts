export const MODULE_ACTIVATION_REQUIRED_EVENT = 'ogretmenpro:module-activation-required';

/** Market’te etkinleştirme sonrası tüm modül sayfalarının durumu yenilensin */
export const MODULE_ACTIVATION_REFRESH_EVENT = 'ogretmenpro:module-activation-refresh';

export type ModuleActivationRequiredDetail = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function dispatchModuleActivationRequired(detail: ModuleActivationRequiredDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MODULE_ACTIVATION_REQUIRED_EVENT, { detail }));
}
