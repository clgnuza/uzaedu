/**
 * Evrak tabanlı "yıllık plan" akışı iki URL’de kullanılır:
 * - /evrak — standart (MEB / okul) şablonları
 * - /bilsem/yillik-plan — Bilsem (curriculum_model=bilsem) şablonları
 *
 * Aynı UI bileşenini paylaşırız; backend ayrıdır (/documents vs /bilsem/...).
 * localStorage anahtarlarını ayırarak bir taraftaki filtre değişiminin diğerini etkilemesini engelleriz.
 */
export type YillikPlanEvrakVariant = 'evrak' | 'bilsem';

/** Wizard bileşeni scope ile çalışır; pathname yerine bunu kullanın. */

const BILSEM_YILLIK_PLAN_PREFIX = '/bilsem/yillik-plan';

export function getYillikPlanEvrakVariant(pathname: string | null): YillikPlanEvrakVariant {
  return pathname?.startsWith(BILSEM_YILLIK_PLAN_PREFIX) ? 'bilsem' : 'evrak';
}

export function getYillikPlanEvrakStorage(variant: YillikPlanEvrakVariant) {
  if (variant === 'bilsem') {
    return {
      filtersKey: 'bilsem-yillik-plan-last-filters',
      guideSeenKey: 'bilsem-yillik-plan-guide-seen',
    };
  }
  return {
    filtersKey: 'evrak-last-filters',
    guideSeenKey: 'evrak-guide-seen',
  };
}
