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
    const positive = items.filter((i) => getVal(i) > 0);
    if (positive.length < 2) return { label: 'Dağılım dengeli (oranlı)', variant: 'success' };
    const subtotal = positive.reduce((a, i) => a + getVal(i), 0);
    const shares = positive.map((i) => getVal(i) / subtotal);
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
  /** Tek renk, ortalama çizgisi yok — istatistik özeti için */
  minimal?: boolean;
  height?: number;
  /** 'coverage_lesson_count' = Ders Görevi (görevlendirme), 'slot_count' = Nöbet sayısı */
  valueKey?: 'coverage_lesson_count' | 'slot_count';
}

const MINIMAL_BAR = 'hsl(var(--primary))';

export function DutyDistributionChart({
  items,
  className,
  maxBars = 20,
  showFairness = true,
  minimal = false,
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
  const showFairnessRow = showFairness && !minimal;
  const chartH = minimal ? Math.max(120, height) : Math.max(100, height - 32);
  const innerPad = minimal ? 'p-3' : 'p-4';

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
    <div className={cn(minimal ? 'space-y-0' : 'space-y-3', className)}>
      {showFairnessRow && (
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
            {valueKey === 'coverage_lesson_count' && <span>ders saati (yerine görev)</span>}
          </div>
        </div>
      )}
      <div className={cn(minimal ? 'rounded-lg border border-border/60 bg-muted/20' : 'rounded-xl border border-border bg-card', innerPad)}>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={minimal ? { top: 4, right: 8, left: 4, bottom: 4 } : { top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              allowDecimals={false}
              fontSize={11}
              tickLine={false}
              axisLine={!minimal}
              {...(minimal ? { tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } } : {})}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={minimal ? 96 : 120}
              tick={{
                fontSize: 11,
                ...(minimal ? { fill: 'hsl(var(--foreground))' } : {}),
              }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v && String(v).length > (minimal ? 14 : 18) ? String(v).slice(0, minimal ? 13 : 17) + '…' : v)}
            />
            <Tooltip
              cursor={{ fill: minimal ? 'hsl(var(--muted) / 0.35)' : undefined }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className={cn('rounded-md border border-border bg-popover px-2.5 py-1.5 text-sm shadow-md', minimal && 'text-xs')}>
                    <p className="font-medium leading-tight">{payload[0].payload.name}</p>
                    <p className="text-muted-foreground tabular-nums">
                      {payload[0].value} {valueKey === 'coverage_lesson_count' ? 'saat' : 'nöbet'}
                    </p>
                  </div>
                ) : null
              }
            />
            {!minimal && avg > 0 && (
              <ReferenceLine x={avg} stroke="oklch(0.6 0.15 250)" strokeDasharray="4 4" strokeWidth={1} />
            )}
            <Bar
              dataKey="count"
              name={valueKey === 'coverage_lesson_count' ? 'Ders saati' : 'Nöbet'}
              radius={[0, 3, 3, 0]}
              maxBarSize={minimal ? 18 : 28}
              fill={minimal ? MINIMAL_BAR : undefined}
              fillOpacity={minimal ? 0.88 : 1}
            >
              {!minimal &&
                chartData.map((entry, idx) => (
                  <Cell key={`${entry.name}-${idx}`} fill={getBarColor(entry.count, min, max)} fillOpacity={0.85} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
