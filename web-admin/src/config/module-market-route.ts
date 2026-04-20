import { getMatchedRoute, ROUTE_SCHOOL_MODULES } from '@/config/menu';
import { SCHOOL_MODULE_KEYS, type SchoolModuleKey } from '@/config/school-modules';

/** menu.ts ROUTE_SCHOOL_MODULES bazen moderator anahtarı döner; market ile hizala */
const ROUTE_SCHOOL_MODULE_ALIAS: Record<string, SchoolModuleKey> = {
  document_templates: 'document',
};

/** Pathname → market module_prices anahtarı (giriş uyarısı için). Uzun önek önce eşleşir. */
const ROUTE_PREFIX_TO_MARKET_MODULE: [string, SchoolModuleKey][] = [
  ['/ogretmen-ajandasi/degerlendirme', 'teacher_agenda'],
  ['/ogretmen-ajandasi', 'teacher_agenda'],
  ['/bilsem/yillik-plan', 'bilsem'],
  ['/bilsem/plan-katki-moderasyon', 'document'],
  ['/bilsem/plan-katki', 'bilsem'],
  ['/bilsem/takvim', 'bilsem'],
  ['/bilsem-sablon', 'bilsem'],
  ['/bilsem', 'bilsem'],
  ['/school-reviews-settings', 'school_reviews'],
  ['/document-templates', 'document'],
  ['/outcome-sets', 'outcome'],
  ['/extra-lesson-params', 'extra_lesson'],
  ['/ek-ders-hesaplama', 'extra_lesson'],
  ['/optik-okuma-ayarlar', 'optical'],
  ['/classes-subjects', 'bilsem'],
  ['/duty', 'duty'],
  ['/tv', 'tv'],
  ['/akilli-tahta', 'smart_board'],
  ['/optik-formlar', 'optical'],
  ['/kazanim-takip', 'outcome'],
  ['/evrak', 'document'],
  ['/school-reviews-report', 'school_reviews'],
  ['/favoriler', 'school_reviews'],
];

const SORTED_PREFIXES = [...ROUTE_PREFIX_TO_MARKET_MODULE].sort((a, b) => b[0].length - a[0].length);

export function getMarketModuleKeyForPath(pathname: string): SchoolModuleKey | null {
  const n = pathname.split('?')[0] || '';
  /** Herkese açık okul listesi/detay; Market etkinleştirme duvarı uygulanmaz (girişli/girişsiz). */
  if (n === '/okul-degerlendirmeleri' || n.startsWith('/okul-degerlendirmeleri/')) return null;
  if (n === '/market' || n.startsWith('/market/')) return null;
  if (n === '/market-policy' || n.startsWith('/market-policy/')) return null;
  for (const [prefix, key] of SORTED_PREFIXES) {
    if (n === prefix || n.startsWith(prefix + '/')) return key;
  }
  const route = getMatchedRoute(n);
  if (route && ROUTE_SCHOOL_MODULES[route]) {
    const raw = ROUTE_SCHOOL_MODULES[route] as string;
    const key = (ROUTE_SCHOOL_MODULE_ALIAS[raw] ?? raw) as SchoolModuleKey;
    if (SCHOOL_MODULE_KEYS.includes(key)) return key;
  }
  return null;
}
