import { getMatchedRoute, ROUTE_SCHOOL_MODULES } from '@/config/menu';
import type { SchoolModuleKey } from '@/config/school-modules';

/** Pathname → market module_prices anahtarı (giriş uyarısı için). Uzun önek önce eşleşir. */
const ROUTE_PREFIX_TO_MARKET_MODULE: [string, SchoolModuleKey][] = [
  ['/ogretmen-ajandasi/degerlendirme', 'teacher_agenda'],
  ['/ogretmen-ajandasi', 'teacher_agenda'],
  ['/bilsem/yillik-plan', 'bilsem'],
  ['/bilsem/takvim', 'bilsem'],
  ['/bilsem-sablon', 'bilsem'],
  ['/bilsem', 'bilsem'],
  ['/school-reviews-settings', 'school_reviews'],
  ['/document-templates', 'document'],
  ['/outcome-sets', 'outcome'],
  ['/extra-lesson-params', 'extra_lesson'],
  ['/extra-lesson-calc', 'extra_lesson'],
  ['/optik-okuma-ayarlar', 'optical'],
  ['/school-profile', 'school_profile'],
  ['/classes-subjects', 'bilsem'],
  ['/moderation', 'school_profile'],
  ['/duty', 'duty'],
  ['/tv', 'tv'],
  ['/akilli-tahta', 'smart_board'],
  ['/optik-formlar', 'optical'],
  ['/kazanim-takip', 'outcome'],
  ['/evrak', 'document'],
  ['/school-reviews-report', 'school_reviews'],
  ['/school-reviews', 'school_reviews'],
  ['/favoriler', 'school_reviews'],
];

const SORTED_PREFIXES = [...ROUTE_PREFIX_TO_MARKET_MODULE].sort((a, b) => b[0].length - a[0].length);

export function getMarketModuleKeyForPath(pathname: string): SchoolModuleKey | null {
  const n = pathname.split('?')[0] || '';
  if (n === '/market' || n.startsWith('/market/')) return null;
  if (n === '/market-policy' || n.startsWith('/market-policy/')) return null;
  for (const [prefix, key] of SORTED_PREFIXES) {
    if (n === prefix || n.startsWith(prefix + '/')) return key;
  }
  const route = getMatchedRoute(n);
  if (route && ROUTE_SCHOOL_MODULES[route]) {
    return ROUTE_SCHOOL_MODULES[route] as SchoolModuleKey;
  }
  return null;
}
