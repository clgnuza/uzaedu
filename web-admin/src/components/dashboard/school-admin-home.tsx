'use client';

import Link from 'next/link';
import type { Me } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  Mail,
  Megaphone,
  Monitor,
  School,
  Settings,
  Sparkles,
  Table2,
  Tv,
  Users,
  Calculator,
  Headphones,
  ScanLine,
  Inbox,
  ShoppingBag,
  Lock,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WelcomeMotivationBanner } from '@/components/dashboard/welcome-motivation-banner';
import type { StatsResponse } from '@/lib/stats-response';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Öğretmen',
  school_admin: 'Okul yöneticisi',
  moderator: 'Moderatör',
  superadmin: 'Süper Admin',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  suspended: 'Askıda',
  deleted: 'Silinmiş',
};
const SEG_PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];
const STATUS_PALETTE = [
  'hsl(142 76% 36%)',
  'hsl(var(--muted-foreground))',
  'hsl(38 92% 50%)',
  'hsl(0 72% 50%)',
];

function DistributionStrip({
  entries,
  labelMap,
  colors,
}: {
  entries: Record<string, number>;
  labelMap: Record<string, string>;
  colors: string[];
}) {
  const pairs = Object.entries(entries).filter(([, v]) => v > 0);
  const total = pairs.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Henüz kayıt yok</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {pairs.map(([k], i) => (
          <div
            key={k}
            className="min-w-0 transition-[width]"
            style={{
              width: `${(entries[k]! / total) * 100}%`,
              backgroundColor: colors[i % colors.length],
            }}
            title={`${labelMap[k] ?? k}: ${entries[k]}`}
          />
        ))}
      </div>
      <ul className="space-y-1 text-xs">
        {pairs.map(([k], i) => (
          <li key={k} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
              {labelMap[k] ?? k}
            </span>
            <span className="font-medium tabular-nums text-foreground">{entries[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthlyCssBars({
  rows,
  maxVal,
  ariaLabel,
  emptyHint,
}: {
  rows: { name: string; deger: number }[];
  maxVal: number;
  ariaLabel: string;
  emptyHint: string;
}) {
  if (!rows.length) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/15 px-2 text-center text-xs text-muted-foreground">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className="flex h-[180px] items-end justify-between gap-0.5 sm:gap-1" role="img" aria-label={ariaLabel}>
      {rows.map((row, i) => {
        const pct = maxVal > 0 ? (row.deger / maxVal) * 100 : 0;
        return (
          <div key={`${row.name}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[9px] font-semibold tabular-nums text-foreground sm:text-[10px]">{row.deger}</span>
            <div className="flex h-[120px] w-full flex-col justify-end sm:h-[128px]">
              <div
                className={cn('w-full rounded-t-sm', row.deger > 0 && 'min-h-[4px]')}
                style={{
                  height: `${pct}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
                title={`${row.name}: ${row.deger}`}
              />
            </div>
            <span className="w-full truncate text-center text-[8px] leading-tight text-muted-foreground sm:text-[9px]">{row.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Okul modül anahtarı + okul yöneticisinin erişebildiği rota (ROUTE_ROLES ile uyumlu). */
const MODULE_CATALOG: { key: string; label: string; href: string; icon: LucideIcon }[] = [
  { key: 'duty', label: 'Nöbet', href: '/duty', icon: CalendarClock },
  { key: 'tv', label: 'Duyuru TV', href: '/tv', icon: Tv },
  { key: 'extra_lesson', label: 'Hesaplamalar', href: '/hesaplamalar', icon: Calculator },
  { key: 'optical', label: 'Optik formlar', href: '/optik-formlar', icon: ScanLine },
  { key: 'smart_board', label: 'Akıllı tahta', href: '/akilli-tahta', icon: Monitor },
  { key: 'teacher_agenda', label: 'Öğretmen ajandası', href: '/ogretmen-ajandasi', icon: ClipboardList },
  { key: 'bilsem', label: 'BİLSEM takvim', href: '/bilsem/takvim', icon: School },
  { key: 'school_profile', label: 'Okul tanıtım', href: '/school-profile', icon: Building2 },
  { key: 'school_reviews', label: 'Okul değerlendirmesi', href: '/school-reviews-report', icon: BarChart3 },
];
/** Modül anahtarı olmayan; her zaman gösterilen yönetim kısayolları */
const ADMIN_ALWAYS_LINKS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Öğretmen onay kuyruğu', href: '/school-join-queue', icon: ClipboardCheck },
  { label: 'Akademik takvim', href: '/akademik-takvim', icon: Calendar },
  { label: 'Takvim ayarları', href: '/akademik-takvim-ayarlar', icon: CalendarClock },
  { label: 'Destek kutusu', href: '/support/inbox', icon: Inbox },
];

function isModuleEnabled(
  enabledModules: string[] | null | undefined,
  moduleKey: string
): boolean {
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
  const inactiveCount = Math.max(0, totalModules - activeCount);
  const allOpen = !enabledModules || enabledModules.length === 0;

  const sa = stats?.school_admin;
  const chartData = stats?.chart ?? [];
  const barRows = chartData.length ? chartData.map((d) => ({ name: d.month, deger: d.count })) : [];
  const annMax = barRows.length ? Math.max(...barRows.map((r) => r.deger), 1) : 1;
  const userBarRows = sa?.users_monthly_chart?.length
    ? sa.users_monthly_chart.map((d) => ({ name: d.month, deger: d.count }))
    : [];
  const userMax = userBarRows.length ? Math.max(...userBarRows.map((r) => r.deger), 1) : 1;
  const schoolName = me.school?.name;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-2.5 pb-6 sm:space-y-8 sm:px-4 sm:pb-8 lg:px-2">
      <WelcomeMotivationBanner />
      <section
        className={cn(
          'relative w-full min-w-0 overflow-hidden rounded-3xl border border-white/50 shadow-[0_20px_50px_-18px_rgba(14,165,233,0.26),0_0_0_1px_rgba(255,255,255,0.08)_inset] dark:border-white/10 dark:shadow-[0_20px_50px_-18px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:rounded-[1.75rem]',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-100/88 via-amber-50/45 to-indigo-100/78 dark:from-sky-950/40 dark:via-zinc-950 dark:to-indigo-950/50"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[18rem] w-[18rem] rounded-full bg-gradient-to-br from-sky-400/42 to-indigo-300/28 blur-3xl dark:from-sky-500/18 dark:to-indigo-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-[16rem] w-[16rem] rounded-full bg-gradient-to-tr from-amber-400/32 to-orange-300/18 blur-3xl dark:from-amber-600/12 dark:to-orange-600/8"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230ea5e9' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="relative z-10 px-4 pb-4 pt-4 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-1 gap-3.5 sm:gap-5">
              <div
                className="relative flex size-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 text-white shadow-[0_20px_40px_-12px_rgba(14,165,233,0.5)] ring-2 ring-white/50 sm:size-[4.75rem] sm:rounded-[1.35rem] dark:ring-white/10"
                aria-hidden
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-white/20 opacity-90"
                  aria-hidden
                />
                <Building2 className="relative z-[1] size-9 text-white drop-shadow-md sm:size-11" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-800/90 sm:text-[11px] sm:tracking-[0.2em] dark:text-sky-300/90">
                  {greetingTr()}
                </p>
                <h1 className="mt-1.5 break-words text-balance bg-gradient-to-r from-sky-700 via-amber-700 to-indigo-700 bg-clip-text text-xl font-extrabold leading-tight tracking-tight text-transparent dark:from-sky-200 dark:via-amber-200 dark:to-indigo-200 sm:mt-2 sm:text-3xl">
                  {displayName}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
                  <time
                    dateTime={new Date().toISOString()}
                    className="inline-flex max-w-full items-center rounded-full border border-white/60 bg-white/50 px-2 py-1 text-[10px] font-medium leading-tight text-foreground/80 shadow-sm backdrop-blur-sm sm:px-2.5 sm:text-[11px] dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                  >
                    <span className="line-clamp-2 sm:line-clamp-none">{formatTodayTr()}</span>
                  </time>
                  {schoolName ? (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-sky-200/65 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold leading-tight text-sky-950 backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:text-[11px] dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-100">
                      <Building2 className="size-3 shrink-0 opacity-80 sm:size-3.5" />
                      <span className="min-w-0 truncate">{schoolName}</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-amber-300/55 bg-amber-500/12 px-2 py-1 text-[10px] font-semibold text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100 sm:px-2.5 sm:text-[11px]">
                    Okul yönetimi
                  </span>
                </div>
              </div>
            </div>
            <nav
              aria-label="Hızlı bağlantılar"
              className="flex w-full min-w-0 shrink-0 justify-between gap-1 self-stretch rounded-2xl border border-white/40 bg-white/35 p-2 shadow-lg shadow-sky-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40 sm:w-auto sm:justify-end sm:gap-2 sm:self-center sm:p-1.5"
            >
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
                href="/profile"
                title="Ayarlar"
                className="inline-flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl text-foreground transition-all active:scale-95 hover:scale-[1.02] hover:bg-white/80 sm:size-12 sm:flex-none sm:hover:scale-105 dark:hover:bg-zinc-800/80"
              >
                <Settings className="size-5" strokeWidth={2} />
                <span className="sr-only">Ayarlar</span>
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
      </section>

      {adminMessagesUnread > 0 && (
        <Link
          href="/system-messages"
          className="block rounded-2xl border-2 border-amber-400/90 bg-amber-50/95 p-3 shadow-md transition-all hover:border-amber-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-500/50 dark:bg-amber-950/35 sm:rounded-3xl sm:p-4"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md sm:size-12">
              <Mail className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100 sm:text-base">
                {adminMessagesUnread} yeni sistem mesajı
              </p>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 sm:text-sm">Merkez iletişim kutusu</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-amber-700 dark:text-amber-300 sm:size-5" />
          </div>
        </Link>
      )}

      {/* KPI bento */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card className="overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-emerald-500/[0.08] to-card shadow-sm ring-1 ring-emerald-500/10 dark:from-emerald-950/30 dark:ring-emerald-500/15">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/25 sm:size-10">
                <School className="size-3.5 sm:size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">Kurum</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                  Bağlı okul
                </p>
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              {isLoadingStats ? (
                <Skeleton className="h-8 w-12 sm:h-9 sm:w-14" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{statsError ? '—' : stats?.schools ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-violet-500/[0.08] to-card shadow-sm ring-1 ring-violet-500/10 dark:from-violet-950/30 dark:ring-violet-500/15">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 shadow-sm ring-1 ring-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/25 sm:size-10">
                <Users className="size-3.5 sm:size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">Hesaplar</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                  Okul kullanıcıları
                </p>
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              {isLoadingStats ? (
                <Skeleton className="h-8 w-12 sm:h-9 sm:w-14" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{statsError ? '—' : stats?.users ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-orange-500/[0.08] to-card shadow-sm ring-1 ring-orange-500/10 dark:from-orange-950/30 dark:ring-orange-500/15">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 shadow-sm ring-1 ring-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/25 sm:size-10">
                <Megaphone className="size-3.5 sm:size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">Duyurular</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                  Toplam kayıt
                </p>
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              {isLoadingStats ? (
                <Skeleton className="h-8 w-12 sm:h-9 sm:w-14" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{statsError ? '—' : stats?.announcements ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-sky-500/[0.08] to-card shadow-sm ring-1 ring-sky-500/10 dark:from-sky-950/30 dark:ring-sky-500/15">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 shadow-sm ring-1 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/25 sm:size-10">
                <Sparkles className="size-3.5 sm:size-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">Modüller</p>
                <p className="mt-0.5 line-clamp-2 text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[11px]">
                  {allOpen ? 'Tümü açık' : `${activeCount} açık · ${inactiveCount} kapalı`}
                </p>
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                {allOpen ? '∞' : `${activeCount}/${totalModules}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-12 xl:items-start">
        <div className="space-y-4 sm:space-y-6 xl:col-span-8">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm ring-1 ring-sky-500/10 sm:rounded-3xl dark:ring-sky-500/15">
            <CardHeader className="border-b border-sky-200/40 bg-gradient-to-r from-sky-50/90 via-background/80 to-indigo-50/40 px-4 py-3.5 dark:border-sky-500/20 dark:from-sky-950/50 dark:via-zinc-950 dark:to-indigo-950/30 sm:px-6 sm:py-4">
              <CardTitle className="text-sm font-bold sm:text-base">Okulunuzda özet</CardTitle>
              <p className="text-[11px] font-normal leading-snug text-muted-foreground sm:text-xs">
                Kullanıcı dağılımı ve bu yıl aylık trend — yönetim için özet
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pt-4 sm:space-y-6 sm:px-6 sm:pt-5">
              {isLoadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-44 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  {(sa?.teachers_pending_approval ?? 0) > 0 && (
                    <Link
                      href="/school-join-queue"
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm transition-colors hover:bg-amber-500/15"
                    >
                      <span className="flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
                        <UserPlus className="size-4 shrink-0" aria-hidden />
                        {sa!.teachers_pending_approval} öğretmen onay bekliyor
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-amber-800 dark:text-amber-200" />
                    </Link>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-6">
                    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/15 to-background/80 p-3.5 sm:p-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-xs">Rol</p>
                      {sa ? (
                        <DistributionStrip entries={sa.users_by_role} labelMap={ROLE_LABELS} colors={SEG_PALETTE} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Veri yüklenemedi</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/15 to-background/80 p-3.5 sm:p-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-xs">Hesap durumu</p>
                      {sa ? (
                        <DistributionStrip entries={sa.users_by_status} labelMap={STATUS_LABELS} colors={STATUS_PALETTE} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Veri yüklenemedi</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
                    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-violet-500/[0.04] to-muted/10 p-3.5 sm:p-4">
                      <p className="mb-1 text-xs font-semibold text-foreground sm:mb-2">Bu yıl eklenen kullanıcılar</p>
                      <p className="mb-2 text-[10px] text-muted-foreground sm:mb-3 sm:text-[11px]">Okula kayıt tarihi bu yıl olan hesaplar (aylık)</p>
                      <MonthlyCssBars
                        rows={userBarRows}
                        maxVal={userMax}
                        ariaLabel="Aylık yeni kullanıcı sayıları"
                        emptyHint="Bu yıl henüz yeni kullanıcı yok"
                      />
                    </div>
                    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-orange-500/[0.04] to-muted/10 p-3.5 sm:p-4">
                      <p className="mb-1 text-xs font-semibold text-foreground sm:mb-2">Bu yıl oluşturulan duyurular</p>
                      <p className="mb-2 text-[10px] text-muted-foreground sm:mb-3 sm:text-[11px]">Yayınlanan duyuru kayıtları (aylık)</p>
                      <MonthlyCssBars
                        rows={barRows}
                        maxVal={annMax}
                        ariaLabel="Aylık duyuru sayıları"
                        emptyHint="Bu yıl henüz duyuru yok"
                      />
                    </div>
                  </div>
                </>
              )}
              {statsError && (
                <Alert message="Özet verileri yüklenemedi. Sayfayı yenileyin." className="mt-1" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 xl:col-span-4">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm ring-1 ring-indigo-500/10 sm:rounded-3xl dark:ring-indigo-500/15">
            <CardHeader className="border-b border-indigo-200/40 bg-gradient-to-r from-indigo-50/90 via-background/80 to-violet-50/35 px-4 py-3.5 dark:border-indigo-500/25 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-violet-950/25 sm:px-6 sm:py-4">
              <CardTitle className="text-sm font-bold sm:text-base">Modül durumu</CardTitle>
              <p className="text-[11px] font-normal leading-snug text-muted-foreground sm:text-xs">
                {allOpen ? 'Tüm modüller menüde kullanılabilir' : 'Açık ve kapalı modül dağılımı — kapalı olanlar aşağıda listelenir'}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-6">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {allOpen ? 'Kısıtlama yok — tüm modüller açık' : `${activeCount} açık · ${inactiveCount} kapalı`}
                </p>
                {allOpen ? (
                  <div className="h-3 w-full overflow-hidden rounded-full bg-primary/20">
                    <div className="h-full w-full rounded-full bg-primary/80" title="Tam erişim" />
                  </div>
                ) : (
                  <>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="min-w-0 transition-[width]"
                        style={{
                          width: `${activeCount + inactiveCount > 0 ? (activeCount / (activeCount + inactiveCount)) * 100 : 0}%`,
                          backgroundColor: 'hsl(var(--primary))',
                        }}
                        title={`Açık: ${activeCount}`}
                      />
                      <div
                        className="min-w-0 bg-muted-foreground/30"
                        style={{
                          width: `${activeCount + inactiveCount > 0 ? (inactiveCount / (activeCount + inactiveCount)) * 100 : 0}%`,
                        }}
                        title={`Kapalı: ${inactiveCount}`}
                      />
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm bg-primary" />
                        Açık modül
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm bg-muted-foreground/40" />
                        Kapalı modül
                      </li>
                    </ul>
                  </>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Modül listesi merkezi ayarlardan yönetilir. Menüde yalnızca açık modüller görünür.
                </p>
              </div>
              {!allOpen && (
                <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                      Açık modüller ({activeCount})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {MODULE_CATALOG.filter((m) => isModuleEnabled(enabledModules, m.key)).map((m) => (
                        <span
                          key={`${m.key}-${m.href}`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-900 dark:text-emerald-100"
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Lock className="size-3.5 shrink-0" aria-hidden />
                      Kapalı modüller ({inactiveCount})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {MODULE_CATALOG.filter((m) => !isModuleEnabled(enabledModules, m.key)).map((m) => (
                        <span
                          key={`${m.key}-${m.href}`}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hızlı işlemler — öğretmen paneli “hızlı erişim” kabuğu ile uyumlu */}
      <div className="overflow-hidden rounded-[1.15rem] border-2 border-sky-200/55 bg-gradient-to-b from-sky-50/88 to-background p-3 shadow-inner dark:border-sky-500/25 dark:from-sky-950/35 dark:to-zinc-950 sm:rounded-[1.35rem] sm:p-4">
        <div className="mb-3 border-b border-sky-200/45 pb-2.5 text-center sm:mb-4 sm:pb-3 sm:text-left dark:border-sky-500/25">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-950 dark:text-sky-100 sm:text-xs">
            İşlem merkezi
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-sm">Sık kullanılan yönetim ekranları</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          <Link
            href="/announcements"
            className="group flex min-h-[3.5rem] items-center justify-between rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md sm:min-h-0 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/22 to-violet-600/10 text-violet-700 shadow-sm ring-1 ring-violet-500/15 dark:text-violet-300 sm:size-11">
                <Megaphone className="size-[1.15rem] sm:size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">Duyurular</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">Yayın ve içerik</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/ders-programi"
            className="group flex min-h-[3.5rem] items-center justify-between rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-md sm:min-h-0 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/22 to-teal-600/10 text-emerald-700 shadow-sm ring-1 ring-emerald-500/15 dark:text-emerald-300 sm:size-11">
                <Table2 className="size-[1.15rem] sm:size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">Ders programı</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">Planlar ve günlük</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/teachers"
            className="group flex min-h-[3.5rem] items-center justify-between rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-md sm:min-h-0 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/22 to-indigo-600/10 text-indigo-700 shadow-sm ring-1 ring-indigo-500/15 dark:text-indigo-300 sm:size-11">
                <Users className="size-[1.15rem] sm:size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">Öğretmenler</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">Liste ve detay</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/classes-subjects"
            className="group flex min-h-[3.5rem] items-center justify-between rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-md sm:min-h-0 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/22 to-blue-600/10 text-sky-700 shadow-sm ring-1 ring-sky-500/15 dark:text-sky-300 sm:size-11">
                <BookOpen className="size-[1.15rem] sm:size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">Sınıflar &amp; dersler</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">Yapılandırma</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/hesaplamalar"
            className="group flex min-h-[3.5rem] items-center justify-between rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md sm:col-span-2 sm:min-h-0 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/22 to-fuchsia-600/10 text-violet-700 shadow-sm ring-1 ring-violet-500/15 dark:text-violet-300 sm:size-11">
                <Calculator className="size-[1.15rem] sm:size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">Hesaplamalar</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">Ek ders, sınav ücreti ve diğer hesaplar</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </div>
      </div>

      {/* Modül haritası — öğretmen “bölüm” kartlarına yakın kabuk */}
      <div className="overflow-hidden rounded-[1.35rem] border border-indigo-200/55 bg-gradient-to-br from-indigo-50/92 via-card to-sky-50/40 shadow-[0_14px_44px_-20px_rgba(99,102,241,0.18)] ring-1 ring-indigo-400/12 dark:border-indigo-500/35 dark:from-indigo-950/45 dark:via-zinc-950 dark:to-sky-950/22 dark:ring-indigo-500/18 sm:rounded-[1.5rem]">
        <div className="border-b border-indigo-200/50 bg-gradient-to-r from-indigo-100/90 via-sky-50/50 to-transparent px-3 py-3 text-center sm:px-4 sm:py-3.5 sm:text-left dark:border-indigo-500/28 dark:from-indigo-950/80 dark:via-sky-950/35 dark:to-transparent">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-950 dark:text-indigo-50">Modül erişimi</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Kısayollar ve açık modüller</p>
        </div>
        <div className="grid gap-1.5 p-3 sm:grid-cols-2 sm:gap-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
          {ADMIN_ALWAYS_LINKS.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group flex min-h-[2.75rem] items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 px-2.5 py-2 text-[13px] transition-all active:scale-[0.99] hover:border-amber-500/45 hover:bg-background hover:shadow-sm sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/16 text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-200 sm:size-9 sm:rounded-xl">
                  <Icon className="size-3.5 sm:size-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium leading-snug text-foreground">{m.label}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:size-4" />
              </Link>
            );
          })}
          {MODULE_CATALOG.filter((m) => isModuleEnabled(enabledModules, m.key)).map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={`${m.key}-${m.href}`}
                href={m.href}
                className="group flex min-h-[2.75rem] items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 px-2.5 py-2 text-[13px] transition-all active:scale-[0.99] hover:border-primary/40 hover:bg-background hover:shadow-sm sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15 sm:size-9 sm:rounded-xl">
                  <Icon className="size-3.5 sm:size-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium leading-snug text-foreground">{m.label}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:size-4" />
              </Link>
            );
          })}
        </div>
        {!allOpen && MODULE_CATALOG.filter((m) => !isModuleEnabled(enabledModules, m.key)).length > 0 && (
          <p className="border-t border-border/30 px-3 pb-3 pt-2.5 text-[11px] text-muted-foreground sm:px-4 sm:pb-4 sm:text-xs">
            Kapalı modüller menüde gizlidir. Açmak için merkez yöneticisi ile iletişime geçin.
          </p>
        )}
      </div>
    </div>
  );
}
