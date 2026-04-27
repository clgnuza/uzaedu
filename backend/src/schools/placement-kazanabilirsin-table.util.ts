import type { GptPlacementRawRow } from './placement-gpt-extract-core';
import type { PlacementUpdateScope } from './school-placement-scores-sync.service';
import { SchoolType, SchoolTypeGroup } from '../types/enums';
import { SCHOOL_TYPE_GROUP_MEMBERS } from './school-type-group.util';

export type SchoolMatchLine = {
  id: string;
  institution_code: string;
  name: string;
  city: string | null;
  district: string | null;
  /** Yerleştirme eşlemesinde ilkokul/ortaokul ile lise karışmasını önlemek için */
  school_type?: SchoolType | null;
};

const OBP_LISE_TYPES = new Set(SCHOOL_TYPE_GROUP_MEMBERS[SchoolTypeGroup.lise_kademesi]);

/** OBP tablosu (İl+İlçe+ad): tür filtresinden sonra kısmi ad eşlemesi. */
const OBP_TABLE_SCHOOL_MATCH_MIN = 52;

/** kazanabilirsin OBP tablosu satırı — DB’de ilkokul/ortaokul aynı ilçede olabiliyor; elenir. */
function kbObpExcludeDbSchoolName(name: string): boolean {
  const n = normTr(name);
  return (
    /\b(ilkokulu|ortaokulu|anaokulu|anaokul|ilkokul|ortaokul)\b/u.test(n) ||
    /\b(öğretmenevi|ogretmenevi|halk eğitim|halk egitim)\b/u.test(n)
  );
}

