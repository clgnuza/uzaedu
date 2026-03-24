'use client';

/**
 * Nöbet dağılım grafiği – profesyonel yatay bar chart.
 * Recharts ile; adil dağılım göstergesi.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

export type DistributionItem = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  slot_count?: number;
  coverage_lesson_count?: number;
};

function getBarColor(count: number, min: number, max: number) {
  if (max === min) return 'oklch(0.55 0.15 145)'; // tek değer – yeşil
  const range = max - min;
  const pos = (count - min) / range;
  if (pos <= 0.33) return 'oklch(0.55 0.15 145)'; // en az – yeşil
  if (pos <= 0.66) return 'oklch(0.7 0.12 85)'; // orta – amber
  return 'oklch(0.65 0.18 25)'; // en fazla – kırmızımsı
}

function computeFairnessLabel(
  items: DistributionItem[],
  valueKey: 'coverage_lesson_count' | 'slot_count' = 'coverage_lesson_count',
): { label: string; variant: 'success' | 'warning' | 'neutral' } {
  if (items.length === 0) return { label: 'Veri yok', variant: 'neutral' };
  const getVal = (i: DistributionItem) =>
    valueKey === 'coverage_lesson_count' ? (i.coverage_lesson_count ?? 0) : (i.slot_count ?? 0);
  const total = items.reduce((a, i) => a + getVal(i), 0);
  if (total === 0) return { label: valueKey === 'coverage_lesson_count' ? 'Görevlendirme yok' : 'Nöbet yok', variant: 'neutral' };

  if (valueKey === 'coverage_lesson_count') {
    const n = items.length;
    const shares = items.map((i) => getVal(i) / total);
    const maxShare = Math.max(...shares);
    const minShare = Math.min(...shares);
    const shareRange = maxShare - minShare;
    if (shareRange <= 0.25) return { label: 'Dağılım dengeli (oranlı)', variant: 'success' };
    if (shareRange <= 0.5) return { label: 'Dağılım kısmen dengeli', variant: 'warning' };
    return { label: 'Dağılım dengesiz (oranlı görevlendirme önerilir)', variant: 'warning' };
  }

  const counts = items.map((i) => getVal(i)).filter((n) => n > 0);
  const min = counts.length ? Math.min(...counts) : 0;
  const max = counts.length ? Math.max(...counts) : 0;
  const diff = max - min;
  if (diff <= 1) return { label: 'Dağılım dengeli', variant: 'success' };
  if (diff <= 3) return { label: 'Dağılım kısmen dengeli', variant: 'warning' };
  return { label: 'Dağılım dengesiz', variant: 'warning' };
}

interface DutyDistributionChartProps {
  items: DistributionItem[];
  className?: string;
  maxBars?: number;
  showFairness?: boolean;
  height?: number;
  /** 'coverage_lesson_count' = Ders Görevi (görevlendirme), 'slot_count' = Nöbet sayısı */
  valueKey?: 'coverage_lesson_count' | 'slot_count';
}

export function DutyDistributionChart({
  items,
  className,
  maxBars = 20,
  showFairness = true,
  height = 320,
  valueKey = 'coverage_lesson_count',
}: DutyDistributionChartProps) {
  const getVal = (i: DistributionItem) =>
    valueKey === 'coverage_lesson_count' ? (i.coverage_lesson_count ?? 0) : (i.slot_count ?? 0);
  const sorted = [...items]
    .filter((i) => getVal(i) > 0)
    .sort((a, b) => getVal(b) - getVal(a))
    .slice(0, maxBars);

  const chartData = sorted.map((i) => ({
    name: i.display_name || i.email || '—',
    count: getVal(i),
  }));

  const counts = sorted.map((i) => getVal(i));
  const min = counts.length ? Math.min(...counts) : 0;
  const max = counts.length ? Math.max(...counts) : 0;
  const avg = counts.length ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0;
  const fairness = computeFairnessLabel(items, valueKey);

  if (chartData.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20', className)}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">Gösterilecek veri yok</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showFairness && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Adil Dağılım:</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                fairness.variant === 'success' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                fairness.variant === 'warning' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                fairness.variant === 'neutral' && 'bg-muted text-muted-foreground',
              )}
            >
              {fairness.label}
            </span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>En az: {min}</span>
            <span>Ortalama: {avg}</span>
            <span>En çok: {max}</span>
            {valueKey === 'coverage_lesson_count' && <span>ders saati</span>}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-4" style={{ minHeight: Math.max(100, height - 32) }}>
        <ResponsiveContainer width="100%" height={Math.max(100, height - 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <XAxis type="number" allowDecimals={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => (v && String(v).length > 18 ? String(v).slice(0, 17) + '…' : v)}
            />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
                    <p className="font-medium">{payload[0].payload.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {payload[0].value} {valueKey === 'coverage_lesson_count' ? 'ders saati' : 'nöbet'}
                    </p>
                  </div>
                ) : null
              }
            />
            {avg > 0 && (
              <ReferenceLine x={avg} stroke="oklch(0.6 0.15 250)" strokeDasharray="4 4" strokeWidth={1} />
            )}
            <Bar dataKey="count" name={valueKey === 'coverage_lesson_count' ? 'Ders saati' : 'Nöbet'} radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={entry.name}
                  fill={getBarColor(entry.count, min, max)}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
