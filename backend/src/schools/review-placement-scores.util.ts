import * as crypto from 'crypto';

/** Tek yıla ait hücre (MEB: merkezî LGS, yerel gösterge; isteğe bağlı diğer kolonlar) */
export type ReviewPlacementScoreRow = {
  year: number;
  with_exam: number | null;
  without_exam: number | null;
  /** Sınavlı/MTAL: kontenjan */
  contingent?: number | null;
  /** Sınavlı: genellikle TBS/sonuç puan toplamı (metin kaynak büyük sayı) */
  tbs?: number | null;
  /** Son yerleşen / taban sınır (küçük sütun) */
  min_taban?: number | null;
};

export type ReviewPlacementTrack = {
  id: string;
  /** Program / alan adı: «Anadolu Lisesi», «Elektrik-Elektronik… Alanı» */
  title: string;
  program?: string;
  language?: string;
  years: ReviewPlacementScoreRow[];
};

/** DB’de saklanan: tek tip nesne; okuma ile legacy dizi hâlâ kabul edilir */
export type ReviewPlacementBundleV3 = { v: 3; tracks: ReviewPlacementTrack[] };

export type ReviewPlacementScoresStored = ReviewPlacementBundleV3;

const MAX_TRACKS = 20;
const MAX_YEARS = 6;
const MAX_STR = 200;

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '.').replace(/\s/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function clampStr(s: unknown, max: number): string {
  const t = typeof s === 'string' ? s.trim() : String(s ?? '').trim();
  return t.length > max ? t.slice(0, max) : t;
}

function stableIdFromText(label: string): string {
  const t = label.trim() || 'track';
  const h = crypto.createHash('sha1').update(t).digest('hex').slice(0, 10);
  return `t_${h}`;
}

function yearRowFromObject(o: Record<string, unknown>): ReviewPlacementScoreRow | null {
  const yRaw = o.year ?? o.yil ?? o.Yil;
  const y = typeof yRaw === 'number' ? yRaw : parseInt(String(yRaw ?? ''), 10);
  if (!Number.isFinite(y) || y < 1990 || y > 2100) return null;
  return {
    year: y,
    with_exam: parseNum(o.with_exam ?? o.merkezi_lgs ?? o.merkezi_taban ?? o.lgs_taban),
    without_exam: parseNum(o.without_exam ?? o.yerel_taban ?? o.yerel ?? o.yerel_obp),
    contingent: parseNum(o.contingent ?? o.kontenjan),
    tbs: parseNum(o.tbs),
    min_taban: parseNum(o.min_taban ?? o.taban),
  };
}

function mergeYearsDedupe(rows: ReviewPlacementScoreRow[]): ReviewPlacementScoreRow[] {
  const byYear = new Map<number, ReviewPlacementScoreRow>();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as unknown as Record<string, unknown>;
    const row = yearRowFromObject(o);
    if (!row) continue;
    byYear.set(row.year, row);
  }
  return [...byYear.values()]
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_YEARS);
}

function normalizeOneTrack(
  t: { id?: unknown; title?: unknown; track_title?: unknown; program?: unknown; language?: unknown; years?: unknown },
  i: number,
): ReviewPlacementTrack | null {
  if (!t || typeof t !== 'object') return null;
  const title =
    clampStr(t.title, MAX_STR) ||
    clampStr(t.track_title, MAX_STR) ||
    `Puan satırı ${i + 1}`;
  const id = clampStr(t.id, 64) || stableIdFromText(title);
  const yIn = Array.isArray(t.years) ? t.years : [];
  const years: ReviewPlacementScoreRow[] = [];
  for (const y of yIn) {
    if (!y || typeof y !== 'object') continue;
    const row = yearRowFromObject(y as Record<string, unknown>);
    if (row) years.push(row);
  }
  const yearsN = mergeYearsDedupe(years);
  if (yearsN.length === 0) return null;
  return {
    id: id || `t${i}`,
    title,
    program: clampStr(t.program, MAX_STR) || undefined,
    language: clampStr(t.language, 80) || undefined,
    years: yearsN,
  };
}

function legacyArrayToV3(raw: unknown): ReviewPlacementBundleV3 | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const years: ReviewPlacementScoreRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const row = yearRowFromObject(o);
    if (row) years.push(row);
  }
  const yN = mergeYearsDedupe(years);
  if (!yN.length) return null;
  return {
    v: 3,
    tracks: [{ id: '_default', title: '', years: yN }],
  };
}

/**
 * Dış/DB girişini tek formata çevirir. Legacy düz dizi {year, with_exam, without_exam} kabul edilir;
 * aksi halde { v:3, tracks: [...] }.
 */
