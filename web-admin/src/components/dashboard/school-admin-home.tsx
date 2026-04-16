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
  ClipboardList,
  ClipboardCheck,
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

/** Üst KPI’larda olmayan: toplam hesap + hesap durumu kırılımı (öğretmen sayısı yok) */
function SchoolAccountHealthStrip({
  stats,
  sa,
  loading,
  error,
}: {
  stats: StatsResponse | null;
  sa: SchoolAdminStatsPayload | undefined;
  loading: boolean;
  error: boolean;
}) {
  if (error) return null;
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-xl sm:h-20" />
        ))}
      </div>
    );
  }
  if (!sa) {
    return <p className="text-sm text-muted-foreground">Özet verisi yok.</p>;
  }
  const us = sa.users_by_status;
  const cells = [
    { label: 'Toplam hesap', value: stats?.users ?? 0 },
    { label: 'Aktif', value: us?.active ?? 0 },
    { label: 'Pasif', value: us?.passive ?? 0 },
    { label: 'Askıda', value: us?.suspended ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2.5 text-center sm:px-3 sm:py-3"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

type SuggestedAction = { href: string; title: string; hint: string; icon: LucideIcon; emphasis?: boolean };

function SchoolSuggestedActionsCard({
  sa,
  loading,
  error,
  enabledModules,
}: {
  sa: SchoolAdminStatsPayload | undefined;
  loading: boolean;
  error: boolean;
  enabledModules: string[] | null;
}) {
  if (error) return null;
  if (loading) {
    return <Skeleton className="h-36 w-full rounded-xl sm:h-32" />;
  }
  if (!sa) {
    return null;
  }

  const pending = sa.teachers_pending_approval ?? 0;
  const suspended = sa.users_by_status?.suspended ?? 0;

  const dynamic: SuggestedAction[] = [];
  if (pending > 0) {
    dynamic.push({
      href: '/school-join-queue',
      title: `${pending} öğretmen onayı bekliyor`,
      hint: 'Başvuruları inceleyin',
      icon: ClipboardCheck,
      emphasis: true,
    });
  }
  if (suspended > 0) {
    dynamic.push({
      href: '/teachers',
      title: `${suspended} askıda hesap`,
      hint: 'Kullanıcı listesinden kontrol edin',
      icon: AlertTriangle,
      emphasis: true,
    });
  }

  const pool: SuggestedAction[] = [
    { href: '/akademik-takvim', title: 'Akademik takvimi aç', hint: 'Tatil ve dönem tarihleri', icon: Calendar },
    { href: '/announcements', title: 'Duyuru hazırla veya düzenle', hint: 'Okul panosu', icon: Megaphone },
    { href: '/classes-subjects', title: 'Sınıf ve ders yapısı', hint: 'Şubeleri güncel tutun', icon: BookOpen },
    { href: '/ders-programi', title: 'Ders programı', hint: 'Günlük tablo ve planlar', icon: Table2 },
  ];
  if (isModuleEnabled(enabledModules, 'school_profile')) {
    pool.splice(2, 0, {
      href: '/school-profile',
      title: 'Okul tanıtım sayfası',
      hint: 'Vitrin metinleri ve görseller',
      icon: Building2,
    });
  }
  if (isModuleEnabled(enabledModules, 'messaging')) {
    pool.push({
      href: '/mesaj-merkezi',
      title: 'Mesaj merkezi',
      hint: 'Veli / şablon gönderimleri',
      icon: MessageSquare,
    });
  }

  const seen = new Set<string>();
  const merged: SuggestedAction[] = [];
  for (const a of [...dynamic, ...pool]) {
    if (seen.has(a.href)) continue;
    seen.add(a.href);
    merged.push(a);
    if (merged.length >= 5) break;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 p-3.5 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Sparkles className="size-4" strokeWidth={2} />
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground">Önerilen kontroller</p>
          <p className="text-[10px] text-muted-foreground">Veriye göre sıralanır; tıklayarak gidin</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {merged.map((a) => {
          const Icon = a.icon;
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors sm:px-3',
                  a.emphasis
                    ? 'border-amber-500/35 bg-amber-500/8 hover:bg-amber-500/12'
                    : 'border-transparent bg-background/60 hover:bg-muted/50',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-snug text-foreground">{a.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground/70" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tüm okul modül anahtarları + okul yöneticisi rotaları (ROUTE_ROLES ile uyumlu). */
const MODULE_CATALOG: { key: SchoolModuleKey; label: string; href: string; icon: LucideIcon }[] = [
  { key: 'duty', label: 'Nöbet', href: '/duty', icon: CalendarClock },
  { key: 'tv', label: 'Duyuru TV', href: '/tv', icon: Tv },
  { key: 'extra_lesson', label: 'Hesaplamalar', href: '/hesaplamalar', icon: Calculator },
  { key: 'optical', label: 'Optik formlar', href: '/optik-formlar', icon: ScanLine },
  { key: 'smart_board', label: 'Akıllı tahta', href: '/akilli-tahta', icon: Monitor },
  { key: 'teacher_agenda', label: 'Öğretmen ajandası', href: '/ogretmen-ajandasi', icon: ClipboardList },
  { key: 'bilsem', label: 'Bilsem', href: '/bilsem/takvim', icon: School },
  { key: 'school_profile', label: 'Okul tanıtım', href: '/school-profile', icon: Building2 },
  { key: 'school_reviews', label: 'Okul değerlendirmesi', href: '/school-reviews-report', icon: BarChart3 },
  { key: 'messaging', label: 'Mesaj merkezi', href: '/mesaj-merkezi', icon: MessageSquare },
  { key: 'butterfly_exam', label: 'Kertenkele sınav', href: '/kelebek-sinav', icon: LayoutGrid },
  { key: 'sorumluluk_sinav', label: 'Sorumluluk sınavı', href: '/sorumluluk-sinav', icon: GraduationCap },
];

type CoreLink = { label: string; href: string; icon: LucideIcon; hint: string; moduleKey?: SchoolModuleKey };

/** Tek liste: menüdeki okul yöneticisi ihtiyaçları, modül kapısı gerekenler işaretli */
const QUICK_LINKS: CoreLink[] = [
  { label: 'Öğretmenler', href: '/teachers', icon: Users, hint: 'Liste ve roller' },
  { label: 'Onay kuyruğu', href: '/school-join-queue', icon: ClipboardCheck, hint: 'Başvuru bekleyenler' },
  { label: 'Sınıflar ve dersler', href: '/classes-subjects', icon: BookOpen, hint: 'Şube ve ders yapısı' },
  { label: 'Duyurular', href: '/announcements', icon: Megaphone, hint: 'Okul içi yayınlar' },
  { label: 'Ders programı', href: '/ders-programi', icon: Table2, hint: 'Plan ve günlük tablo' },
  { label: 'Akademik takvim', href: '/akademik-takvim', icon: Calendar, hint: 'Yıllık görünüm' },
  { label: 'Takvim ayarları', href: '/akademik-takvim-ayarlar', icon: CalendarClock, hint: 'Resmi tatil ve dönemler' },
  { label: 'Okul değerlendirmesi', href: '/school-reviews-report', icon: BarChart3, hint: 'Veli geri bildirimi' },
  { label: 'Sistem mesajları', href: '/system-messages', icon: Mail, hint: 'Merkez duyuruları' },
  { label: 'Bildirimler', href: '/bildirimler', icon: Bell, hint: 'Uyarılar' },
  { label: 'Mesaj merkezi', href: '/mesaj-merkezi', icon: MessageSquare, hint: 'WhatsApp şablonları', moduleKey: 'messaging' },
  { label: 'Destek kutusu', href: '/support/inbox', icon: Inbox, hint: 'Gelen talepler' },
  { label: 'Haberler', href: '/haberler', icon: Newspaper, hint: 'Okul haber vitrini' },
  { label: 'Market', href: '/market', icon: ShoppingBag, hint: 'Jeton ve içerik' },
  { label: 'Hesap ayarları', href: '/settings', icon: Settings, hint: 'Profil ve güvenlik' },
];

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
    year: 'numeric',
  }).format(new Date());
}

const KPI_ACCENTS = {
  emerald: {
    glow: 'from-emerald-400/35 via-teal-400/15 to-transparent',
    bar: 'from-emerald-500 to-teal-400',
    icon: 'bg-emerald-500/20 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
    border: 'border-emerald-500/25 hover:border-emerald-400/45',
  },
  violet: {
    glow: 'from-violet-400/35 via-fuchsia-400/15 to-transparent',
    bar: 'from-violet-600 to-fuchsia-500',
    icon: 'bg-violet-500/20 text-violet-700 ring-violet-500/25 dark:text-violet-300',
    border: 'border-violet-500/25 hover:border-violet-400/45',
  },
  amber: {
    glow: 'from-amber-400/35 via-orange-400/15 to-transparent',
    bar: 'from-amber-500 to-orange-500',
    icon: 'bg-amber-500/20 text-amber-800 ring-amber-500/25 dark:text-amber-300',
    border: 'border-amber-500/25 hover:border-amber-400/45',
  },
  cyan: {
    glow: 'from-cyan-400/35 via-sky-400/15 to-transparent',
    bar: 'from-sky-500 to-cyan-400',
    icon: 'bg-sky-500/20 text-sky-800 ring-sky-500/25 dark:text-sky-300',
    border: 'border-sky-500/25 hover:border-sky-400/45',
  },
} as const;

function KpiBentoTile({
  href,
  label,
  sub,
  value,
  icon: Icon,
  accent,
  loading,
  statsError,
}: {
  href: string;
  label: string;
  sub: string;
  value: ReactNode;
  icon: LucideIcon;
  accent: keyof typeof KPI_ACCENTS;
  loading: boolean;
  statsError: boolean;
}) {
  const a = KPI_ACCENTS[accent];
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex min-h-[7.5rem] flex-col justify-between overflow-hidden rounded-3xl border bg-card/40 p-3.5 shadow-lg backdrop-blur-md transition-all duration-300 sm:min-h-0 sm:p-5',
        'hover:-translate-y-1 hover:shadow-2xl active:scale-[0.99]',
        a.border,
      )}
    >
      <div className={cn('pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-gradient-to-br opacity-90 blur-3xl transition-opacity duration-500 group-hover:opacity-100', a.glow)} />
      <div className={cn('pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r opacity-80', a.bar)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">{label}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-muted-foreground/90 sm:text-[11px]">{sub}</p>
        </div>
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-110 sm:size-12', a.icon)}>
          <Icon className="size-5 sm:size-6" strokeWidth={2} />
        </span>
      </div>
      <div className="relative mt-3 sm:mt-4">
        {loading ? (
          <Skeleton className="h-9 w-16 sm:h-10 sm:w-20" />
        ) : (
          <p
            className={cn(
              'text-3xl font-black tabular-nums tracking-tight sm:text-4xl',
              'bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent dark:from-white dark:to-white/75',
            )}
          >
            {statsError ? '—' : value}
          </p>
        )}
      </div>
    </Link>
  );
}

function SectionLinkCard({
  link,
  enabledModules,
}: {
  link: CoreLink;
  enabledModules: string[] | null;
}) {
  const gated = link.moduleKey && !isModuleEnabled(enabledModules, link.moduleKey);
  if (gated) return null;
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={cn(
        'group relative flex min-h-[4.25rem] flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-3 shadow-sm',
        'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5',
        'active:scale-[0.99] sm:min-h-0 sm:flex-row sm:items-center sm:justify-between sm:p-3.5',
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-105">
          <Icon className="size-[1.15rem] sm:size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 pt-0.5 sm:pt-0">
          <p className="text-sm font-semibold leading-tight text-foreground">{link.label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{link.hint}</p>
        </div>
      </div>
      <ArrowRight className="mt-2 size-4 shrink-0 self-end text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary sm:mt-0 sm:self-center" />
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
  const moduleKeysUnique = [...new Set(MODULE_CATALOG.map((m) => m.key))];
  const totalModules = moduleKeysUnique.length;
  const activeCount = moduleKeysUnique.filter((k) => isModuleEnabled(enabledModules, k)).length;
  const allOpen = !enabledModules || enabledModules.length === 0;

  const sa = stats?.school_admin;
  const schoolName = me.school?.name;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-8 pt-1 sm:space-y-8 sm:px-4 sm:pb-10 lg:px-2">
      <section
        className={cn(
          'relative w-full min-w-0 overflow-hidden rounded-3xl border-2 border-indigo-200/60 bg-indigo-50/20',
          'shadow-[0_24px_60px_-20px_rgba(99,102,241,0.22)] transition-all duration-500 hover:shadow-[0_28px_64px_-18px_rgba(99,102,241,0.28)]',
          'dark:border-indigo-500/35 dark:bg-indigo-950/20 dark:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)] sm:rounded-[1.85rem]',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-100/90 via-sky-50/50 to-violet-100/75 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-violet-950/40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[20rem] w-[20rem] rounded-full bg-gradient-to-br from-violet-400/35 to-indigo-400/25 blur-3xl transition-all duration-700 dark:from-violet-600/15 dark:to-indigo-600/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-24 h-[18rem] w-[18rem] rounded-full bg-gradient-to-tr from-cyan-300/25 to-sky-400/20 blur-3xl dark:from-cyan-700/12 dark:to-sky-700/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28] dark:opacity-[0.1]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="relative z-10 px-4 pb-5 pt-5 sm:px-8 sm:pb-7 sm:pt-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
              <div
                className="relative flex size-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-700 text-white shadow-lg shadow-indigo-500/35 ring-2 ring-white/45 sm:size-[5rem] dark:ring-white/10"
                aria-hidden
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-white/25 opacity-90" aria-hidden />
                <Building2 className="relative z-[1] size-9 text-white drop-shadow-md sm:size-11" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-800/90 dark:text-indigo-300/90 sm:text-[11px]">
                  {greetingTr()}
                </p>
                <h1 className="mt-1.5 break-words text-balance bg-gradient-to-r from-indigo-800 via-violet-800 to-fuchsia-800 bg-clip-text text-xl font-extrabold leading-tight tracking-tight text-transparent dark:from-indigo-100 dark:via-violet-100 dark:to-fuchsia-100 sm:mt-2 sm:text-3xl">
                  {displayName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-3.5 sm:gap-2.5">
                  <time
                    dateTime={new Date().toISOString()}
                    className="inline-flex max-w-full items-center rounded-full border border-white/60 bg-white/55 px-2.5 py-1 text-[10px] font-medium leading-tight text-foreground/85 shadow-sm backdrop-blur-md sm:text-[11px] dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                  >
                    <span className="line-clamp-2 sm:line-clamp-none">{formatTodayTr()}</span>
                  </time>
                  {schoolName ? (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-indigo-200/70 bg-indigo-500/12 px-2.5 py-1 text-[10px] font-semibold leading-tight text-indigo-950 backdrop-blur-sm dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-100 sm:text-[11px]">
                      <Building2 className="size-3.5 shrink-0 opacity-85" />
                      <span className="min-w-0 truncate">{schoolName}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-violet-300/55 bg-violet-500/12 px-2.5 py-1 text-[10px] font-semibold text-violet-950 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-100 sm:text-[11px]">
                    Okul yönetimi
                  </span>
                </div>
              </div>
            </div>
            <nav
              aria-label="Hızlı bağlantılar"
              className="flex w-full min-w-0 shrink-0 justify-stretch gap-1.5 rounded-2xl border border-white/45 bg-white/40 p-2 shadow-inner shadow-indigo-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/45 sm:w-auto sm:justify-end sm:gap-2 sm:self-center sm:p-2"
            >
              <Link
                href="/bildirimler"
                title="Bildirimler"
                className={cn(
                  'relative inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-xl text-muted-foreground transition-all duration-300 hover:scale-[1.04] hover:bg-white/85 active:scale-95 dark:hover:bg-zinc-800/85',
                  allNotificationsUnread > 0 &&
                    'bg-indigo-500/18 text-indigo-950 ring-1 ring-indigo-400/45 dark:bg-indigo-500/22 dark:text-indigo-50 dark:ring-indigo-500/35',
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
                className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-xl text-emerald-700 transition-all duration-300 hover:scale-[1.04] hover:bg-emerald-500/18 active:scale-95 dark:text-emerald-400 dark:hover:bg-emerald-500/22"
              >
                <ShoppingBag className="size-5" strokeWidth={2} />
                <span className="sr-only">Market</span>
              </Link>
              <Link
                href="/profile"
                title="Profil"
                className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-xl text-foreground transition-all duration-300 hover:scale-[1.04] hover:bg-white/85 active:scale-95 dark:hover:bg-zinc-800/85"
              >
                <Settings className="size-5" strokeWidth={2} />
                <span className="sr-only">Profil</span>
              </Link>
              <Link
                href="/support"
                title="Destek"
                className="inline-flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-xl text-sky-700 transition-all duration-300 hover:scale-[1.04] hover:bg-sky-500/18 active:scale-95 dark:text-sky-400 dark:hover:bg-sky-500/22"
              >
                <Headphones className="size-5" strokeWidth={2} />
                <span className="sr-only">Destek</span>
              </Link>
            </nav>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiBentoTile
          href="/teachers"
          label="Öğretmen"
          sub="Kayıtlı öğretmen sayısı"
          value={sa?.users_by_role?.teacher ?? 0}
          icon={Users}
          accent="emerald"
          loading={isLoadingStats}
          statsError={Boolean(statsError)}
        />
        <KpiBentoTile
          href="/school-join-queue"
          label="Onay bekleyen"
          sub="Öğretmen başvurusu"
          value={sa?.teachers_pending_approval ?? 0}
          icon={UserPlus}
          accent="amber"
          loading={isLoadingStats}
          statsError={Boolean(statsError)}
        />
        <KpiBentoTile
          href="/announcements"
          label="Duyurular"
          sub="Toplam yayın"
          value={stats?.announcements ?? 0}
          icon={Megaphone}
          accent="violet"
          loading={isLoadingStats}
          statsError={Boolean(statsError)}
        />
      </div>

      <WelcomeMotivationBanner />

      {adminMessagesUnread > 0 && (
        <Link
          href="/system-messages"
          className="block rounded-2xl border-2 border-amber-400/85 bg-gradient-to-r from-amber-50/98 to-orange-50/90 p-3.5 shadow-md transition-all duration-300 hover:border-amber-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-500/45 dark:from-amber-950/40 dark:to-orange-950/25 sm:rounded-3xl sm:p-4"
        >
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg sm:size-12">
              <Mail className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100 sm:text-base">
                {adminMessagesUnread} yeni sistem mesajı
              </p>
              <p className="text-xs text-amber-900/88 dark:text-amber-200/88 sm:text-sm">Merkez iletişim kutusu — okumak için dokunun</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-amber-700 transition-transform duration-300 group-hover:translate-x-1 dark:text-amber-300" />
          </div>
        </Link>
      )}

      <div className="space-y-5 sm:space-y-7">
        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm ring-1 ring-indigo-500/12 transition-shadow duration-300 hover:shadow-md sm:rounded-3xl dark:ring-indigo-500/18">
            <CardHeader className="border-b border-indigo-200/45 bg-gradient-to-r from-indigo-50/95 via-background/85 to-violet-50/40 px-4 py-3.5 dark:border-indigo-500/22 dark:from-indigo-950/48 dark:via-zinc-950 dark:to-violet-950/28 sm:px-6 sm:py-4">
              <CardTitle className="text-sm font-bold sm:text-base">Okul özeti</CardTitle>
              <p className="text-[11px] font-normal leading-snug text-muted-foreground sm:text-xs">
                Hesap durumu ve size önerilen sonraki adımlar
              </p>
            </CardHeader>
            <CardContent className="space-y-5 px-4 pt-4 sm:px-6 sm:pt-5">
              <SchoolAccountHealthStrip
                stats={stats}
                sa={sa}
                loading={isLoadingStats}
                error={Boolean(statsError)}
              />
              <SchoolSuggestedActionsCard
                sa={sa}
                loading={isLoadingStats}
                error={Boolean(statsError)}
                enabledModules={enabledModules}
              />
              {statsError && <Alert message="Özet verileri yüklenemedi. Sayfayı yenileyin." className="mt-1" />}
            </CardContent>
          </Card>
      </div>

      <section className="overflow-hidden rounded-[1.35rem] border border-border/55 bg-card/50 shadow-sm ring-1 ring-border/30 sm:rounded-[1.6rem]">
        <div className="border-b border-border/40 bg-gradient-to-r from-slate-500/12 via-transparent to-violet-500/10 px-4 py-3.5 sm:px-5 sm:py-4">
          <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">Hızlı erişim</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Sık kullanılan okul yönetimi ekranları</p>
        </div>
        <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:p-4">
          {QUICK_LINKS.map((link) => (
            <SectionLinkCard key={link.href + link.label} link={link} enabledModules={enabledModules} />
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-indigo-200/50 bg-gradient-to-br from-indigo-50/90 via-card to-violet-50/45 shadow-[0_18px_48px_-22px_rgba(79,70,229,0.22)] ring-1 ring-indigo-400/15 transition-shadow duration-500 hover:shadow-[0_22px_52px_-20px_rgba(79,70,229,0.28)] dark:border-indigo-500/35 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-violet-950/25 dark:ring-indigo-500/18 sm:rounded-[1.75rem]">
        <div className="border-b border-indigo-200/50 bg-gradient-to-r from-indigo-100/95 via-violet-50/55 to-transparent px-4 py-3.5 sm:px-5 sm:py-4 dark:border-indigo-500/28 dark:from-indigo-950/85 dark:via-violet-950/35">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-950 dark:text-indigo-50 sm:text-[13px]">Modül özellikleri</h3>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
            {allOpen
              ? 'Tüm modüller açık — aşağıdakilere doğrudan gidebilirsiniz'
              : `${activeCount} / ${totalModules} modül açık (kapalı olanlar menüde gizlidir)`}
          </p>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 sm:gap-2.5 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
          {MODULE_CATALOG.filter((m) => isModuleEnabled(enabledModules, m.key)).map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={`${m.key}-${m.href}`}
                href={m.href}
                className="group flex min-h-[3.25rem] items-center gap-2.5 rounded-2xl border border-border/55 bg-background/85 px-3 py-2.5 text-[13px] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background hover:shadow-md sm:min-h-0 sm:gap-3 sm:text-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/18 transition-transform duration-300 group-hover:scale-105">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium leading-snug text-foreground">{m.label}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/55 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary sm:size-4" />
              </Link>
            );
          })}
        </div>
        {!allOpen && MODULE_CATALOG.filter((m) => !isModuleEnabled(enabledModules, m.key)).length > 0 && (
          <p className="border-t border-border/35 px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5 sm:pb-5 sm:text-xs">
            Kapalı modüller menüde gizlidir. Açmak için merkez yöneticisi ile iletişime geçin.
          </p>
        )}
      </section>
    </div>
  );
}
