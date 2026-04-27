'use client';

import { Share2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
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

import { captureResultCardAsPng } from '@/lib/capture-result-card-png';

export type PlacementScoreRow = {
  year: number;
  with_exam: number | null;
  without_exam: number | null;
  contingent?: number | null;
  tbs?: number | null;
  min_taban?: number | null;
};

export type ReviewPlacementTrackClient = {
  id: string;
  title: string;
  program?: string;
  language?: string;
  years: PlacementScoreRow[];
};

export type ReviewPlacementBundleV3 = { v: 3; tracks: ReviewPlacementTrackClient[] };

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

const M_SERIES_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#f472b6', '#a78bfa', '#2dd4bf', '#4ade80', '#38bdf8',
  '#fb7185', '#fcd34d', '#a3e635', '#22d3ee', '#c084fc', '#f472b6', '#34d399', '#60a5fa',
];
const Y_SERIES_COLORS = [
  '#4ade80', '#22c55e', '#14b8a6', '#34d399', '#6ee7b7', '#86efac', '#2dd4bf', '#5eead4',
  '#10b981', '#059669', '#0d9488', '#2dd4bf', '#65a30d', '#84cc16', '#14b8a6', '#0ea5e9',
];

/** Çoklu izde lejant: «… / Anadolu Lisesi» son parçası — aynı okul adında çakışmayı önler. */
function programLegendSuffix(title: string): string {
  const t = (title || '').trim();
  const idx = t.lastIndexOf(' / ');
  const seg = idx >= 0 ? t.slice(idx + 3).trim() : t;
  const s = seg.length > 48 ? `${seg.slice(0, 46)}…` : seg;
  return s || 'Alan';
}

/** İki SBL / aynı okul adı farklı program: grafik `dataKey` ve lejant `program` ile ayrılır. */
function chartTrackLegendSuffix(tr: ReviewPlacementTrackClient): string {
  const prog = (tr.program || '').trim().replace(/\s+/g, ' ');
  if (prog.length >= 6) {
    return prog.length > 56 ? `${prog.slice(0, 54)}…` : prog;
  }
  return programLegendSuffix((tr.title || '').trim());
}

function dedupSeriesLabel(base: string, used: Map<string, number>): string {
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n === 0 ? base : `${base} (${n + 1})`;
}

function isV3Scores(x: unknown): x is ReviewPlacementBundleV3 {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as { v?: unknown; tracks?: unknown };
  const vOk = Number.isFinite(Number(o.v)) && Number(o.v) === 3;
  const tr = o.tracks;
  if (vOk && Array.isArray(tr)) return true;
  if (Array.isArray(tr) && tr.length > 0 && (o.v === undefined || o.v === null)) return true;
  return false;
}

function v3ToLgs(bundle: ReviewPlacementBundleV3): ReviewPlacementChartsV2['lgs'] {
  const series: NonNullable<ReviewPlacementChartsV2['lgs']>['series'] = [];
  const n = Math.max(1, bundle.tracks.length);
  const labelCounts = new Map<string, number>();
  let anyMerkezi = false;
  let anyYerel = false;
  let anyTbs = false;
  bundle.tracks.forEach((tr, i) => {
    const suffix = chartTrackLegendSuffix(tr);
    const merkezi = tr.years
      .filter((r) => r && typeof r.year === 'number' && r.with_exam != null && Number.isFinite(Number(r.with_exam)))
      .map((r) => ({ year: r.year, score: Number(r.with_exam) }))
      .sort((a, b) => a.year - b.year);
    const yerel = tr.years
      .filter(
        (r) => r && typeof r.year === 'number' && r.without_exam != null && Number.isFinite(Number(r.without_exam)),
      )
      .map((r) => ({ year: r.year, score: Number(r.without_exam) }))
      .sort((a, b) => a.year - b.year);
    const mBase = n > 1 ? `LGS · ${suffix}` : 'Sınavlı — LGS tabanı (merkezî yerleştirme)';
    const yBase = n > 1 ? `Yerel · ${suffix}` : 'Sınavsız — yerel yerleştirme göstergesi';
    const mLabel = dedupSeriesLabel(mBase, labelCounts);
    const yLabel = dedupSeriesLabel(yBase, labelCounts);
    if (merkezi.length) {
      anyMerkezi = true;
      series.push({ label: mLabel, color: M_SERIES_COLORS[i % M_SERIES_COLORS.length], points: merkezi });
    }
    if (yerel.length) {
      anyYerel = true;
      series.push({ label: yLabel, color: Y_SERIES_COLORS[i % Y_SERIES_COLORS.length], points: yerel });
    }
    const tbsPts = tr.years
      .filter((r) => r && typeof r.year === 'number' && r.tbs != null && Number.isFinite(Number(r.tbs)))
      .map((r) => ({ year: r.year, score: Number(r.tbs) }))
      .sort((a, b) => a.year - b.year);
    if (tbsPts.length) {
      anyTbs = true;
      const c = M_SERIES_COLORS[(i + 3) % M_SERIES_COLORS.length];
      const tBase = n > 1 ? `TBS · ${suffix}` : 'Sınavlı — TBS / toplam puan sütunu';
      series.push({
        label: dedupSeriesLabel(tBase, labelCounts),
        color: c,
        points: tbsPts,
      });
    }
  });
  const onlyYerel = anyYerel && !anyMerkezi && !anyTbs;
  const axisLabel = onlyYerel
    ? 'Yerel yerleştirme göstergesi (program bazlı)'
    : 'Sınavlı / sınavsız yerleştirme (alan/program bazlı)';
  let footer: string;
  if (onlyYerel) {
    footer =
      bundle.tracks.length > 1
        ? 'Her çizgi ayrı program/alandır; değerler genelde OBP veya il–ilçe yerleştirme tabanıdır (LGS değil).'
        : 'Yerel gösterge son yıllara göre çizilir (LGS merkezî tabanı yok).';
  } else if (bundle.tracks.length > 1) {
    footer =
      'Her renkli çizgi ayrı alan veya programdır. LGS/TBS — sınavlı; yerel — genelde sınavsız programa giriş göstergesi.';
  } else {
    footer = 'Üst grafik sınavlı (merkezî / mesleki) yollar; alt grafik varsa sınavsız (yerel) yerleşme göstergesidir.';
  }
  return { axisLabel, footer, series };
}

