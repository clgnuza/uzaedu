/**
 * Öğretmen sol menü — `SCHOOL_MODULE_KEYS` sırası ve etiketleri ile birebir.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  CalendarClock,
  Calculator,
  FileText,
  Target,
  ScanLine,
  Monitor,
  BookOpen,
  Sparkles,
  Star,
  GraduationCap,
  MessageSquare,
  ClipboardList,
  Calendar,
  Bell,
  Newspaper,
  ShoppingBag,
  Headphones,
  Megaphone,
  Coins,
  BookUser,
  Search,
  Layers,
  School,
} from 'lucide-react';
import {
  SCHOOL_MODULE_KEYS,
  SCHOOL_MODULE_LABELS,
  type SchoolModuleKey,
} from './school-modules';
import type { MenuItem } from './types';

const T = ['teacher'] as const;

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
  tv: Monitor,
  extra_lesson: Calculator,
  document: FileText,
  outcome: Target,
  optical: ScanLine,
  smart_board: Monitor,
  teacher_agenda: BookOpen,
  bilsem: Sparkles,
  school_reviews: Star,
  butterfly_exam: LayoutGrid,
  sorumluluk_sinav: GraduationCap,
  messaging: MessageSquare,
  dogrudan_temin: ClipboardList,
  ders_dagit: Sparkles,
};

function modChild(
  title: string,
  path: string,
  icon: LucideIcon,
  moduleKey: SchoolModuleKey,
  extra?: Partial<MenuItem>,
): MenuItem {
  return {
    title,
    path,
    icon,
    allowedRoles: [...T],
    requiredSchoolModule: moduleKey,
    ...extra,
  };
}

const MODULE_CHILDREN: Record<SchoolModuleKey, MenuItem[]> = {
  duty: [modChild('Nöbet ve görevler', '/duty', CalendarClock, 'duty')],
  tv: [],
  /** Hesaplamalar — modül dışı «Araçlar» bölümünde (misafir menü ile aynı). */
  extra_lesson: [],
  document: [
    modChild('MEB yıllık plan', '/evrak', FileText, 'document'),
    modChild('Plan katkısı', '/evrak/plan-katki', ClipboardList, 'document'),
  ],
  outcome: [modChild('Kazanım takibi', '/kazanim-takip', Target, 'outcome')],
  optical: [
    modChild('Sınav oturumları', '/optik-oturumlar', ClipboardList, 'optical'),
    modChild('Optik formlar', '/optik-formlar', ScanLine, 'optical'),
    modChild('Serbest tarama', '/optik-okuma', ScanLine, 'optical'),
    modChild('Raporlar', '/optik-raporlar', FileText, 'optical'),
  ],
  smart_board: [modChild('Akıllı tahta', '/akilli-tahta', Monitor, 'smart_board')],
  teacher_agenda: [
    modChild('Ajanda', '/ogretmen-ajandasi', CalendarClock, 'teacher_agenda'),
    modChild('Öğrenci değerlendirme', '/ogretmen-ajandasi/degerlendirme', Target, 'teacher_agenda'),
  ],
  bilsem: [
    modChild('Haftalık takvim', '/bilsem/takvim', Calendar, 'bilsem'),
    modChild('Yıllık plan', '/bilsem/yillik-plan', Layers, 'bilsem'),
    modChild('Plan katkısı', '/bilsem/plan-katki', ClipboardList, 'bilsem'),
  ],
  school_reviews: [],
  butterfly_exam: [
    modChild('Öğrenci sorgulama', '/kelebek-sinav/ogrenci-sorgu', Search, 'butterfly_exam'),
    modChild('Sınav takvimi', '/kelebek-sinav/sinav-planlama', Calendar, 'butterfly_exam'),
  ],
  sorumluluk_sinav: [
    modChild('Görev bilgilendirmem', '/sorumluluk-sinav/bilgilendirme', Bell, 'sorumluluk_sinav'),
  ],
  messaging: [modChild('Mesaj merkezi', '/mesaj-merkezi', LayoutGrid, 'messaging')],
  dogrudan_temin: [],
  ders_dagit: [
    modChild('Müsaitlik tercihleri', '/ders-dagit/tercihler', BookUser, 'ders_dagit'),
    modChild('Sınıf görünümü', '/ders-dagit/veli', LayoutGrid, 'ders_dagit'),
  ],
};