export function normalizeReviewPlacementScoresJson(raw: unknown): ReviewPlacementScoresStored | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    return legacyArrayToV3(raw);
  }
  if (typeof raw !== 'object' || !raw) return null;
  const o = raw as Record<string, unknown>;
  const vNum = Number(o.v);
  const trIn = o.tracks;
  const tracksArr = Array.isArray(trIn) ? trIn : null;
  const v3Shape =
    tracksArr &&
    ((Number.isFinite(vNum) && vNum === 3) ||
      ((o.v === undefined || o.v === null) && tracksArr.length > 0));
  if (v3Shape && tracksArr) {
    const tracks: ReviewPlacementTrack[] = [];
    for (let i = 0; i < tracksArr.length && tracks.length < MAX_TRACKS; i++) {
      const t = normalizeOneTrack(tracksArr[i] as Record<string, unknown>, i);
      if (t) tracks.push(t);
    }
    if (!tracks.length) return null;
    return { v: 3, tracks };
  }
  return null;
}

export function isPlacementBundleV3(x: unknown): x is ReviewPlacementBundleV3 {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as { v?: unknown; tracks?: unknown };
  const vNum = Number(o.v);
  return Number.isFinite(vNum) && vNum === 3 && Array.isArray(o.tracks);
}

/** Normalize edilmiş pakette en az bir yıl satırı var mı (API’de kart göstermek için). */
export function placementBundleHasYearData(bundle: ReviewPlacementScoresStored | null | undefined): boolean {
  if (!bundle?.tracks?.length) return false;
  return bundle.tracks.some((t) => Array.isArray(t.years) && t.years.length > 0);
}

/** Kart / dual_track: herhangi bir yerleştirme sayısı (merkezî, yerel, TBS, kontenjan, taban) var mı. */
export function placementBundleHasAnyPlacementNumbers(
  bundle: ReviewPlacementScoresStored | null | undefined,
): boolean {
  if (!bundle?.tracks?.length) return false;
  for (const t of bundle.tracks) {
    for (const y of t.years ?? []) {
      if (y.with_exam != null && Number.isFinite(Number(y.with_exam))) return true;
      if (y.without_exam != null && Number.isFinite(Number(y.without_exam))) return true;
      if (y.tbs != null && Number.isFinite(Number(y.tbs))) return true;
      if (y.contingent != null && Number.isFinite(Number(y.contingent))) return true;
      if (y.min_taban != null && Number.isFinite(Number(y.min_taban))) return true;
    }
  }
  return false;
}

/** Tüm izlerde birleşik: hem merkezî (LGS) hem yerel dolu hücre var mı. */
export function placementBundleHasBothCentralAndLocal(
  bundle: ReviewPlacementScoresStored | null | undefined,
): boolean {
  if (!bundle?.tracks?.length) return false;
  let hasCentral = false;
  let hasLocal = false;
  for (const t of bundle.tracks) {
    for (const y of t.years ?? []) {
      if (y.with_exam != null && Number.isFinite(Number(y.with_exam))) hasCentral = true;
      if (y.without_exam != null && Number.isFinite(Number(y.without_exam))) hasLocal = true;
      if (hasCentral && hasLocal) return true;
    }
  }
  return false;
}

/** Okuma / istatistik: her zaman dizi; tek iz ise tek eleman. */
export function toPlacementTrackList(
  raw: { year: number; with_exam: number | null; without_exam: number | null }[] | ReviewPlacementScoresStored | null,
): ReviewPlacementTrack[] {
  if (!raw) return [];
  if (isPlacementBundleV3(raw)) return raw.tracks;
  if (Array.isArray(raw)) {
    const v3 = legacyArrayToV3(raw);
    return v3?.tracks ?? [];
  }
  return [];
}

export function getDefaultTrackYears(
  raw: { year: number; with_exam: number | null; without_exam: number | null }[] | ReviewPlacementScoresStored | null,
): ReviewPlacementScoreRow[] {
  const list = toPlacementTrackList(raw);
  if (!list.length) return [];
  return list[0]?.years ?? [];
}

export type PlacementFeedMergeInput = {
  year: number;
  with_exam?: number | null;
  without_exam?: number | null;
  contingent?: number | null;
  tbs?: number | null;
  min_taban?: number | null;
  track_id?: string | null;
  track_title?: string | null;
  program?: string | null;
  language?: string | null;
};