function legacyToLgs(legacy: PlacementScoreRow[]): ReviewPlacementChartsV2['lgs'] {
  return v3ToLgs({ v: 3, tracks: [{ id: '_one', title: '', years: legacy }] });
}

type LgsLineSeries = NonNullable<NonNullable<ReviewPlacementChartsV2['lgs']>['series']>[number];

/** Sınavsız serisi: merkezî LGS, TBS değil — yerel göstergelere ait. */
function isSinavsizChartLabel(label: string): boolean {
  const t = label.trim();
  if (/^LGS ·/u.test(t)) return false;
  if (/^TBS ·/u.test(t)) return false;
  if (/^LGS \(sınavlı\)/u.test(t)) return false;
  if (/^TBS \(sınavlı\)/u.test(t)) return false;
  if (/^Yerel ·/u.test(t)) return true;
  if (/^Y —/u.test(t)) return true;
  if (/Yerel \(sınavsız\)/i.test(t)) return true;
  if (/^Sınavsız[—\s–-]/u.test(t)) return true;
  if (/Sınavsız/i.test(t) && /Yerel|gösterg|yerel/i.test(t)) return true;
  if (t === 'Yerel yerleştirme (gösterge)') return true;
  if (
    /Yerel\s+yerleştirme|Yerel\s+.*gösterges/i.test(t) &&
    !/LGS|merkez[îi]|TBS|LGS \(sınavlı\)|Sınavlı[—-]\s*LGS/i.test(t)
  ) {
    return true;
  }
  return false;
}

function partitionLgsLineSeriesForMerge(series: LgsLineSeries[]): {
  sinavli: LgsLineSeries[];
  sinavsiz: LgsLineSeries[];
} {
  const sinavli: LgsLineSeries[] = [];
  const sinavsiz: LgsLineSeries[] = [];
  for (const s of series) {
    if (!s?.label) continue;
    if (isSinavsizChartLabel(s.label)) sinavsiz.push(s);
    else sinavli.push(s);
  }
  return { sinavli, sinavsiz };
}

/** Skorlardan gelen çizgiler yalnızca bir tarafı içeriyorsa API’deki `lgs` ile tamamlanır (LGS sonra OBP). */
function mergeScoreDerivedLgsWithApi(
  scoreLgs: NonNullable<ReviewPlacementChartsV2['lgs']>,
  apiLgs: ReviewPlacementChartsV2['lgs'] | undefined,
): NonNullable<ReviewPlacementChartsV2['lgs']> {
  const apiSeries = apiLgs?.series?.length ? apiLgs.series : [];
  const sp = partitionLgsLineSeriesForMerge(scoreLgs.series);
  const ap = partitionLgsLineSeriesForMerge(apiSeries);
  const sinavli = sp.sinavli.length > 0 ? sp.sinavli : ap.sinavli;
  const sinavsiz = sp.sinavsiz.length > 0 ? sp.sinavsiz : ap.sinavsiz;
  const series = [...sinavli, ...sinavsiz];
  const hasM = sinavli.length > 0;
  const hasY = sinavsiz.length > 0;
  if (hasM && hasY) {
    return {
      axisLabel: 'Sınavlı / sınavsız yerleştirme (alan/program bazlı)',
      footer:
        'Her renkli çizgi ayrı alan veya programdır. LGS/TBS — sınavlı; yerel — genelde sınavsız programa giriş göstergesi.',
      series,
    };
  }
  if (hasY && !hasM) {
    return { axisLabel: scoreLgs.axisLabel, footer: scoreLgs.footer, series };
  }
  return { axisLabel: scoreLgs.axisLabel, footer: scoreLgs.footer, series };
}

function mergePayload(
  charts: unknown,
  rawRows: unknown,
): ReviewPlacementChartsV2 | null {
  const fromApi = isV2Charts(charts) ? charts : null;
  let scoreLgs: ReviewPlacementChartsV2['lgs'] | null = null;
  if (isV3Scores(rawRows) && rawRows.tracks?.length) {
    const cand = v3ToLgs(rawRows);
    if (cand?.series && cand.series.length > 0) scoreLgs = cand;
  } else if (Array.isArray(rawRows) && rawRows.length) {
    const ar = rawRows as PlacementScoreRow[];
    const cand = legacyToLgs(ar);
    if (cand?.series && cand.series.length > 0) scoreLgs = cand;
  }
  const out: ReviewPlacementChartsV2 = { v: 2 };
  if (scoreLgs?.series?.length) {
    out.lgs =
      fromApi?.lgs?.series?.length && fromApi.lgs
        ? mergeScoreDerivedLgsWithApi(scoreLgs, fromApi.lgs)
        : scoreLgs;
  } else if (fromApi?.lgs?.series?.length) out.lgs = fromApi.lgs;
  if (fromApi?.obp?.series?.length) out.obp = fromApi.obp;
  if (!out.lgs && !out.obp) return null;
  return out;
}

/** Tablodaki yıl × puan türü ile uyum: grafikte skorda olmayan yıl/noktayı at. */
function filterLgsSeriesToBundleConsistency(
  bundle: ReviewPlacementBundleV3,
  series: LgsLineSeries[],
): LgsLineSeries[] {
  const yearsCentral = new Set<number>();
  const yearsLocal = new Set<number>();
  for (const tr of bundle.tracks) {
    for (const y of tr.years ?? []) {
      if (!y || typeof y.year !== 'number') continue;
      if (y.with_exam != null && Number.isFinite(Number(y.with_exam))) yearsCentral.add(y.year);
      if (y.without_exam != null && Number.isFinite(Number(y.without_exam))) yearsLocal.add(y.year);
    }
  }
  return series
    .map((s) => {
      const local = isSinavsizChartLabel(s.label);
      const allow = local ? yearsLocal : yearsCentral;
      if (allow.size === 0) return s;
      return { ...s, points: s.points.filter((p) => allow.has(p.year)) };
    })
    .filter((s) => s.points.length > 0);
}