/** MTAL kaynak satırı: «… Alanı (Sınavlı)» — DB adında parantez yok; eşleşme ve ayrım için kaldırılır. */
function stripKbPlacementSinavParentheses(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\(\s*Sınavlı\s*\)/giu, ' ')
    .replace(/\(\s*Sınavsız\s*\)/giu, ' ')
    .replace(/\(\s*SINAVLI\s*\)/gu, ' ')
    .replace(/\(\s*SINAVSIZ\s*\)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normTr(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['’]/g, "'")
    .replace(/\u00EE|\u00CE/g, 'i')
    .replace(/\u00E2|\u00C2/g, 'a')
    .replace(/\u00FB|\u00DB/g, 'u')
    .toLocaleLowerCase('tr');
}

/** Yapışık OBP (boşluksuz): «58,1245,864,5» — yalnız boşluk yoksa; boşluklu «58,12 45,8» için `parseKbObpScoreCell`. */
export function splitKbObpGluedScores(raw: string): number[] {
  const t = raw.replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(/YENİ|Yeni|yeni/g, '');
  const out: number[] = [];
  let pos = 0;
  while (pos < t.length) {
    const slice = t.slice(pos);
    const m1 = slice.match(/^(\d{1,3},\d{2})/);
    if (m1) {
      out.push(Math.round(parseFloat(m1[1].replace(',', '.')) * 100) / 100);
      pos += m1[1].length;
      continue;
    }
    const m2 = slice.match(/^(\d,\d{1,2})/);
    if (m2) {
      out.push(Math.round(parseFloat(m2[1].replace(',', '.')) * 100) / 100);
      pos += m2[1].length;
      continue;
    }
    pos += 1;
  }
  return out;
}

/** Satır başına tek puan: «55,12\\n61,9\\n–» → [55.12, 61.9, null] */
export function parseKbObpMultilineScores(raw: string): (number | null)[] {
  const lines = raw.split(/\r?\n/).map((line) => line.replace(/\u00a0/g, ' ').trim());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.map((s) => {
    if (!s || s === '–' || s === '-' || s === '—') return null;
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  });
}

function isKbObpDashToken(tok: string): boolean {
  const x = tok.trim();
  return x === '–' || x === '-' || x === '—' || x === '\u2013' || x === '\u2014';
}

/** kazanabilirsin: «58,12 45,8 64,5» veya «34,26 – –» (boşlukla ayrılmış puanlar). */
function tryParseKbObpSpaceSeparatedScores(t: string, yearCount: number): (number | null)[] | null {
  const oneline = t.replace(/\r?\n/g, ' ').trim();
  const tokens = oneline.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const parsed: (number | null)[] = [];
  for (const tok of tokens) {
    if (isKbObpDashToken(tok)) {
      parsed.push(null);
      continue;
    }
    const n = parseFloat(tok.replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    parsed.push(Math.round(n * 100) / 100);
  }
  if (parsed.length < 2) return null;
  const out: (number | null)[] = [];
  for (let i = 0; i < yearCount; i++) out.push(parsed[i] ?? null);
  return out;
}

/** «–50,97–» veya «58,1245,864,5» veya çok satırlı OBP → yıl sayısı kadar (null | number)[] */
export function parseKbObpScoreCell(obpCell: string, yearCount: number): (number | null)[] {
  const t = obpCell.replace(/\u00a0/g, ' ').trim();
  if (!t || t === '–' || t === '-' || t === '—') return Array(yearCount).fill(null);
  if (/\r?\n/.test(t)) {
    const ml = parseKbObpMultilineScores(t);
    const meaningful = ml.filter((x) => x != null).length;
    if (meaningful >= 1 && ml.length >= 2) {
      const out: (number | null)[] = [];
      for (let i = 0; i < yearCount; i++) out.push(ml[i] ?? null);
      return out;
    }
  }
  const spaced = tryParseKbObpSpaceSeparatedScores(t, yearCount);
  if (spaced) return spaced;
  if (/\t/.test(t) && !/\r?\n/.test(t)) {
    const parts = t.split(/\t/).map((x) => x.trim()).filter((x) => x.length > 0);
    if (parts.length >= 2) {
      const ml = parts.map((s) => {
        if (s === '–' || s === '-' || s === '—') return null;
        const n = parseFloat(s.replace(',', '.'));
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
      });
      const meaningful = ml.filter((x) => x != null).length;
      if (meaningful >= 1) {
        const out: (number | null)[] = [];
        for (let i = 0; i < yearCount; i++) out.push(ml[i] ?? null);
        return out;
      }
    }
  }
  const dashSplit = t.split(/[–—]/).map((x) => x.trim());
  if (dashSplit.length > 1) {
    const out: (number | null)[] = [];
    for (let i = 0; i < yearCount; i++) {
      const seg = dashSplit[i] ?? '';
      if (!seg || seg === '-') {
        out.push(null);
        continue;
      }
      const nums = splitKbObpGluedScores(seg);
      out.push(nums.length ? nums[0]! : null);
    }
    return out.slice(0, yearCount);
  }
  const nums = splitKbObpGluedScores(t);
  const out: (number | null)[] = [];
  for (let i = 0; i < yearCount; i++) out.push(nums[i] ?? null);
  return out;
}

function roundKbLgsScore(chunk: string): number {
  return Math.round(parseFloat(chunk.replace(',', '.')) * 10000) / 10000;
}

/** Yapışık hücrede bir taban puanı: önce 3 haneli tam, yoksa 2 haneli (düşük tabanlar). */
function tryKbLgsScoreAtGlued(t: string, i: number): { len: number; val: number } | null {
  const rest = t.slice(i);
  for (const re of [/^(\d{3}),(\d{2,4})/, /^(\d{2}),(\d{2,4})/] as const) {
    const m = rest.match(re);
    if (!m) continue;
    const val = roundKbLgsScore(`${m[1]},${m[2]}`);
    if (val >= 25 && val <= 560) return { len: m[0].length, val };
  }
  return null;
}

/** LGS taban: çok satır; boşlukla ayrılmış; yapışık «366,66423970367…» (2–4 ondalık; 2–3 haneli tam kısım). */
export function splitKbLgsGluedScores(raw: string): number[] {
  const t0 = raw.replace(/\u00a0/g, ' ').trim();
  if (!t0) return [];

  if (/\r?\n/.test(t0)) {
    const lines = t0.split(/\r?\n/).map((ln) => ln.replace(/\s/g, '').trim()).filter(Boolean);
    const outNl: number[] = [];
    for (const ln of lines) {
      if (/^yen[iİ]$/i.test(ln) || ln === '–' || ln === '-') continue;
      const m = ln.match(/^(\d{2,3},\d{2,4})$/);
      if (!m) continue;
      const val = roundKbLgsScore(m[1]!);
      if (val < 25 || val > 560) continue;
      outNl.push(val);
    }
    if (outNl.length >= 2) return outNl;
  }

  const single = t0.replace(/\r?\n/g, ' ').trim();
  const tokens = single.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const outTok: number[] = [];
    for (const tok of tokens) {
      const s = tok.replace(/\s/g, '');
      if (s === '–' || s === '-' || s === '—' || /^yen[iİ]$/iu.test(s)) continue;
      const m = s.match(/^(\d{2,3},\d{2,4})$/);
      if (!m) {
        outTok.length = 0;
        break;
      }
      const val = roundKbLgsScore(m[1]!);
      if (val < 25 || val > 560) {
        outTok.length = 0;
        break;
      }
      outTok.push(val);
    }
    if (outTok.length >= 2) return outTok;
  }

  const t = t0.replace(/\s/g, '');
  const out: number[] = [];
  let i = 0;
  while (i < t.length) {
    const hit = tryKbLgsScoreAtGlued(t, i);
    if (!hit) {
      i += 1;
      continue;
    }
    out.push(hit.val);
    i += hit.len;
  }
  return out;
}

/** «24 24 24 30», «30 YENİ YENİ YENİ» — taban puanlarıyla soldan sağa aynı sırada kontenjan. */
function parseKbKontTokensParallel(cell: string): (number | null)[] {
  const t0 = cell.replace(/\u00a0/g, ' ').trim();
  if (!t0) return [];
  const oneline = t0.replace(/\r?\n/g, ' ').trim();
  const spaced = oneline.split(/\s+/).filter(Boolean);
  if (spaced.length >= 2) {
    const out: (number | null)[] = [];
    for (const tok of spaced) {
      const s = tok.replace(/\s/g, '');
      if (/^yen[iİ]$/iu.test(s) || s === '–' || s === '-' || s === '—') {
        out.push(null);
        continue;
      }
      const d = s.replace(/[^\d]/g, '');
      const n = d ? parseInt(d, 10) : NaN;
      out.push(Number.isFinite(n) && n >= 0 && n < 100_000 ? n : null);
    }
    return out;
  }
  const s = oneline.replace(/\s/g, '');
  const out2: (number | null)[] = [];
  const re = /(\d{1,5})|(YENİ|Yeni|yeni|–|—|-|…)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[1]) {
      const n = parseInt(m[1]!, 10);
      out2.push(Number.isFinite(n) && n < 100_000 ? n : null);
    } else out2.push(null);
  }
  return out2;
}

function alignKbKontToScoreCount(kont: (number | null)[], scoreCount: number): (number | null)[] {
  if (scoreCount < 1) return [];
  if (!kont.length) return Array(scoreCount).fill(null);
  if (kont.length === scoreCount) return kont.slice();
  if (kont.length > scoreCount) return kont.slice(0, scoreCount);
  const pad = Array(scoreCount - kont.length).fill(null);
  return [...pad, ...kont];
}

