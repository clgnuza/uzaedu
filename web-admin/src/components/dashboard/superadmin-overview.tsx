'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  ClipboardList,
  Download,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Puzzle,
  School,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import type { Me } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';
import { useMarketAdminSummaryQuery } from '@/hooks/use-market-admin-summary-query';
import { downloadSuperadminStatsCsv } from '@/lib/export-superadmin-stats-csv';
import type { StatsResponse } from '@/lib/stats-response';
import { apiFetch } from '@/lib/api';
import { ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WelcomeMotivationBanner } from '@/components/dashboard/welcome-motivation-banner';
import { SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';
import { SCHOOL_TYPE_ORDER, formatSchoolTypeLabel } from '@/lib/school-labels';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Süper Admin',
  moderator: 'Moderatör',
  school_admin: 'Okul yöneticisi',
  teacher: 'Öğretmen',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  suspended: 'Askıda',
  deleted: 'Silinmiş',
};

const SCHOOL_STATUS_LABELS: Record<string, string> = {
  deneme: 'Deneme',
  aktif: 'Aktif',
  askida: 'Askıda',
};

type Props = {
  me: Me;
  displayName: string;
  stats: StatsResponse | null;
  statsError: string | null;
  isLoadingStats: boolean;
};

export function SuperadminDashboardShell({ me, displayName, stats, statsError, isLoadingStats }: Props) {
  const { token } = useAuth();
  const marketQ = useMarketAdminSummaryQuery(token, true);
  const [extQueues, setExtQueues] = useState<
    'pending' | { moderation: number | null; reportsUnread: number | null; contactNew: number | null }
  >('pending');
  const sa = stats?.superadmin;
  const nearRatio = sa?.teacher_quota_near_ratio ?? 0.9;
  const nearPct = Math.round(nearRatio * 100);
  const chartData = stats?.chart ?? [];
  const isLoading = isLoadingStats;

  const rolePieData = sa
    ? Object.entries(sa.users_by_role).map(([key, value]) => ({
        name: ROLE_LABELS[key] ?? key,
        value,
      }))
    : [];

  const statusPieData = sa
    ? Object.entries(sa.users_by_status).map(([key, value]) => ({
        name: STATUS_LABELS[key] ?? key,
        value,
      }))
    : [];

  const moduleBarData =
    sa?.module_school_counts.map((m) => ({
      name: SCHOOL_MODULE_LABELS[m.key as SchoolModuleKey] ?? m.key,
      okul: m.count,
      key: m.key,
    })) ?? [];

  const MONTH_ORDER = [
    'Oca',
    'Şub',
    'Mar',
    'Nis',
    'May',
    'Haz',
    'Tem',
    'Ağu',
    'Eyl',
    'Eki',
    'Kas',
    'Ara',
  ] as const;

  const combinedMonthlyActivity = useMemo(() => {
    const regMap = new Map((sa?.users_registration_chart ?? []).map((x) => [x.month, x.count]));
    const annMap = new Map(chartData.map((x) => [x.month, x.count]));
    return MONTH_ORDER.map((m) => ({
      ay: m,
      yeni_kullanici: regMap.get(m) ?? 0,
      yeni_duyuru: annMap.get(m) ?? 0,
    }));
  }, [sa?.users_registration_chart, chartData]);

  const schoolStatusPieData = useMemo(() => {
    if (!sa) return [];
    return Object.entries(sa.schools_by_status).map(([k, v]) => ({
      name: SCHOOL_STATUS_LABELS[k] ?? k,
      value: v,
    }));
  }, [sa]);

  const askidaSchoolCount = sa?.schools_by_status?.askida ?? 0;

  useEffect(() => {
    if (!token) {
      setExtQueues({ moderation: null, reportsUnread: null, contactNew: null });
      return;
    }
    let cancelled = false;
    setExtQueues('pending');
    void (async () => {
      const [mq, cr, ci] = await Promise.allSettled([
        apiFetch<{ total: number }>('/school-reviews/moderation/queue?limit=1&page=1', { token }),
        apiFetch<{ total: number }>(
          '/school-reviews/content-reports/admin?unread_only=true&limit=1&page=1',
          { token },
        ),
        apiFetch<{ total: number }>('/admin/contact-submissions?status=new&limit=1&page=1', { token }),
      ]);
      if (cancelled) return;
      setExtQueues({
        moderation: mq.status === 'fulfilled' ? mq.value.total : null,
        reportsUnread: cr.status === 'fulfilled' ? cr.value.total : null,
        contactNew: ci.status === 'fulfilled' ? ci.value.total : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const schoolTypeRows = useMemo(() => {
    const m = sa?.schools_by_type ?? {};
    const ordered = SCHOOL_TYPE_ORDER.map((k) => ({ key: k, label: formatSchoolTypeLabel(k), count: m[k] ?? 0 }));
    const extras = Object.entries(m).filter(([k]) => !SCHOOL_TYPE_ORDER.includes(k as (typeof SCHOOL_TYPE_ORDER)[number]));
    return [
      ...ordered,
      ...extras.map(([key, count]) => ({ key, label: formatSchoolTypeLabel(key), count })),
    ];
  }, [sa?.schools_by_type]);

  const fmtQ = (n: number | null) => (n === null ? '—' : n);

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-violet-500/[0.08] via-background to-sky-500/[0.12] p-4 shadow-sm sm:p-5 dark:from-violet-950/30 dark:to-sky-950/20">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-violet-400/20 to-transparent blur-3xl" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ToolbarHeading>
            <ToolbarPageTitle className="text-xl sm:text-2xl">Genel pano</ToolbarPageTitle>
            <div className="max-w-xl text-xs font-normal text-muted-foreground sm:text-sm">
              Hoş geldiniz, {displayName} · Kurulum, bekleyen kuyruklar ve trendler
            </div>
          </ToolbarHeading>
        </div>
      </div>

      <WelcomeMotivationBanner />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={!stats}
          onClick={() => stats && downloadSuperadminStatsCsv(stats)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 sm:text-sm"
        >
          <Download className="size-4" />
          CSV indir
        </button>
        <Link
          href="/market"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted sm:text-sm"
        >
          Market detay
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/schools?status=askida"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted sm:text-sm"
        >
          Askıdaki okullar
        </Link>
      </div>

      {sa && (sa.schools_lise_unspecified_count ?? 0) > 0 && (
        <Alert variant="warning" className="border-amber-500/35 bg-amber-500/[0.07]">
          <strong className="font-semibold text-foreground">{sa.schools_lise_unspecified_count ?? 0} okul</strong> yalnızca genel
          &quot;Lise&quot; türünde kayıtlı. Meslek lisesi, İHL veya Bilsem ise{' '}
          <Link href="/schools" className="font-medium text-primary hover:underline">
            okul listesinden
          </Link>{' '}
          türü güncelleyin.
        </Alert>
      )}

      {marketQ.data && (
        <Card className="border-border/60">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="text-sm">Market (bu ay)</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              IAP / tüketim — {marketQ.data.period_labels?.month ?? ''}
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[11px] sm:text-xs">
            <div className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="text-[10px] text-muted-foreground sm:text-xs">IAP — kullanıcı</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.purchases.month.user.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.purchases.month.user.ekders.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="text-[10px] text-muted-foreground sm:text-xs">IAP — okul</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.purchases.month.school.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.purchases.month.school.ekders.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="text-[10px] text-muted-foreground sm:text-xs">Tüketim — kullanıcı</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.consumption.month.user.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.consumption.month.user.ekders.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-2">
              <p className="text-[10px] text-muted-foreground sm:text-xs">Tüketim — okul</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.consumption.month.school.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.consumption.month.school.ekders.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {marketQ.isError && (
        <p className="text-xs text-muted-foreground">Market özeti yüklenemedi (market politikası kapalı olabilir).</p>
      )}

      {sa && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4 text-primary" aria-hidden />
              Bekleyenler (kuyruk & modül)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Tıklanabilir kutular ilgili ekrana gider</p>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Link
              href="/users?role=teacher&teacher_school_membership=pending"
              className="rounded-lg border border-border/70 bg-card/80 p-2 transition-colors hover:border-amber-500/40 hover:bg-muted/30"
            >
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Öğretmen onayı</p>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">{sa.teachers_pending_approval}</p>
            </Link>
            <Link
              href="/schools?status=askida"
              className="rounded-lg border border-border/70 bg-card/80 p-2 transition-colors hover:border-amber-500/40 hover:bg-muted/30"
            >
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Askıdaki okul</p>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">{askidaSchoolCount}</p>
            </Link>
            <div className="rounded-lg border border-border/70 bg-card/80 p-2">
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Kota dolu</p>
              <p className="text-lg font-semibold tabular-nums text-rose-600 sm:text-xl dark:text-rose-400">
                {sa.schools_teacher_quota_full}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/80 p-2">
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Kota %{nearPct}+</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700 sm:text-xl dark:text-amber-300">
                {sa.schools_teacher_quota_near}
              </p>
            </div>
            <Link
              href="/school-reviews-settings"
              className="rounded-lg border border-border/70 bg-card/80 p-2 transition-colors hover:border-primary/35 hover:bg-muted/30"
            >
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Değerlendirme · moderasyon</p>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">
                {extQueues === 'pending' ? '…' : fmtQ(extQueues.moderation)}
              </p>
            </Link>
            <Link
              href="/school-reviews-settings"
              className="rounded-lg border border-border/70 bg-card/80 p-2 transition-colors hover:border-primary/35 hover:bg-muted/30"
            >
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Değerlendirme · bildirim</p>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">
                {extQueues === 'pending' ? '…' : fmtQ(extQueues.reportsUnread)}
              </p>
            </Link>
            <Link
              href="/contact-inbox"
              className="rounded-lg border border-border/70 bg-card/80 p-2 transition-colors hover:border-primary/35 hover:bg-muted/30"
            >
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">İletişim · yeni</p>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">
                {extQueues === 'pending' ? '…' : fmtQ(extQueues.contactNew)}
              </p>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader className="space-y-0.5 py-3">
          <CardTitle className="text-sm">Yıllık platform trafiği</CardTitle>
          <p className="text-[11px] text-muted-foreground">Kayıt ve duyuru</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[220px] w-full min-w-0 min-h-[180px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={combinedMonthlyActivity} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="ay" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="yeni_kullanici" name="Yeni kullanıcı" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="yeni_duyuru" name="Yeni duyuru" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Okul',
            sub: 'Toplam kurum',
            value: stats?.schools,
            color: 'from-teal-500/15 to-teal-500/5',
            Icon: School,
            iconWrap:
              'bg-teal-500/15 text-teal-600 ring-teal-500/20 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/25',
          },
          {
            title: 'Kullanıcı',
            sub: 'Kayıtlı kullanıcı',
            value: stats?.users,
            color: 'from-indigo-500/15 to-indigo-500/5',
            Icon: Users,
            iconWrap:
              'bg-indigo-500/15 text-indigo-600 ring-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/25',
          },
          {
            title: 'Öğretmen',
            sub: 'Onay bekleyen',
            value: sa?.teachers_pending_approval,
            color: 'from-amber-500/15 to-amber-500/5',
            Icon: UserPlus,
            iconWrap:
              'bg-amber-500/15 text-amber-600 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/25',
          },
          {
            title: 'Duyuru',
            sub: 'Toplam kayıt',
            value: stats?.announcements,
            color: 'from-violet-500/15 to-violet-500/5',
            Icon: Megaphone,
            iconWrap:
              'bg-violet-500/15 text-violet-600 ring-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/25',
          },
        ].map((k) => (
          <Card
            key={k.title}
            className={`border-border/60 bg-gradient-to-br ${k.color} shadow-sm`}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ${k.iconWrap}`}
                >
                  <k.Icon className="size-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">{k.title}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {k.sub}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {statsError ? '—' : k.value ?? '—'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="text-sm">Okul durumu</CardTitle>
            <p className="text-[11px] text-muted-foreground">Deneme / aktif / askıda</p>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : (
              sa && (
                <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
                  <div className="h-[140px] min-h-[120px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={schoolStatusPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={54}
                          paddingAngle={2}
                        >
                          {schoolStatusPieData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border)',
                            background: 'var(--card)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(sa.schools_by_status).map(([st, n]) => (
                      <div
                        key={st}
                        className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-xs"
                      >
                        <span>{SCHOOL_STATUS_LABELS[st] ?? st}</span>
                        <span className="font-semibold tabular-nums">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
              Öğretmen kotası & uyarılar
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Dolu / %{nearPct}+</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-xs">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              sa && (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Kota dolu</span>
                    <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {sa.schools_teacher_quota_full}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Kota %{nearPct}+</span>
                    <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {sa.schools_teacher_quota_near}
                    </span>
                  </div>
                  {sa.schools_askida.length === 0 &&
                  sa.schools_teacher_full.length === 0 &&
                  sa.teachers_pending_approval === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Liste boş.</p>
                  ) : (
                    <details className="rounded-md border border-border/60 bg-muted/20 p-2">
                      <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                        Okul listeleri ({sa.schools_askida.length + sa.schools_teacher_full.length})
                      </summary>
                      <div className="mt-2 max-h-28 space-y-2 overflow-y-auto text-[11px]">
                        {sa.schools_askida.length > 0 && (
                          <div>
                            <p className="mb-1 flex items-center gap-1 font-medium">
                              <AlertTriangle className="size-3 text-amber-600" />
                              Askıda
                              <Link href="/schools?status=askida" className="ml-auto text-primary hover:underline">
                                Tümü
                              </Link>
                            </p>
                            <ul className="space-y-0.5">
                              {sa.schools_askida.slice(0, 8).map((s) => (
                                <li key={s.id}>
                                  <Link href={`/schools/${s.id}`} className="text-primary hover:underline">
                                    {s.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                            {sa.schools_askida.length > 8 ? (
                              <p className="mt-1 text-[10px] text-muted-foreground">+{sa.schools_askida.length - 8} daha</p>
                            ) : null}
                          </div>
                        )}
                        {sa.schools_teacher_full.length > 0 && (
                          <div>
                            <p className="mb-1 flex items-center gap-1 font-medium">
                              <UserPlus className="size-3 text-rose-600" />
                              Kota dolu
                            </p>
                            <ul className="space-y-0.5">
                              {sa.schools_teacher_full.slice(0, 8).map((s) => (
                                <li key={s.id} className="flex justify-between gap-2">
                                  <Link href={`/schools/${s.id}`} className="min-w-0 truncate text-primary hover:underline">
                                    {s.name}
                                  </Link>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {s.teacher_count}/{s.teacher_limit}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {sa.schools_teacher_full.length > 8 ? (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                +{sa.schools_teacher_full.length - 8} daha
                              </p>
                            ) : null}
                          </div>
                        )}
                        {sa.teachers_pending_approval > 0 && (
                          <Link
                            href="/users?role=teacher&teacher_school_membership=pending"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            {sa.teachers_pending_approval} öğretmen onayı
                            <ArrowRight className="size-3" />
                          </Link>
                        )}
                      </div>
                    </details>
                  )}
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {sa && (
        <Card className="border-border/60">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="text-sm">Okullar — tür</CardTitle>
            <p className="text-[11px] text-muted-foreground">Türe göre sayı</p>
          </CardHeader>
          <CardContent className="max-h-44 overflow-y-auto overflow-x-auto pt-0">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Tür</th>
                    <th className="py-2 text-right font-medium">Okul</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolTypeRows.map(({ key, label, count }) => (
                    <tr key={key} className="border-b border-border/60">
                      <td className="py-2 pr-4">{label}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {sa && (sa.recent_schools?.length || sa.recent_users?.length) ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Son eklenen okullar</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-2">
                {(sa.recent_schools ?? []).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
                    <Link href={`/schools/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Son kayıt olan kullanıcılar</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-2">
                {(sa.recent_users ?? []).map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
                    <Link href={`/users/${u.id}`} className="font-medium text-primary hover:underline">
                      {u.display_name || u.email}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[u.role] ?? u.role} · {new Date(u.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="text-sm">Kullanıcı rolleri</CardTitle>
            <p className="text-[11px] text-muted-foreground">Dağılım</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[220px] w-full min-w-0 min-h-[180px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={rolePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {rolePieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="space-y-0.5 py-3">
            <CardTitle className="text-sm">Hesap durumları</CardTitle>
            <p className="text-[11px] text-muted-foreground">Aktif / pasif / askıda</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[220px] w-full min-w-0 min-h-[180px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {statusPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-0.5 py-3">
          <CardTitle className="text-sm">Modül — kaç okulda açık</CardTitle>
          <p className="text-[11px] text-muted-foreground">Boş = tümü açık varsayımı</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px] w-full min-w-0 min-h-[180px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={moduleBarData}
                  layout="vertical"
                  margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                    }}
                  />
                  <Bar dataKey="okul" name="Okul sayısı" radius={[0, 4, 4, 0]}>
                    {moduleBarData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <details className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
          Yönetim sayfalarına git (kısayol)
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: '/schools', label: 'Okullar', icon: School },
            { href: '/users', label: 'Kullanıcılar', icon: Users },
            { href: '/modules', label: 'Modüller', icon: Puzzle },
            { href: '/announcements', label: 'Duyurular', icon: Megaphone },
            { href: '/hesaplamalar', label: 'Hesaplamalar', icon: Calculator },
            { href: '/bilsem-sablon', label: 'Bilsem', icon: FileText },
            { href: '/school-join-queue', label: 'Okul birleştirme', icon: Building2 },
            { href: '/contact-inbox', label: 'İletişim kutusu', icon: Inbox },
            { href: '/school-reviews-settings', label: 'Okul değerlendirme', icon: ShieldAlert },
            { href: '/support/platform', label: 'Destek', icon: LifeBuoy },
            { href: '/web-ayarlar', label: 'Web ayarları', icon: Globe },
            { href: '/profile', label: 'Profil', icon: LayoutDashboard },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-muted/50"
            >
              <item.icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
              {item.label}
            </Link>
          ))}
        </div>
      </details>

      {statsError && (
        <Alert message="Bazı istatistikler yüklenemedi. Sayfayı yenileyin." variant="error" />
      )}

      <Card variant="teal" soft>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Hesap</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Profil</dt>
              <dd className="mt-1 font-medium text-foreground">{me.display_name || me.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Rol</dt>
              <dd className="mt-1 text-foreground">Süper Admin</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">E-posta</dt>
              <dd className="mt-1 text-foreground">{me.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Detay</dt>
              <dd className="mt-1">
                <Link href="/profile" className="font-medium text-primary hover:underline">
                  Profil sayfasına git
                </Link>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
