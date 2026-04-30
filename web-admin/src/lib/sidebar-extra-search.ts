import type { MenuItem, ModeratorModuleKey, WebAdminRole } from '@/config/types';

export type SidebarExtraSearchRoute = {
  path: string;
  title: string;
  /** Arama metniyle eşleşecek ek anahtarlar (Türkçe) */
  keywords: string[];
  allowedRoles: WebAdminRole[];
  requiredModule?: ModeratorModuleKey;
  requiredSchoolModule?: string;
};

/** Menüde olmayan veya menü başlığında geçmeyen modül/ayar rotaları */
export const SIDEBAR_EXTRA_SEARCH_ROUTES: SidebarExtraSearchRoute[] = [
  {
    path: '/contact-inbox',
    title: 'Gelen kutusu (iletişim)',
    keywords: ['iletişim', 'form', 'mesaj', 'inbox', 'destek mail', 'gelen kutusu'],
    allowedRoles: ['superadmin', 'moderator'],
  },
  {
    path: '/duty/tercihler',
    title: 'Nöbet tercihleri',
    keywords: ['tercih', 'tercihler', 'müsait', 'müsait değil', 'nöbet günü', 'tercihlerim'],
    allowedRoles: ['teacher', 'school_admin'],
    requiredSchoolModule: 'duty',
  },
  {
    path: '/duty/yerler',
    title: 'Nöbet yerleri',
    keywords: ['nöbet yeri', 'yerler', 'alan', 'salon nöbet'],
    allowedRoles: ['school_admin'],
    requiredSchoolModule: 'duty',
  },
  {
    path: '/duty/planlar',
    title: 'Nöbet planları',
    keywords: ['nöbet planı', 'planlar', 'yayınlanan plan'],
    allowedRoles: ['school_admin', 'teacher'],
    requiredSchoolModule: 'duty',
  },
  {
    path: '/mesaj-merkezi/ogretmen-ayarlar',
    title: 'Mesaj gönderim ayarları',
    keywords: ['gönderim', 'şablon', 'imza', 'öğretmen mesaj', 'sms', 'veli mesajı ayar'],
    allowedRoles: ['teacher'],
    requiredSchoolModule: 'messaging',
  },
  {
    path: '/ders-programi/ayarlar',
    title: 'Ders programı ayarları',
    keywords: ['ders programı ayar', 'zaman çizelgesi', 'slot', 'etüt', 'teneffüs'],
    allowedRoles: ['school_admin'],
  },
  {
    path: '/bilsem/takvim/ayarlar',
    title: 'Bilsem takvim ayarları',
    keywords: ['bilsem takvim', 'kurum takvimi', 'resmi tatil'],
    allowedRoles: ['school_admin', 'teacher'],
    requiredSchoolModule: 'bilsem',
  },
  {
    path: '/evrak/plan-katki',
    title: 'Evrak plan katkısı',
    keywords: ['plan katkı', 'katki', 'excel plan yükle', 'yıllık plan onay', 'moderasyona gönder'],
    allowedRoles: ['teacher', 'school_admin'],
    requiredSchoolModule: 'document',
  },
  {
    path: '/evrak/plan-katki-moderasyon',
    title: 'Evrak plan katkı moderasyonu',
    keywords: ['plan katkı moderasyon', 'plan onay kuyruğu', 'evrak moderasyon'],
    allowedRoles: ['superadmin', 'moderator'],
    requiredModule: 'document_templates',
  },
  {
    path: '/web-ayarlar?tab=seo',
    title: 'Web · SEO',
    keywords: ['seo', 'sitemap', 'meta', 'robots', 'yayın seo'],
    allowedRoles: ['superadmin'],
  },
  {
    path: '/web-ayarlar?tab=mail',
    title: 'Web · Mail (SMTP)',
    keywords: ['smtp', 'e-posta', 'eposta', 'mail ayar', 'gönderici'],
    allowedRoles: ['superadmin'],
  },
  {
    path: '/web-ayarlar?tab=gizlilik',
    title: 'Web · Gizlilik metni',
    keywords: ['gizlilik', 'kvkk', 'kişisel veri'],
    allowedRoles: ['superadmin'],
  },
  {
    path: '/haberler/ayarlar?tab=sync',
    title: 'Haberler · Senkron zamanlama',
    keywords: ['otomatik senkron', 'zamanlama', 'rss', 'içerik senkron', 'cron'],
    allowedRoles: ['superadmin'],
  },
];

function haystack(r: SidebarExtraSearchRoute): string {
  return [r.title, r.path, ...r.keywords].join(' ').toLocaleLowerCase('tr-TR');
}

export function extraSearchRouteMatches(needle: string, r: SidebarExtraSearchRoute): boolean {
  const n = needle.trim().toLocaleLowerCase('tr-TR');
  if (!n) return false;
  const h = haystack(r);
  return h.includes(n);
}

export function isExtraSearchRouteVisible(
  r: SidebarExtraSearchRoute,
  role: WebAdminRole | null,
  moderatorModules: string[] | null | undefined,
  schoolEnabledModules: string[] | null | undefined,
  supportEnabled: boolean,
): boolean {
  if (!role) return false;
  if (!r.allowedRoles.includes(role)) return false;
  if (!supportEnabled && role !== 'superadmin' && r.path.startsWith('/support')) return false;
  if (role === 'moderator' && r.requiredModule) {
    if (!moderatorModules?.includes(r.requiredModule)) return false;
  }
  if ((role === 'teacher' || role === 'school_admin') && r.requiredSchoolModule) {
    if (schoolEnabledModules?.length && !schoolEnabledModules.includes(r.requiredSchoolModule)) return false;
  }
  return true;
}

/** Menü aramasında zaten listelenen path’ler (tekrar gösterme) */
export function collectPathsFromFilteredMenu(items: MenuItem[]): Set<string> {
  const s = new Set<string>();
  const walk = (list: MenuItem[]) => {
    for (const it of list) {
      if (it.path) s.add(it.path);
      if (it.hubOnlyPath) s.add(it.hubOnlyPath);
      if (it.children?.length) walk(it.children);
    }
  };
  walk(items);
  return s;
}

export function getSidebarExtraSearchHits(
  needle: string,
  ctx: {
    role: WebAdminRole | null;
    moderatorModules?: string[] | null;
    schoolEnabledModules?: string[] | null;
    supportEnabled: boolean;
    /** Bu path’ler zaten menü sonuçlarında */
    excludePaths: Set<string>;
  },
): { path: string; title: string }[] {
  const n = needle.trim().toLocaleLowerCase('tr-TR');
  if (!n) return [];
  const out: { path: string; title: string }[] = [];
  for (const r of SIDEBAR_EXTRA_SEARCH_ROUTES) {
    if (!extraSearchRouteMatches(n, r)) continue;
    if (!isExtraSearchRouteVisible(r, ctx.role, ctx.moderatorModules, ctx.schoolEnabledModules, ctx.supportEnabled)) continue;
    if (ctx.excludePaths.has(r.path)) continue;
    out.push({ path: r.path, title: r.title });
  }
  return out;
}
