/**
 * Okul yöneticisi sol menü — `SCHOOL_MODULE_KEYS` sırası ve etiketleri ile birebir.
 * @see school-modules.ts, school-admin-home MODULE_CATALOG
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  CalendarClock,
  Tv,
  Calculator,
  FileText,
  Target,
  ScanLine,
  Monitor,
  BookOpen,
  Sparkles,
  Star,
  LayoutGrid as GridIcon,
  GraduationCap,
  MessageSquare,
  ClipboardList,
  School,
  Building2,
  Newspaper,
  ShoppingBag,
  Headphones,
  Calendar,
  Users,
  Banknote,
  Settings,
  Megaphone,
  TableProperties,
  Wand2,
  ClipboardCheck,
  SlidersHorizontal,
  BookUser,
  Wallet,
  Database,
  BarChart3,
  AlertTriangle,
  Layers,
  UserCheck,
  Puzzle,
} from 'lucide-react';
import {
  SCHOOL_MODULE_KEYS,
  SCHOOL_MODULE_LABELS,
  type SchoolModuleKey,
} from './school-modules';
import type { MenuItem } from './types';

const SA = ['school_admin'] as const;

type MenuGroup = NonNullable<MenuItem['menuGroup']>;

const MODULE_MENU_GROUPS: MenuGroup[] = [
  'teal',
  'sky',
  'violet',
  'emerald',
  'rose',
  'fuchsia',
  'cyan',
  'orange',
  'indigo',
  'amber',
  'emerald',
  'teal',
  'sky',
  'violet',
  'indigo',
];

const MODULE_ICONS: Record<SchoolModuleKey, LucideIcon> = {
  duty: CalendarClock,
  tv: Tv,
  extra_lesson: Calculator,
  document: FileText,
  outcome: Target,
  optical: ScanLine,
  smart_board: Monitor,
  teacher_agenda: BookOpen,
  bilsem: Sparkles,
  school_reviews: Star,
  butterfly_exam: GridIcon,
  sorumluluk_sinav: GraduationCap,
  messaging: MessageSquare,
  dogrudan_temin: ClipboardList,
  ders_dagit: Sparkles,
  okul_koprusu: Puzzle,
};

function modChild(
  title: string,
  path: string,
  icon: LucideIcon,
  moduleKey: SchoolModuleKey,
): MenuItem {
  return {
    title,
    path,
    icon,
    allowedRoles: [...SA],
    requiredSchoolModule: moduleKey,
  };
}

const DERS_DAGIT_CHILDREN: MenuItem[] = [
  modChild('Özet', '/ders-dagit/studyo', Sparkles, 'ders_dagit'),
  modChild('Kurulum', '/ders-dagit/studyo/kurulum', Settings, 'ders_dagit'),
  modChild('Doğrulama', '/ders-dagit/studyo/dogrulama', ClipboardCheck, 'ders_dagit'),
  modChild('Otomatik oluştur', '/ders-dagit/studyo/uret', Wand2, 'ders_dagit'),
  modChild('Program tablosu', '/ders-dagit/studyo/program', TableProperties, 'ders_dagit'),
  modChild('Yayın', '/ders-dagit/studyo/program?panel=publish', Megaphone, 'ders_dagit'),
  modChild('Ayarlar', '/ders-dagit/studyo/ayarlar', SlidersHorizontal, 'ders_dagit'),
  modChild('Müsaitlik tercihleri', '/ders-dagit/tercihler', BookUser, 'ders_dagit'),
  modChild('Sınıf görünümü', '/ders-dagit/veli', LayoutGrid, 'ders_dagit'),
];

const MODULE_CHILDREN: Record<SchoolModuleKey, MenuItem[]> = {
  duty: [modChild('Nöbet planı', '/duty', CalendarClock, 'duty')],
  tv: [modChild('Duyuru TV', '/tv', Tv, 'tv')],
  extra_lesson: [],
  document: [modChild('Plan katkısı', '/evrak/plan-katki', ClipboardList, 'document')],
  outcome: [],
  optical: [
    modChild('Sınav oturumları', '/optik-oturumlar', ClipboardList, 'optical'),
    modChild('Optik formlar', '/optik-formlar', ScanLine, 'optical'),
    modChild('Raporlar', '/optik-raporlar', BarChart3, 'optical'),
  ],
  smart_board: [modChild('Akıllı tahta', '/akilli-tahta', Monitor, 'smart_board')],
  teacher_agenda: [modChild('Ajanda', '/ogretmen-ajandasi', CalendarClock, 'teacher_agenda')],
  bilsem: [
    modChild('Takvim', '/bilsem/takvim', Calendar, 'bilsem'),
    modChild('Yıllık plan', '/bilsem/yillik-plan', Layers, 'bilsem'),
    modChild('Plan katkısı', '/bilsem/plan-katki', ClipboardList, 'bilsem'),
    modChild('Kazanım setleri', '/bilsem/yillik-plan/kazanim-sablonlari', Target, 'bilsem'),
  ],
  school_reviews: [modChild('Değerlendirme raporu', '/school-reviews-report', BarChart3, 'school_reviews')],
  butterfly_exam: [
    modChild('Anasayfa', '/kelebek-sinav', LayoutGrid, 'butterfly_exam'),
    modChild('Sınıf ve öğrenci', '/kelebek-sinav/sinif-ogrenci', Users, 'butterfly_exam'),
    modChild('Salon yerleşimi', '/kelebek-sinav/yerlesim', Building2, 'butterfly_exam'),
    modChild('Ders ve öğretmen', '/kelebek-sinav/ders-ogretmen', GraduationCap, 'butterfly_exam'),
    modChild('Sınav takvimi', '/kelebek-sinav/sinav-planlama', Calendar, 'butterfly_exam'),
    modChild('Sınav işlemleri', '/kelebek-sinav/sinav-islemleri', Calendar, 'butterfly_exam'),
    modChild('İçe aktar / PDF', '/kelebek-sinav/ayarlar', Settings, 'butterfly_exam'),
  ],
  sorumluluk_sinav: [
    modChild('Gruplar', '/sorumluluk-sinav', LayoutGrid, 'sorumluluk_sinav'),
    modChild('Öğrenciler', '/sorumluluk-sinav/ogrenciler', Users, 'sorumluluk_sinav'),
    modChild('Oturumlar', '/sorumluluk-sinav/oturumlar', Calendar, 'sorumluluk_sinav'),
    modChild('Programlama', '/sorumluluk-sinav/programlama', Settings, 'sorumluluk_sinav'),
    modChild('Görevlendirme', '/sorumluluk-sinav/gorevlendirme', UserCheck, 'sorumluluk_sinav'),
    modChild('Raporlar', '/sorumluluk-sinav/raporlar', FileText, 'sorumluluk_sinav'),
  ],
  messaging: [
    modChild('Genel bakış', '/mesaj-merkezi', LayoutGrid, 'messaging'),
    modChild('Veli / öğrenci', '/mesaj-merkezi/veli-iletisim', Users, 'messaging'),
    modChild('Devamsızlık', '/mesaj-merkezi/devamsizlik', FileText, 'messaging'),
    modChild('Ders devamsızlık', '/mesaj-merkezi/ders-devamsizlik', FileText, 'messaging'),
    modChild('Karne', '/mesaj-merkezi/karne', BookOpen, 'messaging'),
    modChild('Gruplar', '/mesaj-merkezi/gruplar', Users, 'messaging'),
    modChild('Veli toplantısı', '/mesaj-merkezi/veli-toplantisi', MessageSquare, 'messaging'),
    modChild('Risk listesi', '/mesaj-merkezi/risk', AlertTriangle, 'messaging'),
    modChild('WhatsApp ayarları', '/mesaj-merkezi/ayarlar', Settings, 'messaging'),
  ],
  dogrudan_temin: [
    modChild('Temin dosyaları', '/dogrudan-temin', ClipboardList, 'dogrudan_temin'),
    modChild('Okul formu / antet', '/dogrudan-temin/okul-bilgileri', School, 'dogrudan_temin'),
    modChild('İstekli firmalar', '/dogrudan-temin/firmalar', Building2, 'dogrudan_temin'),
    modChild('Mali raporlar', '/dogrudan-temin/raporlar', FileText, 'dogrudan_temin'),
    modChild('Kalem kütüphanesi', '/dogrudan-temin/malzeme-kutuphanesi', Database, 'dogrudan_temin'),
    modChild('Özet panel', '/dogrudan-temin/dashboard', BarChart3, 'dogrudan_temin'),
    modChild('Bütçe hiyerarşisi', '/dogrudan-temin/butce-hierarsisi', Wallet, 'dogrudan_temin'),
  ],
  ders_dagit: DERS_DAGIT_CHILDREN,
  okul_koprusu: [modChild('E-Okul Köprüsü', '/e-okul-kopru', Puzzle, 'okul_koprusu')],
};

/** Okul yöneticisi: modül dışı çekirdek işler */
export const SCHOOL_ADMIN_CORE_MENU: MenuItem[] = [
  {
    heading: 'Okul işleri',
    allowedRoles: [...SA],
  },
  {
    title: 'Ders ve takvim',
    icon: School,
    allowedRoles: [...SA],
    menuGroup: 'sky',
    children: [
      { title: 'Ders programı', path: '/ders-programi', icon: BookOpen, allowedRoles: [...SA] },
      { title: 'Akademik takvim', path: '/akademik-takvim', icon: Calendar, allowedRoles: [...SA] },
      { title: 'Takvim görevlendirme', path: '/akademik-takvim-ayarlar?tab=gorevlendirme', icon: Users, allowedRoles: [...SA] },
      { title: 'Takvim ayarları', path: '/akademik-takvim-ayarlar', icon: CalendarClock, allowedRoles: [...SA] },
    ],
  },
];

