'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  dtFileStatusBadgeClass,
  dtFileStatusLabel,
  dtTeminTypeLabel,
  DT_LEGAL_NOTICE,
  dtFormatNumberTr,
  DT_SELECT_SM,
} from '@/lib/dt-ui';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { Button } from '@/components/ui/button';

type DashboardData = {
  year: number;
  summary: {
    active_files: number;
    approx_total: string;
    decision_total: string;
    payment_total: string;
    pending_payment: string;
  };
  by_type: Array<{
    temin_type: string;
    count: number;
    approx_total: string;
    decision_total: string;
    payment_total: string;
  }>;
  recent_files: Array<{ id: string; year: number; file_no: string; subject: string; temin_type: string; status: string }>;
  recent_payments: Array<{ id: string; dt_file_id: string; amount: string; paid_at: string }>;
};

function yearOptions(center: number) {
  const out: number[] = [];
  for (let y = center + 1; y >= center - 6; y--) {
    if (y >= 2000 && y <= 2100) out.push(y);
  }
  return out;
}

export default function DtDashboardPage() {
  const { token, me } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');
  const canFetch = useMemo(() => !!token && (!isSuperadmin || !!schoolId), [token, isSuperadmin, schoolId]);

  const nowY = new Date().getFullYear();
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get('year'));
    return y >= 2000 && y <= 2100 ? y : nowY;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      u.set('year', String(year));
      router.replace(`/dogrudan-temin/dashboard?${u.toString()}`);
    },
    [router, searchParams, year],
  );

  const setYearAndUrl = useCallback(
    (y: number) => {
      setYear(y);
      const u = new URLSearchParams(searchParams.toString());
      u.set('year', String(y));
      if (isSuperadmin && schoolId) u.set('school_id', schoolId);
      router.replace(`/dogrudan-temin/dashboard?${u.toString()}`);
    },
    [isSuperadmin, router, schoolId, searchParams],
  );

  const fetchDashboard = useCallback(async () => {
    if (!canFetch || !ok) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('year', String(year));
      const res = await apiFetch<DashboardData>(
        dtUrl(`/dogrudan-temin/dashboard?${qs.toString()}`, me?.role, schoolId),
        { token },
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canFetch, me?.role, ok, schoolId, token, year]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  const yOpts = yearOptions(nowY);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-2 pb-10 pt-1 text-xs sm:px-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link
          href={dtUrl('/dogrudan-temin', me?.role, schoolId)}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Doğrudan temin
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Özet</span>
      </div>

      <header className="rounded-2xl border border-border/60 bg-gradient-to-br from-indigo-50/90 via-background to-sky-50/50 p-4 shadow-sm dark:from-indigo-950/30 dark:via-background dark:to-sky-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
              <LayoutDashboard className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <ToolbarHeading>
                <ToolbarPageTitle className="text-lg sm:text-xl">Doğrudan temin özeti</ToolbarPageTitle>
                <ToolbarDescription>
                  Seçili yıldaki aktif dosyaların yaklaşık maliyet, karar ve ödeme toplamları; son dosya ve ödeme hareketleri.
                </ToolbarDescription>
              </ToolbarHeading>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground">Yıl</span>
                  <select
                    className={DT_SELECT_SM}
                    value={year}
                    onChange={(e) => setYearAndUrl(Number(e.target.value))}
                  >
                    {yOpts.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={!canFetch || loading}
                  onClick={() => void fetchDashboard()}
                >
                  <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Yenile
                </Button>
                <Button type="button" variant="secondary" size="sm" className="h-8 gap-1" asChild>
                  <Link href={dtUrl('/dogrudan-temin', me?.role, schoolId)}>
                    Dosyalar
                    <ChevronRight className="size-3.5 opacity-70" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,100%)]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                Okul
                <DtInfoHint title="Özetin hangi okula ait olduğunu seçin." />
              </div>
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl border border-sky-200/45 bg-sky-500/8 p-3 dark:border-sky-500/20 dark:bg-sky-950/25">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
        <p className="text-[11px] leading-relaxed text-sky-950/90 dark:text-sky-50/90">
          <span className="font-semibold text-foreground">Not:</span> {DT_LEGAL_NOTICE}
        </p>
      </div>

      {error && <Alert message={error} />}

      {!canFetch ? (
        <Alert variant="info" message={isSuperadmin ? 'Önce okul seçin.' : 'Oturum yükleniyor…'} />
      ) : loading && !data ? (
        <LoadingSpinner label="Yükleniyor…" className="py-10" />
      ) : data ? (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{data.year}</span> yılı — arşivlenmemiş dosyalar
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Aktif dosya</p>
                    <p className="text-2xl font-bold tabular-nums">{data.summary.active_files}</p>
                  </div>
                  <FileText className="size-5 shrink-0 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Yaklaşık toplam</p>
                    <p className="truncate text-lg font-bold tabular-nums">{dtFormatNumberTr(data.summary.approx_total)} ₺</p>
                  </div>
                  <TrendingUp className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Karar toplam</p>
                    <p className="truncate text-lg font-bold tabular-nums">{dtFormatNumberTr(data.summary.decision_total)} ₺</p>
                  </div>
                  <BarChart3 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Ödenen</p>
                    <p className="truncate text-lg font-bold tabular-nums">{dtFormatNumberTr(data.summary.payment_total)} ₺</p>
                  </div>
                  <Wallet className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-l-4 border-l-amber-500 border-border/70 shadow-sm">
              <CardContent className="pt-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Bekleyen ödeme (tahmini)</p>
                  <p className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">
                    {dtFormatNumberTr(data.summary.pending_payment)} ₺
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.by_type.length > 0 ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Temin türüne göre</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="table-x-scroll overflow-x-auto rounded-md border border-border text-xs">
                  <table className="w-full min-w-[520px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Temin türü</th>
                        <th className="px-2 py-1.5 text-right">Dosya</th>
                        <th className="px-2 py-1.5 text-right">Yaklaşık</th>
                        <th className="px-2 py-1.5 text-right">Karar</th>
                        <th className="px-2 py-1.5 text-right">Ödenen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.by_type.map((item) => (
                        <tr key={item.temin_type} className="hover:bg-muted/30">
                          <td className="px-2 py-1.5 font-medium">{dtTeminTypeLabel(item.temin_type)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{item.count}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{dtFormatNumberTr(item.approx_total)} ₺</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{dtFormatNumberTr(item.decision_total)} ₺</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                            {dtFormatNumberTr(item.payment_total)} ₺
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {data.recent_files.length > 0 ? (
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Son dosyalar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {data.recent_files.map((file) => (
                    <Link
                      key={file.id}
                      href={dtUrl(`/dogrudan-temin/${file.id}`, me?.role, schoolId)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs transition hover:border-primary/30 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{file.subject}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {file.year}/{file.file_no}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-muted-foreground">{dtTeminTypeLabel(file.temin_type)}</p>
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${dtFileStatusBadgeClass(file.status)}`}>
                          {dtFileStatusLabel(file.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-border/80 shadow-sm">
                <CardContent className="py-8 text-center text-[11px] text-muted-foreground">
                  Bu yıl için henüz aktif dosya yok.
                </CardContent>
              </Card>
            )}

            {data.recent_payments.length > 0 ? (
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Son ödemeler</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="table-x-scroll overflow-x-auto rounded-md border border-border text-xs">
                    <table className="w-full min-w-[280px] text-left">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5">Tarih</th>
                          <th className="px-2 py-1.5 text-right">Tutar</th>
                          <th className="px-2 py-1.5 text-right"> </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.recent_payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('tr-TR') : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium tabular-nums">{dtFormatNumberTr(payment.amount)} ₺</td>
                            <td className="px-2 py-1.5 text-right">
                              <Link
                                href={dtUrl(`/dogrudan-temin/${payment.dt_file_id}`, me?.role, schoolId)}
                                className="text-primary hover:underline"
                              >
                                Dosya
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-border/80 shadow-sm">
                <CardContent className="py-8 text-center text-[11px] text-muted-foreground">Kayıtlı ödeme yok.</CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
