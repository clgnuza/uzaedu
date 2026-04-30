'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { Me } from '@/providers/auth-provider';
import { useAuth } from '@/hooks/use-auth';
import { useMarketModuleActivationMap, isMarketModuleLocked } from '@/hooks/use-market-module-activation-map';
import { getMarketModuleKeyForPath } from '@/config/module-market-route';
import { SCHOOL_MODULE_KEYS, type SchoolModuleKey } from '@/config/school-modules';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowRight,
  ChevronRight,
  Award,
  Banknote,
  Bell,
  BellRing,
  BookMarked,
  Bug,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Coins,
  Clock,
  FileText,
  FolderOpen,
  Headphones,
  Heart,
  GraduationCap,
  Layers,
  LifeBuoy,
  MapPin,
  Medal,
  Megaphone,
  MessageSquare,
  Monitor,
  Newspaper,
  NotebookPen,
  ScanBarcode,
  ScanLine,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Table2,
  Target,
  User,
  XCircle,
  Undo2,
  Calculator,
  Sigma,
  UsersRound,
  Lock,
  BadgeCheck,
  Quote,
  LayoutGrid,
  Compass,
} from 'lucide-react';
import {
  useWelcomeMotivationQuote,
  WelcomeMotivationQuoteEmbedded,
} from '@/components/dashboard/welcome-motivation-banner';
import { TeacherSchoolJoinBanner } from '@/components/dashboard/teacher-school-join-banner';

