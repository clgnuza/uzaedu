/**
 * Web Admin menü – AUTHORITY_MATRIX.md "Ekran / Route Erişimi" tablosundan türetilir.
 * Her öğe allowedRoles ile; moderator için requiredModule + moderator_modules filtresi.
 */
import type { MenuConfig, MenuItem, ModeratorModuleKey, WebAdminRole } from './types';
import {
  LayoutDashboard,
  CalendarClock,
  Tv,
  Users,
  Settings,
  School,
  User,
  UserCog,
  Puzzle,
  ShoppingBag,
  Coins,
  FileText,
  Calculator,
  Target,
  Bell,
  Megaphone,
  Mail,
  Star,
  BarChart3,
  BookOpen,
  Newspaper,
  Sparkles,
  Calendar,
  ScanLine,
  Search,
  Monitor,
  Headphones,
  Inbox,
  ClipboardList,
  Layers,
  Globe,
  RectangleHorizontal,
  UserPlus,
  Building2,
  ClipboardCheck,
  LayoutGrid,
  GraduationCap,
  UserCheck,
  MessageSquare,
  Banknote,
} from 'lucide-react';
import { isPublicAdminPath } from '@/lib/public-admin-paths';

export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'Genel',
    titleByRole: { teacher: 'Başlangıç' },
    icon: LayoutDashboard,
    allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
    menuGroup: 'slate',
    children: [
      {
        title: 'Dashboard',
        titleByRole: { teacher: 'Ana sayfa' },
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
      },
      {
        title: 'Gelen kutusu',
        path: '/contact-inbox',
        icon: Inbox,
        allowedRoles: ['superadmin', 'moderator'],
      },
      {
        title: 'Profilim',
        titleByRole: { teacher: 'Profilim' },
        path: '/profile',
        icon: User,
        allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
      },
    ],
  },
  {
    title: 'Hesaplamalar',
    icon: Calculator,
    allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
    menuGroup: 'violet',
    sidebarHubOnlyRoles: ['teacher'],
    sidebarHubPath: '/hesaplamalar',
    sidebarHubActivePrefixes: ['/hesaplamalar', '/ek-ders-hesaplama', '/sinav-gorev-ucretleri'],
    children: [
      {
        title: 'Özet',
        path: '/hesaplamalar',
        icon: Calculator,
        allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
      },
      {
        title: 'Ek ders hesaplama',
        path: '/ek-ders-hesaplama',
        icon: Calculator,
        allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
      },
      {
        title: 'Sınav görev ücretleri',
        path: '/sinav-gorev-ucretleri',
        icon: ClipboardList,
        allowedRoles: ['school_admin', 'superadmin', 'teacher', 'moderator'],
      },
      {
        title: 'Hesaplama türleri',
        path: '/extra-lesson-params',
        icon: Layers,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Ek ders parametreleri',
        path: '/extra-lesson-params/ek-ders',
        icon: Settings,
        allowedRoles: ['superadmin'],
      },
    ],
  },
  {
    title: 'Günlük işler',
    titleByRole: { teacher: 'Günlük işler' },
    icon: Bell,
    allowedRoles: ['teacher', 'school_admin', 'superadmin', 'moderator'],
    menuGroup: 'amber',
    children: [
      {
        title: 'Bildirimler',
        path: '/bildirimler',
        icon: Bell,
        allowedRoles: ['teacher', 'school_admin', 'superadmin', 'moderator'],
        badgeKey: 'dutyNotificationsUnread',
      },
      {
        title: 'Sınav Görevleri',
        titleByRole: { teacher: 'Sınav görevlerim' },
        path: '/sinav-gorevlerim',
        icon: ClipboardList,
        allowedRoles: ['teacher'],
      },
    ],
  },
  {
    title: 'Öğrenci ve değerlendirme',
    titleByRole: { teacher: 'Öğrenci ve değerlendirme' },
    icon: Star,
    allowedRoles: ['teacher', 'moderator'],
    menuGroup: 'rose',
    children: [
      {
        title: 'Okul Değerlendirmeleri',
        path: '/okul-degerlendirmeleri',
        icon: Star,
        allowedRoles: ['teacher', 'moderator'],
        requiredModule: 'school_reviews',
        requiredSchoolModule: 'school_reviews',
      },
      {
        title: 'Kazanım Takip',
        titleByRole: { teacher: 'Kazanım takibi' },
        path: '/kazanim-takip',
        icon: Target,
        allowedRoles: ['teacher'],
        requiredSchoolModule: 'outcome',
      },
    ],
  },
  {
    title: 'Plan ve takvim',
    titleByRole: { teacher: 'Plan ve takvim' },
    icon: Calendar,
    allowedRoles: ['teacher', 'school_admin', 'moderator'],
    menuGroup: 'teal',
    children: [
      {
        title: 'Yıllık plan iste',
        titleByRole: { teacher: 'MEB yıllık plan' },
        path: '/evrak',
        icon: FileText,
        allowedRoles: ['teacher', 'moderator'],
        requiredModule: 'document_templates',
        requiredSchoolModule: 'document',
      },
      {
        title: 'Plan katkısı',
        titleByRole: { teacher: 'Plan katkısı (onay)' },
        path: '/evrak/plan-katki',
        icon: ClipboardList,
        allowedRoles: ['teacher', 'school_admin'],
        requiredSchoolModule: 'document',
      },
      {
        title: 'Akademik Takvim',
        path: '/akademik-takvim',
        icon: Calendar,
        allowedRoles: ['teacher', 'school_admin'],
      },
      {
        title: 'Öğretmen Ajandası',
        path: '/ogretmen-ajandasi',
        icon: CalendarClock,
        allowedRoles: ['teacher', 'school_admin'],
        requiredSchoolModule: 'teacher_agenda',
      },
      {
        title: 'Öğrenci Değerlendirme',
        path: '/ogretmen-ajandasi/degerlendirme',
        icon: Target,
        allowedRoles: ['teacher'],
        requiredSchoolModule: 'teacher_agenda',
      },
    ],
  },
  {
    title: 'Haber ve yayın',
    titleByRole: { teacher: 'Haber ve yayın' },
    icon: Newspaper,
    allowedRoles: ['teacher', 'school_admin', 'superadmin'],
    menuGroup: 'orange',
    children: [
      {
        title: 'Haberler',
        path: '/haberler',
        icon: Newspaper,
        allowedRoles: ['teacher', 'school_admin', 'superadmin'],
        publicAccess: true,
      },
      {
        title: 'Haber Yayın',
        path: '/haberler/yayin',
        icon: Sparkles,
        allowedRoles: ['teacher', 'school_admin', 'superadmin'],
        publicAccess: true,
      },
      {
        title: 'Haber ayarları',
        path: '/haberler/ayarlar',
        icon: Settings,
        allowedRoles: ['superadmin'],
      },
    ],
  },
  {
    title: 'Satın alma',
    titleByRole: { teacher: 'Satın alma' },
    icon: ShoppingBag,
    allowedRoles: ['teacher', 'school_admin', 'moderator'],
    menuGroup: 'emerald',
    children: [
      {
        title: 'Market',
        path: '/market',
        icon: ShoppingBag,
        allowedRoles: ['teacher', 'school_admin', 'moderator'],
      },
      {
        title: 'Reklamla jeton',
        path: '/market/rewarded-ad',
        icon: Coins,
        allowedRoles: ['teacher'],
      },
    ],
  },
  {
    title: 'Destek',
    titleByRole: { teacher: 'Destek' },
    icon: Headphones,
    allowedRoles: ['teacher', 'school_admin'],
    menuGroup: 'cyan',
    children: [
      {
        title: 'Destek Taleplerim',
        titleByRole: { teacher: 'Destek talepleri' },
        path: '/support',
        icon: Headphones,
        allowedRoles: ['teacher', 'school_admin'],
      },
    ],
  },
  {
    heading: 'Okul',
    allowedRoles: ['school_admin', 'teacher', 'moderator'],
  },
  {
    title: 'Okul yönetimi',
    titleByRole: { moderator: 'Okul destek' },
    icon: Building2,
    allowedRoles: ['school_admin', 'moderator'],
    menuGroup: 'sky',
    children: [
      {
        title: 'Okul Destek Inbox',
        path: '/support/inbox',
        icon: Inbox,
        allowedRoles: ['school_admin', 'moderator'],
        requiredModule: 'support',
      },
      {
        title: 'Sistem Mesajları',
        path: '/system-messages',
        icon: Mail,
        allowedRoles: ['school_admin'],
        badgeKey: 'adminMessagesUnread',
      },
      {
        title: 'Öğretmenler',
        path: '/teachers',
        icon: Users,
        allowedRoles: ['school_admin'],
      },
      {
        title: 'Öğretmen onay kuyruğu',
        path: '/school-join-queue',
        icon: ClipboardCheck,
        allowedRoles: ['school_admin'],
      },
      {
        title: 'Sınıflar ve Dersler',
        path: '/classes-subjects',
        icon: BookOpen,
        allowedRoles: ['school_admin'],
      },
      {
        title: 'Akademik Takvim Ayarları',
        path: '/akademik-takvim-ayarlar',
        icon: Calendar,
        allowedRoles: ['school_admin'],
      },
      {
        title: 'Okul değerlendirmesi',
        path: '/school-reviews-report',
        icon: BarChart3,
        allowedRoles: ['school_admin'],
      },
    ],
  },
  {
    title: 'Ders ve ekranlar',
    titleByRole: { teacher: 'Okul işlemleri' },
    icon: School,
    allowedRoles: ['school_admin', 'teacher'],
    menuGroup: 'sky',
    children: [
      {
        title: 'Nöbet',
        titleByRole: { teacher: 'Nöbet ve görevler' },
        path: '/duty',
        icon: CalendarClock,
        allowedRoles: ['school_admin', 'teacher'],
        requiredSchoolModule: 'duty',
      },
      {
        title: 'Ders Programı',
        titleByRole: { teacher: 'Ders programı' },
        path: '/ders-programi',
        icon: BookOpen,
        allowedRoles: ['school_admin', 'teacher'],
      },
      {
        title: 'Duyuru TV',
        path: '/tv',
        icon: Tv,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'tv',
      },
      {
        title: 'Akıllı Tahta',
        path: '/akilli-tahta',
        icon: Monitor,
        allowedRoles: ['school_admin', 'teacher'],
        requiredSchoolModule: 'smart_board',
      },
    ],
  },
  {
    title: 'Bilsem',
    titleByRole: { teacher: 'Bilsem modülü' },
    icon: Sparkles,
    allowedRoles: ['teacher', 'school_admin', 'superadmin'],
    requiredSchoolModule: 'bilsem',
    menuGroup: 'violet',
    children: [
      {
        title: 'Takvim',
        titleByRole: { teacher: 'Haftalık takvim' },
        path: '/bilsem/takvim',
        icon: Calendar,
        allowedRoles: ['teacher', 'school_admin'],
        requiredSchoolModule: 'bilsem',
      },
      {
        title: 'Bilsem yıllık plan',
        titleByRole: { teacher: 'Yıllık plan (Word)' },
        path: '/bilsem/yillik-plan',
        icon: Layers,
        allowedRoles: ['school_admin', 'teacher'],
        requiredSchoolModule: 'bilsem',
      },
      {
        title: 'Plan katkısı',
        titleByRole: { teacher: 'Plan katkısı (onay)' },
        path: '/bilsem/plan-katki',
        icon: ClipboardList,
        allowedRoles: ['school_admin', 'teacher'],
        requiredSchoolModule: 'bilsem',
      },
      {
        title: 'Kazanım setleri',
        path: '/bilsem/yillik-plan/kazanim-sablonlari',
        icon: Target,
        allowedRoles: ['school_admin', 'teacher', 'superadmin'],
        requiredSchoolModule: 'bilsem',
      },
    ],
  },
  {
    title: 'Optik',
    titleByRole: { teacher: 'Optik formlar' },
    icon: ScanLine,
    allowedRoles: ['teacher', 'school_admin'],
    requiredSchoolModule: 'optical',
    menuGroup: 'fuchsia',
    children: [
      {
        title: 'Optik Formlar',
        path: '/optik-formlar',
        icon: ScanLine,
        allowedRoles: ['teacher', 'school_admin'],
        requiredSchoolModule: 'optical',
      },
    ],
  },
  {
    title: 'Kertenkele Sınav',
    titleByRole: { teacher: 'Kertenkele Sınav' },
    icon: LayoutGrid,
    allowedRoles: ['teacher', 'school_admin'],
    requiredSchoolModule: 'butterfly_exam',
    menuGroup: 'indigo',
    children: [
      {
        title: 'Öğrenci sorgulama',
        path: '/kelebek-sinav/ogrenci-sorgu',
        icon: Search,
        allowedRoles: ['teacher', 'school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'Anasayfa',
        path: '/kelebek-sinav',
        icon: LayoutGrid,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'Sınıf - Öğrenci İşlemleri',
        titleByRole: { teacher: 'Sınıf' },
        path: '/kelebek-sinav/sinif-ogrenci',
        icon: Users,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'Salon İşlemleri',
        titleByRole: { teacher: 'Salonlar' },
        path: '/kelebek-sinav/yerlesim',
        icon: Building2,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'Ders - Öğretmen İşlemleri',
        titleByRole: { teacher: 'Ders' },
        path: '/kelebek-sinav/ders-ogretmen',
        icon: GraduationCap,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'Sınav Takvimi',
        titleByRole: { teacher: 'Takvim' },
        path: '/kelebek-sinav/sinav-planlama',
        icon: Calendar,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'Sınav İşlemleri',
        titleByRole: { teacher: 'Sınavlar' },
        path: '/kelebek-sinav/sinav-islemleri',
        icon: Calendar,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
      {
        title: 'İçe Aktar / PDF',
        titleByRole: { teacher: 'Aktar' },
        path: '/kelebek-sinav/ayarlar',
        icon: Settings,
        allowedRoles: ['school_admin'],
        requiredSchoolModule: 'butterfly_exam',
      },
    ],
  },
  {
    title: 'Mesaj Gönderme Merkezi',
    titleByRole: { teacher: 'Mesaj' },
    icon: MessageSquare,
    allowedRoles: ['teacher', 'school_admin'],
    requiredSchoolModule: 'messaging',
    menuGroup: 'teal',
    children: [
      { title: 'Genel Bakış',        path: '/mesaj-merkezi',                icon: LayoutGrid, allowedRoles: ['teacher', 'school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'Gönderim ayarları', path: '/mesaj-merkezi/ogretmen-ayarlar', icon: Settings, allowedRoles: ['teacher'],               requiredSchoolModule: 'messaging', hiddenInSidebarForRoles: ['teacher'] },
      { title: 'Veli / Öğrenci',     path: '/mesaj-merkezi/veli-iletisim',  icon: Users,      allowedRoles: ['school_admin', 'teacher'],            requiredSchoolModule: 'messaging', hiddenInSidebarForRoles: ['teacher'] },
      { title: 'Ek Ders',            path: '/mesaj-merkezi/ek-ders',        icon: FileText,   allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'Maaş',               path: '/mesaj-merkezi/maas',           icon: Banknote,   allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'Devamsızlık',        path: '/mesaj-merkezi/devamsizlik',    icon: FileText,   allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'Ders Devamsızlık',   path: '/mesaj-merkezi/ders-devamsizlik',  icon: FileText,    allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'Devamsızlık Mektubu', path: '/mesaj-merkezi/devamsizlik-mektup', icon: FileText, allowedRoles: ['school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'Ara Karne',          path: '/mesaj-merkezi/ara-karne',         icon: BookOpen,    allowedRoles: ['school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'Karne',              path: '/mesaj-merkezi/karne',             icon: BookOpen,    allowedRoles: ['school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'İzin',               path: '/mesaj-merkezi/izin',              icon: FileText,    allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'MEBBİS Puantaj',    path: '/mesaj-merkezi/mebbis-puantaj',    icon: FileText,    allowedRoles: ['school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'KBS Ek Ders',       path: '/mesaj-merkezi/kbs-ek-ders',       icon: FileText,    allowedRoles: ['school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'KBS Maaş',          path: '/mesaj-merkezi/kbs-maas',          icon: Banknote,    allowedRoles: ['school_admin'], requiredSchoolModule: 'messaging' },
      { title: 'Gruplar',            path: '/mesaj-merkezi/gruplar',           icon: Users,       allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'Veli Toplantısı',   path: '/mesaj-merkezi/veli-toplantisi',   icon: MessageSquare, allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'Davetiye',           path: '/mesaj-merkezi/davetiye',          icon: MessageSquare, allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
      { title: 'WhatsApp Ayarları',  path: '/mesaj-merkezi/ayarlar',        icon: Settings,   allowedRoles: ['school_admin'],            requiredSchoolModule: 'messaging' },
    ],
  },
  {
    title: 'Sorumluluk / Beceri Sınavı',
    titleByRole: { teacher: 'Sorumluluk Sınavı' },
    icon: GraduationCap,
    allowedRoles: ['teacher', 'school_admin'],
    requiredSchoolModule: 'sorumluluk_sinav',
    menuGroup: 'teal',
    children: [
      { title: 'Görev bilgilendirmem', path: '/sorumluluk-sinav/bilgilendirme', icon: Bell, allowedRoles: ['teacher'], requiredSchoolModule: 'sorumluluk_sinav' },
      { title: 'Gruplar', path: '/sorumluluk-sinav', icon: LayoutGrid, allowedRoles: ['school_admin'], requiredSchoolModule: 'sorumluluk_sinav' },
      { title: 'Öğrenciler', path: '/sorumluluk-sinav/ogrenciler', icon: Users, allowedRoles: ['school_admin'], requiredSchoolModule: 'sorumluluk_sinav' },
      { title: 'Oturumlar', path: '/sorumluluk-sinav/oturumlar', icon: Calendar, allowedRoles: ['school_admin'], requiredSchoolModule: 'sorumluluk_sinav' },
      { title: 'Programlama', path: '/sorumluluk-sinav/programlama', icon: Settings, allowedRoles: ['school_admin'], requiredSchoolModule: 'sorumluluk_sinav' },
      { title: 'Görevlendirme', path: '/sorumluluk-sinav/gorevlendirme', icon: UserCheck, allowedRoles: ['school_admin'], requiredSchoolModule: 'sorumluluk_sinav' },
      { title: 'Raporlar', path: '/sorumluluk-sinav/raporlar', icon: FileText, allowedRoles: ['school_admin'], requiredSchoolModule: 'sorumluluk_sinav' },
    ],
  },
  {
    title: 'Okul değerlendirme',
    icon: Star,
    allowedRoles: ['superadmin', 'moderator'],
    menuGroup: 'rose',
    children: [
      {
        title: 'Herkese açık sayfa',
        path: '/okul-degerlendirmeleri',
        icon: Globe,
        allowedRoles: ['superadmin', 'moderator'],
      },
      {
        title: 'Modül ayarları',
        path: '/school-reviews-settings',
        icon: Settings,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'school_reviews',
      },
    ],
  },
  {
    title: 'Hesaplama parametreleri',
    icon: Calculator,
    allowedRoles: ['moderator'],
    menuGroup: 'cyan',
    children: [
      {
        title: 'Hesaplama türleri',
        path: '/extra-lesson-params',
        icon: Layers,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'extra_lesson_params',
      },
      {
        title: 'Ek ders parametreleri',
        path: '/extra-lesson-params/ek-ders',
        icon: Settings,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'extra_lesson_params',
      },
    ],
  },
  {
    heading: 'Sistem',
    allowedRoles: ['superadmin'],
  },
  {
    title: 'Platform',
    icon: Globe,
    allowedRoles: ['superadmin'],
    menuGroup: 'indigo',
    children: [
      {
        title: 'Platform Destek',
        path: '/support/platform',
        icon: Headphones,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Web Ayarları',
        path: '/web-ayarlar',
        icon: Globe,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Reklamlar',
        path: '/reklamlar',
        icon: RectangleHorizontal,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Öğretmen davetiye',
        path: '/reklamlar?tab=invite',
        icon: UserPlus,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Market',
        path: '/market',
        icon: ShoppingBag,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Hoşgeldin mesajları',
        path: '/hosgeldin-mesajlari',
        icon: Sparkles,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Destek Modülleri',
        path: '/support/modules',
        icon: Puzzle,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Duyuru TV ayarları',
        path: '/tv',
        icon: Tv,
        allowedRoles: ['superadmin'],
      },
    ],
  },
  {
    title: 'Okullar ve erişim',
    icon: School,
    allowedRoles: ['superadmin', 'moderator'],
    menuGroup: 'indigo',
    children: [
      {
        title: 'Okullara Sistem Mesajı Gönder',
        path: '/send-announcement',
        icon: Megaphone,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'announcements',
      },
      {
        title: 'Okullar',
        path: '/schools',
        icon: School,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'schools',
      },
      {
        title: 'Kullanıcılar',
        path: '/users',
        icon: UserCog,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'users',
      },
      {
        title: 'Okul kayıt kuyruğu',
        path: '/school-join-queue',
        icon: ClipboardCheck,
        allowedRoles: ['superadmin'],
        requiredModule: 'users',
      },
      {
        title: 'Modüller',
        path: '/modules',
        icon: Puzzle,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'modules',
      },
      {
        title: 'Market Politikası',
        path: '/market-policy',
        icon: ShoppingBag,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'market_policy',
      },
      {
        title: 'Sistem Duyuruları',
        path: '/system-announcements',
        icon: Bell,
        allowedRoles: ['moderator'],
        requiredModule: 'system_announcements',
      },
    ],
  },
  {
    title: 'İçerik altyapısı',
    icon: FileText,
    allowedRoles: ['superadmin', 'moderator'],
    menuGroup: 'indigo',
    children: [
      {
        title: 'Evrak & Plan Altyapısı',
        path: '/document-templates',
        icon: FileText,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'document_templates',
      },
      {
        title: 'Plan katkı moderasyonu',
        path: '/evrak/plan-katki-moderasyon',
        icon: ClipboardList,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'document_templates',
      },
      {
        title: 'Kazanım Setleri',
        path: '/outcome-sets',
        icon: Target,
        allowedRoles: ['superadmin', 'moderator'],
        requiredModule: 'document_templates',
      },
    ],
  },
  {
    title: 'Akademik ve sınav',
    icon: ClipboardList,
    allowedRoles: ['superadmin'],
    menuGroup: 'indigo',
    children: [
      {
        title: 'Akademik Takvim Şablonu',
        path: '/akademik-takvim-sablonu',
        icon: Calendar,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Bilsem Altyapısı',
        path: '/bilsem-sablon',
        icon: FileText,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Bilsem Kazanım Setleri',
        path: '/bilsem/yillik-plan/kazanim-sablonlari',
        icon: Target,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Sınav Görevleri',
        path: '/sinav-gorevleri',
        icon: ClipboardList,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Sınav Görevi Ayarları',
        path: '/sinav-gorevleri/ayarlar',
        icon: Settings,
        allowedRoles: ['superadmin'],
      },
      {
        title: 'Optik / Açık Uçlu Ayarları',
        path: '/optik-okuma-ayarlar',
        icon: ScanLine,
        allowedRoles: ['superadmin'],
      },
    ],
  },
];

/** Route → allowedRoles ve moderator için requiredModule eşlemesi. */
export const ROUTE_ROLES: Record<string, ('school_admin' | 'superadmin' | 'teacher' | 'moderator')[]> = {
  '/dashboard': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/profile': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/bildirimler': ['teacher', 'school_admin', 'superadmin', 'moderator'],
  '/sinav-gorevlerim': ['teacher'],
  '/ek-ders-hesaplama': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/hesaplamalar': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/sinav-gorev-ucretleri': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/favoriler': ['teacher', 'moderator'],
  '/evrak': ['teacher', 'superadmin', 'moderator'],
  '/evrak/plan-katki': ['teacher', 'school_admin'],
  '/evrak/plan-katki-moderasyon': ['superadmin', 'moderator'],
  '/market': ['teacher', 'school_admin', 'superadmin', 'moderator'],
  '/market/rewarded-ad': ['teacher'],
  '/kazanim-takip': ['teacher'],
  '/announcements': ['school_admin'],
  '/system-messages': ['school_admin'],
  '/duty': ['school_admin', 'teacher'],
  '/duty/planlar': ['school_admin', 'teacher'],
  '/duty/gorevlendirilen': ['school_admin'],
  '/duty/teblig': ['school_admin'],
  '/duty/gunluk-tablo': ['school_admin', 'teacher'],
  '/duty/yerler': ['school_admin'],
  '/duty/ozet': ['school_admin', 'teacher'],
  '/duty/logs': ['school_admin'],
  '/duty/takas': ['school_admin', 'teacher'],
  '/ders-programi': ['school_admin', 'teacher'],
  '/ders-programi/programlarim': ['school_admin', 'teacher'],
  '/ders-programi/olustur': ['school_admin', 'teacher'],
  '/ders-programi/ayarlar': ['school_admin'],
  '/duty/tercihler': ['school_admin', 'teacher'],
  '/tv': ['school_admin', 'superadmin'],
  '/send-announcement': ['superadmin', 'moderator'],
  '/teachers': ['school_admin'],
  '/classes-subjects': ['school_admin'],
  '/school-reviews-report': ['school_admin'],
  '/settings': ['school_admin', 'superadmin', 'teacher'],
  '/schools': ['superadmin', 'moderator'],
  '/users': ['superadmin', 'moderator'],
  '/school-join-queue': ['superadmin', 'school_admin'],
  '/modules': ['superadmin', 'moderator'],
  '/market-policy': ['superadmin', 'moderator'],
  '/school-reviews-settings': ['superadmin', 'moderator'],
  '/okul-degerlendirmeleri': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/document-templates': ['superadmin', 'moderator'],
  '/work-calendar': ['superadmin', 'moderator'],
  '/yillik-plan-icerik': ['superadmin', 'moderator'],
  '/extra-lesson-params': ['superadmin', 'moderator'],
  '/extra-lesson-params/ek-ders': ['superadmin', 'moderator'],
  '/outcome-sets': ['superadmin', 'moderator'],
  '/system-announcements': ['moderator'],
  '/haberler': ['teacher', 'school_admin', 'superadmin'],
  '/haberler/ayarlar': ['superadmin'],
  '/web-ayarlar': ['superadmin'],
  '/contact-inbox': ['superadmin', 'moderator'],
  '/reklamlar': ['superadmin'],
  '/hosgeldin-mesajlari': ['superadmin'],
  '/haberler/yayin': ['teacher', 'school_admin', 'superadmin'],
  '/akademik-takvim': ['teacher', 'school_admin', 'superadmin'],
  '/ogretmen-ajandasi': ['teacher', 'school_admin'],
  '/ogretmen-ajandasi/degerlendirme': ['teacher'],
  '/akademik-takvim-ayarlar': ['school_admin'],
  '/bilsem/takvim': ['teacher', 'school_admin'],
  '/bilsem/yillik-plan': ['school_admin', 'teacher'],
  '/bilsem/yillik-plan/kazanim-sablonlari': ['school_admin', 'teacher', 'superadmin'],
  '/bilsem/plan-katki': ['school_admin', 'teacher'],
  '/bilsem/plan-katki-moderasyon': ['superadmin', 'moderator'],
  '/akademik-takvim-sablonu': ['superadmin'],
  '/bilsem-sablon': ['superadmin'],
  '/sinav-gorevleri': ['superadmin'],
  '/sinav-gorevleri/ayarlar': ['superadmin'],
  '/optik-formlar': ['teacher', 'school_admin'],
  '/kelebek-sinav': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/ogrenci-sorgu': ['teacher', 'school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/sinif-ogrenci': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/yerlesim': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/ders-ogretmen': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/sinav-islemleri': ['teacher', 'school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/sinav-olustur': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/oturumlar': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/sinav-planlama': ['school_admin', 'superadmin', 'moderator'],
  '/kelebek-sinav/ayarlar': ['school_admin', 'superadmin', 'moderator'],
  '/optik-okuma-ayarlar': ['superadmin'],
  '/akilli-tahta': ['school_admin', 'superadmin', 'teacher'],
  '/support': ['teacher', 'school_admin', 'superadmin'],
  '/support/new': ['teacher', 'school_admin', 'superadmin'],
  '/support/inbox': ['school_admin', 'moderator'],
  '/support/platform': ['superadmin'],
  '/support/modules': ['superadmin'],
  '/403': ['school_admin', 'superadmin', 'teacher', 'moderator'],
  '/sorumluluk-sinav': ['school_admin', 'superadmin', 'moderator'],
  '/sorumluluk-sinav/bilgilendirme': ['teacher'],
  '/sorumluluk-sinav/ogrenciler': ['school_admin', 'superadmin', 'moderator'],
  '/sorumluluk-sinav/oturumlar': ['school_admin', 'superadmin', 'moderator'],
  '/sorumluluk-sinav/programlama': ['school_admin', 'superadmin', 'moderator'],
  '/sorumluluk-sinav/gorevlendirme': ['school_admin', 'superadmin', 'moderator'],
  '/sorumluluk-sinav/raporlar': ['school_admin', 'superadmin', 'moderator'],
  '/sorumluluk-sinav/yoklama': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi': ['school_admin', 'teacher', 'superadmin', 'moderator'],
  '/mesaj-merkezi/ogretmen-ayarlar': ['teacher'],
  '/mesaj-merkezi/veli-iletisim': ['school_admin', 'teacher', 'superadmin', 'moderator'],
  '/mesaj-merkezi/ek-ders': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/maas': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/devamsizlik': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/ders-devamsizlik': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/devamsizlik-mektup': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/ara-karne': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/karne': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/izin': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/mebbis-puantaj': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/kbs-ek-ders': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/kbs-maas': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/gruplar': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/veli-toplantisi': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/davetiye': ['school_admin', 'superadmin', 'moderator'],
  '/mesaj-merkezi/ayarlar': ['school_admin', 'superadmin', 'moderator'],
};

/** Teacher / school_admin için route → required school module (enabled_modules). */
export const ROUTE_SCHOOL_MODULES: Record<string, string | undefined> = {
  '/okul-degerlendirmeleri': 'school_reviews',
  '/favoriler': 'school_reviews',
  '/evrak': 'document',
  '/evrak/plan-katki': 'document',
  '/kazanim-takip': 'outcome',
  '/duty': 'duty',
  '/tv': 'tv',
  '/akilli-tahta': 'smart_board',
  '/ogretmen-ajandasi': 'teacher_agenda',
  '/ogretmen-ajandasi/degerlendirme': 'teacher_agenda',
  '/optik-formlar': 'optical',
  '/bilsem/takvim': 'bilsem',
  '/bilsem/yillik-plan': 'bilsem',
  '/bilsem/yillik-plan/kazanim-sablonlari': 'bilsem',
  '/bilsem/plan-katki': 'bilsem',
  '/kelebek-sinav': 'butterfly_exam',
  '/kelebek-sinav/ogrenci-sorgu': 'butterfly_exam',
  '/kelebek-sinav/sinif-ogrenci': 'butterfly_exam',
  '/kelebek-sinav/yerlesim': 'butterfly_exam',
  '/kelebek-sinav/ders-ogretmen': 'butterfly_exam',
  '/kelebek-sinav/sinav-islemleri': 'butterfly_exam',
  '/kelebek-sinav/sinav-olustur': 'butterfly_exam',
  '/kelebek-sinav/oturumlar': 'butterfly_exam',
  '/kelebek-sinav/sinav-planlama': 'butterfly_exam',
  '/kelebek-sinav/ayarlar': 'butterfly_exam',
  '/sorumluluk-sinav': 'sorumluluk_sinav',
  '/sorumluluk-sinav/bilgilendirme': 'sorumluluk_sinav',
  '/sorumluluk-sinav/ogrenciler': 'sorumluluk_sinav',
  '/sorumluluk-sinav/oturumlar': 'sorumluluk_sinav',
  '/sorumluluk-sinav/programlama': 'sorumluluk_sinav',
  '/sorumluluk-sinav/gorevlendirme': 'sorumluluk_sinav',
  '/sorumluluk-sinav/raporlar': 'sorumluluk_sinav',
  '/sorumluluk-sinav/yoklama': 'sorumluluk_sinav',
  '/mesaj-merkezi': 'messaging',
  '/mesaj-merkezi/ogretmen-ayarlar': 'messaging',
  '/mesaj-merkezi/veli-iletisim': 'messaging',
  '/mesaj-merkezi/ek-ders': 'messaging',
  '/mesaj-merkezi/maas': 'messaging',
  '/mesaj-merkezi/devamsizlik': 'messaging',
  '/mesaj-merkezi/karne': 'messaging',
  '/mesaj-merkezi/izin': 'messaging',
  '/mesaj-merkezi/mebbis-puantaj': 'messaging',
  '/mesaj-merkezi/kbs-ek-ders': 'messaging',
  '/mesaj-merkezi/kbs-maas': 'messaging',
  '/mesaj-merkezi/ders-devamsizlik': 'messaging',
  '/mesaj-merkezi/devamsizlik-mektup': 'messaging',
  '/mesaj-merkezi/ara-karne': 'messaging',
  '/mesaj-merkezi/gruplar': 'messaging',
  '/mesaj-merkezi/veli-toplantisi': 'messaging',
  '/mesaj-merkezi/davetiye': 'messaging',
  '/mesaj-merkezi/ayarlar': 'messaging',
};

/** Moderator için route → required module. */
export const ROUTE_MODULES: Record<string, ModeratorModuleKey | undefined> = {
  '/okul-degerlendirmeleri': 'school_reviews',
  '/favoriler': 'school_reviews',
  '/evrak': 'document_templates',
  '/evrak/plan-katki-moderasyon': 'document_templates',
  '/send-announcement': 'announcements',
  '/schools': 'schools',
  '/users': 'users',
  '/modules': 'modules',
  '/market-policy': 'market_policy',
  '/school-reviews-settings': 'school_reviews',
  '/document-templates': 'document_templates',
  '/work-calendar': 'document_templates',
  '/yillik-plan-icerik': 'document_templates',
  '/bilsem/plan-katki-moderasyon': 'document_templates',
  '/extra-lesson-params': 'extra_lesson_params',
  '/extra-lesson-params/ek-ders': 'extra_lesson_params',
  '/sinav-gorev-ucretleri': 'extra_lesson_params',
  '/ek-ders-hesaplama': 'extra_lesson_params',
  '/outcome-sets': 'document_templates',
  '/system-announcements': 'system_announcements',
  '/support/inbox': 'support',
};

/**
 * pathname için eşleşen route anahtarını döner, yoksa null.
 */
export function getMatchedRoute(pathname: string): string | null {
  const normalized = pathname === '/' ? '/dashboard' : pathname;
  if (normalized === '/403') return '/403';
  for (const route of Object.keys(ROUTE_ROLES).sort((a, b) => b.length - a.length)) {
    if (route === '/403') continue;
    if (route === '/dashboard' && (normalized === '/dashboard' || normalized === '/')) return route;
    if (normalized === route || (route !== '/dashboard' && normalized.startsWith(route + '/'))) return route;
  }
  return null;
}

/**
 * pathname için erişim kontrolü.
 * Moderator: requiredModule (moderator_modules).
 * Teacher / school_admin: requiredSchoolModule (enabled_modules).
 */
export function canAccessRoute(
  pathname: string,
  role: 'school_admin' | 'superadmin' | 'teacher' | 'moderator',
  moderatorModules?: string[] | null,
  schoolEnabledModules?: string[] | null,
  supportEnabled = true,
): boolean {
  const route = getMatchedRoute(pathname);
  if (!route) return false;
  if (route === '/403') return true;
  if (!ROUTE_ROLES[route].includes(role)) return false;
  /** Misafir kabukta açılan sayfalar: girişli kullanıcıda moderator_modules / okul modülü ile kapatma */
  if (isPublicAdminPath(pathname)) return true;
  if (role === 'moderator') {
    const reqMod = ROUTE_MODULES[route];
    if (reqMod) {
      return Array.isArray(moderatorModules) && moderatorModules.includes(reqMod);
    }
  }
  if ((role === 'teacher' || role === 'school_admin') && schoolEnabledModules !== undefined) {
    const reqSchoolMod = ROUTE_SCHOOL_MODULES[route];
    if (reqSchoolMod) {
      if (!Array.isArray(schoolEnabledModules) || schoolEnabledModules.length === 0) return true;
      return schoolEnabledModules.includes(reqSchoolMod);
    }
  }
  return true;
}

/**
 * @deprecated Erişim için canAccessRoute kullanın. Geriye dönük uyumluluk için.
 */
export function getAllowedRolesForPath(pathname: string): ('school_admin' | 'superadmin' | 'teacher' | 'moderator')[] | null {
  if (pathname === '/dashboard' || pathname === '/') return ['school_admin', 'superadmin', 'teacher', 'moderator'];
  if (pathname === '/403') return ['school_admin', 'superadmin', 'teacher', 'moderator'];
  for (const route of Object.keys(ROUTE_ROLES).sort((a, b) => b.length - a.length)) {
    if (route === '/403') continue;
    if (route !== '/dashboard' && (pathname === route || pathname.startsWith(route + '/'))) {
      return ROUTE_ROLES[route];
    }
  }
  return null;
}

export type BreadcrumbItem = { label: string; path?: string };

/**
 * pathname'den breadcrumb listesi üretir (menü path'lerine göre).
 */
/** Ders programı alt sayfaları için breadcrumb etiketleri */
const DERS_PROGRAMI_BREADCRUMBS: Record<string, string> = {
  '/ders-programi/ayarlar': 'Ayarlar',
  '/ders-programi/programlarim': 'Programlarım',
};

function menuBreadcrumbLabel(entry: MenuItem, role?: WebAdminRole): string {
  if (role && entry.titleByRole?.[role]) return entry.titleByRole[role]!;
  return entry.title ?? entry.path ?? '';
}

function menuPathMatchScore(normalized: string, fullPath: string): number {
  if (fullPath === normalized) return fullPath.length + 1_000_000;
  const base = fullPath.split('?')[0];
  if (normalized === base) {
    let s = base.length * 1_000;
    if (!fullPath.includes('?')) s += 1;
    return s;
  }
  if (normalized.startsWith(base + '/')) {
    return base.length * 1_000;
  }
  return -1;
}

/** pathname için menüde eşleşen üst öğe + yaprak zinciri (en uzun path öncelikli; /support vs /support/platform). */
function findMenuChainForPath(normalized: string, entries: MenuItem[], role?: WebAdminRole): MenuItem[] | null {
  let best: { chain: MenuItem[]; len: number } | null = null;

  for (const entry of entries) {
    if (entry.heading) continue;
    if (role && !entry.allowedRoles.includes(role)) continue;
    if (entry.children?.length) {
      for (const child of entry.children) {
        if (!child.path) continue;
        if (role && !child.allowedRoles.includes(role)) continue;
        const len = menuPathMatchScore(normalized, child.path);
        if (len >= 0 && (!best || len > best.len)) best = { chain: [entry, child], len };
      }
    } else if (entry.path) {
      const len = menuPathMatchScore(normalized, entry.path);
      if (len >= 0 && (!best || len > best.len)) best = { chain: [entry], len };
    }
  }
  return best?.chain ?? null;
}

export function getBreadcrumbs(pathname: string, role?: WebAdminRole): BreadcrumbItem[] {
  const normalized = pathname === '/' ? '/dashboard' : pathname.split('?')[0];
  const items: BreadcrumbItem[] = [{ label: 'Ana sayfa', path: '/dashboard' }];
  if (normalized === '/dashboard') return items;
  if (normalized === '/403') {
    items.push({ label: 'Erişim reddedildi' });
    return items;
  }

  const chain = findMenuChainForPath(normalized, MENU_SIDEBAR, role);
  if (chain?.length) {
    /** Menü grubu başlıkları (path yok) — breadcrumb’da tekrar etmesin (örn. «Başlangıç»). */
    for (const m of chain) {
      if (!m.path) continue;
      const label = menuBreadcrumbLabel(m, role);
      items.push({ label, path: m.path });
    }
    if (normalized === '/haberler/ayarlar') {
      items.push({ label: 'Ayarlar' });
    } else if (normalized === '/haberler/yayin') {
      items.push({ label: 'Yayın' });
    } else if (normalized === '/akademik-takvim-ayarlar') {
      items.push({ label: 'Ayarlar' });
    } else if (normalized === '/akademik-takvim-sablonu') {
      items.push({ label: 'Şablon' });
    } else if (normalized === '/ogretmen-ajandasi/degerlendirme') {
      items.push({ label: 'Öğrenci Değerlendirme' });
    } else if (normalized === '/bilsem/takvim/ayarlar') {
      items.push({ label: 'Ayarlar' });
    } else if (normalized === '/bilsem/takvim/yillik-plan') {
      items.push({ label: 'Bilsem yıllık çalışma planı' });
    } else if (normalized === '/bilsem/plan-katki/yeni') {
      items.push({ label: 'Yeni taslak' });
    } else if (normalized.startsWith('/bilsem/plan-katki/') && normalized !== '/bilsem/plan-katki/yeni') {
      items.push({ label: 'Detay' });
    } else if (normalized === '/bilsem/plan-katki-moderasyon') {
      items.push({ label: 'Moderasyon' });
    } else if (normalized === '/evrak/plan-katki/yeni') {
      items.push({ label: 'Yeni taslak' });
    } else if (normalized.startsWith('/evrak/plan-katki/') && normalized !== '/evrak/plan-katki/yeni') {
      items.push({ label: 'Detay' });
    } else if (normalized === '/evrak/plan-katki-moderasyon') {
      items.push({ label: 'Moderasyon' });
    } else if (normalized.startsWith('/bilsem-sablon/')) {
      /* menü etiketi yeterli */
    } else {
      let subLabel = DERS_PROGRAMI_BREADCRUMBS[normalized];
      if (!subLabel && normalized.startsWith('/ders-programi/olustur')) subLabel = 'Excel ile Yükle';
      if (subLabel) items.push({ label: subLabel });
    }
    return items;
  }

  if (items.length === 1 && normalized !== '/dashboard') {
    items.push({ label: normalized.slice(1) || 'Sayfa' });
  }
  return items;
}