/** Çok satırlı veya tek satırlı kont. hücresi → skor sayısı kadar. */
function parseKbKontForBlock(kontCell: string, slotCount: number): (number | null)[] {
  const t0 = kontCell.replace(/\u00a0/g, ' ').trim();
  if (slotCount < 1) return [];
  if (!t0) return Array(slotCount).fill(null);
  if (/\r?\n/.test(t0)) {
    const lines = t0.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean);
    const out: (number | null)[] = [];
    for (const ln of lines) {
      const s = ln.replace(/\s/g, '');
      if (/^yen[iİ]$/i.test(s) || s === '–' || s === '-' || s === '—') {
        out.push(null);
        continue;
      }
      const d = s.replace(/[^\d]/g, '');
      const n = d ? parseInt(d, 10) : NaN;
      out.push(Number.isFinite(n) && n < 100_000 ? n : null);
    }
    return alignKbKontToScoreCount(out, slotCount);
  }
  return alignKbKontToScoreCount(parseKbKontTokensParallel(t0), slotCount);
}

export function extractYearsFromKbYearCell(cell: string): number[] {
  const ys = cell.match(/\d{4}/g);
  if (!ys?.length) return [];
  return ys.map((x) => parseInt(x, 10)).filter((y) => y >= 1990 && y <= 2100);
}

function stripMdCellDecor(s: string): string {
  return s.replace(/\*{1,3}/g, '').replace(/\s+/g, ' ').trim();
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, arr) => !(c === '' && (i === 0 || i === arr.length - 1)));
}

function isMarkdownTableSeparator(line: string): boolean {
  const t = line.trim();
  return /^\|[\s\-:|]+\|$/u.test(t) || /^[\|\s\-:]+$/u.test(t.replace(/\|/g, ''));
}