function greetingTr(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Günaydın';
  if (h >= 12 && h < 18) return 'İyi günler';
  if (h >= 18 && h < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}

function formatTodayTr(): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function initialsFromDisplayName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0] ?? ''}${p[p.length - 1]![0] ?? ''}`.toUpperCase();
  const s = name.trim();
  return s.length >= 2 ? s.slice(0, 2).toUpperCase() : (s.slice(0, 1).toUpperCase() || '?');
}

/** Okul `enabled_modules` boş veya tanımsızsa tüm okul modülleri erişilebilir kabul edilir (menü ile uyumlu). */
export function isSchoolModuleEnabled(
  enabledModules: string[] | null | undefined,
  moduleKey: string
): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(moduleKey);
}

type QuickIcon = typeof Calendar;

type QuickItem = {
  href: string;
  title: string;
  desc: string;
  icon: QuickIcon;
  accent: string;
  /** Tanımlıysa yalnızca bu okul modülü açıkken gösterilir */
  schoolModule?: string;
  /** max-sm: kartı biraz küçült (padding, min-yükseklik, ikon) — masaüstü aynı */
  compactMobile?: boolean;
};

type QuickSection = { label: string; items: QuickItem[] };

/** “Tüm araçlar” bölümleri için dönüşümlü kabuk (her bölüm farklı renk ailesi). */
const TEACHER_HOME_SECTION_THEMES = [
  {
    nav: 'overflow-hidden rounded-[1.35rem] border border-cyan-200/60 bg-gradient-to-br from-cyan-50/95 via-white to-sky-50/45 shadow-[0_14px_44px_-20px_rgba(6,182,212,0.28)] ring-1 ring-cyan-400/15 dark:border-cyan-500/35 dark:from-cyan-950/50 dark:via-zinc-950 dark:to-sky-950/25 dark:ring-cyan-500/20',
    header:
      'border-b border-cyan-200/55 bg-gradient-to-r from-cyan-100/95 via-sky-50/65 to-transparent px-3.5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-950 sm:px-4 sm:text-left dark:border-cyan-500/30 dark:from-cyan-950/85 dark:via-sky-950/45 dark:to-transparent dark:text-cyan-50',
    itemHover:
      'border-slate-200/75 hover:border-cyan-400/45 hover:shadow-[0_18px_36px_-14px_rgba(6,182,212,0.22)] dark:border-zinc-700/70 dark:hover:border-cyan-500/40',
  },
  {
    nav: 'overflow-hidden rounded-[1.35rem] border border-violet-200/60 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/40 shadow-[0_14px_44px_-20px_rgba(139,92,246,0.22)] ring-1 ring-violet-400/15 dark:border-violet-500/35 dark:from-violet-950/45 dark:via-zinc-950 dark:to-fuchsia-950/25 dark:ring-violet-500/20',
    header:
      'border-b border-violet-200/55 bg-gradient-to-r from-violet-100/95 via-fuchsia-50/60 to-transparent px-3.5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-violet-950 sm:px-4 sm:text-left dark:border-violet-500/30 dark:from-violet-950/85 dark:via-fuchsia-950/40 dark:to-transparent dark:text-violet-50',
    itemHover:
      'border-slate-200/75 hover:border-violet-400/45 hover:shadow-[0_18px_36px_-14px_rgba(139,92,246,0.2)] dark:border-zinc-700/70 dark:hover:border-violet-500/40',
  },
  {
    nav: 'overflow-hidden rounded-[1.35rem] border border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/40 shadow-[0_14px_44px_-20px_rgba(16,185,129,0.24)] ring-1 ring-emerald-400/15 dark:border-emerald-500/35 dark:from-emerald-950/45 dark:via-zinc-950 dark:to-teal-950/25 dark:ring-emerald-500/20',
    header:
      'border-b border-emerald-200/55 bg-gradient-to-r from-emerald-100/95 via-teal-50/60 to-transparent px-3.5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-950 sm:px-4 sm:text-left dark:border-emerald-500/30 dark:from-emerald-950/85 dark:via-teal-950/40 dark:to-transparent dark:text-emerald-50',
    itemHover:
      'border-slate-200/75 hover:border-emerald-400/45 hover:shadow-[0_18px_36px_-14px_rgba(16,185,129,0.2)] dark:border-zinc-700/70 dark:hover:border-emerald-500/40',
  },
  {
    nav: 'overflow-hidden rounded-[1.35rem] border border-amber-200/60 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40 shadow-[0_14px_44px_-20px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/15 dark:border-amber-500/35 dark:from-amber-950/40 dark:via-zinc-950 dark:to-orange-950/25 dark:ring-amber-500/20',
    header:
      'border-b border-amber-200/55 bg-gradient-to-r from-amber-100/95 via-orange-50/60 to-transparent px-3.5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-amber-950 sm:px-4 sm:text-left dark:border-amber-500/30 dark:from-amber-950/85 dark:via-orange-950/40 dark:to-transparent dark:text-amber-50',
    itemHover:
      'border-slate-200/75 hover:border-amber-400/45 hover:shadow-[0_18px_36px_-14px_rgba(245,158,11,0.2)] dark:border-zinc-700/70 dark:hover:border-amber-500/40',
  },
  {
    nav: 'overflow-hidden rounded-[1.35rem] border border-rose-200/60 bg-gradient-to-br from-rose-50/95 via-white to-pink-50/40 shadow-[0_14px_44px_-20px_rgba(244,63,94,0.18)] ring-1 ring-rose-400/15 dark:border-rose-500/35 dark:from-rose-950/40 dark:via-zinc-950 dark:to-pink-950/25 dark:ring-rose-500/20',
    header:
      'border-b border-rose-200/55 bg-gradient-to-r from-rose-100/95 via-pink-50/60 to-transparent px-3.5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-rose-950 sm:px-4 sm:text-left dark:border-rose-500/30 dark:from-rose-950/85 dark:via-pink-950/40 dark:to-transparent dark:text-rose-50',
    itemHover:
      'border-slate-200/75 hover:border-rose-400/45 hover:shadow-[0_18px_36px_-14px_rgba(244,63,94,0.18)] dark:border-zinc-700/70 dark:hover:border-rose-500/40',
  },
  {
    nav: 'overflow-hidden rounded-[1.35rem] border border-indigo-200/60 bg-gradient-to-br from-indigo-50/95 via-white to-blue-50/40 shadow-[0_14px_44px_-20px_rgba(99,102,241,0.22)] ring-1 ring-indigo-400/15 dark:border-indigo-500/35 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-blue-950/25 dark:ring-indigo-500/20',
    header:
      'border-b border-indigo-200/55 bg-gradient-to-r from-indigo-100/95 via-blue-50/60 to-transparent px-3.5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-950 sm:px-4 sm:text-left dark:border-indigo-500/30 dark:from-indigo-950/85 dark:via-blue-950/40 dark:to-transparent dark:text-indigo-50',
    itemHover:
      'border-slate-200/75 hover:border-indigo-400/45 hover:shadow-[0_18px_36px_-14px_rgba(99,102,241,0.2)] dark:border-zinc-700/70 dark:hover:border-indigo-500/40',
  },
] as const;

function marketKeyForQuickItem(item: QuickItem): SchoolModuleKey | null {
  if (item.schoolModule && SCHOOL_MODULE_KEYS.includes(item.schoolModule as SchoolModuleKey)) {
    return item.schoolModule as SchoolModuleKey;
  }
  return getMarketModuleKeyForPath(item.href);
}

function buildTeacherQuickSections(enabledModules: string[] | null | undefined): QuickSection[] {
  const sections: QuickSection[] = [
    {
      label: 'Hesaplamalar',
      items: [
        {
          href: '/hesaplamalar',
          title: 'Hesaplamalar',
          desc: 'Ek ders, sınav görev ücreti ve diğer hesap sayfaları',
          icon: Calculator,
          accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-800 dark:text-violet-300',
        },
      ],
    },
    {
      label: 'Plan ve ders',
      items: [
        {
          href: '/akademik-takvim',
          title: 'Akademik takvim',
          desc: 'Takvim ve belirli gün görevleri',
          icon: Calendar,
          accent: 'from-amber-500/20 to-orange-500/10 text-amber-700 dark:text-amber-300',
        },
        {
          href: '/ders-programi/programlarim',
          title: 'Ders programım',
          desc: 'Haftalık program',
          icon: Table2,
          accent: 'from-emerald-500/20 to-teal-500/10 text-emerald-700 dark:text-emerald-300',
        },
        {
          href: '/evrak',
          title: 'MEB yıllık plan',
          desc: 'Plan talebi ve Word çıktısı',
          icon: FileText,
          accent: 'from-teal-500/20 to-cyan-500/10 text-teal-700 dark:text-teal-300',
          schoolModule: 'document',
        },
        {
          href: '/evrak/plan-katki',
          title: 'Plan katkısı',
          desc: 'Excel plan yükle, moderasyon akışı',
          icon: ClipboardList,
          accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-700 dark:text-violet-300',
          schoolModule: 'document',
        },
        {
          href: '/ogretmen-ajandasi',
          title: 'Öğretmen ajandası',
          desc: 'Ajanda kayıtları',
          icon: CalendarClock,
          accent: 'from-sky-500/20 to-blue-500/10 text-sky-700 dark:text-sky-300',
          schoolModule: 'teacher_agenda',
        },
        {
          href: '/ogretmen-ajandasi/degerlendirme',
          title: 'Öğrenci değerlendirme',
          desc: 'Ajanda üzerinden değerlendirme',
          icon: Target,
          accent: 'from-blue-500/20 to-cyan-500/10 text-blue-700 dark:text-blue-300',
          schoolModule: 'teacher_agenda',
        },
      ],
    },
    {
      label: 'Okul araçları',
      items: [
        {
          href: '/duty',
          title: 'Nöbet ve görevler',
          desc: 'Günlük nöbet, tercih, takas',
          icon: CalendarClock,
          accent: 'from-emerald-500/20 to-green-500/10 text-emerald-800 dark:text-emerald-300',
          schoolModule: 'duty',
        },
        {
          href: '/akilli-tahta',
          title: 'Akıllı tahta',
          desc: 'İçerik ve oturum',
          icon: Monitor,
          accent: 'from-violet-500/20 to-purple-500/10 text-violet-700 dark:text-violet-300',
          schoolModule: 'smart_board',
        },
      ],
    },
    {
      label: 'Bilsem',
      items: [
        {
          href: '/bilsem/takvim',
          title: 'Bilsem takvimi',
          desc: 'Haftalık plan ve etkinlikler',
          icon: Calendar,
          accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-800 dark:text-violet-300',
          schoolModule: 'bilsem',
        },
        {
          href: '/bilsem/yillik-plan',
          title: 'Bilsem yıllık plan',
          desc: 'Word plan çıktısı',
          icon: Layers,
          accent: 'from-fuchsia-500/20 to-purple-500/10 text-fuchsia-800 dark:text-fuchsia-300',
          schoolModule: 'bilsem',
        },
      ],
    },
    {
      label: 'Ölçme',
      items: [
        {
          href: '/optik-formlar',
          title: 'Optik formlar',
          desc: 'Optik işlemleri',
          icon: ScanLine,
          accent: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-800 dark:text-fuchsia-300',
          schoolModule: 'optical',
        },
      ],
    },
    {
      label: 'Öğrenci ve topluluk',
      items: [
        {
          href: '/kazanim-takip',
          title: 'Kazanım takibi',
          desc: 'Branş kazanımları',
          icon: Target,
          accent: 'from-indigo-500/20 to-violet-500/10 text-indigo-700 dark:text-indigo-300',
          schoolModule: 'outcome',
        },
        {
          href: '/okul-degerlendirmeleri',
          title: 'Okul değerlendirmeleri',
          desc: 'Araştır ve puanla',
          icon: Star,
          accent: 'from-orange-500/20 to-amber-500/10 text-orange-700 dark:text-orange-300',
          schoolModule: 'school_reviews',
          compactMobile: true,
        },
        {
          href: '/favoriler',
          title: 'Favorilerim',
          desc: 'Kayıtlı okullar',
          icon: Heart,
          accent: 'from-rose-500/20 to-pink-500/10 text-rose-700 dark:text-rose-300',
          schoolModule: 'school_reviews',
        },
      ],
    },
    {
      label: 'Haber ve sınav',
      items: [
        {
          href: '/haberler',
          title: 'Haberler',
          desc: 'Okul ve platform haberleri',
          icon: Newspaper,
          accent: 'from-violet-500/20 to-purple-500/10 text-violet-700 dark:text-violet-300',
        },
        {
          href: '/haberler/yayin',
          title: 'Haber yayını',
          desc: 'Yayın oluştur ve paylaş',
          icon: Sparkles,
          accent: 'from-amber-500/20 to-yellow-500/10 text-amber-800 dark:text-amber-300',
        },
        {
          href: '/sinav-gorevlerim',
          title: 'Sınav görevlerim',
          desc: 'Atanan sınavlar',
          icon: ClipboardList,
          accent: 'from-slate-500/20 to-zinc-500/10 text-slate-700 dark:text-slate-300',
        },
      ],
    },
    {
      label: 'Hizmetler',
      items: [
        {
          href: '/market',
          title: 'Market',
          desc: 'İçerik ve satın alma',
          icon: ShoppingBag,
          accent: 'from-emerald-500/20 to-green-500/10 text-emerald-800 dark:text-emerald-300',
        },
        {
          href: '/market/rewarded-ad',
          title: 'Reklam izle · Jeton kazan',
          desc: 'Mobilde izle, anında jeton',
          icon: Coins,
          accent: 'from-violet-500/20 to-purple-500/10 text-violet-800 dark:text-violet-300',
        },
        {
          href: '/support',
          title: 'Destek talepleri',
          desc: 'Yardım ve talep oluştur',
          icon: Headphones,
          accent: 'from-cyan-500/20 to-sky-500/10 text-cyan-800 dark:text-cyan-300',
        },
      ],
    },
    {
      label: 'Hesap',
      items: [
        {
          href: '/profile',
          title: 'Profilim',
          desc: 'Bilgiler ve tercihler',
          icon: User,
          accent: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-700 dark:text-fuchsia-300',
        },
        {
          href: '/settings',
          title: 'Ayarlar',
          desc: 'Uygulama ayarları',
          icon: Settings,
          accent: 'from-zinc-500/20 to-neutral-500/10 text-zinc-700 dark:text-zinc-300',
        },
      ],
    },
  ];

  return sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) =>
        it.schoolModule ? isSchoolModuleEnabled(enabledModules, it.schoolModule) : true
      ),
    }))
    .filter((sec) => sec.items.length > 0);
}

type TeacherHomeTopShortcut = {
  href: string;
  label: string;
  icon: LucideIcon;
  ring: string;
  marketKey?: SchoolModuleKey;
};

type DutySlot = { user_id: string; area_name: string | null; slot_name: string | null; shift?: string };
type Pref = { id?: string; date: string; status: string };
type Swap = {
  id: string;
  status: string;
  duty_slot?: { date: string; area_name: string | null };
  proposedUser?: { display_name: string | null; email: string };
};
type Assignment = {
  id: string;
  itemTitle: string;
  weekDateStart: string | null;
  weekDateEnd: string | null;
  weekLabel: string | null;
  gorevTipi: string;
};

export type TeacherHomeProps = {
  me: Me;
  displayName: string;
  allNotificationsUnread: number;
  todayDuty: { date: string; slots: DutySlot[] } | null;
  belirliGunAssignments: Assignment[];
  teacherPrefs: Pref[];
  teacherSwaps: Swap[];
};

const TEACHER_HOME_NAV_SECTIONS: {
  id: 'teacher-hero' | 'hizli-erisim' | 'bugun-ozet' | 'tum-moduller';
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: 'teacher-hero', label: 'Panel', Icon: LayoutGrid },
  { id: 'hizli-erisim', label: 'Keşfet', Icon: Compass },
  { id: 'bugun-ozet', label: 'Bugün', Icon: Calendar },
  { id: 'tum-moduller', label: 'Modüller', Icon: Layers },
];

const TEACHER_HOME_SCROLL_SPY_OFFSET = 80;

export function TeacherHome({
  me,
  displayName,
  allNotificationsUnread,
  todayDuty,
  belirliGunAssignments,
  teacherPrefs,
  teacherSwaps,
}: TeacherHomeProps) {
  const { token } = useAuth();
  const activationModules = useMarketModuleActivationMap(token, me.role);
  const enabledModules = me.school?.enabled_modules ?? null;
  const quickSections = buildTeacherQuickSections(enabledModules);
  const dutyEnabled = isSchoolModuleEnabled(enabledModules, 'duty');
  const dutyMarketLocked = dutyEnabled && isMarketModuleLocked(activationModules, 'duty');
  const mySlots = (todayDuty?.slots ?? []).filter((s) => s.user_id === me.id);
  const schoolApproved =
    me.role === 'teacher' &&
    !!me.school_id &&
    (me.school_join_stage ?? 'none') === 'approved';

  const welcomeQuote = useWelcomeMotivationQuote();

  const [activeSectionId, setActiveSectionId] = useState<string>(TEACHER_HOME_NAV_SECTIONS[0]!.id);

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (hash && TEACHER_HOME_NAV_SECTIONS.some((s) => s.id === hash)) {
      setActiveSectionId(hash);
    }
  }, []);

  useEffect(() => {
    const ids = TEACHER_HOME_NAV_SECTIONS.map((s) => s.id);

    const updateActive = () => {
      const y = window.scrollY;
      let current = ids[0]!;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (y + TEACHER_HOME_SCROLL_SPY_OFFSET >= top - 2) {
          current = id;
        }
      }
      setActiveSectionId(current);
    };

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    return () => {
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
    };
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch {
      /* ignore */
    }
  };

  const topShortcutItems = useMemo((): TeacherHomeTopShortcut[] => {
    const items: TeacherHomeTopShortcut[] = [
      { href: '/hesaplamalar', label: 'Hesap', icon: Sigma, ring: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200' },
      { href: '/akademik-takvim', label: 'Takvim', icon: CalendarDays, ring: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-100' },
    ];
    if (dutyEnabled && isSchoolModuleEnabled(enabledModules, 'duty')) {
      items.push({
        href: '/duty',
        label: 'Nöbet',
        icon: UsersRound,
        ring: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100',
        marketKey: 'duty',
      });
    }
    items.push(
      { href: '/ders-programi/programlarim', label: 'Program', icon: CalendarRange, ring: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-100' },
      { href: '/bildirimler', label: 'Bildirim', icon: BellRing, ring: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100' },
      { href: '/haberler', label: 'Haber', icon: Megaphone, ring: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-100' },
      { href: '/support', label: 'Destek', icon: LifeBuoy, ring: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-100' },
    );

    const moduleStrip: TeacherHomeTopShortcut[] = [];
    if (isSchoolModuleEnabled(enabledModules, 'extra_lesson')) {
      moduleStrip.push({
        href: '/ek-ders-hesaplama',
        label: 'Ek ders',
        icon: Banknote,
        ring: 'bg-lime-100 text-lime-900 dark:bg-lime-950/50 dark:text-lime-200',
        marketKey: 'extra_lesson',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'document')) {
      moduleStrip.push({
        href: '/evrak',
        label: 'Evrak',
        icon: FolderOpen,
        ring: 'bg-teal-100 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100',
        marketKey: 'document',
      });
      moduleStrip.push({
        href: '/evrak/plan-katki',
        label: 'Katkı',
        icon: ClipboardList,
        ring: 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100',
        marketKey: 'document',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'outcome')) {
      moduleStrip.push({
        href: '/kazanim-takip',
        label: 'Kazanım',
        icon: BookMarked,
        ring: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100',
        marketKey: 'outcome',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'teacher_agenda')) {
      moduleStrip.push({
        href: '/ogretmen-ajandasi',
        label: 'Ajanda',
        icon: NotebookPen,
        ring: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100',
        marketKey: 'teacher_agenda',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'smart_board')) {
      moduleStrip.push({
        href: '/akilli-tahta',
        label: 'Tahta',
        icon: Monitor,
        ring: 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100',
        marketKey: 'smart_board',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'school_reviews')) {
      moduleStrip.push({
        href: '/okul-degerlendirmeleri',
        label: 'Okul',
        icon: Star,
        ring: 'bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100',
        marketKey: 'school_reviews',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'butterfly_exam')) {
      moduleStrip.push({
        href: '/kelebek-sinav/ogrenci-sorgu',
        label: 'Kertenkele',
        icon: Bug,
        ring: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
        marketKey: 'butterfly_exam',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'sorumluluk_sinav')) {
      moduleStrip.push({
        href: '/sorumluluk-sinav/bilgilendirme',
        label: 'Beceri',
        icon: Medal,
        ring: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-100',
        marketKey: 'sorumluluk_sinav',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'messaging')) {
      moduleStrip.push({
        href: '/mesaj-merkezi',
        label: 'Mesaj',
        icon: MessageSquare,
        ring: 'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-100',
        marketKey: 'messaging',
      });
    }

    const tail: TeacherHomeTopShortcut[] = [];
    if (isSchoolModuleEnabled(enabledModules, 'optical')) {
      tail.push({
        href: '/optik-formlar',
        label: 'Optik',
        icon: ScanBarcode,
        ring: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-100',
        marketKey: 'optical',
      });
    }
    if (isSchoolModuleEnabled(enabledModules, 'bilsem')) {
      tail.push({
        href: '/bilsem/takvim',
        label: 'Bilsem',
        icon: GraduationCap,
        ring: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-100',
        marketKey: 'bilsem',
      });
    }
    tail.push({
      href: '/market',
      label: 'Market',
      icon: ShoppingBag,
      ring: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-100',
    });

    return [...items, ...moduleStrip, ...tail];
  }, [dutyEnabled, enabledModules]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-2 px-3 pb-6 pt-0 sm:space-y-6 sm:px-4 sm:pb-8 lg:px-2">
      <nav
        aria-label="Sayfa bölümleri"
        className="sticky top-0 z-20 -mx-1 border-b border-border/30 bg-background/85 py-1.5 backdrop-blur-xl supports-backdrop-filter:bg-background/70 dark:border-white/10 dark:bg-zinc-950/80 sm:mx-0 sm:mb-1 sm:rounded-b-2xl sm:border sm:border-border/40 sm:px-1 sm:py-2.5 sm:shadow-sm"
      >
        <div className="mx-auto flex max-w-7xl justify-center px-1 sm:px-3">
          <div
            className={cn(
              'grid w-full max-w-md grid-cols-4 gap-0.5 rounded-2xl border border-border/50 bg-muted/40 p-0.5 shadow-inner',
              'dark:border-white/10 dark:bg-zinc-900/60',
              'sm:max-w-2xl sm:gap-1 sm:p-1.5',
            )}
          >
            {TEACHER_HOME_NAV_SECTIONS.map(({ id, label, Icon }) => {
              const isActive = activeSectionId === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(id);
                  }}
                  className={cn(
                    'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-center transition-all duration-200',
                    'sm:min-h-0 sm:flex-row sm:gap-2 sm:px-2 sm:py-2.5',
                    isActive
                      ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md ring-1 ring-orange-400/40 dark:from-orange-600 dark:to-amber-700 dark:ring-orange-500/30'
                      : 'text-muted-foreground hover:bg-background/90 hover:text-foreground active:scale-[0.98] dark:hover:bg-zinc-800/90',
                  )}
                >
                  <Icon
                    className={cn('size-4 shrink-0 sm:size-[1.125rem]', isActive ? 'text-white' : 'opacity-80')}
                    strokeWidth={isActive ? 2.25 : 1.85}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'max-w-full truncate text-[10px] font-semibold leading-none tracking-tight sm:text-xs',
                      isActive && 'font-bold',
                    )}
                  >
                    {label}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </nav>

      <section
        id="teacher-hero"
        aria-labelledby="teacher-home-greeting-heading"
        className="scroll-mt-[4.75rem] sm:scroll-mt-24 relative w-full min-w-0 overflow-hidden rounded-3xl border border-white/50 shadow-[0_20px_50px_-18px_rgba(249,115,22,0.28),0_0_0_1px_rgba(255,255,255,0.08)_inset] dark:border-white/10 dark:shadow-[0_20px_50px_-18px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:rounded-[1.75rem]"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-100/90 via-fuchsia-50/50 to-violet-100/80 dark:from-orange-950/40 dark:via-zinc-950 dark:to-violet-950/50"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[18rem] w-[18rem] rounded-full bg-gradient-to-br from-orange-400/45 to-amber-300/25 blur-3xl dark:from-orange-500/20 dark:to-amber-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-[16rem] w-[16rem] rounded-full bg-gradient-to-tr from-violet-500/30 to-fuchsia-400/20 blur-3xl dark:from-violet-600/15 dark:to-fuchsia-600/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239333ea' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />

        <div className="relative z-10 px-4 pb-4 pt-4 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-1 gap-3.5 sm:gap-5">
              <div
                className={cn(
                  'relative flex size-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-3xl text-white shadow-[0_20px_40px_-12px_rgba(249,115,22,0.55)] ring-2 ring-white/50 sm:size-[4.75rem] sm:rounded-[1.35rem] dark:ring-white/10',
                  schoolApproved
                    ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 shadow-[0_20px_40px_-12px_rgba(16,185,129,0.45)]'
                    : 'bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600 text-xl font-bold tracking-tight sm:text-2xl',
                )}
                role={schoolApproved ? 'img' : undefined}
                aria-hidden={!schoolApproved}
                aria-label={
                  schoolApproved
                    ? `Okul onaylı öğretmen${me.school?.name ? ` — ${me.school.name}` : ''}`
                    : undefined
                }
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-white/20 opacity-90"
                  aria-hidden
                />
                {schoolApproved ? (
                  <BadgeCheck className="relative z-1 size-9 text-white drop-shadow-md sm:size-12" strokeWidth={2} aria-hidden />
                ) : (
                  <span className="relative z-1 text-lg drop-shadow-sm sm:text-2xl" aria-hidden>
                    {initialsFromDisplayName(displayName)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  id="teacher-home-greeting-heading"
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700/90 sm:text-[11px] sm:tracking-[0.2em] dark:text-orange-300/90"
                >
                  {greetingTr()}
                </p>
                <h1 className="mt-1.5 break-words text-balance bg-gradient-to-r from-orange-700 via-amber-700 to-violet-700 bg-clip-text text-xl font-extrabold leading-tight tracking-tight text-transparent dark:from-orange-200 dark:via-amber-200 dark:to-violet-200 sm:mt-2 sm:text-3xl">
                  {displayName}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
                  <time
                    dateTime={new Date().toISOString()}
                    className="inline-flex max-w-full items-center rounded-full border border-white/60 bg-white/50 px-2 py-1 text-[10px] font-medium leading-tight text-foreground/80 shadow-sm backdrop-blur-sm sm:px-2.5 sm:text-[11px] dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                  >
                    <span className="line-clamp-2 sm:line-clamp-none">{formatTodayTr()}</span>
                  </time>
                  {me.school?.name ? (
                    <span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-violet-200/60 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold leading-tight text-violet-900 backdrop-blur-sm sm:px-2.5 sm:text-[11px] dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-100">
                      <span className="min-w-0 truncate">{me.school.name}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <nav
              aria-label="Hızlı bağlantılar"
              className="flex w-full min-w-0 shrink-0 justify-between gap-1 self-stretch rounded-2xl border border-white/40 bg-white/35 p-2 shadow-lg shadow-orange-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40 sm:w-auto sm:justify-end sm:gap-2 sm:self-center sm:p-1.5"
            >
              {welcomeQuote.showReopenTrigger && (
                <button
                  type="button"
                  title="Bugünün sözünü göster"
                  onClick={welcomeQuote.reopenBanner}
                  className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl text-violet-700 transition-all active:scale-95 hover:scale-[1.02] hover:bg-violet-500/15 sm:size-12 sm:flex-none sm:hover:scale-105 dark:text-violet-300 dark:hover:bg-violet-500/20"
                >
                  <Quote className="size-5" strokeWidth={2} />
                  <span className="sr-only">Bugünün sözü</span>
                </button>
              )}
              <Link
                href="/bildirimler"
                title="Bildirimler"
                className={cn(
                  'relative inline-flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl text-muted-foreground transition-all active:scale-95 hover:scale-[1.02] hover:bg-white/80 sm:size-12 sm:flex-none sm:hover:scale-105 dark:hover:bg-zinc-800/80',
                  allNotificationsUnread > 0 &&
                    'bg-indigo-500/15 text-indigo-900 ring-1 ring-indigo-300/50 dark:bg-indigo-500/20 dark:text-indigo-100 dark:ring-indigo-500/30',
                )}
              >
                <Bell className="size-5" strokeWidth={2} />
                <span className="sr-only">Bildirimler</span>
                {allNotificationsUnread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.125rem] justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white shadow-md dark:bg-indigo-500">
                    {allNotificationsUnread > 99 ? '99+' : allNotificationsUnread}
                  </span>
                )}
              </Link>
              <Link
                href="/market"
                title="Market"
                className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl text-emerald-700 transition-all active:scale-95 hover:scale-[1.02] hover:bg-emerald-500/15 sm:size-12 sm:flex-none sm:hover:scale-105 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
              >
                <ShoppingBag className="size-5" strokeWidth={2} />
                <span className="sr-only">Market</span>
              </Link>
              <Link
                href="/support"
                title="Destek"
                className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl text-sky-700 transition-all active:scale-95 hover:scale-[1.02] hover:bg-sky-500/15 sm:size-12 sm:flex-none sm:hover:scale-105 dark:text-sky-400 dark:hover:bg-sky-500/20"
              >
                <Headphones className="size-5" strokeWidth={2} />
                <span className="sr-only">Destek</span>
              </Link>
            </nav>
          </div>
        </div>
        {welcomeQuote.showEmbeddedPanel && welcomeQuote.data?.message && (
          <WelcomeMotivationQuoteEmbedded
            message={welcomeQuote.data.message}
            dateLabel={welcomeQuote.dateLabel}
            onDismiss={welcomeQuote.dismissBanner}
            embeddedClassName="relative z-10 border-t border-white/30 bg-white/25 backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/40"
          />
        )}
      </section>

      <TeacherSchoolJoinBanner me={me} />

      <div
        id="hizli-erisim"
        className="scroll-mt-[4.75rem] sm:scroll-mt-24 rounded-[1.15rem] border-2 border-violet-200/60 bg-gradient-to-b from-violet-50/90 to-white p-3 shadow-inner dark:border-violet-500/25 dark:from-violet-950/30 dark:to-zinc-950 sm:p-4"
      >
        <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
          {topShortcutItems.map((s) => {
            const locked = s.marketKey != null && isMarketModuleLocked(activationModules, s.marketKey);
            const href = locked ? '/market' : s.href;
            return (
              <Link
                key={`${s.href}-${s.label}`}
                href={href}
                title={locked ? `${s.label} — Market’te etkinleştirin` : s.label}
                className="flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    'relative flex size-16 items-center justify-center rounded-full shadow-md ring-2 ring-white/80 dark:ring-zinc-800',
                    s.ring,
                    locked && 'opacity-80',
                  )}
                >
                  <s.icon className="size-7" strokeWidth={1.75} />
                  {locked ? (
                    <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-white dark:ring-zinc-900">
                      <Lock className="size-3" strokeWidth={2.5} aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="max-w-[5.5rem] text-[11px] font-semibold leading-tight text-foreground">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-4 sm:space-y-6 xl:space-y-8">
      <div
        id="bugun-ozet"
        className="scroll-mt-[4.75rem] sm:scroll-mt-24 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-3"
      >
        {dutyEnabled && (
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
            <Link
              href="/duty"
              className={cn(
                'group relative flex min-h-[6.5rem] min-w-0 flex-1 flex-col justify-between gap-2 overflow-hidden rounded-2xl border p-3 transition-all duration-300 sm:min-h-[7rem] sm:p-4',
                'border-emerald-200/55 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 shadow-[0_12px_36px_-16px_rgba(16,185,129,0.28)] ring-1 ring-emerald-500/15',
                'hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-18px_rgba(16,185,129,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                'dark:border-emerald-500/35 dark:from-emerald-950/50 dark:via-zinc-950 dark:to-teal-950/30 dark:ring-emerald-500/25',
                mySlots.length > 0 &&
                  'border-emerald-300/70 from-emerald-100/80 via-emerald-50/90 to-teal-50/60 dark:from-emerald-950/60 dark:via-emerald-950/40 dark:to-teal-950/35',
                !mySlots.length && 'dark:from-zinc-900/80 dark:via-zinc-950 dark:to-zinc-950',
              )}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/10 blur-2xl dark:from-emerald-500/15 dark:to-teal-500/10"
                aria-hidden
              />
              <div className="relative z-[1] flex items-start gap-2.5 sm:gap-3">
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl shadow-lg sm:size-10',
                    mySlots.length
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-2 ring-white/50 dark:ring-emerald-400/20'
                      : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-300',
                  )}
                >
                  <CalendarClock className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-bold leading-tight text-foreground">
                    {mySlots.length ? `${mySlots.length} görev` : 'Yok'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700/90 sm:text-[11px] dark:text-emerald-300/90">
                    Nöbet
                  </p>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-emerald-600/70 transition-transform group-hover:translate-x-1 dark:text-emerald-400/80" />
              </div>
              <div className="relative z-[1] mt-2 min-w-0">
                {mySlots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {mySlots.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-emerald-200/60 bg-white/90 px-2 py-0.5 text-xs font-medium text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100"
                      >
                        <MapPin className="size-3 shrink-0" />
                        {s.area_name || s.slot_name || 'Nöbet'}
                      </span>
                    ))}
                    {mySlots.length > 2 && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        +{mySlots.length - 2}
                      </span>
                    )}
                  </div>
                )}
                {dutyMarketLocked && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                    Market’te etkinleştirme gerekir
                  </p>
                )}
              </div>
            </Link>

            <Link
              href="/bildirimler"
              className="group relative flex shrink-0 flex-col gap-1 overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/95 via-white to-violet-50/45 p-3 shadow-[0_10px_28px_-14px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/15 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgba(99,102,241,0.38)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-indigo-500/40 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-violet-950/30 dark:ring-indigo-500/20 sm:p-3.5"
            >
              <div
                className="pointer-events-none absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-400/25 to-violet-400/10 blur-2xl dark:from-indigo-500/12 dark:to-violet-500/10"
                aria-hidden
              />
              <div className="relative z-[1] flex items-start gap-2.5 sm:gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md ring-2 ring-white/35 dark:ring-indigo-400/25 sm:size-9">
                  <Bell className="size-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-bold text-indigo-950 dark:text-indigo-50">Bildirimler</p>
                  <p className="text-[10px] font-medium text-indigo-800/90 dark:text-indigo-200/85 sm:text-[11px]">
                    {allNotificationsUnread > 0 ? 'Okunmamış var' : 'Tümü güncel'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  {allNotificationsUnread > 0 ? (
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm dark:bg-indigo-500">
                      {allNotificationsUnread > 99 ? '99+' : allNotificationsUnread}
                    </span>
                  ) : null}
                  <ArrowRight className="size-4 shrink-0 text-indigo-600/75 transition-transform group-hover:translate-x-0.5 dark:text-indigo-300/90" />
                </div>
              </div>
            </Link>
          </div>
        )}

        {belirliGunAssignments.length > 0 ? (
          <div
            className={cn(
              'relative flex h-full min-h-[7.25rem] min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-rose-50/40 p-3 shadow-[0_12px_36px_-16px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/20 dark:border-amber-500/40 dark:from-amber-950/55 dark:via-orange-950/35 dark:to-rose-950/25 dark:ring-amber-500/25 sm:min-h-[7.5rem] sm:p-4',
              !dutyEnabled && 'sm:col-span-2',
            )}
          >
            <div
              className="pointer-events-none absolute -left-8 -bottom-12 h-36 w-36 rounded-full bg-gradient-to-tr from-amber-400/35 to-orange-400/15 blur-2xl dark:from-amber-500/15 dark:to-orange-500/10"
              aria-hidden
            />
            <div className="relative z-[1] flex shrink-0 items-start gap-2.5 sm:gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white shadow-lg ring-2 ring-white/40 dark:ring-amber-400/25 sm:size-10">
                <Award className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold leading-tight text-amber-950 dark:text-amber-50">
                  {belirliGunAssignments.length} görev
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800/95 dark:text-amber-200/95 sm:text-[11px]">
                  Belirli gün
                </p>
              </div>
              <Link
                href="/akademik-takvim#akademik-takvim-icerik"
                className="mt-0.5 shrink-0 rounded-lg p-1 text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/10"
                aria-label="Akademik takvime git"
              >
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
              <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                {belirliGunAssignments.map((a) => {
                  const href =
                    a.weekDateStart != null && /^\d{4}-\d{2}-\d{2}$/.test(a.weekDateStart)
                      ? `/akademik-takvim?hafta=${encodeURIComponent(a.weekDateStart)}#akademik-takvim-icerik`
                      : '/akademik-takvim#akademik-takvim-icerik';
                  return (
                    <li key={a.id} className="shrink-0">
                      <Link
                        href={href}
                        className="flex w-full min-w-0 items-start gap-2 rounded-lg border border-amber-200/70 bg-white/90 px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-amber-950 shadow-sm transition-colors hover:border-amber-400/80 hover:bg-amber-50/90 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-950/65 sm:text-xs"
                      >
                        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-600/80 dark:text-amber-400/90" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2">{a.itemTitle}</span>
                          {a.weekLabel ? (
                            <span className="mt-0.5 block line-clamp-1 text-[10px] font-normal text-amber-800/85 dark:text-amber-200/75">
                              {a.weekLabel}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'relative flex min-h-[7.25rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/50 p-3 text-center shadow-inner ring-1 ring-violet-300/15 dark:border-violet-500/30 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/20 dark:ring-violet-500/15 sm:min-h-[7.5rem] sm:p-4',
              !dutyEnabled && 'sm:col-span-2',
            )}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 30%, rgba(139,92,246,0.18), transparent 45%), radial-gradient(circle at 80% 70%, rgba(217,70,239,0.12), transparent 40%)`,
              }}
              aria-hidden
            />
            <p className="relative z-[1] text-sm font-bold text-violet-900 dark:text-violet-100">Belirli gün yok</p>
            <Link
              href="/akademik-takvim"
              className="relative z-[1] mt-2.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-fuchsia-500"
            >
              Takvim
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>

      <div id="tum-moduller" className="scroll-mt-[4.75rem] sm:scroll-mt-24 space-y-5">
        <div className="space-y-1">
          <h2 className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-cyan-300">
            Tüm araçlar
          </h2>
          <p className="text-sm text-muted-foreground">Okulünüzde açık olan modüller listelenir.</p>
        </div>
        <div className="space-y-6">
          {quickSections.map((sec, secIdx) => {
            const theme = TEACHER_HOME_SECTION_THEMES[secIdx % TEACHER_HOME_SECTION_THEMES.length]!;
            return (
            <nav
              key={sec.label}
              aria-label={sec.label}
              className={theme.nav}
            >
              <h3 className={theme.header}>
                {sec.label}
              </h3>
              <ul
                className={cn(
                  'grid gap-2.5 bg-white/25 p-2.5 backdrop-blur-[2px] sm:gap-3 sm:p-3.5 dark:bg-zinc-950/20',
                  sec.items.length === 1
                    ? 'grid-cols-1'
                    : 'grid-cols-2 lg:grid-cols-3',
                )}
              >
                {sec.items.map((item) => {
                  const mk = marketKeyForQuickItem(item);
                  const itemLocked = isMarketModuleLocked(activationModules, mk);
                  const cm = item.compactMobile;
                  return (
                    <li key={`${sec.label}-${item.href}`} className="min-w-0">
                      <Link
                        href={item.href}
                        className={cn(
                          'group relative flex h-full min-h-[7.25rem] flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br from-white/98 via-white to-slate-50/90 p-2.5 shadow-md transition-all duration-200',
                          cm && 'max-sm:min-h-[5.75rem] max-sm:rounded-xl max-sm:p-2',
                          'active:scale-[0.99] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'dark:from-zinc-900/95 dark:via-zinc-900 dark:to-zinc-950/95',
                          theme.itemHover,
                        )}
                      >
                        <div
                          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-white/80 to-transparent opacity-60 blur-xl dark:from-white/5"
                          aria-hidden
                        />
                        <div className="relative z-[1] flex items-start justify-between gap-1">
                          <div
                            className={cn(
                              'flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ring-2 ring-white/60 dark:ring-zinc-800/80 sm:size-11',
                              cm && 'max-sm:size-8 max-sm:rounded-lg max-sm:shadow',
                              item.accent,
                            )}
                          >
                            <item.icon
                              className={cn('size-[1.1rem] sm:size-5', cm && 'max-sm:size-4')}
                              strokeWidth={1.85}
                            />
                          </div>
                          <ChevronRight
                            className={cn(
                              'size-3.5 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-foreground sm:size-4',
                              cm && 'max-sm:size-3',
                            )}
                            aria-hidden
                          />
                        </div>
                        <div className={cn('relative z-[1] min-w-0 pt-1', cm && 'max-sm:pt-0.5')}>
                          <span
                            className={cn(
                              'line-clamp-2 text-[13px] font-bold leading-snug text-foreground sm:text-sm',
                              cm && 'max-sm:text-[12px] max-sm:leading-tight',
                            )}
                          >
                            {item.title}
                          </span>
                          <p
                            className={cn(
                              'mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:text-[11px]',
                              cm && 'max-sm:mt-0.5 max-sm:line-clamp-1',
                            )}
                          >
                            {item.desc}
                          </p>
                          {itemLocked ? (
                            <span className="mt-1.5 inline-flex items-center gap-0.5 rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <Lock className="size-2.5 shrink-0" aria-hidden />
                              Kilitli
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            );
          })}
        </div>
      </div>

      {dutyEnabled && (
        <Card className="overflow-hidden rounded-[1.25rem] border border-teal-200/55 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 shadow-[0_16px_48px_-24px_rgba(20,184,166,0.35)] ring-1 ring-teal-400/20 dark:border-teal-500/35 dark:from-emerald-950/45 dark:via-zinc-950 dark:to-teal-950/30 dark:ring-teal-500/20 sm:rounded-3xl">
          <CardHeader className="relative border-b border-teal-200/45 bg-gradient-to-r from-emerald-100/90 via-teal-50/70 to-cyan-50/40 py-4 dark:border-teal-500/25 dark:from-emerald-950/70 dark:via-teal-950/45 dark:to-cyan-950/25">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(45,212,191,0.2),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_100%_0%,rgba(45,212,191,0.12),transparent_55%)]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold text-emerald-950 dark:text-emerald-50">
                <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-2 ring-white/40 dark:ring-emerald-400/20">
                  <CalendarCheck className="size-5" strokeWidth={2} />
                </span>
                Nöbet tercihleri ve takas
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/duty/tercihler"
                  className="rounded-full border border-emerald-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950/70"
                >
                  Tercihler
                </Link>
                <Link
                  href="/duty/takas"
                  className="rounded-full border border-teal-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-teal-900 shadow-sm transition hover:border-teal-400 hover:bg-teal-50 dark:border-teal-500/40 dark:bg-teal-950/50 dark:text-teal-100 dark:hover:bg-teal-950/70"
                >
                  Takas
                </Link>
                <Link
                  href="/duty"
                  className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500"
                >
                  Nöbet özeti
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {teacherPrefs.length === 0 && teacherSwaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz kayıt yok.{' '}
                <Link href="/duty/tercihler" className="font-medium text-primary hover:underline">
                  Tercih ekle
                </Link>{' '}
                veya{' '}
                <Link href="/duty/takas" className="font-medium text-primary hover:underline">
                  takas talebi
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Son tercihler</p>
                  {teacherPrefs.length > 0 ? (
                    <ul className="space-y-2">
                      {teacherPrefs.map((p) => {
                        const statusConfig = {
                          available: { icon: CheckCircle2, label: 'Müsait', className: 'text-emerald-600 dark:text-emerald-400' },
                          unavailable: { icon: XCircle, label: 'Müsait değil', className: 'text-rose-600 dark:text-rose-400' },
                          prefer: { icon: Star, label: 'Tercih', className: 'text-blue-600 dark:text-blue-400' },
                        };
                        const cfg =
                          statusConfig[p.status as keyof typeof statusConfig] ?? {
                            icon: Clock,
                            label: p.status,
                            className: 'text-muted-foreground',
                          };
                        const Icon = cfg.icon;
                        return (
                          <li
                            key={p.id ?? p.date}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                          >
                            <span className="tabular-nums text-foreground">
                              {new Date(p.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', cfg.className)}>
                              <Icon className="size-3.5" />
                              {cfg.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <Link href="/duty/tercihler" className="text-primary hover:underline">
                        Tercih ekleyin
                      </Link>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Takas</p>
                  {teacherSwaps.length > 0 ? (
                    <ul className="space-y-2">
                      {teacherSwaps.map((s) => {
                        const cfg =
                          s.status === 'approved'
                            ? { icon: CheckCircle2, label: 'Onaylandı' }
                            : s.status === 'rejected'
                              ? { icon: XCircle, label: 'Reddedildi' }
                              : s.status === 'reverted'
                                ? { icon: Undo2, label: 'Geri alındı' }
                                : { icon: Clock, label: 'Bekliyor' };
                        const Icon = cfg.icon;
                        return (
                          <li
                            key={s.id}
                            className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="truncate text-foreground">
                              {s.duty_slot?.date
                                ? new Date(s.duty_slot.date + 'T12:00:00').toLocaleDateString('tr-TR', {
                                    day: 'numeric',
                                    month: 'short',
                                  })
                                : '—'}
                              <span className="text-muted-foreground"> → </span>
                              {s.proposedUser?.display_name || s.proposedUser?.email || '—'}
                            </span>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 text-xs font-medium',
                                s.status === 'approved' && 'text-emerald-600 dark:text-emerald-400',
                                s.status === 'rejected' && 'text-rose-600 dark:text-rose-400',
                                s.status === 'reverted' && 'text-slate-600 dark:text-slate-400',
                                s.status === 'pending' && 'text-amber-600 dark:text-amber-400',
                              )}
                            >
                              <Icon className="size-3.5" />
                              {cfg.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <Link href="/duty/takas" className="text-primary hover:underline">
                        Takas oluştur
                      </Link>
                    </p>
                  )}
                  {teacherSwaps.length > 0 && (
                    <Link href="/duty/takas" className="inline-block text-xs font-medium text-primary hover:underline">
                      Tümünü gör →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
