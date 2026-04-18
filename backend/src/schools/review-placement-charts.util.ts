const MAX_SERIES = 8;
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
