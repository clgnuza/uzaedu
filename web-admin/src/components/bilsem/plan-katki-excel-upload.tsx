'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseYillikPlanSablonXlsx, YILLIK_PLAN_SABLON_COLUMN_HELP, type BilsemPlanWeekItem } from '@/lib/parse-yillik-plan-sablon-xlsx';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Download, FileUp, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function clip(s: string | null | undefined, n = 42) {
  const t = String(s ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '—';
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function parseItems(json: string): BilsemPlanWeekItem[] {
  try {
    const j = JSON.parse(json) as unknown;
    return Array.isArray(j) ? (j as BilsemPlanWeekItem[]) : [];
  } catch {
    return [];
  }
}

export function PlanKatkiExcelPlanUpload({
  itemsJson,
  onItemsJsonChange,
  autoLoadTemplateUrl,
  onParsed,
}: {
  itemsJson: string;
  onItemsJsonChange: (json: string) => void;
  autoLoadTemplateUrl?: string;
  /** Yükleme / otomatik şablon sonrası (önizleme ve akış için) */
  onParsed?: (p: { weekCount: number; fileName: string | null; source: 'file' | 'template' }) => void;
}) {
  const [info, setInfo] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(!!autoLoadTemplateUrl);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoLoadTemplateUrl) return;
    let alive = true;
    void fetch(autoLoadTemplateUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((buf) => {
        const { items } = parseYillikPlanSablonXlsx(buf);
        if (!alive) return;
        onItemsJsonChange(JSON.stringify(items));
        setFileName('örnek şablon (otomatik)');
        onParsed?.({ weekCount: items.length, fileName: null, source: 'template' });
      })
      .catch(() => {
        if (alive) {
        }
      })
      .finally(() => {
        if (alive) setLoadingTemplate(false);
      });
    return () => {
      alive = false;
    };
  }, [autoLoadTemplateUrl, onItemsJsonChange, onParsed]);

  const items = useMemo(() => parseItems(itemsJson), [itemsJson]);
  const weekCount = items.length;
  const previewRows = useMemo(() => items.slice(0, 5), [items]);
  const range =
    weekCount > 0
      ? (() => {
          const w = items.map((i) => i.week_order).filter((n) => typeof n === 'number');
          if (!w.length) return null;
          return { min: Math.min(...w), max: Math.max(...w) };
        })()
      : null;

  function readFile(f: File) {
    setFileName(f.name);
    const r = new FileReader();
    r.onload = () => {
      try {
        const buf = r.result instanceof ArrayBuffer ? r.result : null;
        if (!buf) {
          return;
        }
        const { items: parsed } = parseYillikPlanSablonXlsx(buf);
        onItemsJsonChange(JSON.stringify(parsed));
        setInfo(``);
        onParsed?.({ weekCount: parsed.length, fileName: f.name, source: 'file' });
      } catch (err) {
        setInfo(err instanceof Error ? '' : '');
        onParsed?.({ weekCount: 0, fileName: f.name, source: 'file' });
      }
    };
    r.readAsArrayBuffer(f);
  }

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-1.5 text-[10px] text-muted-foreground sm:grid-cols-3 sm:gap-2 sm:text-xs">
        <li className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 sm:px-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/20 text-[10px] font-bold text-fuchsia-800 dark:text-fuchsia-200">
            1
          </span>
          <span>
            <span className="text-foreground">Şablonu indirin</span> ve Excel’de doldurun.
          </span>
        </li>
        <li
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:px-2.5',
            weekCount > 0 ? 'bg-fuchsia-500/12 text-foreground' : 'bg-muted/40',
          )}
        >
          {weekCount > 0 ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-white">
              <Check className="h-3 w-3" />
            </span>
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">2</span>
          )}
          <span>Bu ekrandan .xlsx seçin; haftalar otomatik okunur.</span>
        </li>
        <li
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:px-2.5',
            weekCount > 0 ? 'bg-fuchsia-500/12 text-foreground' : 'bg-muted/40',
          )}
        >
          {weekCount > 0 ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-white">
              <Check className="h-3 w-3" />
            </span>
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">3</span>
          )}
          <span>Tabloyu kontrol edin, sonra «Kaydet» (sayfa altı).</span>
        </li>
      </ol>

      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Table2 className="h-4 w-4 shrink-0 text-fuchsia-600" />
            Yıllık plan
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={loadingTemplate}
            >
              <FileUp className="h-3.5 w-3.5" />
              {weekCount > 0 ? 'Başka dosya seç' : 'Excel dosyası seç'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                readFile(f);
              }}
            />
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-fuchsia-700 dark:text-fuchsia-300" asChild>
              <a href="/yillik-plan-sablon.xlsx" download>
                <Download className="h-3.5 w-3.5" />
                Şablon indir
              </a>
            </Button>
          </div>
        </div>
        <div
          className={cn(
            'flex shrink-0 flex-col items-stretch justify-center rounded-lg px-3 py-2 text-center sm:min-w-[6.5rem]',
            weekCount > 0 ? 'bg-fuchsia-500/12 text-fuchsia-900 dark:text-fuchsia-100' : 'bg-muted/50 text-muted-foreground',
          )}
        >
          <span className="text-2xl font-bold tabular-nums leading-none">{weekCount}</span>
          <span className="text-[10px] font-medium">hafta</span>
          {range && (
            <span className="mt-0.5 text-[9px] opacity-80">
              {range.min}.–{range.max}. hafta
            </span>
          )}
        </div>
      </div>

      {info && <p className="text-xs text-muted-foreground sm:text-sm">{info}</p>}

      {weekCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-foreground sm:text-sm">Önizleme (ilk 5 satır)</h4>
            {weekCount > 5 && (
              <span className="text-[10px] text-muted-foreground">+{weekCount - 5} satır daha</span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/80 bg-background shadow-inner">
            <table className="w-full min-w-[520px] text-left text-[10px] sm:min-w-0 sm:text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Hf</th>
                  <th className="px-2 py-2 font-medium">Ünite / tema</th>
                  <th className="px-2 py-2 font-medium">Konu</th>
                  <th className="px-2 py-2 font-medium">Öğr. çıktıları</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px] font-medium tabular-nums sm:py-2 sm:text-xs">
                      {r.week_order}
                    </td>
                    <td className="max-w-[140px] px-2 py-1.5 sm:max-w-none sm:py-2">{clip(r.unite, 36)}</td>
                    <td className="max-w-[140px] px-2 py-1.5 sm:max-w-none sm:py-2">{clip(r.konu, 40)}</td>
                    <td className="max-w-[200px] px-2 py-1.5 text-muted-foreground sm:max-w-none sm:py-2">
                      {clip(r.kazanimlar, 52)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="group rounded-lg border border-dashed border-border/80 bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium sm:px-3 sm:text-sm [&::-webkit-details-marker]:hidden">
          <span>Şablon düzeni (sütun eşlemesi + notlar)</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-border/60 px-2.5 pb-3 pt-1 text-[10px] leading-relaxed text-muted-foreground sm:px-3 sm:text-xs">
          <p>
            2. satırda <strong>HAFTA</strong> ve <strong>ÜNİTE / TEMA</strong> bulunmalı; veri 3. satırdan itibaren. Örnek:{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">yiillik-plan-sablon.xlsx</code>
          </p>
          <ul className="grid max-h-48 gap-1 overflow-y-auto sm:max-h-64 sm:grid-cols-1">
            {YILLIK_PLAN_SABLON_COLUMN_HELP.map((c) => (
              <li key={c.excel} className="flex flex-wrap items-baseline gap-x-1 border-b border-border/30 py-0.5 last:border-0">
                <span className="shrink-0 font-medium text-foreground">{c.excel}</span>
                <span className="text-muted-foreground/80">→</span>
                <code className="shrink-0 rounded bg-background px-1 font-mono text-[10px] text-foreground">{c.api}</code>
                {c.note && <span className="w-full pl-0 text-[9px] text-muted-foreground/90 sm:pl-20">{c.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
