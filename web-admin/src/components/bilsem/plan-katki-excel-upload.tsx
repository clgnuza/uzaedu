'use client';

import { useEffect, useState } from 'react';
import { parseYillikPlanSablonXlsx, YILLIK_PLAN_SABLON_COLUMN_HELP } from '@/lib/parse-yillik-plan-sablon-xlsx';

export function PlanKatkiExcelPlanUpload({
  itemsJson,
  onItemsJsonChange,
  autoLoadTemplateUrl,
}: {
  itemsJson: string;
  onItemsJsonChange: (json: string) => void;
  /** Yalnızca yeni taslak sayfası: örnek şablonu otomatik oku */
  autoLoadTemplateUrl?: string;
}) {
  const [info, setInfo] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(!!autoLoadTemplateUrl);

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
        setInfo(`Örnek şablon yüklendi (${items.length} hafta). İsterseniz kendi Excelinizi seçin.`);
      })
      .catch(() => {
        if (alive) setInfo('Örnek şablon indirilemedi; aşağıdan .xlsx yükleyin.');
      })
      .finally(() => {
        if (alive) setLoadingTemplate(false);
      });
    return () => {
      alive = false;
    };
  }, [autoLoadTemplateUrl, onItemsJsonChange]);

  let weekCount = 0;
  try {
    const j = JSON.parse(itemsJson) as unknown;
    weekCount = Array.isArray(j) ? j.length : 0;
  } catch {
    weekCount = 0;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 gap-y-2">
        <span className="text-sm font-medium text-muted-foreground">Yıllık plan (Excel)</span>
        <a
          className="text-xs font-medium text-primary underline-offset-2 hover:underline sm:text-sm"
          href="/yillik-plan-sablon.xlsx"
          download
        >
          Örnek şablon indir (.xlsx)
        </a>
        <label className="cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline sm:text-sm">
          Excel yükle…
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => {
                try {
                  const buf = r.result instanceof ArrayBuffer ? r.result : null;
                  if (!buf) {
                    setInfo('Dosya okunamadı.');
                    return;
                  }
                  const { items } = parseYillikPlanSablonXlsx(buf);
                  onItemsJsonChange(JSON.stringify(items));
                  setInfo(`${items.length} hafta içe aktarıldı.`);
                } catch (err) {
                  setInfo(err instanceof Error ? err.message : 'Excel işlenemedi.');
                }
              };
              r.readAsArrayBuffer(f);
              e.target.value = '';
            }}
          />
        </label>
        {loadingTemplate && <span className="text-xs text-muted-foreground">Şablon yükleniyor…</span>}
        {!loadingTemplate && weekCount > 0 && (
          <span className="text-xs font-medium text-foreground">{weekCount} hafta</span>
        )}
      </div>
      {info && <p className="text-xs text-muted-foreground sm:text-sm">{info}</p>}
      <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <p className="font-medium text-foreground">Şablon düzeni</p>
        <p className="mt-1">
          İlk veri satırının üstünde, <strong>HAFTA</strong> ve <strong>ÜNİTE / TEMA</strong> içeren başlık satırı
          olmalıdır. Örnek dosya: <code className="rounded bg-muted px-1 font-mono text-[11px]">yiillik-plan-sablon.xlsx</code>.
        </p>
        <ul className="mt-2 grid max-h-52 gap-x-3 gap-y-0.5 overflow-y-auto sm:max-h-none sm:grid-cols-2">
          {YILLIK_PLAN_SABLON_COLUMN_HELP.map((c) => (
            <li key={c.excel} className="break-words">
              <span className="font-medium text-foreground">{c.excel}</span>
              {' → '}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">{c.api}</code>
              {c.note ? ` — ${c.note}` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
