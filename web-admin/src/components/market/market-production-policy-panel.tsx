'use client';

import { BookOpen, FileText, GraduationCap, Layers, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type MarketEntitlementExchangeConfig = {
  enabled: boolean;
  jeton_per_yillik_plan_unit: number;
  jeton_per_evrak_unit: number;
  max_units_per_request: number;
};

function fmtTrRatioInput(n: number): string {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(Math.min(1_000_000_000, Math.max(0, n)) * 1e6) / 1e6;
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6, useGrouping: false }).format(r);
}

export function MarketProductionPolicyPanel({
  exchange,
  eeJetonDraft,
  onEeJetonDraftChange,
  onExchangeChange,
  onEeBlur,
}: {
  exchange: MarketEntitlementExchangeConfig;
  eeJetonDraft: { yp: string; ev: string } | null;
  onEeJetonDraftChange: (draft: { yp: string; ev: string } | null) => void;
  onExchangeChange: (patch: Partial<MarketEntitlementExchangeConfig>) => void;
  onEeBlur: () => void;
}) {
  return (
    <Card id="market-policy-uretim" className="scroll-mt-4 overflow-hidden border-indigo-400/35 shadow-md ring-1 ring-indigo-500/10">
      <CardHeader className="border-b border-border/60 bg-linear-to-r from-indigo-500/10 via-violet-500/5 to-transparent pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-md">
              <BookOpen className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Plan ve evrak üretim ekonomisi</CardTitle>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                <strong className="font-medium text-foreground">MEB yıllık plan</strong> ve{' '}
                <strong className="font-medium text-foreground">Bilsem Word üretimi</strong> aynı{' '}
                <code className="rounded bg-muted px-1 text-xs">yillik_plan_uretim</code> kotasını tüketir. Mağaza
                paketleri ve jeton takası bu kotayı artırır; Bilsem plan katkısı ayrı jeton ödülüdür.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <BookOpen className="size-3.5" />
              Yıllık plan kotası
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              MEB müfredatı + Bilsem şablonları. Her Word üretimi 1 hak düşer.
            </p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-background/80 px-2 py-0.5 text-[10px] font-medium">
              <Layers className="size-3" />
              Ortak tüketim
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <FileText className="size-3.5" />
              Evrak kotası
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Yıllık plan dışındaki şablonlar için ayrı <code className="rounded bg-muted px-0.5">evrak_uretim</code>{' '}
              hakkı.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              <Sparkles className="size-3.5" />
              Plan katkı jetonu (öğretmen)
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              MEB veya Bilsem katalog planı başka öğretmenin Word üretiminde kullanıldığında plan sahibine jeton —
              üretim hakkı tüketimi ile ayrı akış.
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <GraduationCap className="size-3" />
              Yalnızca öğretmen · kota değil jeton
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Jeton ile hak alma (öğretmen · Market sayfası)</h3>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                id="ee-enabled"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={exchange.enabled}
                onChange={(e) => onExchangeChange({ enabled: e.target.checked })}
              />
              <span>Özellik açık</span>
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
              <Label htmlFor="ee-yp" className="text-xs font-semibold">
                1 yıllık plan hakkı (jeton)
              </Label>
              <p className="text-[10px] text-muted-foreground">MEB + Bilsem üretiminde ortak</p>
              <Input
                id="ee-yp"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                className="h-9 font-medium tabular-nums"
                placeholder="örn. 25 veya 0,5"
                value={eeJetonDraft?.yp ?? fmtTrRatioInput(exchange.jeton_per_yillik_plan_unit)}
                onFocus={() =>
                  onEeJetonDraftChange({
                    yp: eeJetonDraft?.yp ?? fmtTrRatioInput(exchange.jeton_per_yillik_plan_unit),
                    ev: eeJetonDraft?.ev ?? fmtTrRatioInput(exchange.jeton_per_evrak_unit),
                  })
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  onEeJetonDraftChange({
                    yp: raw,
                    ev: eeJetonDraft?.ev ?? fmtTrRatioInput(exchange.jeton_per_evrak_unit),
                  });
                  onExchangeChange({ jeton_per_yillik_plan_unit: parseRatioInput(raw) });
                }}
                onBlur={onEeBlur}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
              <Label htmlFor="ee-ev" className="text-xs font-semibold">
                1 evrak hakkı (jeton)
              </Label>
              <p className="text-[10px] text-muted-foreground">Diğer şablon üretimi</p>
              <Input
                id="ee-ev"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                className="h-9 font-medium tabular-nums"
                placeholder="örn. 10 veya 0,1"
                value={eeJetonDraft?.ev ?? fmtTrRatioInput(exchange.jeton_per_evrak_unit)}
                onFocus={() =>
                  onEeJetonDraftChange({
                    yp: eeJetonDraft?.yp ?? fmtTrRatioInput(exchange.jeton_per_yillik_plan_unit),
                    ev: eeJetonDraft?.ev ?? fmtTrRatioInput(exchange.jeton_per_evrak_unit),
                  })
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  onEeJetonDraftChange({
                    yp: eeJetonDraft?.yp ?? fmtTrRatioInput(exchange.jeton_per_yillik_plan_unit),
                    ev: raw,
                  });
                  onExchangeChange({ jeton_per_evrak_unit: parseRatioInput(raw) });
                }}
                onBlur={onEeBlur}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
              <Label htmlFor="ee-max" className="text-xs font-semibold">
                Tek istekte en fazla birim
              </Label>
              <p className="text-[10px] text-muted-foreground">Jeton takası üst sınırı</p>
              <Input
                id="ee-max"
                type="number"
                min={1}
                max={500}
                className="h-9 max-w-full font-medium tabular-nums"
                value={exchange.max_units_per_request}
                onChange={(e) =>
                  onExchangeChange({
                    max_units_per_request: Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 1)),
                  })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const RATIO_MAX = 1_000_000_000;
function parseRatioInput(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '.' || t === '-.') return 0;
  const x = parseFloat(t);
  if (Number.isNaN(x)) return 0;
  return Math.round(Math.min(RATIO_MAX, Math.max(0, x)) * 1e6) / 1e6;
}
