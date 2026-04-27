import {
  normalizeReviewPlacementScoresJson,
  type ReviewPlacementBundleV3,
  type ReviewPlacementTrack,
} from './review-placement-scores.util';

/** Çok alanlı okullarda tüm seriler API’ye sığsın (el ile v2 JSON). */
const MAX_SERIES = 24;
const MAX_POINTS = 24;
const MAX_LABEL = 140;

function clampStr(s: unknown, max: number): string {
  const t = typeof s === 'string' ? s.trim() : '';
  return t.length > max ? t.slice(0, max) : t;
}

function isHexColor(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s);
}

function isSafeCssColor(s: string): boolean {
  const t = s.trim();
  if (t.length < 4 || t.length > 80) return false;
  if (isHexColor(t)) return true;
  if (/^rgba?\(\s*[\d.]+\s*,/i.test(t)) return true;
  return /^hsla?\(/i.test(t);
}

/** API yanıtı: v2 grafik JSON — şema dışını atar, boyut sınırlar. */
export function sanitizeReviewPlacementCharts(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.v) !== 2) return null;
  const out: Record<string, unknown> = { v: 2 };

  const lgs = o.lgs;
  if (lgs && typeof lgs === 'object' && !Array.isArray(lgs)) {
    const lg = lgs as Record<string, unknown>;
    const seriesIn = Array.isArray(lg.series) ? lg.series : [];
    const series = seriesIn.slice(0, MAX_SERIES).map((item) => {
      if (!item || typeof item !== 'object') return null;
      const s = item as Record<string, unknown>;
      const label = clampStr(s.label, MAX_LABEL);
      const color = clampStr(s.color, 80);
      const ptsIn = Array.isArray(s.points) ? s.points : [];
      const points = ptsIn.slice(0, MAX_POINTS).map((p) => {
        if (!p || typeof p !== 'object') return null;
        const q = p as Record<string, unknown>;
        const year = typeof q.year === 'number' ? q.year : parseInt(String(q.year ?? ''), 10);
        const score = typeof q.score === 'number' ? q.score : parseFloat(String(q.score ?? '').replace(',', '.'));
        if (!Number.isFinite(year) || year < 1990 || year > 2100) return null;
        if (!Number.isFinite(score)) return null;
        return { year, score: Math.round(score * 100) / 100 };
      });
      const pointsOk = points.filter((x): x is { year: number; score: number } => x != null);
      if (!label || !isSafeCssColor(color) || pointsOk.length === 0) return null;
      return { label, color, points: pointsOk };
    });
    const seriesOk = series.filter((x): x is NonNullable<typeof x> => x != null);
    if (seriesOk.length) {
      out.lgs = {
        axisLabel: clampStr(lg.axisLabel, 80) || 'LGS Taban Puanlar',
        footer: clampStr(lg.footer, 220),
        series: seriesOk,
      };
    }
  }

  const obp = o.obp;
  if (obp && typeof obp === 'object' && !Array.isArray(obp)) {
    const ob = obp as Record<string, unknown>;
    const seriesIn = Array.isArray(ob.series) ? ob.series : [];
    const series = seriesIn.slice(0, MAX_SERIES).map((item) => {
      if (!item || typeof item !== 'object') return null;
      const s = item as Record<string, unknown>;
      const label = clampStr(s.label, MAX_LABEL);
      const color = clampStr(s.color, 80);
      const lightColor = clampStr(s.lightColor, 80);
      const progsIn = Array.isArray(s.programs) ? s.programs : [];
      const programs = progsIn.slice(0, 8).map((p) => {
        if (!p || typeof p !== 'object') return null;
        const q = p as Record<string, unknown>;
        const code = clampStr(q.code, 16);
        const lower = typeof q.lower === 'number' ? q.lower : parseFloat(String(q.lower ?? '').replace(',', '.'));
        const upper = typeof q.upper === 'number' ? q.upper : parseFloat(String(q.upper ?? '').replace(',', '.'));
        if (!code || !Number.isFinite(lower) || !Number.isFinite(upper)) return null;
        return { code, lower: Math.round(lower * 100) / 100, upper: Math.round(upper * 100) / 100 };
      });
      const programsOk = programs.filter((x): x is { code: string; lower: number; upper: number } => x != null);
      if (!label || !isSafeCssColor(color) || programsOk.length === 0) return null;
      const row: Record<string, unknown> = { label, color, programs: programsOk };
      if (lightColor && isSafeCssColor(lightColor)) row.lightColor = lightColor;
      return row;
    });
    const seriesOk = series.filter((x): x is NonNullable<typeof x> => x != null);
    if (seriesOk.length) {
      const yMax = typeof ob.yMax === 'number' && ob.yMax > 0 && ob.yMax <= 500 ? ob.yMax : 200;
      out.obp = {
        axisLabel: clampStr(ob.axisLabel, 80) || 'OBP Başarı Puanları',
        yMax,
        academicYear: clampStr(ob.academicYear, 24),
        footer: clampStr(ob.footer, 220),
        series: seriesOk,
      };
    }
  }

  if (!out.lgs && !out.obp) return null;
  return out;
}

