'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { BarChart3, TrendingUp, Wallet, FileText } from 'lucide-react';
import { dtFileStatusBadgeClass, dtFileStatusLabel, dtTeminTypeLabel, DT_LEGAL_NOTICE, dtFormatNumberTr } from '@/lib/dt-ui';

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

export default function DtDashboardPage() {
  const { token, me } = useAuth();
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const schoolId = (me as { school_id?: string })?.school_id ?? me?.school?.id ?? '';

  const fetchDashboard = useCallback(async () => {
    if (!token || !ok) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>(dtUrl('/dogrudan-temin/dashboard', me?.role, schoolId), { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [ok, schoolId, token, me?.role]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  if (loading) return <LoadingSpinner label="Yükleniyor…" className="py-10" />;
  if (error) return <Alert message={error} />;

  return (
    <div className="space-y-3">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">Doğrudan Temin Dashboard</ToolbarPageTitle>
        </ToolbarHeading>
      </Toolbar>

      {data ? (
        <div className="space-y-4">
          <Alert variant="info" message={DT_LEGAL_NOTICE} />
          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Aktif Dosya</p>
                    <p className="text-2xl font-bold">{data.summary.active_files}</p>
                  </div>
                  <FileText className="size-5 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Yaklaşık Toplam</p>
                    <p className="text-lg font-bold">{dtFormatNumberTr(data.summary.approx_total)}</p>
                    <p className="text-xs text-muted-foreground">₺</p>
                  </div>
                  <TrendingUp className="size-5 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Karar Toplam</p>
                    <p className="text-lg font-bold">{dtFormatNumberTr(data.summary.decision_total)}</p>
                    <p className="text-xs text-muted-foreground">₺</p>
                  </div>
                  <BarChart3 className="size-5 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Ödenen</p>
                    <p className="text-lg font-bold">{dtFormatNumberTr(data.summary.payment_total)}</p>
                    <p className="text-xs text-muted-foreground">₺</p>
                  </div>
                  <Wallet className="size-5 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-red-500">
              <CardContent className="pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Bekleyen Ödeme</p>
                  <p className="text-lg font-bold text-red-600">{dtFormatNumberTr(data.summary.pending_payment)}</p>
                  <p className="text-xs text-muted-foreground">₺</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* By Type Distribution */}
          {data.by_type.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Temin Türüne Göre Dağılım</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto rounded-md border border-border text-xs">
                  <table className="w-full min-w-[500px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Temin Türü</th>
                        <th className="px-2 py-1.5 text-right">Dosya</th>
                        <th className="px-2 py-1.5 text-right">Yaklaşık</th>
                        <th className="px-2 py-1.5 text-right">Karar</th>
                        <th className="px-2 py-1.5 text-right">Ödenen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.by_type.map((item) => (
                        <tr key={item.temin_type} className="hover:bg-muted/30">
                          <td className="px-2 py-1 font-medium">{dtTeminTypeLabel(item.temin_type)}</td>
                          <td className="px-2 py-1 text-right">{item.count}</td>
                          <td className="px-2 py-1 text-right">{dtFormatNumberTr(item.approx_total)}</td>
                          <td className="px-2 py-1 text-right">{dtFormatNumberTr(item.decision_total)}</td>
                          <td className="px-2 py-1 text-right text-green-600">{dtFormatNumberTr(item.payment_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Files */}
          {data.recent_files.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Son Dosyalar</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data.recent_files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 p-2 text-xs">
                      <div>
                        <p className="font-medium">{file.subject}</p>
                        <p className="text-muted-foreground">{file.year}/{file.file_no}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">{dtTeminTypeLabel(file.temin_type)}</p>
                        <p className={`rounded px-2 py-0.5 text-[10px] font-semibold ${dtFileStatusBadgeClass(file.status)}`}>
                          {dtFileStatusLabel(file.status)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Payments */}
          {data.recent_payments.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Son Ödemeler</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto rounded-md border border-border text-xs">
                  <table className="w-full min-w-[400px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Tarih</th>
                        <th className="px-2 py-1.5">Tutar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.recent_payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-muted/30">
                          <td className="px-2 py-1">{new Date(payment.paid_at).toLocaleDateString('tr-TR')}</td>
                          <td className="px-2 py-1 font-medium">{dtFormatNumberTr(payment.amount)} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
