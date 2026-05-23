/** Ana akış — üst şerit (StudioHubBar) */
export const STUDIO_FLOW = [
  { href: '/ders-dagit/studyo', label: 'Özet', exact: true },
  { href: '/ders-dagit/studyo/kurulum', label: 'Kurulum' },
  { href: '/ders-dagit/studyo/dogrulama', label: 'Doğrula' },
  { href: '/ders-dagit/studyo/uret', label: 'Oluştur' },
  { href: '/ders-dagit/studyo/program', label: 'Program' },
  { href: '/ders-dagit/studyo/raporlar', label: 'Yazdır' },
  { href: '/ders-dagit/studyo/ayarlar', label: 'Ayarlar' },
] as const;

/** Kurulum / veri sayfaları — ikinci şerit (FLOW ile çakışmaz) */
export const STUDIO_DATA_PAGES = [
  { href: '/ders-dagit/studyo/donem', label: 'Dönem' },
  { href: '/ders-dagit/studyo/sinif-saatleri', label: 'Sınıf saatleri' },
  { href: '/ders-dagit/studyo/ogretmenler', label: 'Öğretmenler' },
  { href: '/ders-dagit/studyo/dersler', label: 'Dersler' },
  { href: '/ders-dagit/studyo/gruplar', label: 'Gruplar' },
  { href: '/ders-dagit/studyo/secmeli', label: 'Seçmeli' },
  { href: '/ders-dagit/studyo/derslikler', label: 'Derslikler' },
  { href: '/ders-dagit/studyo/atamalar', label: 'Atamalar' },
  { href: '/ders-dagit/studyo/planlama-iliskileri', label: 'Planlama' },
  { href: '/ders-dagit/studyo/kurallar', label: 'Kurallar' },
  { href: '/ders-dagit/studyo/arsiv', label: 'Arşiv' },
  { href: '/ders-dagit/studyo/adalet', label: 'Adalet' },
] as const;

const FLOW_ONLY = new Set([
  '/ders-dagit/studyo',
  '/ders-dagit/studyo/kurulum',
  '/ders-dagit/studyo/dogrulama',
  '/ders-dagit/studyo/uret',
  '/ders-dagit/studyo/program',
  '/ders-dagit/studyo/raporlar',
  '/ders-dagit/studyo/ayarlar',
  '/ders-dagit/studyo/yayin',
  '/ders-dagit/studyo/ogretmen-program',
]);

export function matchStudioHref(pathname: string, href: string, exact?: boolean) {
  const path = pathname.split('?')[0] ?? pathname;
  const base = href.split('?')[0] ?? href;
  if (href === '/ders-dagit/studyo' || exact) return path === base;
  return path === base || path.startsWith(`${base}/`);
}

/** En uzun eşleşen stüdyo rotası (mobil menü için) */
export function resolveStudioNavHref(pathname: string, hrefs: string[]): string {
  const path = pathname.split('?')[0] ?? pathname;
  let best = '';
  for (const href of hrefs) {
    if (matchStudioHref(path, href) && href.length > best.length) best = href;
  }
  return best;
}

/** Program / doğrulama / üret sayfalarında alt menü gizlenir */
export function showStudioDataNav(pathname: string) {
  if (!pathname.startsWith('/ders-dagit/studyo')) return false;
  for (const p of FLOW_ONLY) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return false;
  }
  return true;
}

export function showStudioOnboarding(pathname: string, setupComplete: boolean) {
  if (setupComplete) return false;
  if (pathname.includes('/program') || pathname.includes('/uret')) return false;
  return true;
}

/** Ayarlar sayfası — tüm modül sayfaları (gizli alt menü dahil) */
export const STUDIO_EXTRA_PAGES = [
  { href: '/ders-dagit/studyo/gruplar', label: 'Gruplar' },
  { href: '/ders-dagit/studyo/secmeli', label: 'Seçmeli' },
  { href: '/ders-dagit/studyo/arsiv', label: 'Arşiv' },
  { href: '/ders-dagit/studyo/adalet', label: 'Adalet' },
  { href: '/ders-dagit/studyo/ogretmen-program', label: 'Öğretmen programı' },
  { href: '/ders-dagit/studyo/yayin', label: 'Yayın' },
] as const;

/** Mobil / ayarlar: ana akış + veri + ekstra (Özet ve Ayarlar hariç) */
export function allStudioModuleHrefs(): { href: string; label: string }[] {
  const flow = STUDIO_FLOW.filter((f) => f.href !== '/ders-dagit/studyo' && f.href !== '/ders-dagit/studyo/ayarlar');
  const flowHrefs = new Set<string>(flow.map((f) => f.href));
  const data = STUDIO_DATA_PAGES.filter((d) => !flowHrefs.has(d.href));
  const dataHrefs = new Set<string>(data.map((d) => d.href));
  const extra = STUDIO_EXTRA_PAGES.filter((e) => !flowHrefs.has(e.href) && !dataHrefs.has(e.href));
  return [...flow, ...data, ...extra];
}
