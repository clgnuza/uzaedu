'use client';

import Link from 'next/link';
import type { Me } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WelcomeMotivationBanner } from '@/components/dashboard/welcome-motivation-banner';

export type SchoolAdminStatsPayload = {
  schools: number;
  users: number;
  announcements: number;
  chart: { month: string; count: number }[];
};

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

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
  stats: SchoolAdminStatsPayload | null;
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

  const pieData = allOpen
    ? [
        { name: 'Tüm modüller', value: 1, fill: 'hsl(var(--primary) / 0.85)' },
      ]
    : [
        { name: 'Açık', value: activeCount, fill: 'hsl(var(--primary) / 0.9)' },
        { name: 'Kapalı', value: inactiveCount, fill: 'hsl(var(--muted-foreground) / 0.25)' },
      ];

  const chartData = stats?.chart ?? [];
  const barRows = chartData.length ? chartData.map((d) => ({ name: d.month, deger: d.count })) : [];
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
        <div className="space-y-6 xl:col-span-7">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base">Duyuru oluşturma — bu yıl (aylık)</CardTitle>
              <p className="text-xs font-normal text-muted-foreground">Okulunuza ait duyuru kayıtlarının dağılımı</p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="h-[260px] w-full min-h-[200px]">
                {isLoadingStats ? (
                  <div className="flex h-full items-center justify-center">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 260 }}>
                    <BarChart
                      data={barRows.length ? barRows : [{ name: '—', deger: 0 }]}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border)',
                          background: 'var(--card)',
                        }}
                        labelStyle={{ color: 'var(--foreground)' }}
                      />
                      <Bar dataKey="deger" name="Adet" radius={[4, 4, 0, 0]}>
                        {(barRows.length ? barRows : [{ name: '—', deger: 0 }]).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {statsError && (
                <Alert message="Grafik verisi yüklenemedi. Sayfayı yenileyin." className="mt-3" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <CardTitle className="text-base">Modül durumu</CardTitle>
              <p className="text-xs font-normal text-muted-foreground">
                {allOpen ? 'Tüm modüller menüde kullanılabilir' : 'Açık ve kapalı modül dağılımı — kapalı olanlar aşağıda listelenir'}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="h-[200px] w-full max-w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height: 200 }}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={allOpen ? 0 : 2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number | undefined) => [allOpen ? 'Tam erişim' : (v ?? 0), allOpen ? '' : 'Adet']}
                        contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p className="font-medium text-foreground">
                    {allOpen ? 'Kısıtlama yok' : `${activeCount} açık · ${inactiveCount} kapalı`}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Modül listesi merkezi ayarlardan yönetilir. Menüde yalnızca açık modüller görünür.
                  </p>
                </div>
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