function alignPayloadLgsWithScoresForCharts(
  p: ReviewPlacementChartsV2 | null,
  rawRows: unknown,
): ReviewPlacementChartsV2 | null {
  if (!p?.lgs?.series?.length || !isV3Scores(rawRows)) return p;
  const filtered = filterLgsSeriesToBundleConsistency(rawRows, p.lgs.series);
  if (!filtered.length) return p;
  const same =
    filtered.length === p.lgs.series.length &&
    filtered.every((s, i) => {
      const o = p.lgs!.series[i]!;
      if (s.label !== o.label || s.points.length !== o.points.length) return false;
      return s.points.every((pt, j) => pt.year === o.points[j]!.year && pt.score === o.points[j]!.score);
    });
  if (same) return p;
  return { ...p, lgs: { ...p.lgs, series: filtered } };
}

function titleFromLgsChartSeriesLabel(label: string): string {
  const t = label.trim();
  const m = t.match(/^LGS ·\s*(.+)/u) || t.match(/^Yerel ·\s*(.+)/u) || t.match(/^TBS ·\s*(.+)/u);
  if (m?.[1]) return m[1].trim();
  return t;
}

/** Grafik `lgs` serilerinden tablo için v3 paketi (skor JSON yok / eksik yıl iken). */
function syntheticBundleFromLgsChart(
  lgs: NonNullable<ReviewPlacementChartsV2['lgs']>,
): ReviewPlacementBundleV3 | null {
  const series = lgs?.series;
  if (!Array.isArray(series) || !series.length) return null;
  const tracks: ReviewPlacementTrackClient[] = [];
  for (let i = 0; i < series.length; i++) {
    const ser = series[i]!;
    if (!ser?.points?.length) continue;
    const lab = ser.label.trim();
    const isY = isSinavsizChartLabel(ser.label);
    const isTbs = /^TBS ·/u.test(lab) || /TBS\s*\/\s*toplam/i.test(lab);
    const title = titleFromLgsChartSeriesLabel(ser.label);
    const years: PlacementScoreRow[] = ser.points.map((p) => {
      const row: PlacementScoreRow = {
        year: p.year,
        with_exam: !isY && !isTbs ? p.score : null,
        without_exam: isY ? p.score : null,
        contingent: null,
        min_taban: null,
      };
      if (isTbs) row.tbs = p.score;
      return row;
    });
    tracks.push({
      id: `chart:${i}:${lab.slice(0, 64)}`,
      title,
      years,
    });
  }
  if (!tracks.length) return null;
  return { v: 3, tracks };
}

function normTrackKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Grafikteki izleri skor izleriyle aynı yılda birleştirir (LGS grafikte, OBP skorda vb.). */
function mergePlacementV3WithChartTracks(
  base: ReviewPlacementBundleV3,
  syn: ReviewPlacementBundleV3 | null,
): ReviewPlacementBundleV3 {
  if (!syn?.tracks.length) return base;
  const outTracks: ReviewPlacementTrackClient[] = base.tracks.map((t) => ({
    ...t,
    years: [...(t.years ?? [])],
  }));
  for (const st of syn.tracks) {
    const key = normTrackKey(st.title ?? '');
    let idx = outTracks.findIndex((t) => normTrackKey(t.title ?? '') === key);
    if (idx < 0 && key.length >= 8) {
      idx = outTracks.findIndex(
        (t) =>
          normTrackKey(t.title ?? '').includes(key) ||
          key.includes(normTrackKey(t.title ?? '')),
      );
    }
    if (idx < 0) {
      outTracks.push({ ...st, years: [...(st.years ?? [])] });
      continue;
    }
    const tr = outTracks[idx]!;
    const yByYear = new Map<number, PlacementScoreRow>();
    for (const y of tr.years ?? []) yByYear.set(y.year, { ...y });
    for (const y of st.years ?? []) {
      const prev = yByYear.get(y.year) ?? {
        year: y.year,
        with_exam: null,
        without_exam: null,
        contingent: null,
        tbs: null,
        min_taban: null,
      };
      yByYear.set(y.year, {
        year: y.year,
        with_exam: prev.with_exam ?? y.with_exam ?? null,
        without_exam: prev.without_exam ?? y.without_exam ?? null,
        tbs: prev.tbs ?? y.tbs ?? null,
        contingent: prev.contingent ?? y.contingent ?? null,
        min_taban: prev.min_taban ?? y.min_taban ?? null,
      });
    }
    tr.years = [...yByYear.values()].sort((a, b) => b.year - a.year);
  }
  return { v: 3, tracks: outTracks };
}

function yerelScoresByYear(tr: ReviewPlacementTrackClient): Map<number, number> {
  const m = new Map<number, number>();
  for (const y of tr.years ?? []) {
    if (y.without_exam != null && Number.isFinite(Number(y.without_exam))) m.set(y.year, Number(y.without_exam));
  }
  return m;
}

/** `chart:` sentetik iz, aynı yerel puanlara sahip skor iziyle aynıysa tablodan atılır (sınavlı+sınavsız). */
function removeRedundantSyntheticYerelTracks(bundle: ReviewPlacementBundleV3 | null): ReviewPlacementBundleV3 | null {
  if (!bundle?.tracks?.length) return bundle;
  const remove = new Set<string>();
  const synthetics = bundle.tracks.filter((t) => String(t.id).startsWith('chart:'));
  const rows = bundle.tracks.filter((t) => !String(t.id).startsWith('chart:'));
  for (const st of synthetics) {
    const sig = yerelScoresByYear(st);
    if (!sig.size) continue;
    for (const rt of rows) {
      const rmap = yerelScoresByYear(rt);
      let ok = true;
      for (const [y, v] of sig) {
        if (rmap.get(y) !== v) {
          ok = false;
          break;
        }
      }
      if (ok) {
        remove.add(st.id);
        break;
      }
    }
  }
  if (!remove.size) return bundle;
  return { v: 3, tracks: bundle.tracks.filter((t) => !remove.has(t.id)) };
}

function isGenericSinavsizSeriesLabel(lab: string): boolean {
  const t = lab.trim();
  if (/^sınavsız[—\s–-]/iu.test(t)) return true;
  if (t === 'Yerel gösterge') return true;
  return false;
}

