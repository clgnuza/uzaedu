'use client';

import { isPlanWeekItemHeaderNoise, type BilsemPlanWeekItem } from '@/lib/parse-yillik-plan-sablon-xlsx';
import { cn } from '@/lib/utils';

const COLS: {
  key: keyof BilsemPlanWeekItem;
  label: string;
  clip?: number;
  mono?: boolean;
  muted?: boolean;
}[] = [
  { key: 'week_order', label: 'Hf', mono: true },
  { key: 'ders_saati', label: 'Saat', mono: true },
  { key: 'unite', label: 'Ünite / tema', clip: 36 },
  { key: 'konu', label: 'Konu', clip: 40 },
  { key: 'kazanimlar', label: 'Öğrenme çıktıları', clip: 48, muted: true },
  { key: 'surec_bilesenleri', label: 'Süreç', clip: 32 },
  { key: 'olcme_degerlendirme', label: 'Ölçme', clip: 32 },
  { key: 'sosyal_duygusal', label: 'Sos.-duyg.', clip: 28 },
  { key: 'degerler', label: 'Değerler', clip: 24 },
  { key: 'okuryazarlik_becerileri', label: 'Okuryazarlık', clip: 28 },
  { key: 'belirli_gun_haftalar', label: 'Belirli gün', clip: 28 },
  { key: 'zenginlestirme', label: 'Farklılaştırma', clip: 28 },
  { key: 'okul_temelli_planlama', label: 'Okul temelli', clip: 28 },
];

function clip(s: string | null | undefined, n = 42) {
  const t = String(s ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '—';
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function normalizePlanWeekItemForPreview(item: BilsemPlanWeekItem): BilsemPlanWeekItem {
  const next = { ...item };
  const dedupePair = (a: keyof BilsemPlanWeekItem, b: keyof BilsemPlanWeekItem) => {
    const va = String(next[a] ?? '').trim();
    const vb = String(next[b] ?? '').trim();
    if (va && vb && va === vb) next[a] = null;
  };
  dedupePair('degerler', 'zenginlestirme');
  dedupePair('okuryazarlik_becerileri', 'okul_temelli_planlama');
  return next;
}

export function parsePlanWeekItems(itemsJson: string): BilsemPlanWeekItem[] {
  try {
    const j = JSON.parse(itemsJson) as unknown;
    if (!Array.isArray(j)) return [];
    return [...j]
      .filter((el) => el && typeof el === 'object')
      .map((el) => normalizePlanWeekItemForPreview(el as BilsemPlanWeekItem))
      .filter((item) => !isPlanWeekItemHeaderNoise(item))
      .sort((a, b) => (Number(a.week_order) || 0) - (Number(b.week_order) || 0));
  } catch {
    return [];
  }
}

export function PlanKatkiWeekPreviewTable({
  items,
  compact,
  className,
}: {
  items: BilsemPlanWeekItem[];
  compact?: boolean;
  className?: string;
}) {
  if (!items.length) {
    return <p className="text-xs text-muted-foreground">Hafta verisi yok.</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border/80 bg-background shadow-inner', className)}>
      <table className="w-full min-w-[960px] text-left text-[10px] sm:text-xs">
        <thead>
          <tr className="border-b border-border/80 bg-muted/50 text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {COLS.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-2 py-2 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={`${r.week_order}-${i}`} className="border-b border-border/40 align-top last:border-0 hover:bg-muted/20">
              {COLS.map((col) => {
                const raw = r[col.key];
                const text =
                  col.key === 'week_order' || col.key === 'ders_saati'
                    ? String(raw ?? '—')
                    : clip(typeof raw === 'string' ? raw : raw != null ? String(raw) : null, compact ? (col.clip ?? 36) : 200);
                return (
                  <td
                    key={col.key}
                    className={cn(
                      'max-w-[200px] px-2 py-1.5 sm:py-2',
                      col.mono && 'whitespace-nowrap font-mono text-[10px] font-medium tabular-nums',
                      col.muted && 'text-muted-foreground',
                    )}
                    title={typeof raw === 'string' ? raw : undefined}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
