'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  CHANNEL_LABELS,
  TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  fetchMessagingReports,
  fetchWeeklyPrincipalReport,
  fetchMissingPhones,
  fetchB2GOverview,
  reportsExportUrl,
  type MessagingReportsOverview,
  msgQ,
} from '@/lib/messaging-api';
import { getApiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
  TrendingUp,
  XCircle,
  AlertTriangle,
  Clock,
  PieChart,
  Download,
} from 'lucide-react';

async function downloadCsv(token: string, path: string, filename: string) {
  const res = await fetch(getApiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) throw new Error('İndirme başarısız');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className={cn('rounded-2xl border p-3 shadow-sm', accent)}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      {sub ? <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function BarRow({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between gap-2 text-[11px]">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{right ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/50">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniTimeline({ rows }: { rows: MessagingReportsOverview['timeline'] }) {
  const max = Math.max(1, ...rows.map((r) => r.sent + r.failed));
  if (!rows.length) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Bu aralıkta gönderim kaydı yok</p>;
  }
  return (
    <div className="flex items-end gap-1 h-28 pt-2">
      {rows.map((r) => {
        const total = r.sent + r.failed;
        const h = Math.max(4, Math.round((total / max) * 100));
        const failH = total > 0 ? Math.round((r.failed / total) * h) : 0;
        const okH = h - failH;
        return (
          <div key={r.day} className="flex flex-1 flex-col items-center gap-0.5 min-w-0" title={`${r.day}: ${r.sent} başarılı, ${r.failed} hatalı`}>
            <div className="flex w-full max-w-[14px] flex-col justify-end rounded-t-sm overflow-hidden" style={{ height: `${h}%` }}>
              <div className="w-full bg-emerald-500" style={{ height: `${okH}%` }} />
              {failH > 0 ? <div className="w-full bg-red-400" style={{ height: `${failH}%` }} /> : null}
            </div>
            <span className="text-[8px] text-muted-foreground rotate-0 truncate w-full text-center">
              {r.day.slice(8)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function MesajRaporlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState<MessagingReportsOverview | null>(null);
  const [weekly, setWeekly] = useState<Record<string, unknown> | null>(null);
  const [missingCount, setMissingCount] = useState(0);
  const [b2g, setB2g] = useState<Array<{ schoolName: string; sent: number; failed: number }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const [r, w, m] = await Promise.all([
        fetchMessagingReports(token, q, range),
        fetchWeeklyPrincipalReport(token, q).catch(() => null),
        fetchMissingPhones(token, q).catch(() => ({ missing: [] })),
      ]);
      setReport(r);
      setWeekly(w);
      setMissingCount(Array.isArray(m?.missing) ? m.missing.length : 0);
      if (me?.role === 'superadmin' || me?.role === 'moderator') {
        const b = await fetchB2GOverview(token, range.from, range.to).catch(() => ({ schools: [] }));
        setB2g(b.schools ?? []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rapor yüklenemedi');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [token, q, range, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxTypeTotal = useMemo(
    () => Math.max(1, ...(report?.byType.map((t) => t.total) ?? [1])),
    [report?.byType],
  );

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border bg-amber-50/80 p-6 text-center text-sm dark:bg-amber-950/20">
        İletim raporları yalnızca okul yöneticisi için görüntülenebilir.
      </div>
    );
  }

  if (loading && !report) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const s = report?.summary;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-emerald-500/8 p-4 shadow-sm dark:from-indigo-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold">
              <BarChart3 className="size-5 text-indigo-600" />
              İletim Raporları
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Kampanya, kanal ve alıcı bazında gönderim istatistikleri
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={loading || !token}
            onClick={() => {
              void downloadCsv(token ?? '', reportsExportUrl(q, range.from, range.to), 'mesaj-rapor.csv').catch((e) =>
                toast.error(e instanceof Error ? e.message : 'Hata'),
              );
            }}
          >
            <Download className="size-4" />
            CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()} disabled={loading}>
            {loading ? <LoadingSpinner className="size-4" /> : <RefreshCw className="size-4" />}
            Yenile
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">Başlangıç</label>
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 w-36 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">Bitiş</label>
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 w-36 text-sm" />
          </div>
          <Button size="sm" className="h-9 gap-1" onClick={() => void load()}>
            <CalendarRange className="size-4" />
            Uygula
          </Button>
        </div>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              icon={Send}
              label="Gönderilen"
              value={s.sent.toLocaleString('tr-TR')}
              sub={`${s.total.toLocaleString('tr-TR')} alıcı kaydı`}
              accent="bg-emerald-50/90 border-emerald-200/60 dark:bg-emerald-950/25 dark:border-emerald-900/40"
            />
            <StatCard
              icon={XCircle}
              label="Hatalı"
              value={s.failed.toLocaleString('tr-TR')}
              sub={s.failed > 0 ? 'Yeniden deneme önerilir' : 'Temiz dönem'}
              accent="bg-red-50/90 border-red-200/60 dark:bg-red-950/25 dark:border-red-900/40"
            />
            <StatCard
              icon={Clock}
              label="Bekleyen"
              value={s.pending.toLocaleString('tr-TR')}
              sub="Önizleme / kuyruk"
              accent="bg-amber-50/90 border-amber-200/60 dark:bg-amber-950/25 dark:border-amber-900/40"
            />
            <StatCard
              icon={TrendingUp}
              label="İletim oranı"
              value={s.deliveryRate != null ? `%${s.deliveryRate}` : '—'}
              sub="Başarılı / (başarılı+hatalı)"
              accent="bg-indigo-50/90 border-indigo-200/60 dark:bg-indigo-950/25 dark:border-indigo-900/40"
            />
            <StatCard
              icon={PieChart}
              label="Kampanya"
              value={s.campaignsTotal}
              sub={`${s.campaignsCompleted} tamamlandı`}
              accent="bg-violet-50/90 border-violet-200/60 dark:bg-violet-950/25 dark:border-violet-900/40"
            />
            <StatCard
              icon={Smartphone}
              label="Aktif gönderim"
              value={s.campaignsSending}
              sub={`${s.campaignsPreview} önizlemede`}
              accent="bg-sky-50/90 border-sky-200/60 dark:bg-sky-950/25 dark:border-sky-900/40"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white/80 p-4 shadow-sm dark:bg-zinc-900/60">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Günlük iletim</p>
              <MiniTimeline rows={report!.timeline} />
              <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-500" /> Başarılı</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-red-400" /> Hatalı</span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/80 p-4 shadow-sm dark:bg-zinc-900/60 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kanal (WhatsApp / SMS)</p>
              {report!.byChannel.length === 0 ? (
                <p className="text-xs text-muted-foreground">Henüz kanallı gönderim yok</p>
              ) : (
                report!.byChannel.map((ch) => (
                  <BarRow
                    key={ch.channel}
                    label={CHANNEL_LABELS[ch.channel] ?? ch.channel}
                    value={ch.sent}
                    max={Math.max(...report!.byChannel.map((x) => x.total))}
                    color={ch.channel === 'sms' ? 'bg-sky-500' : 'bg-emerald-500'}
                    right={`${ch.sent} ✓ · ${ch.failed} ✗${ch.successRate != null ? ` · %${ch.successRate}` : ''}`}
                  />
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white/80 p-4 shadow-sm dark:bg-zinc-900/60 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mesaj grubu / tür</p>
              {report!.byType.slice(0, 10).map((t) => (
                <BarRow
                  key={t.type}
                  label={TYPE_LABELS[t.type] ?? t.type}
                  value={t.sent}
                  max={maxTypeTotal}
                  color="bg-indigo-500"
                  right={`${t.sent}/${t.total}${t.successRate != null ? ` · %${t.successRate}` : ''}`}
                />
              ))}
            </div>

            <div className="rounded-2xl border bg-white/80 p-4 shadow-sm dark:bg-zinc-900/60 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kampanya durumu</p>
              {report!.byCampaignStatus.map((row) => (
                <BarRow
                  key={row.status}
                  label={STATUS_LABELS[row.status] ?? row.status}
                  value={row.count}
                  max={Math.max(1, s.campaignsTotal)}
                  color={
                    row.status === 'completed'
                      ? 'bg-emerald-500'
                      : row.status === 'failed'
                        ? 'bg-red-500'
                        : row.status === 'sending'
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                  }
                />
              ))}
            </div>
          </div>

          {report!.topErrors.length > 0 ? (
            <div className="rounded-2xl border border-red-200/60 bg-red-50/40 p-4 dark:border-red-900/40 dark:bg-red-950/15">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-200">
                <AlertTriangle className="size-4" />
                Sık görülen hata mesajları
              </p>
              <ul className="space-y-1.5">
                {report!.topErrors.map((e, i) => (
                  <li key={i} className="flex justify-between gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-red-900/90 dark:text-red-100/90">{e.message}</span>
                    <span className="shrink-0 font-bold tabular-nums text-red-700 dark:text-red-300">{e.count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border bg-white/80 shadow-sm dark:bg-zinc-900/60 overflow-hidden">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-bold">Kampanya detayı</p>
              <p className="text-[11px] text-muted-foreground">İletim durumu ve kanal bilgisi</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50/80 dark:bg-zinc-800/50">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Kampanya</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Tür</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Kanal</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">İletim</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Durum</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {report!.recentCampaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="max-w-[200px] truncate px-3 py-2.5 font-medium">
                        <Link href={`/mesaj-merkezi/kampanya/${c.id}${q}`} className="hover:underline">
                          {c.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{TYPE_LABELS[c.type] ?? c.type}</td>
                      <td className="px-3 py-2.5">
                        {c.channel ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-zinc-800">
                            {c.channel === 'sms' ? <MessageSquare className="size-3" /> : <Smartphone className="size-3" />}
                            {CHANNEL_LABELS[c.channel] ?? c.channel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          {c.sentCount}
                        </span>
                        {c.failedCount > 0 ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="size-3" />
                            {c.failedCount}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">/ {c.totalCount}</span>
                        {c.deliveryRate != null ? (
                          <span className="ml-1 font-semibold text-indigo-600">%{c.deliveryRate}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[c.status])}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report!.recentCampaigns.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Bu tarih aralığında kampanya yok</p>
            ) : null}
          </div>

          {weekly ? (
            <div className="rounded-2xl border p-4 text-sm">
              <p className="font-bold">Haftalık müdür özeti</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(weekly.overview as { summary?: { sent?: number; failed?: number } })?.summary?.sent ?? 0} gönderildi ·{' '}
                {(weekly.overview as { summary?: { failed?: number } })?.summary?.failed ?? 0} hata ·{' '}
                {Array.isArray((weekly as { riskTop?: unknown[] }).riskTop) ? (weekly as { riskTop: unknown[] }).riskTop.length : 0} risk kaydı
              </p>
              <Link href={`/mesaj-merkezi/otomasyon${q}`} className="text-xs text-indigo-600 underline">Otomasyon ayarları</Link>
            </div>
          ) : null}
          {missingCount > 0 ? (
            <p className="text-xs text-amber-700">⚠ Son kampanyalarda {missingCount} alıcıda telefon eksik — Veli rehberi / Excel kontrol edin.</p>
          ) : null}
          {b2g.length > 0 ? (
            <div className="rounded-2xl border p-4">
              <p className="font-bold text-sm mb-2">İlçe / çoklu okul (B2G)</p>
              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {b2g.map((s) => (
                  <li key={s.schoolName}>{s.schoolName}: {s.sent} gönderim, {s.failed} hata</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-center text-[11px] text-muted-foreground">
            <Link href={`/mesaj-merkezi${q}`} className="font-semibold text-indigo-600 hover:underline">
              Genel Bakış
            </Link>
            {' '}· yeni kampanya oluşturmak için modül sayfalarını kullanın
          </p>
        </>
      ) : null}
    </div>
  );
}