/** Besleme satırlarını v3 demetine yazar; yıl hücresi iz bazında birleşir. */
export function applyPlacementIncsToBundle(
  existing: unknown,
  incList: PlacementFeedMergeInput[],
  updateScope: 'both' | 'central_only' | 'local_only',
): ReviewPlacementBundleV3 | null {
  const bundle: ReviewPlacementBundleV3 = normalizeReviewPlacementScoresJson(existing) ?? { v: 3, tracks: [] };
  for (const inc of incList) {
    const y = inc.year;
    if (!Number.isFinite(y) || y < 1990 || y > 2100) continue;
    const tid = resolveTrackId(inc);
    let tr = findTrack(bundle.tracks, tid);
    if (!tr) {
      if (bundle.tracks.length >= MAX_TRACKS) continue;
      const initTitle =
        clampStr(inc.track_title, MAX_STR) ||
        clampStr(inc.program, MAX_STR) ||
        (clampStr(inc.language, 80) ? `Dil: ${clampStr(inc.language, 80)}` : '') ||
        'Yerleştirme satırı';
      tr = {
        id: tid,
        title: initTitle,
        years: [],
        program: clampStr(inc.program, MAX_STR) || undefined,
        language: clampStr(inc.language, 80) || undefined,
      };
      bundle.tracks.push(tr);
    }
    if (inc.track_title) tr.title = clampStr(inc.track_title, MAX_STR) || tr.title;
    if (Object.prototype.hasOwnProperty.call(inc, 'program')) {
      const p = clampStr(inc.program, MAX_STR);
      if (p) tr.program = p;
    }
    if (Object.prototype.hasOwnProperty.call(inc, 'language')) {
      const ln = clampStr(inc.language, 80);
      if (ln) tr.language = ln;
    }
    const ymap = new Map(tr.years.map((r) => [r.year, { ...r } as ReviewPlacementScoreRow]));
    const prev = ymap.get(y) ?? {
      year: y,
      with_exam: null,
      without_exam: null,
      contingent: null,
      tbs: null,
      min_taban: null,
    };
    const next: ReviewPlacementScoreRow = { ...prev, year: y };
    const weProvided = Object.prototype.hasOwnProperty.call(inc, 'with_exam');
    const woProvided = Object.prototype.hasOwnProperty.call(inc, 'without_exam');
    const weNum = weProvided ? parseNum(inc.with_exam) : null;
    const woNum = woProvided ? parseNum(inc.without_exam) : null;
    if (updateScope === 'both' || updateScope === 'central_only') {
      if (weProvided) {
        if (weNum != null) {
          next.with_exam = weNum;
        } else if (updateScope === 'central_only') {
          next.with_exam = null;
        } else if (!(woProvided && woNum != null)) {
          /** both: yalnız OBP dolu satırda merkezî null yazma (LGS korunur) */
          next.with_exam = null;
        }
      }
    }
    if (updateScope === 'both' || updateScope === 'local_only') {
      if (woProvided) {
        if (woNum != null) {
          next.without_exam = woNum;
        } else if (updateScope === 'local_only') {
          next.without_exam = null;
        } else if (!(weProvided && weNum != null)) {
          /** both: yalnız LGS dolu satırda yerel null yazma (OBP korunur) */
          next.without_exam = null;
        }
      }
    }
    const kInc = inc as { kontenjan?: number | null; contingent?: number | null };
    if (Object.prototype.hasOwnProperty.call(inc, 'contingent')) next.contingent = parseNum(kInc.contingent);
    else if (kInc.kontenjan != null) next.contingent = parseNum(kInc.kontenjan);
    if (Object.prototype.hasOwnProperty.call(inc, 'tbs')) next.tbs = parseNum(inc.tbs);
    if (Object.prototype.hasOwnProperty.call(inc, 'min_taban')) next.min_taban = parseNum(inc.min_taban);
    ymap.set(y, next);
    tr.years = mergeYearsDedupe([...ymap.values()]);
  }
  if (!bundle.tracks.some((t) => t.years.length)) return null;
  return { v: 3, tracks: bundle.tracks };
}

function resolveTrackId(inc: PlacementFeedMergeInput): string {
  const t = typeof inc.track_id === 'string' && inc.track_id.trim() ? inc.track_id.trim().slice(0, 64) : '';
  if (t) return t;
  const title = typeof inc.track_title === 'string' ? inc.track_title.trim() : '';
  const prog = typeof inc.program === 'string' ? inc.program.trim() : '';
  const lang = typeof inc.language === 'string' ? inc.language.trim() : '';
  if (!title && !prog && !lang) return '_default';
  /** Aynı okul yolu + farklı okul türü (ör. iki SBL): yalnız title ile tek izde birleşirdi; program/lang id’ye girer. */
  if (title && !prog && !lang) return stableIdFromText(title);
  const composite = [title, prog, lang].filter(Boolean).join('\u0001');
  return stableIdFromText(composite);
}

function findTrack(tracks: ReviewPlacementTrack[], id: string): ReviewPlacementTrack | null {
  return tracks.find((x) => x.id === id) ?? null;
}