/** Her okul modülü = bir menü grubu (SCHOOL_MODULE_KEYS sırası) */
export function buildSchoolAdminModuleMenuItems(): MenuItem[] {
  return SCHOOL_MODULE_KEYS.flatMap((key, index) => {
    const children = MODULE_CHILDREN[key] ?? [];
    if (children.length === 0) return [];
    const item: MenuItem = {
      title: SCHOOL_MODULE_LABELS[key],
      icon: MODULE_ICONS[key],
      allowedRoles: [...SA],
      requiredSchoolModule: key,
      menuGroup: MODULE_MENU_GROUPS[index % MODULE_MENU_GROUPS.length],
      children,
    };
    return [item];
  });
}

export const SCHOOL_ADMIN_CALC_MENU: MenuItem[] = [
  {
    heading: 'Hesaplamalar',
    allowedRoles: [...SA],
  },
  {
    title: 'Hesaplamalar',
    icon: Calculator,
    allowedRoles: [...SA],
    menuGroup: 'violet',
    requiredSchoolModule: 'extra_lesson',
    children: [
      { title: 'Özet', path: '/hesaplamalar', icon: Calculator, allowedRoles: [...SA], requiredSchoolModule: 'extra_lesson' },
      { title: 'Ek ders hesaplama', path: '/ek-ders-hesaplama', icon: Calculator, allowedRoles: [...SA], requiredSchoolModule: 'extra_lesson' },
      { title: 'Sınav görev ücretleri', path: '/sinav-gorev-ucretleri', icon: ClipboardList, allowedRoles: [...SA], requiredSchoolModule: 'extra_lesson' },
      { title: 'Yolluk (okul)', path: '/yolluk-hesaplama/okul', icon: Banknote, allowedRoles: [...SA], requiredSchoolModule: 'extra_lesson' },
    ],
  },
];

