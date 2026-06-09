'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  parseYillikPlanSablonXlsx,
  YILLIK_PLAN_SABLON_COLUMN_HELP,
  type BilsemPlanWeekItem,
  type YillikPlanUploadCurriculum,
} from '@/lib/parse-yillik-plan-sablon-xlsx';
import { buildApiAuthHeaders, formatApiErrorMessage, getApiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ChevronDown, Download, FileUp, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

export type PlanKatkiTemplateQuery = {
  academicYear: string;
  subjectCode?: string;
  grade?: number;
  /** Şablon SÜRE sütunu için başlangıç haftalık ders saati */
  weeklyHours?: number;
};

const PREVIEW_COLUMNS: {
  key: keyof BilsemPlanWeekItem;
  label: string;
  clip?: number;
  mono?: boolean;
}[] = [
  { key: 'week_order', label: 'Hf', mono: true },
  { key: 'ders_saati', label: 'Saat', mono: true },
  { key: 'unite', label: 'Ünite / tema', clip: 28 },
  { key: 'konu', label: 'Konu', clip: 32 },
  { key: 'kazanimlar', label: 'Öğrenme çıktıları', clip: 44 },
  { key: 'surec_bilesenleri', label: 'Süreç', clip: 28 },
  { key: 'olcme_degerlendirme', label: 'Ölçme', clip: 28 },
  { key: 'belirli_gun_haftalar', label: 'Belirli gün', clip: 24 },
];

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
  templateQuery,
  onParsed,
  variant = 'bilsem',
}: {
  itemsJson: string;
  onItemsJsonChange: (json: string) => void;
  templateQuery: PlanKatkiTemplateQuery;
  onParsed?: (p: { weekCount: number; fileName: string | null; source: 'file' | 'template' }) => void;
  variant?: YillikPlanUploadCurriculum;
}) {
  const { token } = useAuth();
  const [info, setInfo] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState(() =>
    templateQuery.weeklyHours != null && Number.isFinite(templateQuery.weeklyHours)
      ? Math.max(0, Math.round(templateQuery.weeklyHours))
      : 2,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (templateQuery.weeklyHours != null && Number.isFinite(templateQuery.weeklyHours)) {
      setWeeklyHours(Math.max(0, Math.round(templateQuery.weeklyHours)));
    }
  }, [templateQuery.weeklyHours, templateQuery.subjectCode, templateQuery.grade]);

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

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    setInfo(null);
    try {
      const res = await fetch(getApiUrl('/yillik-plan-icerik/upload-template.xlsx'), {
        headers: buildApiAuthHeaders(token),
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        throw new Error(formatApiErrorMessage(body.message) ?? `İndirme başarısız (${res.status})`);
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'yiillik-plan-sablon-2.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setInfo(e instanceof Error ? e.message : 'Şablon indirilemedi.');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  function readFile(f: File) {
    setFileName(f.name);
    const r = new FileReader();
    r.onload = () => {
      try {
        const buf = r.result instanceof ArrayBuffer ? r.result : null;
        if (!buf) return;
        const { items: parsed } = parseYillikPlanSablonXlsx(buf, {
          defaultDersSaati: weeklyHours,
          curriculum: variant,
        });
        onItemsJsonChange(JSON.stringify(parsed));
        setInfo(null);
        onParsed?.({ weekCount: parsed.length, fileName: f.name, source: 'file' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Excel okunamadı.';
        setInfo(msg);
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
            <span className="text-foreground">Sabit şablonu indirin</span>, sütunları doldurun.
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
          <span>Doldurulmuş .xlsx dosyasını seçin.</span>
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
          <span>Önizlemeyi kontrol edin, kaydedin.</span>
        </li>
      </ol>

      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Table2 className="h-4 w-4 shrink-0 text-fuchsia-600" />
            Yıllık plan
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="plan-katki-weekly-hours" className="text-[10px] text-muted-foreground sm:text-xs">
                Haftalık ders saati (yüklemede)
              </Label>
              <Input
                id="plan-katki-weekly-hours"
                type="number"
                min={0}
                max={40}
                step={1}
                className="h-8 w-20 tabular-nums"
                value={weeklyHours}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setWeeklyHours(Number.isFinite(n) && n >= 0 ? n : 0);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={downloadingTemplate}
              onClick={() => void downloadTemplate()}
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingTemplate ? 'Hazırlanıyor…' : 'Şablon indir'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" />
              {weekCount > 0 ? 'Başka dosya seç' : 'Excel yükle'}
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

      {info && <p className="text-xs text-destructive sm:text-sm">{info}</p>}
      {fileName && weekCount > 0 && (
        <p className="text-[10px] text-muted-foreground">Dosya: {fileName}</p>
      )}

      {weekCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-foreground sm:text-sm">Önizleme (ilk 5 satır)</h4>
            {weekCount > 5 && (
              <span className="text-[10px] text-muted-foreground">+{weekCount - 5} satır daha</span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/80 bg-background shadow-inner">
            <table className="w-full min-w-[720px] text-left text-[10px] sm:text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                  {PREVIEW_COLUMNS.map((col) => (
                    <th key={col.key} className="whitespace-nowrap px-2 py-2 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    {PREVIEW_COLUMNS.map((col) => {
                      const raw = r[col.key];
                      const text =
                        col.key === 'week_order' || col.key === 'ders_saati'
                          ? String(raw ?? '—')
                          : clip(typeof raw === 'string' ? raw : raw != null ? String(raw) : null, col.clip ?? 36);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'max-w-[160px] px-2 py-1.5 sm:py-2',
                            col.mono && 'whitespace-nowrap font-mono text-[10px] font-medium tabular-nums sm:text-xs',
                            col.key === 'kazanimlar' && 'text-muted-foreground',
                          )}
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
        </div>
      )}

      <details className="group rounded-lg border border-dashed border-border/80 bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium sm:px-3 sm:text-sm [&::-webkit-details-marker]:hidden">
          <span>Sütun eşlemesi</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-border/60 px-2.5 pb-3 pt-1 text-[10px] leading-relaxed text-muted-foreground sm:px-3 sm:text-xs">
          <ul className="grid max-h-48 gap-1 overflow-y-auto sm:max-h-64">
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
