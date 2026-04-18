'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type PlacementScoreRow = { year: number; with_exam: number | null; without_exam: number | null };

export type ReviewPlacementChartsV2 = {
  v: 2;
  lgs?: {
    axisLabel?: string;
    footer?: string;
    series: { label: string; color: string; points: { year: number; score: number }[] }[];
  };
  obp?: {
    axisLabel?: string;
    yMax?: number;
    academicYear?: string;
    footer?: string;
    series: {
      label: string;
      color: string;
      lightColor?: string;
      programs: { code: string; lower: number; upper: number }[];
    }[];
  };
};

function isV2Charts(x: unknown): x is ReviewPlacementChartsV2 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (Number(o.v) !== 2) return false;
  const lgs = o.lgs as ReviewPlacementChartsV2['lgs'] | undefined;
  const obp = o.obp as ReviewPlacementChartsV2['obp'] | undefined;
  const lOk = lgs && Array.isArray(lgs.series) && lgs.series.length > 0;
  const oOk = obp && Array.isArray(obp.series) && obp.series.length > 0;
  return !!(lOk || oOk);
}

function legacyToLgs(legacy: PlacementScoreRow[]): ReviewPlacementChartsV2['lgs'] {
  const sorted = [...legacy].filter((r) => r && typeof r.year === 'number').sort((a, b) => a.year - b.year);
  const merkezi = sorted
    .filter((r) => r.with_exam != null && Number.isFinite(Number(r.with_exam)))
    .map((r) => ({ year: r.year, score: Number(r.with_exam) }));
  const yerel = sorted
    .filter((r) => r.without_exam != null && Number.isFinite(Number(r.without_exam)))
    .map((r) => ({ year: r.year, score: Number(r.without_exam) }));
  const series: NonNullable<ReviewPlacementChartsV2['lgs']>['series'] = [];
  if (merkezi.length)
    series.push({ label: 'Merkezî (LGS tabanı)', color: '#f87171', points: merkezi });
  if (yerel.length)
    series.push({ label: 'Yerel yerleştirme (gösterge)', color: '#4ade80', points: yerel });
  return {
    axisLabel: 'LGS / yerleştirme göstergeleri',
    footer: 'Merkezî sütun LGS tabanı; yerel sütun kayıtlı gösterge (OBP/ikamet vb. özet olabilir).',
    series,
  };
}

function mergePayload(
  charts: unknown,
  legacy: PlacementScoreRow[] | null | undefined,
): ReviewPlacementChartsV2 | null {
  const fromApi = isV2Charts(charts) ? charts : null;
  const leg = Array.isArray(legacy) && legacy.length ? legacyToLgs(legacy) : null;
  const out: ReviewPlacementChartsV2 = { v: 2 };
  if (fromApi?.lgs?.series?.length) out.lgs = fromApi.lgs;
  else if (leg?.series?.length) out.lgs = leg;
  if (fromApi?.obp?.series?.length) out.obp = fromApi.obp;
  if (!out.lgs && !out.obp) return null;
  return out;
}

export function hasPlacementInfographic(
  charts: unknown,
  legacy: PlacementScoreRow[] | null | undefined,
): boolean {
  return mergePayload(charts, legacy) !== null;
}

