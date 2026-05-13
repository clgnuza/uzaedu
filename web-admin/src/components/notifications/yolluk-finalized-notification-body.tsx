'use client';

import { cn } from '@/lib/utils';

export type YollukFinalizedNotificationMeta = {
  school_name?: string;
  fiscal_year?: number;
  kind?: string;
  calc_title?: string | null;
  total_tl?: number;
  effective_daily_tl?: number;
  lines?: Array<{ key?: string; label?: string; amount_tl?: number }>;
};

function kindTr(k: string | undefined) {
  if (k === 'gecici') return 'Geçici görev';
  if (k === 'denetim') return 'Denetim';
  if (k === 'surekli') return 'Sürekli (yer değiştirme)';
  return k?.trim() || '—';
}

function fmtTl(n: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function YollukFinalizedNotificationBody({
  metadata,
}: {
  metadata?: Record<string, unknown> | null;
}) {
  const m = (metadata ?? {}) as YollukFinalizedNotificationMeta;
  const lines = Array.isArray(m.lines) ? m.lines : [];
  const total = typeof m.total_tl === 'number' && Number.isFinite(m.total_tl) ? m.total_tl : null;
  const g = typeof m.effective_daily_tl === 'number' && Number.isFinite(m.effective_daily_tl) ? m.effective_daily_tl : null;

  return (
    <div
      className={cn(
        'mt-2 overflow-hidden rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-50/95 via-white to-cyan-50/70 shadow-md ring-1 ring-emerald-500/15',
        'dark:border-emerald-500/35 dark:from-emerald-950/55 dark:via-zinc-950/90 dark:to-cyan-950/35 dark:ring-emerald-400/20',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2 dark:bg-emerald-500/10">
        {m.school_name ? (
          <p className="text-[11px] leading-tight sm:text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">Okul </span>
            <span className="text-foreground">{m.school_name}</span>
          </p>
        ) : null}
        {m.fiscal_year != null ? (
          <p className="text-[11px] leading-tight sm:text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">Mali yıl </span>
            <span className="tabular-nums text-foreground">{m.fiscal_year}</span>
          </p>
        ) : null}
        <p className="text-[11px] leading-tight sm:text-xs">
          <span className="font-semibold text-emerald-800 dark:text-emerald-200">Tür </span>
          <span className="text-foreground">{kindTr(m.kind)}</span>
        </p>
        {g != null && g > 0 ? (
          <p className="text-[11px] leading-tight sm:text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">Gündelik </span>
            <span className="tabular-nums text-foreground">{fmtTl(g)} TL</span>
          </p>
        ) : null}
        {m.calc_title ? (
          <p className="w-full text-[10px] leading-snug text-muted-foreground sm:text-[11px]">{m.calc_title}</p>
        ) : null}
      </div>

      <div className="max-h-52 overflow-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-[11px] sm:text-xs">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm dark:bg-zinc-950/95">
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
              <th className="px-3 py-2 font-semibold">Kalem</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Tutar (TL)</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">
                  Satır özeti yok; detay için hesap sayfasını açın.
                </td>
              </tr>
            ) : (
              lines.map((l, i) => {
                const raw = Number(l.amount_tl);
                const amt = Number.isFinite(raw) ? raw : 0;
                const lab = typeof l.label === 'string' && l.label.trim() ? l.label : l.key || '—';
                return (
                  <tr key={l.key ? String(l.key) : `y-${i}`} className="border-t border-border/50 odd:bg-white/40 even:bg-muted/20 dark:odd:bg-zinc-900/40 dark:even:bg-zinc-900/20">
                    <td className="max-w-[min(56vw,28rem)] break-words px-3 py-1.5 text-muted-foreground">{lab}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums text-foreground">{fmtTl(amt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {total != null ? (
            <tfoot>
              <tr className="border-t-2 border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-50">
                <td className="px-3 py-2 text-sm font-bold">Genel toplam</td>
                <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">{fmtTl(total)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
