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
  { key: 'school_reviews', label: 'Okul değerlendirme', href: '/school-reviews-report', icon: BarChart3 },
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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 pb-8 sm:space-y-8 sm:px-4 lg:px-2">
      <WelcomeMotivationBanner />
      <section
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/60 shadow-sm sm:rounded-3xl',
          'bg-gradient-to-br from-sky-500/[0.14] via-background to-indigo-500/[0.1]',
          'dark:from-sky-950/50 dark:via-background dark:to-indigo-950/40',
          'p-5 sm:p-7 md:p-8',
        )}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-gradient-to-br from-sky-400/20 to-indigo-400/10 blur-3xl dark:from-sky-500/10 dark:to-indigo-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-teal-400/12 to-transparent blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium tracking-wide text-muted-foreground">{greetingTr()}</p>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {displayName}
            </h1>
            {schoolName && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  {schoolName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                  Okul yönetimi
                </span>
              </p>
            )}
            <time className="block text-xs text-muted-foreground/90" dateTime={new Date().toISOString()}>
              {formatTodayTr()}
            </time>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Link
              href="/bildirimler"
              className={cn(
                'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all sm:w-auto',
                'border-border/80 bg-background/80 backdrop-blur-sm hover:border-primary/40 hover:bg-background',
                allNotificationsUnread > 0 && 'border-indigo-300/60 bg-indigo-50/90 dark:border-indigo-500/40 dark:bg-indigo-950/40',
              )}
            >
              <Bell className="size-4 shrink-0" />
              Bildirimler
              {allNotificationsUnread > 0 && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-indigo-500">
                  {allNotificationsUnread > 99 ? '99+' : allNotificationsUnread}
                </span>
              )}
            </Link>
            <Link
              href="/market"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-muted/80"
            >
              <ShoppingBag className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Market
            </Link>
            <Link
              href="/profile"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-muted/80"
            >
              <Settings className="size-3.5" />
              Ayarlar
            </Link>
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-muted/80"
            >
              <Headphones className="size-3.5 text-cyan-600 dark:text-cyan-400" />
              Destek
            </Link>
          </div>
        </div>
      </section>

      {adminMessagesUnread > 0 && (
        <Link
          href="/system-messages"
          className="block rounded-2xl border-2 border-amber-400/90 bg-amber-50/95 p-4 shadow-md transition-all hover:border-amber-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-500/50 dark:bg-amber-950/35"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
              <Mail className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                {adminMessagesUnread} yeni sistem mesajı
              </p>
              <p className="text-sm text-amber-900/90 dark:text-amber-200/90">Merkez iletişim kutusu</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-amber-700 dark:text-amber-300" />
          </div>
        </Link>
      )}

      {/* KPI bento */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-emerald-500/[0.08] to-card shadow-sm dark:from-emerald-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <School className="size-4 text-emerald-600 dark:text-emerald-400" />
              Kurum
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingStats ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-foreground">{statsError ? '—' : stats?.schools ?? 0}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Bağlı okul</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-violet-500/[0.08] to-card shadow-sm dark:from-violet-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="size-4 text-violet-600 dark:text-violet-400" />
              Hesaplar
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingStats ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-foreground">{statsError ? '—' : stats?.users ?? 0}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Okul kullanıcıları</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-orange-500/[0.08] to-card shadow-sm dark:from-orange-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Megaphone className="size-4 text-orange-600 dark:text-orange-400" />
              Duyurular
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingStats ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-foreground">{statsError ? '—' : stats?.announcements ?? 0}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Toplam kayıt</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-sky-500/[0.08] to-card shadow-sm dark:from-sky-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-4 text-sky-600 dark:text-sky-400" />
              Modüller
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {allOpen ? '∞' : `${activeCount}/${totalModules}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {allOpen ? 'Tümü açık' : `${activeCount} açık · ${inactiveCount} kapalı`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-12 xl:items-start">
        <div className="space-y-6 xl:col-span-8">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base">Okulunuzda özet</CardTitle>
              <p className="text-xs font-normal text-muted-foreground">
                Kullanıcı dağılımı ve bu yıl aylık trend — yönetim için özet
              </p>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
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
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rol</p>
                      {sa ? (
                        <DistributionStrip entries={sa.users_by_role} labelMap={ROLE_LABELS} colors={SEG_PALETTE} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Veri yüklenemedi</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hesap durumu</p>
                      {sa ? (
                        <DistributionStrip entries={sa.users_by_status} labelMap={STATUS_LABELS} colors={STATUS_PALETTE} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Veri yüklenemedi</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                      <p className="mb-2 text-xs font-semibold text-foreground">Bu yıl eklenen kullanıcılar</p>
                      <p className="mb-3 text-[11px] text-muted-foreground">Okula kayıt tarihi bu yıl olan hesaplar (aylık)</p>
                      <MonthlyCssBars
                        rows={userBarRows}
                        maxVal={userMax}
                        ariaLabel="Aylık yeni kullanıcı sayıları"
                        emptyHint="Bu yıl henüz yeni kullanıcı yok"
                      />
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                      <p className="mb-2 text-xs font-semibold text-foreground">Bu yıl oluşturulan duyurular</p>
                      <p className="mb-3 text-[11px] text-muted-foreground">Yayınlanan duyuru kayıtları (aylık)</p>
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

        <div className="space-y-6 xl:col-span-4">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base">Modül durumu</CardTitle>
              <p className="text-xs font-normal text-muted-foreground">
                {allOpen ? 'Tüm modüller menüde kullanılabilir' : 'Açık ve kapalı modül dağılımı — kapalı olanlar aşağıda listelenir'}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-6">
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

      {/* Hızlı işlemler */}
      <div>
        <div className="mb-4 flex flex-col gap-1 border-b border-border/40 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">İşlem merkezi</h2>
            <p className="text-sm text-muted-foreground">Sık kullanılan yönetim ekranları</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/announcements"
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 text-violet-700 dark:text-violet-300">
                <Megaphone className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Duyurular</p>
                <p className="text-xs text-muted-foreground">Yayın ve içerik</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/ders-programi"
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/10 text-emerald-700 dark:text-emerald-300">
                <Table2 className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Ders programı</p>
                <p className="text-xs text-muted-foreground">Planlar ve günlük</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/teachers"
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 text-indigo-700 dark:text-indigo-300">
                <Users className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Öğretmenler</p>
                <p className="text-xs text-muted-foreground">Liste ve detay</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/classes-subjects"
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/10 text-sky-700 dark:text-sky-300">
                <BookOpen className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Sınıflar &amp; dersler</p>
                <p className="text-xs text-muted-foreground">Yapılandırma</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/hesaplamalar"
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md sm:col-span-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-600/10 text-violet-700 dark:text-violet-300">
                <Calculator className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Hesaplamalar</p>
                <p className="text-xs text-muted-foreground">Ek ders, sınav ücreti ve diğer hesaplar</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </div>
      </div>

      {/* Modül haritası — okulda açık olanlar */}
      <div className="rounded-3xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-sm dark:bg-card/25 sm:p-6">
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Modül erişimi</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ADMIN_ALWAYS_LINKS.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-3 text-sm transition-all hover:border-amber-500/40 hover:bg-background hover:shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 font-medium leading-tight text-foreground">{m.label}</span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
          {MODULE_CATALOG.filter((m) => isModuleEnabled(enabledModules, m.key)).map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={`${m.key}-${m.href}`}
                href={m.href}
                className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-3 text-sm transition-all hover:border-primary/35 hover:bg-background hover:shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 font-medium leading-tight text-foreground">{m.label}</span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
        {!allOpen && MODULE_CATALOG.filter((m) => !isModuleEnabled(enabledModules, m.key)).length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Kapalı modüller menüde gizlidir. Açmak için merkez yöneticisi ile iletişime geçin.
          </p>
        )}
      </div>
    </div>
  );
}