function mixLight(color: string): string {
  const t = color.trim();
  if (t.startsWith('#') && (t.length === 7 || t.length === 9)) {
    const hex = t.slice(1, 7);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const m = (c: number) => Math.round(c + (255 - c) * 0.52);
    const rr = m(r).toString(16).padStart(2, '0');
    const gg = m(g).toString(16).padStart(2, '0');
    const bb = m(b).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`;
  }
  return 'rgba(255,255,255,0.28)';
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

const shell =
  'relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-indigo-950/90 to-violet-950/95 text-white shadow-2xl shadow-indigo-950/40 ring-1 ring-white/10';

type ChartLayout = 'compact' | 'cozy' | 'wide';

function useChartLayout(): ChartLayout {
  return useSyncExternalStore(
    (on) => {
      const mqNarrow = window.matchMedia('(max-width: 640px)');
      const mqWide = window.matchMedia('(min-width: 1025px)');
      const fn = () => on();
      mqNarrow.addEventListener('change', fn);
      mqWide.addEventListener('change', fn);
      return () => {
        mqNarrow.removeEventListener('change', fn);
        mqWide.removeEventListener('change', fn);
      };
    },
    () => {
      if (window.matchMedia('(max-width: 640px)').matches) return 'compact';
      if (window.matchMedia('(min-width: 1025px)').matches) return 'wide';
      return 'cozy';
    },
    () => 'cozy',
  );
}

export type SchoolPlacementScoresCardProps = {
  schoolName: string;
  charts?: unknown;
  rows?: PlacementScoreRow[] | null;
};

export function SchoolPlacementScoresCard({ schoolName, charts, rows }: SchoolPlacementScoresCardProps) {
  const layout = useChartLayout();
  const compact = layout === 'compact';
  const wide = layout === 'wide';
  const payload = useMemo(() => mergePayload(charts, rows), [charts, rows]);
  const lgsH = compact ? 172 : wide ? 186 : 212;
  const obpH = compact ? 196 : wide ? 200 : 226;
  const lgsMargin =
    layout === 'compact'
      ? { top: 10, right: 4, left: 0, bottom: 0 }
      : wide
        ? { top: 14, right: 6, left: 0, bottom: 2 }
        : { top: 22, right: 8, left: 0, bottom: 4 };
  const obpMargin =
    layout === 'compact'
      ? { top: 4, right: 2, left: 0, bottom: 16 }
      : wide
        ? { top: 4, right: 4, left: 0, bottom: 20 }
        : { top: 6, right: 4, left: 0, bottom: 26 };
  const lgsLineData = useMemo(() => {
    if (!payload?.lgs?.series?.length) return [];
    const years = new Set<number>();
    for (const s of payload.lgs.series) for (const p of s.points) years.add(p.year);
    const yArr = [...years].sort((a, b) => a - b);
    return yArr.map((year) => {
      const row: Record<string, string | number | null> = { year: String(year) };
      for (const ser of payload.lgs!.series) {
        const hit = ser.points.find((p) => p.year === year);
        row[ser.label] = hit ? hit.score : null;
      }
      return row;
    });
  }, [payload]);

  const obpBarRows = useMemo(() => {
    if (!payload?.obp?.series?.length) return [];
    const rowsB: {
      key: string;
      short: string;
      lower: number;
      span: number;
      color: string;
      light: string;
      dept: string;
      upper: number;
    }[] = [];
    for (const s of payload.obp.series) {
      const light = s.lightColor?.trim() || mixLight(s.color);
      for (const p of s.programs) {
        const span = Math.max(0, Math.round((p.upper - p.lower) * 100) / 100);
        rowsB.push({
          key: `${s.label} · ${p.code}`,
          short: p.code,
          lower: p.lower,
          span,
          color: s.color,
          light,
          dept: s.label,
          upper: p.upper,
        });
      }
    }
    return rowsB;
  }, [payload]);

  if (!payload) return null;

  const yMaxObp = payload.obp?.yMax && payload.obp.yMax > 0 ? payload.obp.yMax : 200;

  return (
    <div className={shell}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(244,114,182,0.12),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_100%,rgba(34,211,238,0.1),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(167,139,250,0.08),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[min(38vw,200px)] font-black leading-none text-white/[0.035] sm:text-[min(42vw,220px)] sm:text-white/[0.045]"
        aria-hidden
      >
        MEB
      </div>

      <header className="relative z-1 flex items-center gap-2 border-b border-white/10 bg-gradient-to-r from-white/5 via-fuchsia-500/5 to-cyan-500/5 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2.5 md:px-5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-400/50 bg-gradient-to-br from-rose-500 to-rose-800 text-[8px] font-bold leading-tight text-white shadow-lg shadow-rose-900/50 sm:size-10 sm:text-[9px] md:size-11"
          aria-hidden
        >
          MEB
        </div>
        <h3 className="min-w-0 flex-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white sm:text-xs md:text-sm">
          {schoolName}
        </h3>
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-gradient-to-br from-cyan-500/30 to-violet-600/35 text-[8px] font-semibold text-cyan-50 shadow-inner sm:size-10 sm:text-[9px] md:size-11"
          aria-hidden
        >
          OKL
        </div>
      </header>

      <div className="relative z-1 space-y-3 px-2 py-2.5 sm:space-y-5 sm:px-3 sm:py-4 md:space-y-6 md:px-4 md:py-5">
        {payload.lgs && lgsLineData.length > 0 && (
          <section className="flex min-h-0 gap-1 sm:gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-sky-400/25 bg-gradient-to-b from-sky-500/20 to-sky-500/5 py-1.5 sm:w-9 sm:py-2 md:w-10">
              <span
                className="text-[9px] font-bold uppercase tracking-wider text-white/80 sm:text-[11px] sm:tracking-widest sm:text-white/90"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {payload.lgs.axisLabel || 'LGS Taban Puanlar'}
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-r-lg border border-l-0 border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-white/[0.04] to-transparent py-1 pr-0.5 sm:py-0 sm:pr-1">
              <ResponsiveContainer width="100%" height={lgsH}>
                <LineChart data={lgsLineData} margin={lgsMargin}>
                  <CartesianGrid stroke="rgba(125,211,252,0.12)" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'rgba(224,242,254,0.88)', fontSize: compact ? 9 : wide ? 10 : 11 }}
                    axisLine={{ stroke: 'rgba(56,189,248,0.35)' }}
                  />
                  <YAxis
                    width={compact ? 30 : wide ? 32 : 34}
                    tick={{ fill: 'rgba(224,242,254,0.78)', fontSize: compact ? 9 : wide ? 9 : 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(11,18,32,0.94)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      fontSize: compact ? 11 : 12,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: compact ? 9 : wide ? 10 : 11, paddingTop: compact ? 2 : wide ? 4 : 6 }}
                    formatter={(v) => <span className="text-sky-50/90">{v}</span>}
                  />
                  {payload.lgs.series.map((ser) => (
                    <Line
                      key={ser.label}
                      type="monotone"
                      dataKey={ser.label}
                      stroke={ser.color}
                      strokeWidth={compact ? 2 : wide ? 2.25 : 2.5}
                      dot={{ r: compact ? 3 : wide ? 3 : 4, fill: ser.color, stroke: '#fff', strokeWidth: 1 }}
                      activeDot={{ r: compact ? 5 : 6, stroke: ser.color, strokeWidth: 1, fill: '#fff' }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {payload.lgs.footer ? (
                <p className="mt-1 px-0.5 text-right text-[9px] leading-snug text-white/50 sm:mt-2 sm:text-[11px] sm:text-white/55">{payload.lgs.footer}</p>
              ) : null}
            </div>
          </section>
        )}

        {payload.obp && obpBarRows.length > 0 && (
          <section className="flex min-h-0 gap-1 sm:gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-violet-400/25 bg-gradient-to-b from-violet-500/20 to-fuchsia-500/5 py-1.5 sm:w-9 sm:py-2 md:w-10">
              <span
                className="text-[9px] font-bold uppercase tracking-wider text-white/80 sm:text-[11px] sm:tracking-widest sm:text-white/90"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {payload.obp.axisLabel || 'OBP Başarı Puanları'}
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-r-lg border border-l-0 border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent py-1 pr-0.5 sm:py-0 sm:pr-1">
              {payload.obp.academicYear ? (
                <p className="mb-0.5 text-center text-[9px] font-semibold text-white/65 sm:mb-1 sm:text-[10px] sm:text-white/70">{payload.obp.academicYear}</p>
              ) : null}
              <div className="mb-1 flex flex-wrap items-center justify-center gap-2 text-[9px] text-violet-100/70 sm:mb-1.5 sm:gap-3 sm:text-[10px]">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-violet-300/50 sm:size-2" /> Alt OBP
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-fuchsia-300 sm:size-2" /> Üst OBP
                </span>
              </div>
              <ResponsiveContainer width="100%" height={obpH}>
                <BarChart data={obpBarRows} margin={obpMargin}>
                  <CartesianGrid stroke="rgba(196,181,253,0.12)" strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="short"
                    tick={{ fill: 'rgba(237,233,254,0.9)', fontSize: compact ? 9 : wide ? 9 : 10 }}
                    axisLine={{ stroke: 'rgba(167,139,250,0.4)' }}
                    interval={0}
                    height={compact ? 34 : wide ? 40 : 46}
                    tickFormatter={(v, i) => {
                      const r = obpBarRows[i];
                      return r ? `${r.short}` : String(v);
                    }}
                  />
                  <YAxis
                    domain={[0, yMaxObp]}
                    width={compact ? 28 : wide ? 30 : 32}
                    tick={{ fill: 'rgba(237,233,254,0.78)', fontSize: compact ? 9 : wide ? 9 : 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as (typeof obpBarRows)[0] | undefined;
                      if (!d) return null;
                      return (
                        <div className="rounded-[10px] border border-white/12 bg-[#0b1220]/95 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur-sm sm:px-3 sm:py-2 sm:text-xs">
                          <p className="font-semibold text-white">{d.dept}</p>
                          <p className="text-white/70">{d.short}</p>
                          <p className="mt-1 tabular-nums text-white/90">
                            Alt: {fmtNum(d.lower)} — Üst: {fmtNum(d.upper)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="lower" stackId="obp" maxBarSize={compact ? 34 : wide ? 40 : 46}>
                    {obpBarRows.map((e, i) => (
                      <Cell key={`l-${e.key}`} fill={e.light} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="span"
                    stackId="obp"
                    maxBarSize={compact ? 34 : wide ? 40 : 46}
                    radius={compact ? [6, 6, 0, 0] : wide ? [7, 7, 0, 0] : [9, 9, 0, 0]}
                  >
                    {obpBarRows.map((e, i) => (
                      <Cell key={`u-${e.key}`} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {payload.obp.footer ? (
                <p className="mt-1 px-0.5 text-right text-[9px] leading-snug text-white/50 sm:mt-2 sm:text-[11px] sm:text-white/55">{payload.obp.footer}</p>
              ) : null}
            </div>
          </section>
        )}
      </div>

      <footer className="relative z-1 flex flex-col gap-1.5 border-t border-white/10 bg-gradient-to-r from-black/25 via-violet-950/30 to-cyan-950/20 px-3 py-2 text-[9px] text-violet-100/70 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-4 sm:py-2 md:px-5 sm:text-[10px] md:text-[11px]">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 sm:gap-x-3.5 sm:gap-y-1">
          {payload.lgs?.series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1 sm:gap-1.5">
              <span className="size-2 shrink-0 rounded-full ring-1 ring-white/30 sm:size-2.5" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
          {payload.obp?.series.map((s) => (
            <span key={`o-${s.label}`} className="inline-flex items-center gap-1 sm:gap-1.5">
              <span className="size-2 shrink-0 rounded-full ring-1 ring-white/30 sm:size-2.5" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <p className="max-w-prose text-right leading-tight sm:leading-snug">Yerleştirme sonuçları — merkezî / yerel ve program bazlı farklılıklar olabilir.</p>
      </footer>
    </div>
  );
}