function sinavsizSeriesPointSignature(s: LgsLineSeries): string {
  return [...s.points]
    .map((p) => `${p.year}:${p.score}`)
    .sort()
    .join('|');
}

/** Grafikte aynı (yıl, puan) dizisine sahip yinelenen sınavsız serileri tek çizgide birleştirir. */
function dedupeSinavsizSeriesByIdenticalPoints(sinavsiz: LgsLineSeries[]): LgsLineSeries[] {
  const sigToBest = new Map<string, LgsLineSeries>();
  for (const s of sinavsiz) {
    if (!s.points?.length) continue;
    const sig = sinavsizSeriesPointSignature(s);
    const prev = sigToBest.get(sig);
    if (!prev) {
      sigToBest.set(sig, s);
      continue;
    }
    if (isGenericSinavsizSeriesLabel(prev.label) && !isGenericSinavsizSeriesLabel(s.label)) sigToBest.set(sig, s);
  }
  return [...sigToBest.values()];
}

function withDedupedSinavsizInPayload(p: ReviewPlacementChartsV2 | null): ReviewPlacementChartsV2 | null {
  if (!p?.lgs?.series?.length) return p;
  const { sinavli, sinavsiz } = partitionLgsLineSeriesForMerge(p.lgs.series);
  const ded = dedupeSinavsizSeriesByIdenticalPoints(sinavsiz);
  const mul = (arr: LgsLineSeries[]) => arr.map(sinavsizSeriesPointSignature).slice().sort().join('\u241e');
  if (ded.length === sinavsiz.length && mul(sinavsiz) === mul(ded)) return p;
  return { ...p, lgs: { ...p.lgs, series: [...sinavli, ...ded] } };
}

function lgsIsYerelOnlyChart(lgs: NonNullable<ReviewPlacementChartsV2['lgs']> | undefined): boolean {
  return Boolean(lgs?.series?.length && lgs.series.every((s) => isSinavsizChartLabel(s.label)));
}

function trackRowsAreYerelOnly(t: ReviewPlacementTrackClient): boolean {
  const ys = t.years ?? [];
  if (!ys.length) return false;
  return ys.every(
    (y) =>
      y.with_exam == null &&
      (y.tbs == null || !Number.isFinite(Number(y.tbs))) &&
      (y.contingent == null || !Number.isFinite(Number(y.contingent))) &&
      (y.min_taban == null || !Number.isFinite(Number(y.min_taban))),
  );
}

/**
 * Grafik + skor birleşince aynı yıl yereli iki izde (API çizgisi + tablo) tekrarlanmasın.
 * Yalnızca grafik tamamen sınavsız ve en az bir `chart:` sentetik iz varken çalışır.
 */
function collapseYerelOnlyDuplicateTracks(
  bundle: ReviewPlacementBundleV3 | null,
  lgs: NonNullable<ReviewPlacementChartsV2['lgs']> | undefined,
): ReviewPlacementBundleV3 | null {
  if (!bundle?.tracks?.length || !lgsIsYerelOnlyChart(lgs)) return bundle;
  const hasSynthetic = bundle.tracks.some((t) => String(t.id).startsWith('chart:'));
  const hasRowTrack = bundle.tracks.some((t) => !String(t.id).startsWith('chart:'));
  if (!hasSynthetic || !hasRowTrack || bundle.tracks.length <= 1) return bundle;
  if (!bundle.tracks.every((t) => trackRowsAreYerelOnly(t))) return bundle;
  const yByYear = new Map<number, PlacementScoreRow>();
  for (const tr of bundle.tracks) {
    for (const y of tr.years ?? []) {
      if (y.without_exam == null || !Number.isFinite(Number(y.without_exam))) continue;
      if (yByYear.has(y.year)) continue;
      yByYear.set(y.year, {
        year: y.year,
        with_exam: null,
        without_exam: Number(y.without_exam),
        contingent: null,
        tbs: null,
        min_taban: null,
      });
    }
  }
  const years = [...yByYear.values()].sort((a, b) => b.year - a.year);
  const nonGeneric = bundle.tracks.find(
    (t) => !/^sınavsız[—\s–-]/iu.test((t.title ?? '').trim()) && (t.title ?? '').trim().length > 0,
  );
  const title =
    (nonGeneric?.title ?? bundle.tracks.find((t) => !String(t.id).startsWith('chart:'))?.title ?? bundle.tracks[0]!.title)
      ?.trim() || 'Yerel yerleştirme';
  return {
    v: 3,
    tracks: [{ id: 'merged-yerel-display', title, years }],
  };
}

/** Yerel-only’de çoklu çizgiyi tek seriye indir (tablo ile aynı yıl değerleri). */
function applyYerelChartSeriesCollapse(
  p: ReviewPlacementChartsV2 | null,
  collapsed: ReviewPlacementBundleV3 | null,
): ReviewPlacementChartsV2 | null {
  if (!p?.lgs?.series?.length || !collapsed?.tracks?.length) return p;
  if (!lgsIsYerelOnlyChart(p.lgs)) return p;
  if (p.lgs.series.length <= 1) return p;
  if (collapsed.tracks.length !== 1) return p;
  const tr = collapsed.tracks[0]!;
  const pts = (tr.years ?? [])
    .filter((y) => y.without_exam != null && Number.isFinite(Number(y.without_exam)))
    .map((y) => ({ year: y.year, score: Number(y.without_exam) }))
    .sort((a, b) => a.year - b.year);
  if (!pts.length) return p;
  const color =
    p.lgs.series.find((s) => isSinavsizChartLabel(s.label))?.color ?? Y_SERIES_COLORS[0]!;
  return {
    ...p,
    lgs: {
      ...p.lgs,
      series: [{ label: 'Yerel gösterge', color, points: pts }],
    },
  };
}

export function hasPlacementInfographic(charts: unknown, rawRows: unknown): boolean {
  if (mergePayload(charts, rawRows) !== null) return true;
  if (isV3Scores(rawRows) && (rawRows.tracks?.some((t) => t.years?.length) ?? false)) return true;
  const fromApi = isV2Charts(charts) ? charts : null;
  if (
    fromApi?.lgs?.series?.length &&
    syntheticBundleFromLgsChart(fromApi.lgs)?.tracks.some((t) => t.years?.length)
  )
    return true;
  return false;
}