/** «Yıl» hücresi satır satır (site: yeni→eski). */
function tryParseKbLgsYearLines(cell: string): number[] | null {
  const t = cell.replace(/\u00a0/g, ' ').trim();
  if (!/\r?\n/.test(t)) return null;
  const lines = t.split(/\r?\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const ys: number[] = [];
  for (const ln of lines) {
    const m = ln.match(/\b(20\d{2})\b/);
    if (!m) return null;
    const y = parseInt(m[1]!, 10);
    if (!isPlausiblePlacementYear(y)) return null;
    ys.push(y);
  }
  return ys.length >= 2 ? ys : null;
}

/** «Taban» hücresi satır satır aynı sırada puanlar. */
function tryParseKbLgsTabanLines(cell: string): number[] | null {
  const t0 = cell.replace(/\u00a0/g, ' ').trim();
  if (!/\r?\n/.test(t0)) return null;
  const lines = t0.split(/\r?\n/).map((ln) => ln.replace(/\s/g, '').trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const out: number[] = [];
  for (const ln of lines) {
    if (/^yen[iİ]$/i.test(ln) || ln === '–' || ln === '-') continue;
    const m = ln.match(/^(\d{2,3},\d{2,4})$/);
    if (!m) return null;
    const val = roundKbLgsScore(m[1]!);
    if (val < 25 || val > 560) return null;
    out.push(val);
  }
  return out.length >= 2 ? out : null;
}

function isPlausiblePlacementYear(y: number): boolean {
  return y >= 2015 && y <= 2035;
}

/** `|…|` satırından yıl çıkar; 6+ hane kurum kodu vb. `\d{4}` tuzaklarını azaltır. */
function extractPlacementYearsFromMarkdownLine(line: string): number[] {
  const t = line.replace(/\|/g, ' ').replace(/\b\d{6,}\b/g, ' ');
  return extractYearsFromKbYearCell(t);
}

/**
 * Birleşik yıl kümesinden en uzun ardışık zincir; aynı uzunlukta birden fazlaysa **en geç biten**
 * (genelde güncel LGS blokları: 2022–2025).
 */
function longestConsecutiveYearRun(sortedUnique: readonly number[]): number[] {
  const ys = sortedUnique.filter(isPlausiblePlacementYear);
  if (!ys.length) return [];
  const runs: number[][] = [];
  let cur: number[] = [ys[0]!];
  for (let i = 1; i < ys.length; i++) {
    const y = ys[i]!;
    if (y === cur[cur.length - 1]! + 1) cur.push(y);
    else {
      runs.push(cur);
      cur = [y];
    }
  }
  runs.push(cur);
  let best = runs[0]!;
  for (const r of runs) {
    if (r.length > best.length) best = r;
    else if (r.length === best.length && r[r.length - 1]! > best[best.length - 1]!) best = r;
  }
  return best;
}

/**
 * kazanabilirsin: «Yıl» ile «Taban/OBP» arasındaki tüm hücreler (yıllar çoklu `<td>`); skor sütunu hariç.
 */
function extractYearsFromYilBandExcludingNumericColumn(
  cells: readonly string[],
  yilIdx: number,
  numericColIdx: number,
): number[] {
  if (yilIdx < 0 || numericColIdx < 0 || yilIdx === numericColIdx) return [];
  const lo = Math.min(yilIdx, numericColIdx);
  const hi = Math.max(yilIdx, numericColIdx);
  const chunks: string[] = [];
  for (let i = lo; i <= hi; i++) {
    if (i === numericColIdx) continue;
    chunks.push(cells[i] ?? '');
  }
  return extractYearsFromKbYearCell(chunks.join(' '));
}

/**
 * «Yıl» sütununda şablon: tüm satırlardaki yıl hücrelerini birleştirip en uzun ardışık yıl dizisini alır;
 * tek satırda en uzun hücre (bestSub/bestAny) yedek kalır.
 * `numericColIdx`: LGS’te taban sütunu, OBP’de OBP sütunu — aralıkta hariç tutulur (yıllar komşu `<td>`’lerde olabilir).
 */
function bestYearsFromMarkdownYilColumn(
  lines: readonly string[],
  headerIdx: number,
  yilIdx: number,
  okulIdx: number,
  numericColIdx: number,
): number[] {
  const hdrCells = splitMarkdownTableRow(lines[headerIdx]!);
  const hdrOk = hdrCells[okulIdx] ?? '';
  const hdrY = extractYearsFromKbYearCell(hdrCells[yilIdx] ?? '');
  const hdrBand = extractYearsFromYilBandExcludingNumericColumn(hdrCells, yilIdx, numericColIdx);
  const hdrLineYears = extractPlacementYearsFromMarkdownLine(lines[headerIdx]!);
  let bestSub: number[] = [];
  let bestAny: number[] = [];
  const union: number[] = [...hdrY, ...hdrBand, ...hdrLineYears];
  if (hdrY.length > bestAny.length) bestAny = hdrY;
  if (!hdrOk.includes('/') && hdrY.length > bestSub.length) bestSub = hdrY;
  for (let j = headerIdx + 1; j < lines.length; j++) {
    const ln = lines[j]!.trim();
    if (!ln.includes('|')) {
      if (ln === '') continue;
      break;
    }
    if (isMarkdownTableSeparator(ln)) continue;
    const cells = splitMarkdownTableRow(ln);
    const raw = extractYearsFromKbYearCell(cells[yilIdx] ?? '');
    for (const y of raw) union.push(y);
    for (const y of extractYearsFromYilBandExcludingNumericColumn(cells, yilIdx, numericColIdx)) union.push(y);
    const okCell = cells[okulIdx] ?? '';
    /** Okul yolu satırında kurum kodu vb. 4 haneli gürültüyü almamak için yalnız «Yıl» hücresi; alt başlıkta tüm satır. */
    if (!okCell.includes('/')) {
      for (const y of extractPlacementYearsFromMarkdownLine(ln)) union.push(y);
    }
    if (raw.length > bestAny.length) bestAny = raw;
    if (!okCell.includes('/') && raw.length > bestSub.length) bestSub = raw;
  }
  const singleCell = bestSub.length >= 2 ? bestSub : bestAny;
  const singleSorted = [...new Set(singleCell)].sort((a, b) => a - b);
  const span = longestConsecutiveYearRun([...new Set(union)].sort((a, b) => a - b));
  if (span.length >= singleSorted.length && span.length >= 2) return span;
  if (singleSorted.length >= 2) return singleSorted;
  return span.length >= 2 ? span : singleSorted;
}

/**
 * Tablo şablonu + veri satırı yıllarını skor sayısına göre hizalar.
 * Skor sayısı < yıl sayısı: sütunlar soldan eski → sağda güncel; çoğunlukla **son N yıl** ile skorlar örtüşür.
 */
function alignKbLgsYearsToScores(tableTemplate: number[], yearsFromCell: number[], scoreCount: number): number[] {
  if (scoreCount < 1) return [];
  const tpl = tableTemplate;
  const cell = yearsFromCell;

  if (tpl.length >= scoreCount) {
    if (tpl.length === scoreCount) return tpl.slice();
    const tailCell = cell.length > scoreCount ? cell.slice(-scoreCount) : cell;
    if (tailCell.length === scoreCount) {
      const off = tpl.length - tailCell.length;
      if (off >= 0 && tailCell.every((y, j) => y === tpl[off + j]!)) {
        return tpl.slice(-scoreCount);
      }
    }
    const headCell = cell.length > scoreCount ? cell.slice(0, scoreCount) : cell;
    if (headCell.length === scoreCount && headCell.every((y, j) => y === tpl[j]!)) {
      return tpl.slice(0, scoreCount);
    }
    if (cell.length > 0 && cell.length <= tpl.length) {
      const off = tpl.length - cell.length;
      if (off >= 0 && cell.every((y, j) => y === tpl[off + j]!)) {
        return tpl.slice(-scoreCount);
      }
    }
    return tpl.slice(-scoreCount);
  }
  if (cell.length >= scoreCount) {
    return cell.length > scoreCount ? cell.slice(-scoreCount) : cell.slice(0, scoreCount);
  }
  if (tpl.length > 0) return tpl.slice(-Math.min(scoreCount, tpl.length));
  return cell.slice(0, Math.min(scoreCount, cell.length));
}

/** DB’de «Konya (Merkez)» gibi değerler `konya` ile eşlensin. */
function normCityKey(city: string | null | undefined): string {
  return normTr((city ?? '').replace(/\s*\([^)]*\)/g, ' '));
}

/** Meslek / İHL: kaynak «Okul / Alan» — DB adı çoğunlukla ilk parça. */
function kbSchoolNameMatchVariants(schoolName: string): string[] {
  const t = schoolName.trim();
  const full = normTr(t);
  const head = (t.split(/\s*\/\s*/)[0] ?? t).trim();
  const h = normTr(head);
  if (!h || h === full) return [full];
  return [full, h];
}

function scoreKbNameToName(nm: string, variant: string): number {
  if (nm === variant) return 100;
  if (nm.includes(variant) || variant.includes(nm)) {
    return Math.min(95, 70 + Math.min(nm.length, variant.length) / 4);
  }
  const ta = new Set(variant.split(' ').filter((x) => x.length > 2));
  const tb = new Set(nm.split(' ').filter((x) => x.length > 2));
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter += 1;
  const u = ta.size + tb.size - inter;
  return u > 0 ? (inter / u) * 60 : 0;
}

function kbRowSchoolMatchScore(nm: string, schoolName: string): number {
  let best = 0;
  for (const v of kbSchoolNameMatchVariants(schoolName)) {
    const sc = scoreKbNameToName(nm, v);
    if (sc > best) best = sc;
  }
  return best;
}

/** Çoklu MTAL alanı: «… / elektrik-elektronik …» kuyruğu tek okula indirger. */
function kbSchoolPathTailToken(schoolName: string): string | null {
  const segs = schoolName.split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
  if (segs.length < 2) return null;
  const tail = normTr(segs[segs.length - 1]!);
  if (tail.length < 5 || tail.length > 96) return null;
  return tail;
}

function pickSchoolForObpRow(
  city: string,
  district: string,
  schoolName: string,
  schools: SchoolMatchLine[],
  minAcceptScore = OBP_TABLE_SCHOOL_MATCH_MIN,
): { line: SchoolMatchLine | null; note?: string } {
  const schoolNameClean = stripKbPlacementSinavParentheses(schoolName);
  const cN = normTr(city);
  const dN = normTr(district);
  const sn = normTr(schoolNameClean);
  let pool = schools.filter((s) => normCityKey(s.city) === cN);
  if (!pool.length) {
    return { line: null, note: `İl eşleşmedi: «${city}» · ${sn.slice(0, 48)}` };
  }
  const noPrimary = pool.filter((s) => !kbObpExcludeDbSchoolName(s.name));
  if (noPrimary.length) pool = noPrimary;
  const typedLise = pool.filter((s) => s.school_type != null && OBP_LISE_TYPES.has(s.school_type));
  if (typedLise.length) pool = typedLise;
  const dPool = pool.filter((s) => {
    const sd = normTr(s.district ?? '');
    return sd === dN || sd.includes(dN) || dN.includes(sd);
  });
  const search = dPool.length ? dPool : pool;
  let best: SchoolMatchLine | null = null;
  let bestScore = 0;
  for (const s of search) {
    const nm = normTr(s.name);
    const sc = kbRowSchoolMatchScore(nm, schoolNameClean);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  if (!best || bestScore < minAcceptScore) {
    return { line: null, note: `Okul eşleşmedi (${bestScore.toFixed(0)}): ${dN} · ${sn.slice(0, 56)}` };
  }
  const scoreAgainst = (s: SchoolMatchLine) => kbRowSchoolMatchScore(normTr(s.name), schoolNameClean);
  let amb = search.filter((s) => {
    const sc = scoreAgainst(s);
    return sc >= bestScore - 1 && sc >= minAcceptScore;
  });
  if (!amb.length) {
    amb = search.filter((s) => {
      const sc = scoreAgainst(s);
      return sc >= bestScore - 3 && sc >= minAcceptScore;
    });
  }
  if (amb.length > 1) {
    const tail = kbSchoolPathTailToken(schoolNameClean);
    if (tail) {
      const narrowed = amb.filter((s) => normTr(s.name).includes(tail));
      if (narrowed.length === 1) {
        return { line: narrowed[0]! };
      }
      if (narrowed.length >= 1) amb = narrowed;
    }
  }
  if (amb.length > 1) {
    const codes = new Set(amb.map((s) => s.institution_code));
    if (codes.size === 1) {
      return { line: amb[0]! };
    }
  }
  if (amb.length > 1 && schoolNameClean.includes('/')) {
    const headSchool = (schoolNameClean.split(/\s*\/\s*/)[0] ?? '').trim();
    if (headSchool.length >= 8) {
      let topH = -1;
      const byHead: SchoolMatchLine[] = [];
      for (const s of amb) {
        const h = kbRowSchoolMatchScore(normTr(s.name), headSchool);
        if (h > topH + 1e-6) {
          topH = h;
          byHead.length = 0;
          byHead.push(s);
        } else if (Math.abs(h - topH) <= 1e-6) {
          byHead.push(s);
        }
      }
      if (byHead.length === 1) return { line: byHead[0]! };
    }
  }
  if (amb.length > 1) {
    return {
      line: null,
      note: `Birden fazla aday (${amb.length}): ${dN} · ${sn.slice(0, 40)}…`,
    };
  }
  return { line: best };
}

/** Excel/PDF yapıştırma: tab + yıl/OBP hücresi alt satırlarda (2023➜\\t55,12) */
function tryParseObpTsvMultilineBlocks(
  text: string,
  schools: SchoolMatchLine[],
): { rows: GptPlacementRawRow[]; warnings: string[] } | null {
  const rawLines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let cur: string[] = [];
  const isHeaderLine = (line: string): boolean => {
    const p = line.split('\t').map((x) => x.trim().replace(/\*+/g, ''));
    if (p.length < 4) return false;
    const a = normTr(p[0] ?? '');
    return a === 'il' && /\bilçe\b/iu.test(line) && /\bokul\b/iu.test(line);
  };
  const isAnchorLine = (line: string): boolean => {
    if (!line.includes('\t')) return false;
    if (isHeaderLine(line)) return false;
    const p = line.split('\t');
    return p.length >= 5 && !!(p[0] ?? '').trim() && !!(p[1] ?? '').trim() && !!(p[2] ?? '').trim().length;
  };
  for (const line of rawLines) {
    const L = line.replace(/\u00a0/g, ' ');
    if (!L.trim()) continue;
    if (isAnchorLine(L)) {
      if (cur.length) blocks.push(cur.join('\n'));
      cur = [L];
    } else if (cur.length) cur.push(L);
  }
  if (cur.length) blocks.push(cur.join('\n'));
  if (blocks.length < 1) return null;

  const rows: GptPlacementRawRow[] = [];
  const warnings: string[] = [];
  for (const block of blocks) {
    const linesB = block.split(/\r?\n/).filter((x) => x.trim());
    if (!linesB.length) continue;
    const parts0 = linesB[0]!.split('\t').map((x) => x.trim());
    if (parts0.length < 5) continue;
    const city = parts0[0] ?? '';
    const district = parts0[1] ?? '';
    const okul = parts0[2] ?? '';
    const tail = [...parts0.slice(4), ...linesB.slice(1)].join('\n');
    const ft = tail.indexOf('\t');
    if (ft < 0) {
      warnings.push(`OBP sütunu ayırıcı yok (tab): ${okul.slice(0, 40)}…`);
      continue;
    }
    const yearCell = tail.slice(0, ft).trim();
    const obpCell = tail.slice(ft + 1).trim();
    const yearTemplate = extractYearsFromKbYearCell(yearCell);
    if (yearTemplate.length < 2) continue;
    if (!okul || okul.length < 4) continue;
    const scores = parseKbObpScoreCell(obpCell, yearTemplate.length);
    const { line: sch, note } = pickSchoolForObpRow(city, district, okul, schools);
    if (!sch) {
      if (note) warnings.push(note);
      continue;
    }
    const program = extractKbObpProgramFromSchoolCell(okul);
    for (let yi = 0; yi < yearTemplate.length; yi++) {
      const y = yearTemplate[yi]!;
      const sc = scores[yi];
      if (sc == null) continue;
      rows.push({
        institution_code: sch.institution_code,
        year: y,
        track_title: okul.trim() || null,
        track_id: null,
        program,
        language: null,
        with_exam: null,
        without_exam: sc,
        contingent: null,
        tbs: null,
        min_taban: null,
      });
    }
  }
  if (rows.length < 3) return null;
  return { rows, warnings };
}

/** Merkezî LGS: meslek/uzun yol; MTAL alan ekiyle token eşlemesi bazen 55 altına inebiliyordu. */
const LGS_PATH_MATCH_MIN_SCORE = 50;

function pickSchoolForLgsPath(okulPath: string, schools: SchoolMatchLine[]): { line: SchoolMatchLine | null; note?: string } {
  const parts = okulPath.split('/').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return { line: null, note: `Okul yolu kısa: ${okulPath.slice(0, 60)}` };
  const city = parts[0]!;
  const district = parts[1]!;
  const schoolName = parts.slice(2).join(' / ');
  return pickSchoolForObpRow(city, district, schoolName, schools, LGS_PATH_MATCH_MIN_SCORE);
}

/** «Okul / … Programı» — grafik ve birleştirme için son parça program. */
function extractKbObpProgramFromSchoolCell(okul: string): string | null {
  const parts = okul.split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1]!;
  return last.length >= 4 ? last : null;
}

function tryParseObpMarkdownTable(
  text: string,
  schools: SchoolMatchLine[],
): { rows: GptPlacementRawRow[]; warnings: string[] } | null {
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes('|')) continue;
    const low = line.toLocaleLowerCase('tr');
    if (!/obp/i.test(low)) continue;
    if (!/okul/i.test(low)) continue;
    const probe = splitMarkdownTableRow(line);
    const hasIl = probe.some((c) => normTr(stripMdCellDecor(c)) === 'il');
    const hasIlce = probe.some((c) => normTr(stripMdCellDecor(c)).startsWith('ilçe'));
    if (!hasIl || !hasIlce) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx < 0) return null;

  const headerCells = splitMarkdownTableRow(lines[headerIdx]!);
  const ilIdx = headerCells.findIndex((c) => normTr(stripMdCellDecor(c)) === 'il');
  const ilceIdx = headerCells.findIndex((c) => normTr(stripMdCellDecor(c)).startsWith('ilçe'));
  const okulIdx = headerCells.findIndex((c) => /\bokul\b/iu.test(stripMdCellDecor(c)));
  const yilIdx = headerCells.findIndex(
    (c) => /\byıl\b/iu.test(stripMdCellDecor(c)) || normTr(stripMdCellDecor(c)) === 'yıl',
  );
  const obpIdx = headerCells.findIndex(
    (c) => /\bobp\b/iu.test(stripMdCellDecor(c)) || normTr(stripMdCellDecor(c)) === 'obp',
  );
  if (ilIdx < 0 || ilceIdx < 0 || okulIdx < 0 || obpIdx < 0 || yilIdx < 0) return null;

  const rows: GptPlacementRawRow[] = [];
  const warnings: string[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.includes('|')) {
      if (line === '') continue;
      break;
    }
    if (isMarkdownTableSeparator(line)) continue;
    const cells = splitMarkdownTableRow(line);
    if (cells.length < Math.max(ilIdx, ilceIdx, okulIdx, obpIdx) + 1) continue;
    const city = cells[ilIdx] ?? '';
    const district = cells[ilceIdx] ?? '';
    const okul = cells[okulIdx] ?? '';
    const obpCell = cells[obpIdx] ?? '';
    const yearCell = cells[yilIdx] ?? '';
    const ys = extractYearsFromKbYearCell(yearCell);
    if (!okul || okul.length < 4 || ys.length < 2) continue;
    const scores = parseKbObpScoreCell(obpCell, ys.length);
    const { line: sch, note } = pickSchoolForObpRow(city, district, okul, schools);
    if (!sch) {
      if (note) warnings.push(note);
      continue;
    }
    const program = extractKbObpProgramFromSchoolCell(okul);
    for (let yi = 0; yi < ys.length; yi++) {
      const y = ys[yi]!;
      const sc = scores[yi];
      if (sc == null) continue;
      rows.push({
        institution_code: sch.institution_code,
        year: y,
        track_title: okul.trim() || null,
        track_id: null,
        program,
        language: null,
        with_exam: null,
        without_exam: sc,
        contingent: null,
        tbs: null,
        min_taban: null,
      });
    }
  }
  if (rows.length < 3) return null;
  return { rows, warnings };
}

