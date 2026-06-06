'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Me } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Headphones,
  Inbox,
  LayoutGrid,
  Mail,
  Megaphone,
  MessageSquare,
  Monitor,
  Newspaper,
  ScanLine,
  School,
  Settings,
  ShoppingBag,
  Sparkles,
  Table2,
  Tv,
  Users,
  Calculator,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WelcomeMotivationBanner } from '@/components/dashboard/welcome-motivation-banner';
import type { SchoolAdminStatsPayload, StatsResponse } from '@/lib/stats-response';
import type { SchoolModuleKey } from '@/config/school-modules';

function isModuleEnabled(enabledModules: string[] | null | undefined, moduleKey: string): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(moduleKey);
}

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
  }).format(new Date());
}

const MODULE_CATALOG: {
  key: SchoolModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
  ring: string;
}[] = [
  { key: 'duty', label: 'Nöbet', href: '/duty', icon: CalendarClock, ring: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200' },
  { key: 'tv', label: 'Duyuru TV', href: '/tv', icon: Tv, ring: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200' },
  { key: 'extra_lesson', label: 'Hesaplamalar', href: '/hesaplamalar', icon: Calculator, ring: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200' },
  { key: 'optical', label: 'Optik', href: '/optik-formlar', icon: ScanLine, ring: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200' },
  { key: 'smart_board', label: 'Akıllı tahta', href: '/akilli-tahta', icon: Monitor, ring: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200' },
  { key: 'teacher_agenda', label: 'Ajanda', href: '/ogretmen-ajandasi', icon: ClipboardList, ring: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200' },
  { key: 'bilsem', label: 'Bilsem', href: '/bilsem/takvim', icon: School, ring: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200' },
  { key: 'school_reviews', label: 'Değerlendirme', href: '/school-reviews-report', icon: BarChart3, ring: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200' },
  { key: 'messaging', label: 'Mesaj', href: '/mesaj-merkezi', icon: MessageSquare, ring: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
  { key: 'butterfly_exam', label: 'Kelebek', href: '/kelebek-sinav', icon: LayoutGrid, ring: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-200' },
  { key: 'sorumluluk_sinav', label: 'Sorumluluk', href: '/sorumluluk-sinav', icon: GraduationCap, ring: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200' },
  { key: 'ders_dagit', label: 'DersDağıt', href: '/ders-dagit/studyo', icon: Sparkles, ring: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200' },
];

const SECTION_THEMES = [
  {
    nav: 'overflow-hidden rounded-2xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/95 via-white to-sky-50/45 shadow-[0_10px_32px_-18px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/15 dark:border-cyan-500/35 dark:from-cyan-950/50 dark:via-zinc-950 dark:to-sky-950/25',
    header:
      'border-b border-cyan-200/55 bg-gradient-to-r from-cyan-100/95 via-sky-50/65 to-transparent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-950 sm:px-4 sm:py-3 sm:text-[11px] dark:border-cyan-500/30 dark:from-cyan-950/85 dark:text-cyan-50',
    itemHover: 'border-slate-200/75 hover:border-cyan-400/45 hover:shadow-[0_12px_28px_-12px_rgba(6,182,212,0.2)] dark:border-zinc-700/70 dark:hover:border-cyan-500/40',
  },
  {
    nav: 'overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/40 shadow-[0_10px_32px_-18px_rgba(139,92,246,0.22)] ring-1 ring-violet-400/15 dark:border-violet-500/35 dark:from-violet-950/45 dark:via-zinc-950 dark:to-fuchsia-950/25',
    header:
      'border-b border-violet-200/55 bg-gradient-to-r from-violet-100/95 via-fuchsia-50/60 to-transparent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-950 sm:px-4 sm:py-3 sm:text-[11px] dark:border-violet-500/30 dark:from-violet-950/85 dark:text-violet-50',
    itemHover: 'border-slate-200/75 hover:border-violet-400/45 hover:shadow-[0_12px_28px_-12px_rgba(139,92,246,0.18)] dark:border-zinc-700/70 dark:hover:border-violet-500/40',
  },
  {
    nav: 'overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/40 shadow-[0_10px_32px_-18px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/15 dark:border-emerald-500/35 dark:from-emerald-950/45 dark:via-zinc-950 dark:to-teal-950/25',
    header:
      'border-b border-emerald-200/55 bg-gradient-to-r from-emerald-100/95 via-teal-50/60 to-transparent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-950 sm:px-4 sm:py-3 sm:text-[11px] dark:border-emerald-500/30 dark:from-emerald-950/85 dark:text-emerald-50',
    itemHover: 'border-slate-200/75 hover:border-emerald-400/45 hover:shadow-[0_12px_28px_-12px_rgba(16,185,129,0.18)] dark:border-zinc-700/70 dark:hover:border-emerald-500/40',
  },
  {
    nav: 'overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40 shadow-[0_10px_32px_-18px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/15 dark:border-amber-500/35 dark:from-amber-950/40 dark:via-zinc-950 dark:to-orange-950/25',
    header:
      'border-b border-amber-200/55 bg-gradient-to-r from-amber-100/95 via-orange-50/60 to-transparent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-950 sm:px-4 sm:py-3 sm:text-[11px] dark:border-amber-500/30 dark:from-amber-950/85 dark:text-amber-50',
    itemHover: 'border-slate-200/75 hover:border-amber-400/45 hover:shadow-[0_12px_28px_-12px_rgba(245,158,11,0.16)] dark:border-zinc-700/70 dark:hover:border-amber-500/40',
  },
  {
    nav: 'overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-br from-rose-50/95 via-white to-pink-50/40 shadow-[0_10px_32px_-18px_rgba(244,63,94,0.16)] ring-1 ring-rose-400/15 dark:border-rose-500/35 dark:from-rose-950/40 dark:via-zinc-950 dark:to-pink-950/25',
    header: 'border-b border-rose-200/55 bg-gradient-to-r from-rose-100/95 via-pink-50/60 to-transparent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-950 sm:px-4 sm:py-3 sm:text-[11px] dark:border-rose-500/30 dark:from-rose-950/85 dark:text-rose-50',
    itemHover: 'border-slate-200/75 hover:border-rose-400/45 dark:border-zinc-700/70 dark:hover:border-rose-500/40',
  },
  {
    nav: 'overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/95 via-white to-blue-50/40 shadow-[0_10px_32px_-18px_rgba(99,102,241,0.22)] ring-1 ring-indigo-400/15 dark:border-indigo-500/35 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-blue-950/25',
    header:
      'border-b border-indigo-200/55 bg-gradient-to-r from-indigo-100/95 via-blue-50/60 to-transparent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-950 sm:px-4 sm:py-3 sm:text-[11px] dark:border-indigo-500/30 dark:from-indigo-950/85 dark:text-indigo-50',
    itemHover: 'border-slate-200/75 hover:border-indigo-400/45 hover:shadow-[0_12px_28px_-12px_rgba(99,102,241,0.18)] dark:border-zinc-700/70 dark:hover:border-indigo-500/40',
  },
] as const;

type CoreLink = { label: string; href: string; icon: LucideIcon; hint: string; accent: string; moduleKey?: SchoolModuleKey };

const QUICK_SECTIONS: { label: string; theme: (typeof SECTION_THEMES)[number]; items: CoreLink[] }[] = [
  {
    label: 'Okul yönetimi',
    theme: SECTION_THEMES[2]!,
    items: [
      { label: 'Öğretmenler', href: '/teachers', icon: Users, hint: 'Liste ve roller', accent: 'from-emerald-500 to-teal-600' },
      { label: 'Onay kuyruğu', href: '/school-join-queue', icon: ClipboardCheck, hint: 'Başvuru bekleyenler', accent: 'from-amber-500 to-orange-600' },
      { label: 'Sınıflar ve dersler', href: '/classes-subjects', icon: BookOpen, hint: 'Şube yapısı', accent: 'from-blue-500 to-indigo-600' },
      { label: 'Duyurular', href: '/announcements', icon: Megaphone, hint: 'Okul panosu', accent: 'from-violet-500 to-purple-600' },
      { label: 'Okul değerlendirmesi', href: '/school-reviews-report', icon: BarChart3, hint: 'Veli geri bildirimi', accent: 'from-orange-500 to-rose-600' },
    ],
  },
  {
    label: 'Takvim ve program',
    theme: SECTION_THEMES[0]!,
    items: [
      { label: 'Ders programı', href: '/ders-programi', icon: Table2, hint: 'Günlük tablo', accent: 'from-cyan-500 to-sky-600' },
      { label: 'Akademik takvim', href: '/akademik-takvim', icon: Calendar, hint: 'Yıllık görünüm', accent: 'from-sky-500 to-blue-600' },
      { label: 'Takvim ayarları', href: '/akademik-takvim-ayarlar', icon: CalendarClock, hint: 'Tatil ve dönemler', accent: 'from-teal-500 to-emerald-600' },
    ],
  },
  {
    label: 'İletişim ve hesap',
    theme: SECTION_THEMES[5]!,
    items: [
      { label: 'Sistem mesajları', href: '/system-messages', icon: Mail, hint: 'Merkez duyuruları', accent: 'from-indigo-500 to-violet-600' },
      { label: 'Bildirimler', href: '/bildirimler', icon: Bell, hint: 'Uyarılar', accent: 'from-violet-500 to-fuchsia-600' },
      { label: 'Mesaj merkezi', href: '/mesaj-merkezi', icon: MessageSquare, hint: 'WhatsApp şablonları', accent: 'from-green-500 to-emerald-600', moduleKey: 'messaging' },
      { label: 'Destek kutusu', href: '/support/inbox', icon: Inbox, hint: 'Gelen talepler', accent: 'from-sky-500 to-cyan-600' },
      { label: 'Haberler', href: '/haberler', icon: Newspaper, hint: 'Okul vitrini', accent: 'from-amber-500 to-yellow-600' },
      { label: 'Market', href: '/market', icon: ShoppingBag, hint: 'Jeton ve içerik', accent: 'from-emerald-500 to-green-600' },
      { label: 'Hesap ayarları', href: '/settings', icon: Settings, hint: 'Profil ve güvenlik', accent: 'from-slate-500 to-zinc-600' },
    ],
  },
];

const KPI_THEMES = {
  emerald: {
    card: 'border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/50 shadow-[0_8px_28px_-14px_rgba(16,185,129,0.28)] ring-1 ring-emerald-400/15 dark:border-emerald-500/35 dark:from-emerald-950/50 dark:via-zinc-950 dark:to-teal-950/30',
    glow: 'from-emerald-400/30 to-teal-400/10',
    icon: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-2 ring-white/50 dark:ring-emerald-400/20',
    label: 'text-emerald-800/90 dark:text-emerald-300/90',
  },
  amber: {
    card: 'border-amber-200/60 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/45 shadow-[0_8px_28px_-14px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/15 dark:border-amber-500/35 dark:from-amber-950/45 dark:via-zinc-950 dark:to-orange-950/30',
    glow: 'from-amber-400/30 to-orange-400/10',
    icon: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md ring-2 ring-white/50 dark:ring-amber-400/20',
    label: 'text-amber-800/90 dark:text-amber-300/90',
  },
  violet: {
    card: 'border-violet-200/60 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/45 shadow-[0_8px_28px_-14px_rgba(139,92,246,0.22)] ring-1 ring-violet-400/15 dark:border-violet-500/35 dark:from-violet-950/45 dark:via-zinc-950 dark:to-fuchsia-950/30',
    glow: 'from-violet-400/30 to-fuchsia-400/10',
    icon: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md ring-2 ring-white/50 dark:ring-violet-400/20',
    label: 'text-violet-800/90 dark:text-violet-300/90',
  },
  indigo: {
    card: 'border-indigo-200/60 bg-gradient-to-br from-indigo-50/95 via-white to-blue-50/45 shadow-[0_8px_28px_-14px_rgba(99,102,241,0.22)] ring-1 ring-indigo-400/15 dark:border-indigo-500/35 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-blue-950/30',
    glow: 'from-indigo-400/30 to-blue-400/10',
    icon: 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md ring-2 ring-white/50 dark:ring-indigo-400/20',
    label: 'text-indigo-800/90 dark:text-indigo-300/90',
  },
} as const;

type SuggestedAction = { href: string; title: string; hint: string; icon: LucideIcon; emphasis?: boolean };

function buildSuggestedActions(
  sa: SchoolAdminStatsPayload | undefined,
  enabledModules: string[] | null,
): SuggestedAction[] {
  if (!sa) return [];
  const pending = sa.teachers_pending_approval ?? 0;
  const suspended = sa.users_by_status?.suspended ?? 0;
  const dynamic: SuggestedAction[] = [];
  if (pending > 0) {
    dynamic.push({ href: '/school-join-queue', title: `${pending} öğretmen onayı bekliyor`, hint: 'Başvuruları inceleyin', icon: ClipboardCheck, emphasis: true });
  }
  if (suspended > 0) {
    dynamic.push({ href: '/teachers', title: `${suspended} askıda hesap`, hint: 'Kullanıcı listesinden kontrol edin', icon: AlertTriangle, emphasis: true });
  }
  const pool: SuggestedAction[] = [
    { href: '/akademik-takvim', title: 'Akademik takvimi aç', hint: 'Tatil ve dönem tarihleri', icon: Calendar },
    { href: '/announcements', title: 'Duyuru hazırla', hint: 'Okul panosu', icon: Megaphone },
    { href: '/classes-subjects', title: 'Sınıf ve ders yapısı', hint: 'Şubeleri güncel tutun', icon: BookOpen },
    { href: '/ders-programi', title: 'Ders programı', hint: 'Günlük tablo', icon: Table2 },
  ];
  if (isModuleEnabled(enabledModules, 'messaging')) {
    pool.push({ href: '/mesaj-merkezi', title: 'Mesaj merkezi', hint: 'Veli iletişimi', icon: MessageSquare });
  }
  if (isModuleEnabled(enabledModules, 'smart_board')) {
    pool.push({ href: '/akilli-tahta?tab=kurulum', title: 'Akıllı tahta kurulumu', hint: 'QR etiket, USB', icon: Monitor });
  }
  const seen = new Set<string>();
  const merged: SuggestedAction[] = [];
  for (const a of [...dynamic, ...pool]) {
    if (seen.has(a.href)) continue;
    seen.add(a.href);
    merged.push(a);
    if (merged.length >= 4) break;
  }
  return merged;
}

function KpiTile({
  href,
  label,
  value,
  icon: Icon,
  theme,
  loading,
  error,
}: {
  href: string;
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  theme: (typeof KPI_THEMES)[keyof typeof KPI_THEMES];
  loading: boolean;
  error: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex min-h-[5.25rem] flex-col justify-between overflow-hidden rounded-2xl border p-2.5 transition-all duration-200',
        'hover:-translate-y-0.5 active:scale-[0.99] sm:min-h-[6rem] sm:p-3.5',
        theme.card,
      )}
    >
      <div className={cn('pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br blur-2xl', theme.glow)} aria-hidden />
      <div className="relative flex items-start justify-between gap-1.5">
        <p className={cn('text-[10px] font-bold uppercase tracking-wide sm:text-[11px]', theme.label)}>{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9', theme.icon)}>
          <Icon className="size-3.5 sm:size-4" strokeWidth={2} />
        </span>
      </div>
      <div className="relative mt-1">
        {loading ? (
          <Skeleton className="h-7 w-12 sm:h-8 sm:w-14" />
        ) : (
          <p className="text-2xl font-black tabular-nums tracking-tight text-foreground sm:text-3xl">{error ? '—' : value}</p>
        )}
      </div>
    </Link>
  );
}

function TopShortcut({
  href,
  label,
  icon: Icon,
  ring,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  ring: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="relative flex min-w-[4rem] shrink-0 snap-start flex-col items-center gap-1 text-center">
      <span className={cn('relative flex size-12 items-center justify-center rounded-full shadow-md ring-2 ring-white/80 dark:ring-zinc-800 sm:size-14', ring)}>
        <Icon className="size-5 sm:size-6" strokeWidth={1.75} />
        {badge != null && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1rem] justify-center rounded-full bg-indigo-600 px-0.5 text-[9px] font-bold leading-4 text-white shadow">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="max-w-[4.5rem] text-[10px] font-semibold leading-tight text-foreground sm:text-[11px]">{label}</span>
    </Link>
  );
}

export type SchoolAdminHomeProps = {
  me: Me;
  displayName: string;
  stats: StatsResponse | null;
  statsError: string | null;
  isLoadingStats: boolean;
  adminMessagesUnread: number;
  allNotificationsUnread: number;
};

export function SchoolAdminHome({
  me,
  displayName,
  stats,
  statsError,
  isLoadingStats,
  adminMessagesUnread,
  allNotificationsUnread,
}: SchoolAdminHomeProps) {
  const enabledModules = me.school?.enabled_modules ?? null;
  const sa = stats?.school_admin;
  const schoolName = me.school?.name;
  const moduleKeysUnique = [...new Set(MODULE_CATALOG.map((m) => m.key))];
  const activeCount = moduleKeysUnique.filter((k) => isModuleEnabled(enabledModules, k)).length;
  const allOpen = !enabledModules || enabledModules.length === 0;
  const suggested = buildSuggestedActions(sa, enabledModules);
  const visibleModules = MODULE_CATALOG.filter((m) => isModuleEnabled(enabledModules, m.key));
  const us = sa?.users_by_status;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-3 pb-6 pt-0 sm:space-y-5 sm:px-4 sm:pb-8 lg:px-2">
      {/* Hero */}
      <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-indigo-200/55 shadow-[0_16px_40px_-18px_rgba(99,102,241,0.28)] dark:border-indigo-500/35 dark:shadow-[0_16px_40px_-18px_rgba(0,0,0,0.5)] sm:rounded-[1.5rem]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-100/90 via-sky-50/50 to-violet-100/75 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-violet-950/40" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-gradient-to-br from-violet-400/30 to-indigo-400/20 blur-3xl dark:from-violet-600/15" aria-hidden />
        <div className="relative z-10 flex items-center gap-3 px-3.5 py-3 sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-white/40 sm:size-14">
            <Building2 className="size-6 sm:size-7" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700/90 dark:text-indigo-300/90 sm:text-[11px]">
              {greetingTr()}
            </p>
            <h1 className="truncate text-base font-extrabold tracking-tight text-indigo-950 dark:text-indigo-50 sm:text-xl">
              {displayName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <time dateTime={new Date().toISOString()} className="rounded-full border border-white/60 bg-white/50 px-2 py-0.5 text-[10px] font-medium text-foreground/80 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:text-[11px]">
                {formatTodayTr()}
              </time>
              {schoolName && (
                <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full border border-indigo-300/50 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-900 dark:border-indigo-500/30 dark:text-indigo-100 sm:max-w-none sm:text-[11px]">
                  <Building2 className="size-3 shrink-0" />
                  {schoolName}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <KpiTile href="/teachers" label="Öğretmen" value={sa?.users_by_role?.teacher ?? 0} icon={Users} theme={KPI_THEMES.emerald} loading={isLoadingStats} error={Boolean(statsError)} />
        <KpiTile href="/school-join-queue" label="Onay bekleyen" value={sa?.teachers_pending_approval ?? 0} icon={UserPlus} theme={KPI_THEMES.amber} loading={isLoadingStats} error={Boolean(statsError)} />
        <KpiTile href="/announcements" label="Duyuru" value={stats?.announcements ?? 0} icon={Megaphone} theme={KPI_THEMES.violet} loading={isLoadingStats} error={Boolean(statsError)} />
        <KpiTile href="/teachers" label="Toplam hesap" value={stats?.users ?? 0} icon={Users} theme={KPI_THEMES.indigo} loading={isLoadingStats} error={Boolean(statsError)} />
      </div>

      {/* Hesap durumu */}
      {!statsError && !isLoadingStats && sa && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Aktif', value: us?.active ?? 0, cls: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100' },
            { label: 'Pasif', value: us?.passive ?? 0, cls: 'border-slate-200/70 bg-slate-50/80 text-slate-700 dark:border-zinc-600/30 dark:bg-zinc-900/50 dark:text-zinc-200' },
            { label: 'Askıda', value: us?.suspended ?? 0, cls: 'border-amber-200/70 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100' },
          ].map((c) => (
            <span key={c.label} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium sm:text-xs', c.cls)}>
              {c.label}: <strong className="font-bold tabular-nums">{c.value}</strong>
            </span>
          ))}
        </div>
      )}
      {isLoadingStats && <Skeleton className="h-7 w-48 rounded-full" />}

      {/* Kısayol şeridi */}
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [-webkit-overflow-scrolling:touch]">
        <div className="flex snap-x snap-mandatory gap-3 sm:justify-center sm:gap-4">
          <TopShortcut href="/bildirimler" label="Bildirim" icon={Bell} ring="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200" badge={allNotificationsUnread} />
          <TopShortcut href="/teachers" label="Öğretmen" icon={Users} ring="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" />
          <TopShortcut href="/school-join-queue" label="Onay" icon={ClipboardCheck} ring="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200" />
          <TopShortcut href="/announcements" label="Duyuru" icon={Megaphone} ring="bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" />
          <TopShortcut href="/ders-programi" label="Program" icon={Table2} ring="bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200" />
          <TopShortcut href="/market" label="Market" icon={ShoppingBag} ring="bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200" />
          <TopShortcut href="/settings" label="Ayarlar" icon={Settings} ring="bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200" />
          <TopShortcut href="/support" label="Destek" icon={Headphones} ring="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200" />
        </div>
      </div>

      <WelcomeMotivationBanner />

      {adminMessagesUnread > 0 && (
        <Link
          href="/system-messages"
          className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50/60 p-3 shadow-[0_8px_24px_-12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/20 transition-all hover:-translate-y-0.5 dark:border-amber-500/35 dark:from-amber-950/50 dark:via-orange-950/30 dark:to-amber-950/40 sm:p-3.5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
            <Mail className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-950 dark:text-amber-50">{adminMessagesUnread} yeni sistem mesajı</p>
            <p className="text-[11px] text-amber-800/85 dark:text-amber-200/85">Merkez iletişim kutusu</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5 dark:text-amber-300" />
        </Link>
      )}

      {statsError && <Alert message="Özet verileri yüklenemedi. Sayfayı yenileyin." />}

      {/* Önerilen + özet */}
      {(suggested.length > 0 || sa) && (
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {suggested.length > 0 && (
            <Card variant="indigo" soft className="overflow-hidden rounded-2xl border-indigo-200/50 shadow-sm dark:border-indigo-500/30">
              <CardHeader className="border-b border-indigo-200/40 bg-gradient-to-r from-indigo-50/90 to-transparent px-3 py-2.5 dark:border-indigo-500/25 dark:from-indigo-950/50 sm:px-4 sm:py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-indigo-950 dark:text-indigo-50">
                  <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
                  Önerilen adımlar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-2 py-2 sm:px-3 sm:py-3">
                {suggested.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.href}
                      href={a.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors sm:px-3',
                        a.emphasis
                          ? 'border border-amber-300/50 bg-amber-50/70 hover:bg-amber-50 dark:border-amber-500/25 dark:bg-amber-950/30 dark:hover:bg-amber-950/45'
                          : 'hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10',
                      )}
                    >
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', a.emphasis ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400')}>
                        <Icon className="size-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-foreground sm:text-sm">{a.title}</span>
                        <span className="block text-[10px] text-muted-foreground sm:text-xs">{a.hint}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card variant="teal" soft className="overflow-hidden rounded-2xl border-teal-200/50 shadow-sm dark:border-teal-500/30">
            <CardHeader className="border-b border-teal-200/40 bg-gradient-to-r from-teal-50/90 to-transparent px-3 py-2.5 dark:border-teal-500/25 dark:from-teal-950/50 sm:px-4 sm:py-3">
              <CardTitle className="text-sm font-bold text-teal-950 dark:text-teal-50">Okul özeti</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-4 sm:gap-3">
              {isLoadingStats
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
                : [
                    { label: 'Öğretmen', value: sa?.users_by_role?.teacher ?? 0 },
                    { label: 'Onay bekleyen', value: sa?.teachers_pending_approval ?? 0 },
                    { label: 'Duyuru', value: stats?.announcements ?? 0 },
                    { label: 'Toplam', value: stats?.users ?? 0 },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl border border-teal-200/40 bg-white/60 px-2 py-2 text-center dark:border-teal-500/20 dark:bg-zinc-900/40 sm:px-3 sm:py-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{statsError ? '—' : c.value}</p>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hızlı erişim — temalı bölümler */}
      <div className="space-y-3 sm:space-y-4">
        <h2 className="bg-gradient-to-r from-indigo-700 via-violet-600 to-cyan-600 bg-clip-text text-base font-extrabold tracking-tight text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-300 sm:text-lg">
          Yönetim araçları
        </h2>
        {QUICK_SECTIONS.map((sec) => {
          const items = sec.items.filter((l) => !l.moduleKey || isModuleEnabled(enabledModules, l.moduleKey));
          if (items.length === 0) return null;
          const theme = sec.theme;
          return (
            <nav key={sec.label} aria-label={sec.label} className={theme.nav}>
              <h3 className={theme.header}>{sec.label}</h3>
              <ul className="grid grid-cols-2 gap-2 bg-white/25 p-2 backdrop-blur-[2px] sm:grid-cols-3 sm:gap-2.5 sm:p-3 dark:bg-zinc-950/20 lg:grid-cols-3">
                {items.map((item) => (
                  <li key={item.href + item.label} className="min-w-0">
                    <Link
                      href={item.href}
                      className={cn(
                        'group relative flex h-full min-h-[5rem] flex-col justify-between overflow-hidden rounded-xl border bg-gradient-to-br from-white/98 via-white to-slate-50/90 p-2 shadow-sm transition-all duration-200',
                        'max-sm:min-h-[4.75rem] max-sm:p-1.5',
                        'hover:-translate-y-0.5 active:scale-[0.99] dark:from-zinc-900/95 dark:via-zinc-900 dark:to-zinc-950/95',
                        theme.itemHover,
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md ring-2 ring-white/60 dark:ring-zinc-800/80 sm:size-9', item.accent)}>
                          <item.icon className="size-3.5 sm:size-4" strokeWidth={1.85} />
                        </span>
                        <ChevronRight className="size-3 shrink-0 text-muted-foreground/45 transition group-hover:translate-x-0.5 group-hover:text-foreground sm:size-3.5" />
                      </div>
                      <div className="min-w-0 pt-1">
                        <span className="line-clamp-2 text-[11px] font-bold leading-snug text-foreground sm:text-xs">{item.label}</span>
                        <p className="mt-0.5 line-clamp-1 text-[9px] text-muted-foreground sm:text-[10px]">{item.hint}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          );
        })}
      </div>

      {/* Modüller */}
      {visibleModules.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-violet-200/55 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/40 shadow-[0_10px_32px_-18px_rgba(139,92,246,0.2)] ring-1 ring-violet-400/12 dark:border-violet-500/30 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/25">
          <div className="border-b border-violet-200/50 bg-gradient-to-r from-violet-100/90 to-transparent px-3 py-2.5 dark:border-violet-500/25 dark:from-violet-950/60 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-violet-950 dark:text-violet-50 sm:text-[11px]">Modüller</h2>
              <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                {allOpen ? 'Tümü açık' : `${activeCount} / ${moduleKeysUnique.length} açık`}
              </span>
            </div>
          </div>
          <div className="-mx-0 overflow-x-auto px-3 py-3 sm:overflow-visible sm:px-4">
            <div className="flex snap-x snap-mandatory gap-3 sm:flex-wrap sm:gap-2.5">
              {visibleModules.map((m) => (
                <Link
                  key={`${m.key}-${m.href}`}
                  href={m.href}
                  className="flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1.5 text-center sm:min-w-0 sm:flex-row sm:rounded-xl sm:border sm:border-violet-200/40 sm:bg-white/70 sm:px-3 sm:py-2 sm:text-left sm:shadow-sm sm:transition-colors sm:hover:border-violet-400/50 sm:hover:bg-white dark:sm:border-violet-500/25 dark:sm:bg-zinc-900/50"
                >
                  <span className={cn('flex size-11 items-center justify-center rounded-full shadow-md ring-2 ring-white/80 dark:ring-zinc-800 sm:size-9 sm:rounded-lg sm:shadow-sm sm:ring-0', m.ring)}>
                    <m.icon className="size-5 sm:size-4" strokeWidth={1.75} />
                  </span>
                  <span className="max-w-[4.5rem] text-[10px] font-semibold leading-tight text-foreground sm:max-w-none sm:text-xs">{m.label}</span>
                </Link>
              ))}
            </div>
          </div>
          {!allOpen && MODULE_CATALOG.some((m) => !isModuleEnabled(enabledModules, m.key)) && (
            <p className="border-t border-violet-200/40 px-3 pb-3 pt-2 text-[10px] text-muted-foreground dark:border-violet-500/20 sm:px-4 sm:text-xs">
              Kapalı modüller menüde gizlidir. Açmak için merkez yöneticisi ile iletişime geçin.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