/** Misafir / public-admin-paths ile aynı — okul modülü kapısı yok. */
export const TEACHER_TOOLS_MENU: MenuItem[] = [
  {
    heading: 'Araçlar',
    allowedRoles: [...T],
  },
  {
    title: 'Hesaplamalar',
    icon: Calculator,
    allowedRoles: [...T],
    menuGroup: 'violet',
    sidebarHubOnlyRoles: [...T],
    sidebarHubPath: '/hesaplamalar',
    sidebarHubActivePrefixes: [
      '/hesaplamalar',
      '/ek-ders-hesaplama',
      '/sinav-gorev-ucretleri',
      '/yolluk-hesaplama',
    ],
    children: [
      { title: 'Özet', path: '/hesaplamalar', icon: Calculator, allowedRoles: [...T] },
      { title: 'Ek ders hesaplama', path: '/ek-ders-hesaplama', icon: Calculator, allowedRoles: [...T] },
      {
        title: 'Sınav görev ücretleri',
        path: '/sinav-gorev-ucretleri',
        icon: ClipboardList,
        allowedRoles: [...T],
      },
      { title: 'Yolluk hesaplarım', path: '/yolluk-hesaplama/benim', icon: Calculator, allowedRoles: [...T] },
    ],
  },
  {
    title: 'Herkese açık',
    icon: Newspaper,
    allowedRoles: [...T],
    menuGroup: 'orange',
    children: [
      { title: 'Haberler', path: '/haberler', icon: Newspaper, allowedRoles: [...T], publicAccess: true },
      { title: 'Haber yayın', path: '/haberler/yayin', icon: Megaphone, allowedRoles: [...T], publicAccess: true },
      {
        title: 'Okul değerlendirmeleri',
        path: '/okul-degerlendirmeleri',
        icon: Star,
        allowedRoles: [...T],
        publicAccess: true,
      },
    ],
  },
];

export const TEACHER_CORE_MENU: MenuItem[] = [
  {
    heading: 'Okul işleri',
    allowedRoles: [...T],
  },
  {
    title: 'Ders ve takvim',
    icon: School,
    allowedRoles: [...T],
    menuGroup: 'sky',
    children: [
      { title: 'Ders programı', path: '/ders-programi', icon: BookOpen, allowedRoles: [...T] },
      { title: 'Akademik takvim', path: '/akademik-takvim', icon: Calendar, allowedRoles: [...T] },
      { title: 'Sınıflar ve dersler', path: '/classes-subjects', icon: Layers, allowedRoles: [...T] },
    ],
  },
];

function buildTeacherModuleMenuItems(): MenuItem[] {
  return SCHOOL_MODULE_KEYS.map((key, index) => {
    const children = MODULE_CHILDREN[key];
    if (children.length === 0) return null;

    const base: MenuItem = {
      title: SCHOOL_MODULE_LABELS[key],
      icon: MODULE_ICONS[key],
      allowedRoles: [...T],
      requiredSchoolModule: key,
      menuGroup: MODULE_MENU_GROUPS[index % MODULE_MENU_GROUPS.length],
      children,
    };

    return base;
  }).filter((item): item is MenuItem => item !== null);
}

export const TEACHER_OTHER_MENU: MenuItem[] = [
  {
    heading: 'Diğer',
    allowedRoles: [...T],
  },
  {
    title: 'Hesap ve destek',
    icon: Headphones,
    allowedRoles: [...T],
    menuGroup: 'zinc',
    children: [
      { title: 'Market', path: '/market', icon: ShoppingBag, allowedRoles: [...T] },
      { title: 'Reklamla jeton', path: '/market/rewarded-ad', icon: Coins, allowedRoles: [...T] },
      { title: 'Destek talepleri', path: '/support', icon: Headphones, allowedRoles: [...T] },
    ],
  },
];

export const TEACHER_SIDEBAR_SECTION: MenuItem[] = [
  ...TEACHER_TOOLS_MENU,
  ...TEACHER_CORE_MENU,
  { heading: 'Modüller', allowedRoles: [...T] },
  ...buildTeacherModuleMenuItems(),
  ...TEACHER_OTHER_MENU,
];