const M_SERIES_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#f472b6', '#a78bfa', '#2dd4bf', '#4ade80', '#38bdf8',
  '#fb7185', '#fcd34d', '#a3e635', '#22d3ee', '#c084fc', '#34d399', '#60a5fa',
];
const Y_SERIES_COLORS = [
  '#4ade80', '#22c55e', '#14b8a6', '#34d399', '#6ee7b7', '#86efac', '#2dd4bf', '#5eead4',
  '#10b981', '#059669', '#0d9488', '#65a30d', '#84cc16', '#0ea5e9',
];

function programLegendSuffix(title: string): string {
  const t = (title || '').trim();
  const idx = t.lastIndexOf(' / ');
  const seg = idx >= 0 ? t.slice(idx + 3).trim() : t;
  const s = seg.length > 48 ? `${seg.slice(0, 46)}…` : seg;
  return s || 'Alan';
}

/** Aynı kurumda birden fazla SBL/MTAL satırı: yol sonu aynı kalır; ayırt için `program` (okul türü) önceliklidir. */
function chartTrackLegendSuffix(tr: ReviewPlacementTrack): string {
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

/** `review_placement_scores` (v3) → v2 `lgs` çizgileri (web-admin mergePayload ile uyumlu). */
export function buildLgsChartsFromScoresV3(bundle: ReviewPlacementBundleV3): {
  axisLabel: string;
  footer: string;
  series: { label: string; color: string; points: { year: number; score: number }[] }[];
} {
  const series: { label: string; color: string; points: { year: number; score: number }[] }[] = [];
  const n = Math.max(1, bundle.tracks.length);
  const labelCounts = new Map<string, number>();
  let anyMerkezi = false;
  let anyYerel = false;
  let anyTbs = false;
  bundle.tracks.forEach((tr, i) => {
    const suffix = chartTrackLegendSuffix(tr);
    const merkezi = (tr.years ?? [])
      .filter((r) => r && typeof r.year === 'number' && r.with_exam != null && Number.isFinite(Number(r.with_exam)))
      .map((r) => ({ year: r.year, score: Number(r.with_exam) }))
      .sort((a, b) => a.year - b.year);
    const yerel = (tr.years ?? [])
      .filter(
        (r) => r && typeof r.year === 'number' && r.without_exam != null && Number.isFinite(Number(r.without_exam)),
      )
      .map((r) => ({ year: r.year, score: Number(r.without_exam) }))
      .sort((a, b) => a.year - b.year);
    const mBase = n > 1 ? `LGS · ${suffix}` : 'Sınavlı — LGS tabanı (merkezî yerleştirme)';
    const yBase = n > 1 ? `Yerel · ${suffix}` : 'Sınavsız — yerel yerleştirme göstergesi';
    if (merkezi.length) {
      anyMerkezi = true;
      series.push({
        label: dedupSeriesLabel(mBase, labelCounts),
        color: M_SERIES_COLORS[i % M_SERIES_COLORS.length]!,
        points: merkezi,
      });
    }
    if (yerel.length) {
      anyYerel = true;
      series.push({
        label: dedupSeriesLabel(yBase, labelCounts),
        color: Y_SERIES_COLORS[i % Y_SERIES_COLORS.length]!,
        points: yerel,
      });
    }
    const tbsPts = (tr.years ?? [])
      .filter((r) => r && typeof r.year === 'number' && r.tbs != null && Number.isFinite(Number(r.tbs)))
      .map((r) => ({ year: r.year, score: Number(r.tbs) }))
      .sort((a, b) => a.year - b.year);
    if (tbsPts.length) {
      anyTbs = true;
      series.push({
        label: dedupSeriesLabel(n > 1 ? `TBS · ${suffix}` : 'Sınavlı — TBS / toplam puan sütunu', labelCounts),
        color: M_SERIES_COLORS[(i + 3) % M_SERIES_COLORS.length]!,
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

type PlacementLgsLineSeries = {
  label: string;
  color: string;
  points: { year: number; score: number }[];
};

/** `SchoolPlacementScoresCard` / mergePayload ile aynı: sınavsız (yerel/OBP çizgisi) lejantları. */
function placementLgsSeriesIsSinavsizStyle(label: string): boolean {
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

function partitionLgsLineSeries(series: PlacementLgsLineSeries[]): {
  sinavli: PlacementLgsLineSeries[];
  sinavsiz: PlacementLgsLineSeries[];
} {
  const sinavli: PlacementLgsLineSeries[] = [];
  const sinavsiz: PlacementLgsLineSeries[] = [];
  for (const s of series) {
    if (!s?.label) continue;
    if (placementLgsSeriesIsSinavsizStyle(s.label)) sinavsiz.push(s);
    else sinavli.push(s);
  }
  return { sinavli, sinavsiz };
}

function isPlacementLgsLineSeries(x: unknown): x is PlacementLgsLineSeries {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.label === 'string' && typeof o.color === 'string' && Array.isArray(o.points);
}

/**
 * Skordan gelen `built` yalnızca yerel veya yalnız merkezî seri ürettiğinde, mevcut grafikteki
 * diğer taraftaki çizgileri korur (OBP uygulayınca DB’deki LGS çizgilerinin silinmesini önler).
 */
function mergeBuiltLgsBlockWithExisting(
  built: ReturnType<typeof buildLgsChartsFromScoresV3>,
  existingLgs: Record<string, unknown> | undefined,
): ReturnType<typeof buildLgsChartsFromScoresV3> {
  const exRaw = existingLgs?.series;
  const exSeries: PlacementLgsLineSeries[] = Array.isArray(exRaw)
    ? (exRaw.filter(isPlacementLgsLineSeries) as PlacementLgsLineSeries[])
    : [];
  const bp = partitionLgsLineSeries(built.series);
  const ep = partitionLgsLineSeries(exSeries);
  const sinavli = bp.sinavli.length > 0 ? bp.sinavli : ep.sinavli;
  const sinavsiz = bp.sinavsiz.length > 0 ? bp.sinavsiz : ep.sinavsiz;
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
    return { axisLabel: built.axisLabel, footer: built.footer, series };
  }
  return { axisLabel: built.axisLabel, footer: built.footer, series };
}

/**
 * Puan paketinden LGS çizgilerini üretir; mevcut v2 grafikteki OBP bloğunu korur.
 * Puanlardan gelen seriler, el ile girilmiş LGS serilerinin yerini alır (web ile aynı).
 */
export function mergePlacementChartsWithScores(
  existingCharts: unknown,
  scores: unknown,
): Record<string, unknown> | null {
  const norm = normalizeReviewPlacementScoresJson(scores);
  const existing = sanitizeReviewPlacementCharts(existingCharts);
  if (!norm?.tracks?.length) {
    return existing;
  }
  const built = buildLgsChartsFromScoresV3(norm);
  const out: Record<string, unknown> = { v: 2 };
  if (built.series.length > 0) {
    const rawLgs = existing?.lgs;
    const existingLgs =
      rawLgs && typeof rawLgs === 'object' && !Array.isArray(rawLgs) ? (rawLgs as Record<string, unknown>) : undefined;
    out.lgs = existingLgs ? mergeBuiltLgsBlockWithExisting(built, existingLgs) : built;
  } else if (existing?.lgs) out.lgs = existing.lgs;
  if (existing?.obp) out.obp = existing.obp;
  return sanitizeReviewPlacementCharts(out);
}
