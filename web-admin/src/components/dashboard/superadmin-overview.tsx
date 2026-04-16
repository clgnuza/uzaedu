'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  Download,
  FileText,
  LayoutDashboard,
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

  const regChart =
    sa?.users_registration_chart.map((d) => ({ name: d.month, kayit: d.count })) ?? [];

  const annChart = chartData.map((d) => ({ name: d.month, duyuru: d.count }));

  const schoolTypeRows = useMemo(() => {
    const m = sa?.schools_by_type ?? {};
    const ordered = SCHOOL_TYPE_ORDER.map((k) => ({ key: k, label: formatSchoolTypeLabel(k), count: m[k] ?? 0 }));
    const extras = Object.entries(m).filter(([k]) => !SCHOOL_TYPE_ORDER.includes(k as (typeof SCHOOL_TYPE_ORDER)[number]));
    return [
      ...ordered,
      ...extras.map(([key, count]) => ({ key, label: formatSchoolTypeLabel(key), count })),
    ];
  }, [sa?.schools_by_type]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/[0.08] via-background to-sky-500/[0.12] p-6 shadow-sm sm:p-8 dark:from-violet-950/30 dark:to-sky-950/20">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-violet-400/20 to-transparent blur-3xl" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-5">
          <ToolbarHeading>
            <ToolbarPageTitle className="text-2xl sm:text-3xl">Genel pano</ToolbarPageTitle>
            <div className="max-w-xl text-sm font-normal text-muted-foreground">
              Hoş geldiniz, {displayName} · Tüm kurumlar, kullanıcılar ve modül kullanımı tek ekranda
            </div>
          </ToolbarHeading>
        </div>
      </div>

      <WelcomeMotivationBanner />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!stats}
          onClick={() => stats && downloadSuperadminStatsCsv(stats)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Download className="size-4" />
          CSV indir
        </button>
        <Link
          href="/market"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Market detay
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/schools?status=askida"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
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
          <CardHeader>
            <CardTitle className="text-base">Market (bu ay)</CardTitle>
            <p className="text-xs text-muted-foreground">
              IAP yükleme ve modül tüketimi — {marketQ.data.period_labels?.month ?? ''}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">IAP — kullanıcı</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.purchases.month.user.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.purchases.month.user.ekders.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">IAP — okul</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.purchases.month.school.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.purchases.month.school.ekders.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Tüketim — kullanıcı</p>
              <p className="font-semibold tabular-nums">
                jeton {marketQ.data.consumption.month.user.jeton.toFixed(2)} · ek ders{' '}
                {marketQ.data.consumption.month.user.ekders.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Tüketim — okul</p>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: '/schools', label: 'Okullar', sub: 'Kurum listesi', icon: School, accent: 'teal' },
          { href: '/users', label: 'Kullanıcılar', sub: 'Rol ve durum', icon: Users, accent: 'indigo' },
          { href: '/modules', label: 'Modüller', sub: 'Okul politikaları', icon: Puzzle, accent: 'violet' },
          { href: '/announcements', label: 'Duyurular', sub: 'İçerik yönetimi', icon: Megaphone, accent: 'rose' },
          { href: '/hesaplamalar', label: 'Hesaplamalar', sub: 'Ek ders ve sınav ücreti', icon: Calculator, accent: 'sky' },
          { href: '/bilsem-sablon', label: 'Bilsem altyapı', sub: 'Takvim & kazanım', icon: FileText, accent: 'emerald' },
          { href: '/support/platform', label: 'Destek', sub: 'Platform talepleri', icon: Building2, accent: 'amber' },
          { href: '/profile', label: 'Profil', sub: 'Hesap & özet', icon: LayoutDashboard, accent: 'slate' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 sm:size-10 ${k.iconWrap}`}
                >
                  <k.Icon className="size-4 sm:size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-bold leading-tight text-foreground">{k.title}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    {k.sub}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {statsError ? '—' : k.value ?? '—'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Okul durumu</CardTitle>
            <p className="text-xs text-muted-foreground">Deneme / aktif / askıda</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              sa &&
              Object.entries(sa.schools_by_status).map(([st, n]) => (
                <div
                  key={st}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm"
                >
                  <span>{SCHOOL_STATUS_LABELS[st] ?? st}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Öğretmen kotası</CardTitle>
            <p className="text-xs text-muted-foreground">
              Dolu ve %{nearPct}+ (eşik: env STATS_TEACHER_QUOTA_NEAR_RATIO)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              sa && (
                <>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Kota dolu</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {sa.schools_teacher_quota_full}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Kota dolmak üzere (%{nearPct}+)</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      {sa.schools_teacher_quota_near}
                    </span>
                  </div>
                </>
              )
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/25 bg-amber-500/[0.06] lg:col-span-1">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-base">Operasyon uyarıları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              sa && (
                <>
                  {sa.schools_askida.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex flex-wrap items-center gap-2 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="size-3.5 text-amber-600" />
                          Askıdaki okullar
                        </span>
                        <Link href="/schools?status=askida" className="text-xs font-normal text-primary hover:underline">
                          Tümünü listele
                        </Link>
                      </p>
                      <ul className="space-y-1">
                        {sa.schools_askida.map((s) => (
                          <li key={s.id}>
                            <Link
                              href={`/schools/${s.id}`}
                              className="text-primary hover:underline"
                            >
                              {s.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sa.schools_teacher_full.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 font-medium text-foreground">
                        <UserPlus className="size-3.5 text-rose-600" />
                        Öğretmen kotası dolu
                      </p>
                      <ul className="space-y-1">
                        {sa.schools_teacher_full.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                              href={`/schools/${s.id}`}
                              className="text-primary hover:underline"
                            >
                              {s.name}
                            </Link>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.teacher_count}/{s.teacher_limit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sa.teachers_pending_approval > 0 && (
                    <Link
                      href="/users?role=teacher&teacher_school_membership=pending"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {sa.teachers_pending_approval} öğretmen onay bekliyor
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                  {sa.schools_askida.length === 0 &&
                    sa.schools_teacher_full.length === 0 &&
                    sa.teachers_pending_approval === 0 && (
                      <p className="text-muted-foreground">Şu an kritik uyarı yok.</p>
                    )}
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {sa && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Okullar — tür kırılımı</CardTitle>
            <p className="text-xs text-muted-foreground">Kayıtlı okul sayısı, tür alanına göre</p>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-0">
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
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Son eklenen okullar</CardTitle>
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
            <CardHeader>
              <CardTitle className="text-base">Son kayıt olan kullanıcılar</CardTitle>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Kullanıcı rolleri</CardTitle>
            <p className="text-xs text-muted-foreground">Sistem geneli dağılım</p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full min-w-0 min-h-[200px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={rolePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
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
          <CardHeader>
            <CardTitle>Hesap durumları</CardTitle>
            <p className="text-xs text-muted-foreground">Aktif / pasif / askıda</p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full min-w-0 min-h-[200px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={88}
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
        <CardHeader>
          <CardTitle>Modül — kaç okulda açık</CardTitle>
          <p className="text-xs text-muted-foreground">
            Boş liste = tüm modüller açık sayılır (okul ayarı)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] w-full min-w-0 min-h-[200px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={moduleBarData}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={128}
                    tick={{ fontSize: 11 }}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Yeni kayıtlar (bu yıl)</CardTitle>
            <p className="text-xs text-muted-foreground">Kullanıcı oluşturma — aylık</p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full min-w-0 min-h-[200px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={regChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                      }}
                    />
                    <Bar dataKey="kayit" name="Kayıt" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Duyurular (bu yıl)</CardTitle>
            <p className="text-xs text-muted-foreground">Oluşturulan duyuru — aylık</p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full min-w-0 min-h-[200px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={annChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                      }}
                    />
                    <Bar dataKey="duyuru" name="Duyuru" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