/** «İl / İlçe / Okul» ile başlayan tab satırı (kazanabilirsin TSV yapıştırma) */
function isLikelyLgsTsvSchoolAnchorLine(line: string): boolean {
  const s = line.trim();
  if (!s.includes('\t')) return false;
  const head = (s.split('\t')[0] ?? '').trim();
  return head.includes('/') && (head.match(/\//g) ?? []).length >= 2;
}

/** Çok satırlı hücreler: anchor satıra kadar olan satırlar bir okul bloğu */
function splitLgsTsvIntoBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (cur.length) cur.push(line);
      continue;
    }
    if (isLikelyLgsTsvSchoolAnchorLine(line)) {
      if (cur.length) blocks.push(cur);
      cur = [line];
    } else if (cur.length) cur.push(line);
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

/**
 * kazanabilirsin.com → Excel’den «tab» ile kopyalanmış LGS tablosu (markdown | yok).
 * Yıl ve taban hücresi çok satırlı; puanlar `splitKbLgsGluedScores` ile okunur.
 */
function tryParseLgsTsvKazanabilirsinBlocks(
  text: string,
  schools: SchoolMatchLine[],
): { rows: GptPlacementRawRow[]; warnings: string[] } | null {
  const body = text.trim();
  if (body.length < 80 || !body.includes('\t')) return null;
  const headProbe = body.split(/\r?\n/).slice(0, 30).join('\n');
  /** OBP il tablosu (İl sütunu «İl» — \bil\b JS’te eşleşmez); LGS TSV ayrıştırıcıya sokma */
  if (/obp/i.test(headProbe) && /ilçe/i.test(headProbe) && /okul/i.test(headProbe)) return null;

  const blocks = splitLgsTsvIntoBlocks(body.split(/\r?\n/));
  if (!blocks.length) return null;

  const rows: GptPlacementRawRow[] = [];
  const warnings: string[] = [];
  for (const bl of blocks) {
    const path = (bl[0]?.split('\t')[0] ?? '').trim();
    if (!path.includes('/')) continue;
    const segs = path.split('/').map((x) => x.trim()).filter(Boolean);
    if (segs.length < 3) continue;

    const blockText = bl.join('\n');
    let years = [...new Set(extractYearsFromKbYearCell(blockText))].sort((a, b) => a - b);
    const scores = splitKbLgsGluedScores(blockText);
    if (scores.length < 1 || years.length < 2) continue;
    if (years.length > scores.length) years = years.slice(0, scores.length);
    else if (years.length < scores.length) continue;
    const n = years.length;
    const { line: sch, note } = pickSchoolForLgsPath(path, schools);
    if (!sch) {
      if (note) warnings.push(note);
      continue;
    }
    for (let yi = 0; yi < n; yi++) {
      rows.push({
        institution_code: sch.institution_code,
        year: years[yi]!,
        track_title: path.trim() || null,
        track_id: null,
        program: null,
        language: null,
        with_exam: scores[yi]!,
        without_exam: null,
        contingent: null,
        tbs: null,
        min_taban: null,
      });
    }
  }
  if (rows.length < 3) return null;
  return { rows, warnings };
}

function tryParseLgsMarkdownTable(
  text: string,
  schools: SchoolMatchLine[],
): { rows: GptPlacementRawRow[]; warnings: string[] } | null {
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i]!.toLocaleLowerCase('tr');
    if (!lines[i]!.includes('|')) continue;
    if (!/\btaban\b/u.test(low)) continue;
    if (!/\bokul\b/u.test(low)) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx < 0) return null;

  const headerCells = splitMarkdownTableRow(lines[headerIdx]!);
  const normH = (c: string) => stripMdCellDecor(c);
  const okulIdx = headerCells.findIndex((c) => {
    const n = normH(c);
    const nTr = normTr(n);
    return (
      /\bokul\b/iu.test(n) &&
      (/\badı\b/iu.test(n) || /\badi\b/iu.test(n) || nTr.includes('okul adı') || nTr.includes('okul adi'))
    );
  });
  const yilIdx = headerCells.findIndex((c) => /\byıl\b/iu.test(normH(c)));
  const kontIdx = headerCells.findIndex((c) => /^kont/u.test(normH(c)) || /\bkont\./iu.test(normH(c)));
  /** kazanabilirsin: «Taban Puanı» — \bpuan\b «Puanı» ile eşleşmez */
  const tabanIdx = headerCells.findIndex((c) => {
    const n = normH(c);
    return /\btaban\b/iu.test(n) && /puan/i.test(n);
  });
  /** kazanabilirsin: aynı okul adı, farklı «Okul Türü» satırları (ör. iki SBL) — birleştirme anahtarı için. */
  const okulTuruIdx = headerCells.findIndex((c) => {
    const nTr = normTr(normH(c));
    if (nTr.includes('okul adı') || nTr.includes('okul adi')) return false;
    if (!nTr.includes('okul')) return false;
    return nTr.includes('türü') || nTr.includes('okul turu');
  });
  if (okulIdx < 0 || yilIdx < 0 || tabanIdx < 0) return null;

  const tableYearTemplate = bestYearsFromMarkdownYilColumn(lines, headerIdx, yilIdx, okulIdx, tabanIdx);

  const rows: GptPlacementRawRow[] = [];
  const warnings: string[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.includes('|')) {
      if (line === '') continue;
      break;
    }
    if (isMarkdownTableSeparator(line)) continue;
    const cells = splitMarkdownTableRow(line);
    if (cells.length <= Math.max(okulIdx, yilIdx, tabanIdx)) continue;
    const path = cells[okulIdx] ?? '';
    if (!path.includes('/')) continue;
    const yearsCell = cells[yilIdx] ?? '';
    const tabanCell = cells[tabanIdx] ?? '';
    const kontCell = kontIdx >= 0 ? (cells[kontIdx] ?? '') : '';
    const okulTuruRaw = okulTuruIdx >= 0 ? stripMdCellDecor(cells[okulTuruIdx] ?? '') : '';
    const programVal = okulTuruRaw.length >= 3 ? okulTuruRaw : null;
    const yLines = tryParseKbLgsYearLines(yearsCell);
    const tLines = tryParseKbLgsTabanLines(tabanCell);
    const tabanScoresZip = tLines ?? splitKbLgsGluedScores(tabanCell);
    if (yLines && tabanScoresZip.length === yLines.length && yLines.length >= 2) {
      const { line: sch, note } = pickSchoolForLgsPath(path, schools);
      if (!sch) {
        if (note) warnings.push(note);
        continue;
      }
      const kontAligned = parseKbKontForBlock(kontCell, yLines.length);
      for (let yi = 0; yi < yLines.length; yi++) {
        rows.push({
          institution_code: sch.institution_code,
          year: yLines[yi]!,
          track_title: path.trim() || null,
          track_id: null,
          program: programVal,
          language: null,
          with_exam: tabanScoresZip[yi]!,
          without_exam: null,
          contingent: kontAligned[yi] ?? null,
          tbs: null,
          min_taban: null,
        });
      }
      continue;
    }
    const yearsFromCell = extractYearsFromKbYearCell(yearsCell);
    const scores = splitKbLgsGluedScores(tabanCell);
    if (!scores.length) continue;
    const yearsAligned = alignKbLgsYearsToScores(tableYearTemplate, yearsFromCell, scores.length);
    const n = Math.min(yearsAligned.length, scores.length);
    if (n < 1) continue;
    const { line: sch, note } = pickSchoolForLgsPath(path, schools);
    if (!sch) {
      if (note) warnings.push(note);
      continue;
    }
    const kontAligned2 = parseKbKontForBlock(kontCell, scores.length);
    for (let yi = 0; yi < n; yi++) {
      rows.push({
        institution_code: sch.institution_code,
        year: yearsAligned[yi]!,
        track_title: path.trim() || null,
        track_id: null,
        program: programVal,
        language: null,
        with_exam: scores[yi]!,
        without_exam: null,
        contingent: kontAligned2[yi] ?? null,
        tbs: null,
        min_taban: null,
      });
    }
  }
  if (rows.length < 3) return null;
  return { rows, warnings };
}