export const SCHOOL_ADMIN_NEWS_MENU: MenuItem[] = [
  {
    heading: 'Haberler',
    allowedRoles: [...SA],
  },
  {
    title: 'Haber ve yayın',
    icon: Newspaper,
    allowedRoles: [...SA],
    menuGroup: 'orange',
    children: [
      { title: 'Haberler', path: '/haberler', icon: Newspaper, allowedRoles: [...SA] },
      { title: 'Haber yayın', path: '/haberler/yayin', icon: Megaphone, allowedRoles: [...SA] },
    ],
  },
];

/** Modül dışı: market, destek */
export const SCHOOL_ADMIN_OTHER_MENU: MenuItem[] = [
  {
    heading: 'Diğer',
    allowedRoles: [...SA],
  },
  {
    title: 'Hesap ve destek',
    icon: Headphones,
    allowedRoles: [...SA],
    menuGroup: 'zinc',
    children: [
      { title: 'Market', path: '/market', icon: ShoppingBag, allowedRoles: [...SA] },
      { title: 'Destek talepleri', path: '/support', icon: Headphones, allowedRoles: [...SA] },
    ],
  },
];

export const SCHOOL_ADMIN_SIDEBAR_SECTION: MenuItem[] = [
  ...SCHOOL_ADMIN_CORE_MENU,
  { heading: 'Modüller', allowedRoles: [...SA] },
  ...buildSchoolAdminModuleMenuItems(),
  ...SCHOOL_ADMIN_CALC_MENU,
  ...SCHOOL_ADMIN_NEWS_MENU,
  ...SCHOOL_ADMIN_OTHER_MENU,
];