function numericLikeToFinite(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Sınavsız (OBP) ekseni: küçük aralıkta padding, tick sıkışmasını azaltır. */
function numericDomainFromLgsRows(data: Record<string, string | number | null>[]): [number, number] | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of data) {
    for (const [k, v] of Object.entries(row)) {
      if (k === 'year') continue;
      const n = numericLikeToFinite(v);
      if (n == null) continue;
      lo = Math.min(lo, n);
      hi = Math.max(hi, n);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  if (lo === hi) {
    const d = Math.max(0.25, Math.abs(lo) * 0.04 || 0.5);
    return [lo - d, hi + d];
  }
  const span = hi - lo;
  const pad = Math.max(span * 0.12, span < 8 ? 0.5 : 0.75);
  const loP = lo - pad;
  const hiP = hi + pad;
  if (hi <= 120 && lo >= 0) {
    return [Math.max(0, Math.floor(loP * 100) / 100), Math.ceil(hiP * 100) / 100];
  }
  return [loP, hiP];
}

function buildLgsLineData(groupSeries: LgsLineSeries[]): Record<string, string | number | null>[] {
  if (!groupSeries.length) return [];
  const years = new Set<number>();
  for (const s of groupSeries) for (const p of s.points) years.add(p.year);
  const yArr = [...years].sort((a, b) => a - b);
  return yArr.map((year) => {
    const row: Record<string, string | number | null> = { year: String(year) };
    for (const ser of groupSeries) {
      const hit = ser.points.find((p) => p.year === year);
      row[ser.label] = hit ? hit.score : null;
    }
    return row;
  });
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

/** Tek tabloda tüm iz × yıl (özet). */
function V3SummaryFlatTable({ bundle }: { bundle: ReviewPlacementBundleV3 }) {
  type Flat = {
    k: string;
    alan: string;
    dil: string;
    yil: number;
    merkezi: number | null;
    yerel: number | null;
    tbs: number | null;
    knt: number | null;
    taban: number | null;
  };
  const flat: Flat[] = [];
  for (const tr of bundle.tracks) {
    const alan = [tr.title?.trim(), tr.program?.trim()].filter(Boolean).join(' · ') || '—';
    const dil = tr.language?.trim() || '—';
    for (const y of tr.years || []) {
      flat.push({
        k: `${tr.id}-${y.year}`,
        alan,
        dil,
        yil: y.year,
        merkezi: y.with_exam ?? null,
        yerel: y.without_exam ?? null,
        tbs: y.tbs ?? null,
        knt: y.contingent ?? null,
        taban: y.min_taban ?? null,
      });
    }
  }
  flat.sort((a, b) => a.alan.localeCompare(b.alan, 'tr') || b.yil - a.yil);
  const showM = flat.some((r) => r.merkezi != null);
  const showY = flat.some((r) => r.yerel != null);
  const showT = flat.some((r) => r.tbs != null);
  const showC = flat.some((r) => r.knt != null);
  const showTab = flat.some((r) => r.taban != null);
  if (!flat.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-cyan-400/20 bg-cyan-950/15">
      <p className="border-b border-cyan-400/15 bg-cyan-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-cyan-100/90 sm:px-2.5 sm:text-[10px]">
        Tüm alanlar — özet
      </p>
      <table className="w-full min-w-[520px] text-left tabular-nums text-white/90">
        <thead>
          <tr className="border-b border-white/10 text-white/65">
            <th className="px-2 py-1.5 font-medium sm:px-2.5">Program / alan</th>
            <th className="px-2 py-1.5 font-medium">Dil</th>
            <th className="px-2 py-1.5 font-medium">Yıl</th>
            {showM ? <th className="px-2 py-1.5 font-medium">Merkezî (LGS)</th> : null}
            {showY ? <th className="px-2 py-1.5 font-medium">Yerel</th> : null}
            {showT ? <th className="px-2 py-1.5 font-medium">TBS</th> : null}
            {showC ? <th className="px-2 py-1.5 font-medium">Knt.</th> : null}
            {showTab ? <th className="px-2 py-1.5 font-medium">Taban</th> : null}
          </tr>
        </thead>
        <tbody>
          {flat.map((r) => (
            <tr key={r.k} className="border-b border-white/6 last:border-0">
              <td className="max-w-[220px] px-2 py-1.5 align-top text-[10px] leading-snug sm:max-w-xs sm:px-2.5 sm:text-[11px]">
                {r.alan}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-white/80">{r.dil}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{r.yil}</td>
              {showM ? <td className="px-2 py-1.5">{r.merkezi != null ? fmtNum(r.merkezi) : '—'}</td> : null}
              {showY ? <td className="px-2 py-1.5">{r.yerel != null ? fmtNum(r.yerel) : '—'}</td> : null}
              {showT ? <td className="px-2 py-1.5">{r.tbs != null ? fmtNum(r.tbs) : '—'}</td> : null}
              {showC ? <td className="px-2 py-1.5">{r.knt != null ? fmtNum(r.knt) : '—'}</td> : null}
              {showTab ? <td className="px-2 py-1.5">{r.taban != null ? fmtNum(r.taban) : '—'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  rows?: unknown;
};

function V3DetailTables({ bundle }: { bundle: ReviewPlacementBundleV3 }) {
  if (!bundle.tracks.length) return null;
  return (
    <div className="space-y-3">
      {bundle.tracks.map((tr) => {
        const years = [...tr.years].sort((a, b) => b.year - a.year);
        if (!years.length) return null;
        const showC = years.some((y) => y.contingent != null);
        const showT = years.some((y) => y.tbs != null);
        const showMin = years.some((y) => y.min_taban != null);
        const hasLgs = years.some((y) => y.with_exam != null);
        const hasSinavliBlock = hasLgs || showC || showT || showMin;
        const hasYerel = years.some((y) => y.without_exam != null);
        return (
          <div
            key={tr.id}
            className="space-y-2 rounded-lg border border-sky-400/15 bg-white/4 p-1.5 text-[10px] sm:p-2 sm:text-[11px]"
          >
            <p className="border-b border-white/10 px-1.5 py-1 font-semibold text-sky-100/95 sm:px-2">
              {tr.title?.trim() || (bundle.tracks.length > 1 ? 'Program / alan' : 'Yerleştirme')}
              {tr.program ? <span className="ml-1 font-normal text-white/70">· {tr.program}</span> : null}
              {tr.language ? <span className="ml-1 font-normal text-white/70">· Dil: {tr.language}</span> : null}
            </p>
            {hasSinavliBlock && (
              <div className="overflow-x-auto rounded-md border border-rose-400/20 bg-rose-950/15">
                <p className="border-b border-rose-400/15 bg-rose-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-rose-100/90 sm:px-2.5 sm:text-[10px]">
                  Sınavlı (LGS, merkezî / TBS, kontenjan)
                </p>
                <table className="w-full min-w-[200px] text-left tabular-nums text-white/90">
                  <thead>
                    <tr className="border-b border-white/10 text-white/65">
                      <th className="px-2 py-1.5 font-medium sm:px-2.5">Yıl</th>
                      {hasLgs ? <th className="px-2 py-1.5 font-medium">LGS / merkezî</th> : null}
                      {showC ? <th className="px-2 py-1.5 font-medium">Knt.</th> : null}
                      {showT ? <th className="px-2 py-1.5 font-medium">TBS</th> : null}
                      {showMin ? <th className="px-2 py-1.5 font-medium">Taban / son puan</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y) => (
                      <tr key={`s-${y.year}`} className="border-b border-white/6 last:border-0">
                        <td className="px-2 py-1.5 sm:px-2.5">{y.year}</td>
                        {hasLgs ? (
                          <td className="px-2 py-1.5">{y.with_exam != null ? fmtNum(y.with_exam) : '—'}</td>
                        ) : null}
                        {showC ? <td className="px-2 py-1.5">{y.contingent != null ? fmtNum(y.contingent) : '—'}</td> : null}
                        {showT ? <td className="px-2 py-1.5">{y.tbs != null ? fmtNum(y.tbs) : '—'}</td> : null}
                        {showMin ? <td className="px-2 py-1.5">{y.min_taban != null ? fmtNum(y.min_taban) : '—'}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasYerel && (
              <div className="overflow-x-auto rounded-md border border-emerald-400/20 bg-emerald-950/15">
                <p className="border-b border-emerald-400/15 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-100/90 sm:px-2.5 sm:text-[10px]">
                  Sınavsız (yerel yerleştirme göstergesi)
                </p>
                <table className="w-full min-w-[160px] text-left tabular-nums text-white/90">
                  <thead>
                    <tr className="border-b border-white/10 text-white/65">
                      <th className="px-2 py-1.5 font-medium sm:px-2.5">Yıl</th>
                      <th className="px-2 py-1.5 font-medium">Yerel gösterge (OBP/alan vb.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y) => (
                      <tr key={`e-${y.year}`} className="border-b border-white/6 last:border-0">
                        <td className="px-2 py-1.5 sm:px-2.5">{y.year}</td>
                        <td className="px-2 py-1.5">{y.without_exam != null ? fmtNum(y.without_exam) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SchoolPlacementScoresCard({ schoolName, charts, rows }: SchoolPlacementScoresCardProps) {
  const layout = useChartLayout();
  const compact = layout === 'compact';
  const wide = layout === 'wide';
  const payload = useMemo(() => mergePayload(charts, rows), [charts, rows]);
  const payloadAligned = useMemo(() => alignPayloadLgsWithScoresForCharts(payload, rows), [payload, rows]);
  const payloadPresentation = useMemo(() => withDedupedSinavsizInPayload(payloadAligned), [payloadAligned]);
  const displayV3Bundle = useMemo((): ReviewPlacementBundleV3 | null => {
    const syn =
      payloadPresentation?.lgs?.series?.length && payloadPresentation.lgs
        ? syntheticBundleFromLgsChart(payloadPresentation.lgs)
        : null;
    const fromRows = isV3Scores(rows) ? rows : null;
    if (!fromRows?.tracks?.length) return syn;
    const hasAnyYearRow = fromRows.tracks.some((t) => (t.years ?? []).length > 0);
    if (!hasAnyYearRow) return syn;
    return mergePlacementV3WithChartTracks(fromRows, syn);
  }, [rows, payloadPresentation]);
  const strippedSyntheticBundle = useMemo(
    () => removeRedundantSyntheticYerelTracks(displayV3Bundle),
    [displayV3Bundle],
  );
  const yerelCollapsedBundle = useMemo(
    () => collapseYerelOnlyDuplicateTracks(strippedSyntheticBundle, payloadPresentation?.lgs),
    [strippedSyntheticBundle, payloadPresentation],
  );
  const chartPayload = useMemo(
    () => applyYerelChartSeriesCollapse(payloadPresentation, yerelCollapsedBundle),
    [payloadPresentation, yerelCollapsedBundle],
  );
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
  const lgsSplit = useMemo(() => {
    const list = chartPayload?.lgs?.series;
    if (!list?.length) return { sinavli: [] as LgsLineSeries[], sinavsiz: [] as LgsLineSeries[] };
    const sinavli: LgsLineSeries[] = [];
    const sinavsiz: LgsLineSeries[] = [];
    for (const ser of list) (isSinavsizChartLabel(ser.label) ? sinavsiz : sinavli).push(ser);
    return { sinavli, sinavsiz };
  }, [chartPayload]);
  const lgsLineDataSinavli = useMemo(() => buildLgsLineData(lgsSplit.sinavli), [lgsSplit]);
  const lgsLineDataSinavsiz = useMemo(() => buildLgsLineData(lgsSplit.sinavsiz), [lgsSplit]);
  const yerelYDomain = useMemo(() => numericDomainFromLgsRows(lgsLineDataSinavsiz), [lgsLineDataSinavsiz]);
  const chartYerelOnly = useMemo(
    () =>
      Boolean(
        chartPayload?.lgs?.series?.length && chartPayload.lgs.series.every((s) => isSinavsizChartLabel(s.label)),
      ),
    [chartPayload],
  );
  const seriesCount = chartPayload?.lgs?.series?.length ?? 0;
  const dualPlacementCharts = lgsSplit.sinavli.length > 0 && lgsSplit.sinavsiz.length > 0;
  const lgsChartHeight = Math.min(
    440,
    (dualPlacementCharts ? (compact ? 156 : wide ? 174 : 184) : lgsH) + Math.max(0, seriesCount - 3) * (compact ? 10 : wide ? 12 : 14),
  );

  const obpBarRows = useMemo(() => {
    if (!chartPayload?.obp?.series?.length) return [];
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
    for (const s of chartPayload.obp.series) {
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
  }, [chartPayload]);

  const showV3Table = Boolean(yerelCollapsedBundle?.tracks?.some((t) => t.years?.length > 0));
  if (!payload && !showV3Table) return null;

  const yMaxObp = chartPayload?.obp?.yMax && chartPayload.obp.yMax > 0 ? chartPayload.obp.yMax : 200;

  const shareCardRef = useRef<HTMLDivElement>(null);
  const sharingRef = useRef(false);
  const [sharing, setSharing] = useState(false);
  const handleShareVisual = useCallback(async () => {
    const el = shareCardRef.current;
    if (!el || sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    try {
      const blob = await captureResultCardAsPng(el, null);
      if (!blob) {
        toast.error('Görsel oluşturulamadı; sayfayı kaydırıp tekrar deneyin.');
        return;
      }
      const slug = schoolName
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72);
      const name = `yerlestirme-${slug || 'okul'}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      if (
        nav?.share &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })
      ) {
        await nav.share({
          files: [file],
          title: `${schoolName} — Yerleştirme`,
          text: 'Yerleştirme grafiği (görsel)',
        });
        toast.success('Paylaşım seçildi.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('PNG indirildi; galeriden sosyal medyada paylaşabilirsiniz.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Paylaşım açılamadı.');
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }, [schoolName]);

  return (
    <div ref={shareCardRef} className={shell} data-capture-keep-dark>
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
        {chartYerelOnly ? 'Yerel' : 'MEB'}
      </div>

      <header className="relative z-10 flex items-center gap-2 border-b border-white/10 bg-gradient-to-r from-white/5 via-fuchsia-500/5 to-cyan-500/5 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2.5 md:px-5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-400/50 bg-gradient-to-br from-rose-500 to-rose-800 text-[8px] font-bold leading-tight text-white shadow-lg shadow-rose-900/50 sm:size-10 sm:text-[9px] md:size-11"
          aria-hidden
        >
          {chartYerelOnly ? 'Yrl' : 'MEB'}
        </div>
        <h3 className="min-w-0 flex-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white sm:text-xs md:text-sm">
          {schoolName}
        </h3>
        <button
          type="button"
          data-html2canvas-ignore
          onClick={() => void handleShareVisual()}
          disabled={sharing}
          title="Grafiği PNG olarak paylaş veya indir"
          className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-400/40 bg-gradient-to-br from-cyan-500/25 to-violet-600/30 px-2 py-1 text-[9px] font-semibold text-cyan-50 shadow-inner ring-1 ring-white/10 transition hover:border-cyan-300/60 hover:from-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[10px]"
        >
          <Share2 className="size-3.5 shrink-0 opacity-95 sm:size-4" aria-hidden />
          <span className="max-[380px]:sr-only">{sharing ? '…' : 'Paylaş'}</span>
        </button>
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-gradient-to-br from-cyan-500/30 to-violet-600/35 text-[8px] font-semibold text-cyan-50 shadow-inner sm:size-10 sm:text-[9px] md:size-11"
          aria-hidden
        >
          OKL
        </div>
      </header>

      <div className="relative z-1 space-y-3 px-2 py-2.5 sm:space-y-5 sm:px-3 sm:py-4 md:space-y-6 md:px-4 md:py-5">
        {chartPayload?.lgs && lgsLineDataSinavli.length > 0 && lgsSplit.sinavli.length > 0 && (
          <section className="flex min-h-0 gap-1 sm:gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-rose-400/30 bg-gradient-to-b from-rose-500/25 to-rose-600/5 py-1.5 sm:w-9 sm:py-2 md:w-10">
              <span
                className="text-[8px] font-extrabold uppercase leading-tight tracking-wide text-rose-100/95 sm:text-[9px] sm:tracking-wider"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Sınavlı
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-r-lg border border-l-0 border-rose-400/25 bg-gradient-to-br from-rose-500/10 via-rose-950/20 to-transparent py-1 pr-0.5 sm:py-0 sm:pr-1">
              {lgsSplit.sinavli.length > 1 && (
                <p className="px-0.5 pb-0.5 text-center text-[8px] font-medium text-rose-100/80 sm:text-[9px]">LGS / TBS / merkezî puan</p>
              )}
              <ResponsiveContainer width="100%" height={lgsChartHeight}>
                <LineChart data={lgsLineDataSinavli} margin={lgsMargin}>
                  <CartesianGrid stroke="rgba(251,113,133,0.14)" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'rgba(254,226,232,0.92)', fontSize: compact ? 9 : wide ? 10 : 11 }}
                    axisLine={{ stroke: 'rgba(244,63,94,0.4)' }}
                  />
                  <YAxis
                    width={compact ? 30 : wide ? 32 : 34}
                    tick={{ fill: 'rgba(254,226,232,0.8)', fontSize: compact ? 9 : wide ? 9 : 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? fmtNum(v) : String(v))}
                    allowDecimals
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(11,18,32,0.94)',
                      border: '1px solid rgba(251,113,133,0.2)',
                      borderRadius: 10,
                      fontSize: compact ? 11 : 12,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: compact ? 9 : wide ? 10 : 11, paddingTop: compact ? 2 : wide ? 4 : 6 }}
                    formatter={(v) => <span className="text-rose-50/95">{v}</span>}
                  />
                  {lgsSplit.sinavli.map((ser) => (
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
            </div>
          </section>
        )}

        {chartPayload?.lgs && lgsLineDataSinavsiz.length > 0 && lgsSplit.sinavsiz.length > 0 && (
          <section className="flex min-h-0 gap-1 sm:gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-emerald-400/30 bg-gradient-to-b from-emerald-500/20 to-emerald-600/5 py-1.5 sm:w-9 sm:py-2 md:w-10">
              <span
                className="text-[8px] font-extrabold uppercase leading-tight tracking-wide text-emerald-100/95 sm:text-[9px] sm:tracking-wider"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Sınavsız
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-r-lg border border-l-0 border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-emerald-950/20 to-transparent py-1 pr-0.5 sm:py-0 sm:pr-1">
              {lgsSplit.sinavsiz.length > 1 && (
                <p className="px-0.5 pb-0.5 text-center text-[8px] font-medium text-emerald-100/80 sm:text-[9px]">Yerel / OBP göstergeleri (alan bazlı olabilir)</p>
              )}
              <ResponsiveContainer width="100%" height={lgsChartHeight}>
                <LineChart data={lgsLineDataSinavsiz} margin={lgsMargin}>
                  <CartesianGrid stroke="rgba(52,211,153,0.12)" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'rgba(209,250,229,0.9)', fontSize: compact ? 9 : wide ? 10 : 11 }}
                    axisLine={{ stroke: 'rgba(16,185,129,0.35)' }}
                  />
                  <YAxis
                    width={compact ? 34 : wide ? 36 : 38}
                    tick={{ fill: 'rgba(209,250,229,0.8)', fontSize: compact ? 9 : wide ? 9 : 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={yerelYDomain ?? ['auto', 'auto']}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? fmtNum(v) : String(v))}
                    allowDecimals
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(11,18,32,0.94)',
                      border: '1px solid rgba(52,211,153,0.25)',
                      borderRadius: 10,
                      fontSize: compact ? 11 : 12,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: compact ? 9 : wide ? 10 : 11, paddingTop: compact ? 2 : wide ? 4 : 6 }}
                    formatter={(v) => <span className="text-emerald-50/95">{v}</span>}
                  />
                  {lgsSplit.sinavsiz.map((ser) => (
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
            </div>
          </section>
        )}

        {chartPayload?.lgs && chartPayload.lgs.footer && (lgsLineDataSinavli.length > 0 || lgsLineDataSinavsiz.length > 0) && (
          <p className="px-0.5 text-right text-[9px] leading-snug text-white/50 sm:px-1 sm:text-[11px] sm:text-white/55">
            {chartYerelOnly
              ? lgsSplit.sinavsiz.length > 1
                ? 'Her çizgi ayrı program/alandır; değerler genelde OBP veya il–ilçe yerleştirme tabanıdır (LGS değil).'
                : 'Yerel gösterge son yıllara göre çizilir (LGS merkezî tabanı yok).'
              : chartPayload.lgs.footer}
          </p>
        )}

        {yerelCollapsedBundle && showV3Table && (
          <div className="space-y-3 px-0.5 sm:space-y-4 sm:px-1">
            {!chartYerelOnly ? <V3SummaryFlatTable bundle={yerelCollapsedBundle} /> : null}
            <V3DetailTables bundle={yerelCollapsedBundle} />
          </div>
        )}

        {chartPayload?.obp && obpBarRows.length > 0 && (
          <section className="flex min-h-0 gap-1 sm:gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-violet-400/25 bg-gradient-to-b from-violet-500/20 to-fuchsia-500/5 py-1.5 sm:w-9 sm:py-2 md:w-10">
                <span
                className="text-[9px] font-bold uppercase tracking-wider text-white/80 sm:text-[11px] sm:tracking-widest sm:text-white/90"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {chartPayload?.obp?.axisLabel || 'OBP Başarı Puanları'}
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-r-lg border border-l-0 border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent py-1 pr-0.5 sm:py-0 sm:pr-1">
              {chartPayload?.obp?.academicYear ? (
                <p className="mb-0.5 text-center text-[9px] font-semibold text-white/65 sm:mb-1 sm:text-[10px] sm:text-white/70">{chartPayload.obp.academicYear}</p>
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
              {chartPayload?.obp?.footer ? (
                <p className="mt-1 px-0.5 text-right text-[9px] leading-snug text-white/50 sm:mt-2 sm:text-[11px] sm:text-white/55">{chartPayload.obp.footer}</p>
              ) : null}
            </div>
          </section>
        )}
      </div>

      <footer className="relative z-1 flex flex-col gap-1.5 border-t border-white/10 bg-gradient-to-r from-black/25 via-violet-950/30 to-cyan-950/20 px-3 py-2 text-[9px] text-violet-100/70 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-4 sm:py-2 md:px-5 sm:text-[10px] md:text-[11px]">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {chartPayload?.lgs?.series.some((s) => !isSinavsizChartLabel(s.label)) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 sm:gap-x-3.5 sm:gap-y-1">
              <span className="w-full text-[8px] font-bold uppercase text-rose-200/90 sm:text-[9px]">Sınavlı</span>
              {chartPayload.lgs!.series
                .filter((s) => !isSinavsizChartLabel(s.label))
                .map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1 sm:gap-1.5">
                    <span className="size-2 shrink-0 rounded-full ring-1 ring-rose-300/40 sm:size-2.5" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
            </div>
          )}
          {chartPayload?.lgs?.series.some((s) => isSinavsizChartLabel(s.label)) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 sm:gap-x-3.5 sm:gap-y-1">
              <span className="w-full text-[8px] font-bold uppercase text-emerald-200/90 sm:text-[9px]">Sınavsız</span>
              {chartPayload.lgs!.series
                .filter((s) => isSinavsizChartLabel(s.label))
                .map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1 sm:gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full ring-1 ring-emerald-300/40 sm:size-2.5"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                  </span>
                ))}
            </div>
          )}
          {chartPayload?.obp?.series?.map((s) => (
            <span key={`o-${s.label}`} className="inline-flex items-center gap-1 sm:gap-1.5">
              <span className="size-2 shrink-0 rounded-full ring-1 ring-white/30 sm:size-2.5" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <p className="max-w-prose text-right leading-tight sm:leading-snug">
          {chartYerelOnly
            ? 'Yerel göstergeler program bazında farklılaşabilir; LGS merkezî tabanı bu kartta yoktur.'
            : 'Yerleştirme sonuçları — merkezî / yerel ve program bazlı farklılıklar olabilir.'}
        </p>
      </footer>
    </div>
  );
}