/**
 * kazanabilirsin.com benzeri yapıştırılmış markdown tabloları deterministik ayrıştırır.
 * Başarılıysa GPT çağrısı gerekmez; satırlar applyRows ile aynı modele gider.
 */
export function tryDeterministicKazanabilirsinTable(
  sourceText: string,
  schools: SchoolMatchLine[],
  sourceScope: PlacementUpdateScope,
): { used: boolean; rawRows: GptPlacementRawRow[]; warnings: string[] } {
  const t = sourceText.trim();
  if (t.length < 80) return { used: false, rawRows: [], warnings: [] };

  if (sourceScope === 'local_only' || sourceScope === 'both') {
    const tsv = tryParseObpTsvMultilineBlocks(t, schools);
    if (tsv && tsv.rows.length >= 3) {
      return {
        used: true,
        rawRows: tsv.rows,
        warnings: [
          'Kaynak: tab ayraçlı OBP tablosu (çok satırlı yıl/OBP hücresi) — deterministik ayrıştırıcı (GPT atlandı).',
          ...tsv.warnings,
        ],
      };
    }
    const obp = tryParseObpMarkdownTable(t, schools);
    if (obp && obp.rows.length >= 3) {
      return {
        used: true,
        rawRows: obp.rows,
        warnings: [
          'Kaynak: kazanabilirsin-benzeri OBP tablosu — deterministik ayrıştırıcı (GPT atlandı). İl sayfası URL’si (ör. …/konya-sinavsiz-obp-…) ve aynı il için «İl filtresi» önerilir.',
          ...obp.warnings,
        ],
      };
    }
  }

  if (sourceScope === 'central_only' || sourceScope === 'both') {
    const lgsMd = tryParseLgsMarkdownTable(t, schools);
    if (lgsMd && lgsMd.rows.length >= 3) {
      return {
        used: true,
        rawRows: lgsMd.rows,
        warnings: [
          'Kaynak: kazanabilirsin-benzeri LGS markdown tablosu — deterministik ayrıştırıcı (GPT atlandı).',
          ...lgsMd.warnings,
        ],
      };
    }
    const lgsTsv = tryParseLgsTsvKazanabilirsinBlocks(t, schools);
    if (lgsTsv && lgsTsv.rows.length >= 3) {
      return {
        used: true,
        rawRows: lgsTsv.rows,
        warnings: [
          'Kaynak: kazanabilirsin-benzeri tab-ayraçlı LGS (çok satırlı hücre) — deterministik ayrıştırıcı (GPT atlandı).',
          ...lgsTsv.warnings,
        ],
      };
    }
  }

  return { used: false, rawRows: [], warnings: [] };
}
