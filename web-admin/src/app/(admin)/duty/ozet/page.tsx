'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, Scale, RefreshCw, Users, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { DutyDistributionChart } from '@/components/duty/duty-distribution-chart';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { cn } from '@/lib/utils';

type SummaryItem = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  slot_count: number;
  weighted_count?: number;
  replacement_count?: number;
  regular_count?: number;
  coverage_lesson_count?: number;
};

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STORAGE_INCLUDE_ARCHIVED = 'duty-ozet-include-archived';

const QUICK_RANGES = [
  { label: 'Bu ay', days: 0, thisMonth: true },
  { label: 'Son 30 gün', days: 30 },
  { label: 'Son 90 gün', days: 90 },
];

function getRangeFromPreset(preset: { days: number; thisMonth?: boolean }) {
  const now = new Date();
  if (preset.thisMonth) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYMD(from), to: toYMD(now) };
  }
  const from = new Date(now);
  from.setDate(now.getDate() - preset.days);
  return { from: toYMD(from), to: toYMD(now) };
}

export default function DutyOzetPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [to, setTo] = useState(() => toYMD(new Date()));
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_INCLUDE_ARCHIVED);
      if (v === '1') setIncludeArchived(true);
    } catch { /* ignore */ }
  }, []);

  // En son yayınlanan planın tarihlerine git
  useEffect(() => {
    if (!token) return;
    apiFetch<{ period_start: string | null; period_end: string | null; status: string; archived_at?: string | null }[]>('/duty/plans', { token })
      .then((plans) => {
        const published = Array.isArray(plans)
          ? plans.filter((p) => p.status === 'published' && p.period_start && !p.archived_at)
              .sort((a, b) => (b.period_start! > a.period_start! ? 1 : -1))
          : [];
        if (published[0]?.period_start) {
          setFrom(published[0].period_start.slice(0, 10));
          setTo(published[0].period_end?.slice(0, 10) ?? toYMD(new Date()));
        }
      })
      .catch(() => {/* ignore */});
  }, [token]);

  const [eligibleTeacherCount, setEligibleTeacherCount] = useState<number | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const arch = includeArchived ? '&include_archived=1' : '';
      const res = await apiFetch<{ items: SummaryItem[]; eligible_teacher_count?: number }>(
        `/duty/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${arch}`,
        { token },
      );
      setItems(res?.items ?? []);
      setEligibleTeacherCount(typeof res?.eligible_teacher_count === 'number' ? res.eligible_teacher_count : null);
    } catch {
      setItems([]);
      setEligibleTeacherCount(null);
    } finally {
      setLoading(false);
    }
  }, [token, from, to, includeArchived]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Sadece ders saati yerine görevlendirme (duty_coverage, gelmeyen öğretmenin ders saatine atama)
  const totalCoverage = items.reduce((a, i) => a + (i.coverage_lesson_count ?? 0), 0);
  const yerineGorevAlanCount = items.filter((i) => (i.coverage_lesson_count ?? 0) > 0).length;
  const dersSaatiGorevAlanCount = items.filter((i) => (i.coverage_lesson_count ?? 0) > 0).length;
  const nEligible = eligibleTeacherCount != null && eligibleTeacherCount > 0 ? eligibleTeacherCount : items.length;
  const avgCoverage = dersSaatiGorevAlanCount > 0 ? (totalCoverage / dersSaatiGorevAlanCount).toFixed(1) : '—';

  const shares =
    totalCoverage > 0
      ? items
          .filter((i) => (i.coverage_lesson_count ?? 0) > 0)
          .map((i) => (i.coverage_lesson_count ?? 0) / totalCoverage)
      : [];
  const maxShare = shares.length ? Math.max(...shares) : 0;
  const minShare = shares.length ? Math.min(...shares) : 0;
  const shareRange = shares.length >= 2 ? maxShare - minShare : 0;
  const fairLabel = shareRange <= 0.25 ? 'Dengeli' : shareRange <= 0.5 ? 'Kısmen dengeli' : 'Dengesiz';
  const fairColor = shareRange > 0.5 ? 'rose' : shareRange > 0.25 ? 'amber' : 'emerald';
  const idealPct = nEligible > 0 ? (1 / nEligible) * 100 : 0;
  const fairSub =
    totalCoverage > 0 && nEligible > 0
      ? `Görev alanlar arası oran farkı: %${(shareRange * 100).toFixed(0)} · Hedef pay (uygun ${nEligible} öğr.): ~%${idealPct.toFixed(0)}`
      : 'Görevlendirme yok';

  return (
    <div className="space-y-6">
      <DutyPageHeader
        icon={BarChart2}
        title="İstatistikler"
        description="Gelmeyen öğretmenin ders saatine yapılan yerine görevlendirme (saat sayısı). Tam gün nöbet yerine atama bu özetde yoktur."
        color="purple"
        actions={
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Yenile
          </Button>
        }
      />

      {/* Hızlı tarih seçimi + özel aralık */}
      <Card className="border-0 bg-muted/40 shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Hızlı presetler */}
            <div className="flex items-center gap-1.5">
              {QUICK_RANGES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => {
                    const range = getRangeFromPreset(r);
                    setFrom(range.from);
                    setTo(range.to);
                    setActivePreset(i);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    activePreset === i
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/50',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {/* Özel aralık */}
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Başlangıç</Label>
                <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setActivePreset(null); }} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bitiş</Label>
                <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setActivePreset(null); }} className="h-9" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-border accent-primary"
                checked={includeArchived}
                onChange={(e) => {
                  const on = e.target.checked;
                  setIncludeArchived(on);
                  try {
                    localStorage.setItem(STORAGE_INCLUDE_ARCHIVED, on ? '1' : '0');
                  } catch { /* ignore */ }
                }}
              />
              Arşivlenmiş planları hesaba kat
            </label>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">Veriler yükleniyor…</p>
        </div>
      ) : !items.length ? (
        <EmptyState
          icon={<BarChart2 className="size-12 text-muted-foreground/50" />}
          title="Veri bulunamadı"
          description="Seçilen tarih aralığında yayınlanmış nöbet kaydı yok."
        />
      ) : (
        <div className="space-y-5">
          {/* Özet kartları — Sadece görevlendirme metrikleri */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Toplam Ders Görevi"
              value={totalCoverage}
              icon={ArrowLeftRight}
              color="blue"
              sub={totalCoverage > 0 ? 'gelmeyen öğretmenin yerine girilen saat' : 'görevlendirme yok'}
            />
            <StatCard
              label="Yerine görev alan öğretmen"
              value={yerineGorevAlanCount}
              icon={Users}
              color="purple"
              sub={
                eligibleTeacherCount != null
                  ? `En az bir ders saati yerine giren · Liste ${items.length} · Uygun ${eligibleTeacherCount}`
                  : `Ders saati yerine görev alan · Liste ${items.length}`
              }
            />
            <StatCard
              label="Kişi Başı Ort."
              value={avgCoverage}
              icon={BarChart2}
              color="amber"
              sub="ortalama ders saati"
            />
            <StatCard
              label="Adil Dağılım"
              value={fairLabel}
              icon={Scale}
              color={fairColor as 'emerald' | 'amber' | 'rose'}
              sub={fairSub}
            />
          </div>

          {/* Öğretmen bazlı yatay çubuk; grafik bileşeni yalnız pozitif değerleri gösterir */}
          <Card>
            <CardHeader className="pb-3 space-y-1">
              <CardTitle className="text-base font-semibold">Öğretmenlere göre ders görevi</CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yerine girilen ders saati sayısı · En fazla görev alanlar üstte
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <DutyDistributionChart
                items={items}
                minimal
                showFairness={false}
                maxBars={15}
                height={Math.min(280, Math.max(160, Math.min(items.filter((i) => (i.coverage_lesson_count ?? 0) > 0).length, 15) * 22))}
                valueKey="coverage_lesson_count"
              />
            </CardContent>
          </Card>

          {/* Ders Görevi Sıralaması — Oranlı görevlendirme */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowLeftRight className="size-4 text-orange-500" />
                  Ders Görevi Sıralaması
                </CardTitle>
                <span className="text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded px-2 py-0.5">
                  Oranlı görevlendirme — Hedef: ~%{totalCoverage > 0 && nEligible > 0 ? ((1 / nEligible) * 100).toFixed(0) : '—'} (uygun öğretmen başına)
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-x-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Öğretmen</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Saat</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Oran %</th>
                      <th className="px-4 py-3 hidden sm:table-cell font-medium text-muted-foreground text-center">Dağılım</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...items]
                      .sort((a, b) => (b.coverage_lesson_count ?? 0) - (a.coverage_lesson_count ?? 0))
                      .map((row, idx) => {
                        const val = row.coverage_lesson_count ?? 0;
                        const sharePct = totalCoverage > 0 ? (val / totalCoverage) * 100 : 0;
                        const idealPct = nEligible > 0 ? (1 / nEligible) * 100 : 0;
                        const maxVal = Math.max(...items.map((i) => i.coverage_lesson_count ?? 0), 1);
                        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                        const barColor = sharePct <= idealPct * 1.2 ? 'bg-emerald-500' : sharePct <= idealPct * 1.8 ? 'bg-amber-500' : 'bg-orange-500';
                        return (
                          <tr key={row.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium">{row.display_name || row.email || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {val > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                  {val} saat
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn(
                                'text-xs font-medium',
                                sharePct > idealPct * 1.5 ? 'text-orange-600 dark:text-orange-400' : sharePct < idealPct * 0.5 && val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                              )}>
                                {totalCoverage > 0 ? `${sharePct.toFixed(1)}%` : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 max-w-36 rounded-full bg-muted overflow-hidden">
                                  <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">{val}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                Oran % = toplam ders saati yerine görevindeki payınız (sadece coverage). Hedef ~%{totalCoverage > 0 && nEligible > 0 ? ((1 / nEligible) * 100).toFixed(0) : '—'}. Tam gün nöbet değişimi bu tabloda yok.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'primary',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  sub?: string;
}) {
  const colors: Record<string, { card: string; icon: string; text: string }> = {
    primary: { card: 'border-primary/20', icon: 'bg-primary/10 text-primary', text: 'text-primary' },
    blue: { card: 'border-blue-500/20', icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: 'text-blue-600 dark:text-blue-400' },
    purple: { card: 'border-purple-500/20', icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', text: 'text-purple-600 dark:text-purple-400' },
    emerald: { card: 'border-emerald-500/20', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
    amber: { card: 'border-amber-500/20', icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', text: 'text-amber-700 dark:text-amber-300' },
    rose: { card: 'border-rose-500/20', icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400' },
  };
  const c = colors[color] ?? colors.primary;
  return (
    <Card className={cn('border overflow-hidden', c.card)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={cn('text-2xl font-bold mt-1 truncate', c.text)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('flex items-center justify-center size-9 rounded-xl shrink-0 mt-0.5', c.icon)}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
