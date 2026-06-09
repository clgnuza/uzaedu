import * as XLSX from 'xlsx';

export type BilsemPlanWeekItem = {
  week_order: number;
  unite: string | null;
  konu: string | null;
  kazanimlar: string | null;
  ders_saati: number;
  belirli_gun_haftalar: string | null;
  surec_bilesenleri: string | null;
  olcme_degerlendirme: string | null;
  sosyal_duygusal: string | null;
  degerler: string | null;
  okuryazarlik_becerileri: string | null;
  zenginlestirme: string | null;
  okul_temelli_planlama: string | null;
};

/** API şablonu: SÜRE (AY, HAFTA, DERS SAATİ) + içerik sütunları; öğretmen 36 hafta doldurur */
export const YILLIK_PLAN_UPLOAD_MAX_WEEKS = 36;

/** yiillik-plan-sablon-2.xlsx: Excel 1–2 başlık, 3–38 veri (0-indeks 2–37) */
const SABLON2_HEADER_ROW = 1;
const SABLON2_DATA_START = 2;
const SABLON2_DATA_END = 37;

export const YILLIK_PLAN_SABLON_COLUMN_HELP: { excel: string; api: string; note: string }[] = [
  { excel: 'ÜNİTE / TEMA', api: 'unite', note: 'Doldurulacak' },
  { excel: 'KONU (İÇERİK ÇERÇEVESİ)', api: 'konu', note: 'Doldurulacak' },
  { excel: 'ÖĞRENME ÇIKTILARI', api: 'kazanimlar', note: 'Doldurulacak' },
  { excel: 'SÜREÇ BİLEŞENLERİ', api: 'surec_bilesenleri', note: 'Doldurulacak' },
  { excel: 'ÖLÇME VE DEĞERLENDİRME', api: 'olcme_degerlendirme', note: 'Doldurulacak' },
  { excel: 'SOSYAL - DUYGUSAL …', api: 'sosyal_duygusal', note: 'Doldurulacak' },
  { excel: 'DEĞERLER', api: 'degerler', note: 'Doldurulacak' },
  { excel: 'OKURYAZARLIK BECERİLERİ', api: 'okuryazarlik_becerileri', note: 'Doldurulacak' },
  { excel: 'BELİRLİ GÜN VE HAFTALAR', api: 'belirli_gun_haftalar', note: 'Doldurulacak' },
  { excel: 'FARKLILAŞTIRMA', api: 'zenginlestirme', note: 'Doldurulacak' },
  { excel: 'OKUL TEMELLİ PLANLAMA', api: 'okul_temelli_planlama', note: 'Doldurulacak' },
];

function cell(v: unknown): string {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function nullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t.length ? t : null;
}

const HOLIDAY_PHRASE_RE =
  /(TAT[İI]L|YARIYIL|D[ÖO]NEM\s+ARA|D[ÖO]NEM\s+SONU|KARNE|BAYRAM|RESM[İI]\s+TAT[İI]L|ARA\s+TAT[İI]L[İI]|SEMINER|UYUM\s+HAFTASI)/i;

function isHolidayLabel(ay: string, hafta: string): boolean {
  return HOLIDAY_PHRASE_RE.test(`${ay} ${hafta}`);
}

function isNonTeachingSureRow(ay: string, hafta: string, dersSaati: number): boolean {
  if (dersSaati === 0) return true;
  if (isHolidayLabel(ay, hafta)) return true;
  if (isTatilRowByDateShape(ay, hafta)) return true;
  return false;
}

function isGuideRow(r: unknown[], colFark: number, colOkul: number): boolean {
  const f = cell(r[colFark] ?? '');
  const o = cell(r[colOkul] ?? '');
  return f.length > 120 || o.length > 120;
}

/** Sağ sütunlarda rehber metni var; 1. veri satırı (3. Excel satırı) her zaman hafta satırıdır */
function isGuideOnlyRow(
  sh: XLSX.WorkSheet,
  rowIdx: number,
  r: unknown[],
  c: ColMap,
  noMerge: Set<number>,
  dataStart: number,
): boolean {
  if (isHeaderLabelsRow(sh, rowIdx, r, c, noMerge, dataStart)) return true;
  if (rowIdx === dataStart) return false;
  const okulCol = c.okul_temelli >= 0 ? c.okul_temelli : c.zenginlestirme;
  if (!isGuideRow(r, c.zenginlestirme, okulCol)) return false;
  return !rowHasPlanBody(sh, rowIdx, r, c, noMerge, dataStart);
}

function isSablon2FixedLayout(rows: unknown[][], headerRow: number): boolean {
  return headerRow === SABLON2_HEADER_ROW && rows.length >= SABLON2_DATA_END + 1;
}

/** "10 - 14 Kasım" (N. Hafta yok) — tatil satırı */
function isTatilRowByDateShape(ay: string, ha: string): boolean {
  const t = `${ay} ${ha}`.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (HOLIDAY_PHRASE_RE.test(t)) return true;
  if (/\d+\s*\.\s*Hafta/i.test(ha) || /\bHafta\s*:/i.test(ha)) return false;
  if (/\bHafta\s*:/i.test(ay)) return false;
  if (
    /^\d{1,2}\s*[-–—]\s*\d{1,2}\s+/.test(ha) &&
    /(Kasım|Kasim|ocak|Ocak|şubat|Şubat|mart|Mart|nisan|Nisan|May|Haz|Tem|Ağu|Eyl|ekim|aral)/i.test(ha) &&
    !/Hafta/i.test(ha)
  ) {
    return true;
  }
  if (
    /^\d{1,2}\s+(Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Ocak|Şubat|Nisan|Mart|Haziran|Kasım|ocak|mart)/i.test(ha) &&
    /[-–—]/.test(ha) &&
    !/Hafta/i.test(ha)
  ) {
    return true;
  }
  return false;
}

function normHeader(v: unknown): string {
  return String(v ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type WeekParse = { kind: 'holiday' } | { kind: 'weeks'; weeks: number[] } | { kind: 'unknown' };

function parseWeekLine(ayRaw: unknown, haftaRaw: unknown): WeekParse {
  const ay = cell(ayRaw);
  const oneHa = String(haftaRaw ?? '').replace(/\r\n/g, ' ').replace(/\r/g, ' ');
  if (isHolidayLabel(ay, oneHa)) return { kind: 'holiday' };
  if (isTatilRowByDateShape(ay, oneHa)) return { kind: 'holiday' };
  const combined = `${ay} ${oneHa}`.replace(/\s+/g, ' ');

  const rangeDash = combined.match(/(\d+)\s*[-–—]\s*(\d+)\s*\.\s*Hafta/i);
  if (rangeDash) {
    const a = parseInt(rangeDash[1], 10);
    const b = parseInt(rangeDash[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b >= a && b <= YILLIK_PLAN_UPLOAD_MAX_WEEKS) {
      const weeks: number[] = [];
      for (let w = a; w <= b; w++) weeks.push(w);
      return { kind: 'weeks', weeks };
    }
  }
  const rangeVe = combined.match(/(\d+)\s*\.\s*ve\s*(\d+)\s*\.\s*Hafta/i);
  if (rangeVe) {
    const a = parseInt(rangeVe[1], 10);
    const b = parseInt(rangeVe[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b >= a && b <= YILLIK_PLAN_UPLOAD_MAX_WEEKS) {
      const weeks: number[] = [];
      for (let w = a; w <= b; w++) weeks.push(w);
      return { kind: 'weeks', weeks };
    }
  }
  const fromH = parseWeekOrderFromHaftaCell(haftaRaw) ?? parseWeekOrderFromHaftaCell(ayRaw);
  if (fromH != null) {
    if (fromH < 1 || fromH > YILLIK_PLAN_UPLOAD_MAX_WEEKS) return { kind: 'unknown' };
    return { kind: 'weeks', weeks: [fromH] };
  }
  return { kind: 'unknown' };
}

type ColMap = {
  ay: number;
  hafta: number;
  ders_saati: number;
  unite: number;
  konu: number;
  kazanimlar: number;
  surec_bilesenleri: number;
  olcme_degerlendirme: number;
  sosyal_duygusal: number;
  degerler: number;
  okuryazarlik_becerileri: number;
  belirli_gun_haftalar: number;
  zenginlestirme: number;
  okul_temelli: number;
};

function mergedValueAt(
  sh: XLSX.WorkSheet,
  row: number,
  col: number,
  raw: unknown,
  opts?: { noMerge?: boolean; mergeFloorRow?: number },
): unknown {
  const hasRaw = String(raw ?? '').trim().length > 0;
  if (hasRaw || opts?.noMerge) return raw;
  const merges = (sh['!merges'] ?? []) as XLSX.Range[];
  for (const m of merges) {
    if (row < m.s.r || row > m.e.r || col < m.s.c || col > m.e.c) continue;
    if (opts?.mergeFloorRow != null && m.s.r < opts.mergeFloorRow) continue;
    const addr = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
    return sh[addr]?.v ?? raw;
  }
  return raw;
}

function readCell(
  sh: XLSX.WorkSheet,
  row: number,
  col: number,
  raw: unknown,
  noMergeCols: Set<number>,
  mergeFloorRow?: number,
): string {
  const v = mergedValueAt(sh, row, col, raw, {
    noMerge: noMergeCols.has(col),
    mergeFloorRow,
  });
  return cell(v);
}

function headerHasSureColumns(hrow: unknown[]): boolean {
  const cells = hrow.map((c) => normHeader(c).toUpperCase());
  return (
    cells.some((s) => s === 'AY' || /^AY(\s|\/)/.test(s)) &&
    cells.some((s) => s.includes('HAFTA') && !s.includes('BELİRLİ') && !s.includes('BELIRLI'))
  );
}

function resolveColMap(hrow: unknown[]): ColMap {
  const n = hrow.length;
  const u = (c: number) => normHeader(hrow[c]).toUpperCase();
  const find = (test: (s: string) => boolean, fb: number): number => {
    for (let c = 0; c < n; c++) {
      if (test(u(c))) return c;
    }
    return fb;
  };
  const hasSure = headerHasSureColumns(hrow);
  const f = find(
    (s) =>
      s.includes('FARKLILAŞTIRMA') ||
      s.includes('FARKLILASTIRMA') ||
      (s.includes('FARKL') && s.includes('OKUL')),
    12,
  );
  let oi = find((s) => s.includes('OKUL') && (s.includes('TEMELL') || s.includes('TEMELI') || s.includes('PLANLAMA')), 13);
  if (oi === f) oi = -1;

  return {
    ay: hasSure ? find((s) => s === 'AY' || /^AY(\s|\/)/.test(s), 0) : -1,
    hafta: hasSure
      ? find(
          (s) => s.includes('HAFTA') && !s.includes('BELİRLİ') && !s.includes('BELIRLI') && !s.includes('BELIRLI GUN'),
          1,
        )
      : -1,
    ders_saati: hasSure ? find((s) => s.includes('DERS') && (s.includes('SAAT') || s.includes('SAATİ')), 2) : -1,
    unite: find((s) => s.includes('ÜNİTE') || s.includes('UNITE') || (s.includes('TEMA') && s.length < 32), hasSure ? 3 : 0),
    konu: find(
      (s) =>
        s.includes('KONU') &&
        (s.includes('İÇERİK') || s.includes('ICERIK') || s.includes('ÇERÇEVE') || s.includes('CERCEVE') || s.length < 24),
      4,
    ),
    kazanimlar: find(
      (s) =>
        (s.includes('ÖĞRENME') || s.includes('OGRENME')) &&
        (s.includes('ÇIKTI') || s.includes('CIKTI') || s.length < 28),
      5,
    ),
    surec_bilesenleri: find(
      (s) =>
        (s.includes('SÜREÇ') || s.includes('SUREC')) &&
        (s.includes('BİLEŞEN') || s.includes('BILESEN') || s.length < 24),
      6,
    ),
    olcme_degerlendirme: find(
      (s) => s.includes('ÖLÇME') || s.includes('OLCME') || (s.includes('DEĞERLEND') && s.length < 48),
      7,
    ),
    sosyal_duygusal: find(
      (s) => s.includes('SOSYAL') && (s.includes('DUYGUSAL') || s.includes('ÖĞREN') || s.includes('OGREN')),
      8,
    ),
    degerler: find((s) => s === 'DEĞERLER' || s === 'DEGERLER' || s.startsWith('DEĞERLER') || s.startsWith('DEGERLER'), 9),
    okuryazarlik_becerileri: find(
      (s) => s.includes('OKURYAZAR') || s.includes('OKU-YAZAR'),
      10,
    ),
    belirli_gun_haftalar: find(
      (s) => s.includes('BELİRLİ') || s.includes('BELIRLI') || (s.includes('BELG') && s.includes('HAFT')),
      11,
    ),
    zenginlestirme: f,
    okul_temelli: oi,
  };
}

function pairFarkOkul(
  r: unknown[],
  c: ColMap,
): { zenginlestirme: string | null; okul_temelli_planlama: string | null } {
  const z = nullIfEmpty(cell(r[c.zenginlestirme]));
  if (c.okul_temelli < 0) {
    return { zenginlestirme: z, okul_temelli_planlama: z };
  }
  const o = nullIfEmpty(cell(r[c.okul_temelli]));
  return { zenginlestirme: z, okul_temelli_planlama: o };
}

export function parseWeekOrderFromHaftaCell(haftaRaw: unknown): number | null {
  const one = String(haftaRaw ?? '').replace(/\r?\n/g, ' ');
  const m = one.match(/(\d+)\s*\.\s*Hafta/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function dersSaatiCell(v: unknown, fallback = 2): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? Math.max(0, n) : Math.max(0, Math.round(fallback));
}

function isHeaderLikeCell(t: string): boolean {
  return isColumnTitleCell(t);
}

/** Sütun başlığı / şablon etiketi (veri değil) */
export function isColumnTitleCell(t: string): boolean {
  const u = String(t ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!u || u.length > 72) return false;
  if (u.includes('ÜNİTE') && u.includes('TEMA') && u.length < 48) return true;
  if (u.startsWith('KONU') || (u.includes('KONU') && (u.includes('İÇERİK') || u.includes('ÇERÇEVE')))) return true;
  if (u.includes('ÖĞRENME') && u.includes('ÇIKTI') && u.length < 48) return true;
  if (u.includes('SÜREÇ') && u.includes('BİLEŞEN') && u.length < 48) return true;
  if (u.includes('ÖLÇME') && u.includes('DEĞERLEND') && u.length < 56) return true;
  if (u === 'DEĞERLER' || u === 'DEGERLER' || u.startsWith('DEĞERLER ') || u.startsWith('DEGERLER ')) return true;
  if (u.includes('OKURYAZAR') && u.includes('BECER') && u.length < 56) return true;
  if (u.includes('BELİRLİ') && u.includes('GÜN') && u.length < 56) return true;
  if (u.includes('FARKLILAŞTIRMA') || u.includes('FARKLILASTIRMA')) return true;
  if (u.includes('OKUL') && u.includes('TEMELL') && u.includes('PLAN') && u.length < 56) return true;
  if (u.includes('SOSYAL') && u.includes('DUYGUSAL') && u.length < 56) return true;
  return false;
}

export function isPlanWeekItemHeaderNoise(item: BilsemPlanWeekItem): boolean {
  const texts = [
    item.unite,
    item.konu,
    item.kazanimlar,
    item.surec_bilesenleri,
    item.olcme_degerlendirme,
    item.sosyal_duygusal,
    item.degerler,
    item.okuryazarlik_becerileri,
    item.belirli_gun_haftalar,
    item.zenginlestirme,
    item.okul_temelli_planlama,
  ].filter((v): v is string => !!v && String(v).trim().length > 0);
  let titleHits = 0;
  for (const t of texts) {
    if (isColumnTitleCell(t)) titleHits++;
  }
  return titleHits >= 2;
}

/** Şablondaki örnek 1,2,3… satırları (dört çekirdek sütun yalnızca rakam) */
function isPlaceholderDemoRow(r: unknown[], c: ColMap): boolean {
  const core = [c.unite, c.konu, c.kazanimlar, c.surec_bilesenleri].map((col) => cell(r[col] ?? ''));
  if (!core.every((v) => /^\d{1,2}$/.test(v))) return false;
  const extraCols = [
    c.olcme_degerlendirme,
    c.sosyal_duygusal,
    c.degerler,
    c.okuryazarlik_becerileri,
    c.belirli_gun_haftalar,
    c.zenginlestirme,
    ...(c.okul_temelli >= 0 ? [c.okul_temelli] : []),
  ];
  return !extraCols.some((col) => {
    const t = cell(r[col] ?? '');
    return t.length > 0 && !/^\d{1,2}$/.test(t);
  });
}

function rowHasPlanBody(
  sh: XLSX.WorkSheet,
  rowIdx: number,
  r: unknown[],
  c: ColMap,
  noMerge: Set<number>,
  mergeFloorRow: number,
): boolean {
  const cols = [
    c.unite,
    c.konu,
    c.kazanimlar,
    c.surec_bilesenleri,
    c.olcme_degerlendirme,
    c.sosyal_duygusal,
    c.degerler,
    c.okuryazarlik_becerileri,
    c.belirli_gun_haftalar,
    c.zenginlestirme,
    ...(c.okul_temelli >= 0 ? [c.okul_temelli] : []),
  ];
  for (const col of cols) {
    const t = nullIfEmpty(readCell(sh, rowIdx, col, r[col], noMerge, mergeFloorRow));
    if (t && !isHeaderLikeCell(t)) return true;
  }
  return false;
}

/** Birleşik üst başlık satırı (satır 0) — veri satırı değil */
function isMergedSuperHeaderRow(cells: string[]): boolean {
  const joined = cells.filter(Boolean).join(' ');
  const hasKonuCol = cells.some(
    (s) => /^KONU(\s|\(|$)/.test(s) || (s.includes('KONU') && s.length < 48),
  );
  if (hasKonuCol) return false;
  return (
    joined.includes('ÜNİTE') &&
    joined.includes('TEMA') &&
    (joined.includes('ÇERÇEVE') || joined.includes('CERCEVE') || joined.includes('ÖĞRENME ÇIKTILARI'))
  );
}

function isSubHeaderRow(cells: string[]): boolean {
  const hasUniteCol = cells.some(
    (s) =>
      (s.includes('ÜNİTE') || s.includes('UNITE')) &&
      s.includes('TEMA') &&
      !s.includes('ÇERÇEVE') &&
      !s.includes('CERCEVE') &&
      s.length < 40,
  );
  const hasKonuCol = cells.some(
    (s) =>
      s.includes('KONU') &&
      (s.includes('İÇERİK') || s.includes('ICERIK') || s.includes('ÇERÇEVE') || s.includes('CERCEVE')),
  );
  return hasUniteCol && hasKonuCol;
}

function isHeaderLabelsRow(
  sh: XLSX.WorkSheet,
  rowIdx: number,
  r: unknown[],
  c: ColMap,
  noMerge: Set<number>,
  mergeFloorRow: number,
): boolean {
  const cols = [
    c.unite,
    c.konu,
    c.kazanimlar,
    c.surec_bilesenleri,
    c.olcme_degerlendirme,
    c.sosyal_duygusal,
    c.degerler,
    c.okuryazarlik_becerileri,
    c.belirli_gun_haftalar,
    c.zenginlestirme,
    ...(c.okul_temelli >= 0 ? [c.okul_temelli] : []),
  ];
  let titleHits = 0;
  for (const col of cols) {
    const t = readCell(sh, rowIdx, col, r[col], noMerge, mergeFloorRow);
    if (isColumnTitleCell(t)) titleHits++;
  }
  return titleHits >= 2;
}

function findHeaderRow(rows: unknown[][]): { row: number; hasSure: boolean } {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i];
    if (!r || r.length < 6) continue;
    const cells = r.map((c) => normHeader(c).toUpperCase());
    if (isMergedSuperHeaderRow(cells)) continue;
    if (!isSubHeaderRow(cells)) continue;
    const hasSure =
      cells.some((s) => s === 'AY' || /^AY(\s|\/)/.test(s)) &&
      cells.some((s) => s.includes('HAFTA') && !s.includes('BELİRLİ') && !s.includes('BELIRLI'));
    return { row: i, hasSure };
  }
  return { row: -1, hasSure: false };
}

export type YillikPlanUploadCurriculum = 'meb' | 'bilsem';

function noMergeColsFor(C: ColMap, curriculum: YillikPlanUploadCurriculum): Set<number> {
  if (curriculum !== 'meb') return new Set<number>();
  const s = new Set<number>();
  for (const col of [
    C.sosyal_duygusal,
    C.degerler,
    C.okuryazarlik_becerileri,
    C.belirli_gun_haftalar,
    C.zenginlestirme,
    C.okul_temelli,
  ]) {
    if (col >= 0) s.add(col);
  }
  return s;
}

function pushItem(
  items: BilsemPlanWeekItem[],
  sh: XLSX.WorkSheet,
  rowIdx: number,
  r: unknown[],
  C: ColMap,
  weekOrder: number,
  ds: number,
  noMerge: Set<number>,
  mergeFloorRow: number,
  curriculum: YillikPlanUploadCurriculum,
): void {
  if (weekOrder < 1 || weekOrder > YILLIK_PLAN_UPLOAD_MAX_WEEKS) return;
  const uniteVal = nullIfEmpty(readCell(sh, rowIdx, C.unite, r[C.unite], noMerge, mergeFloorRow));
  const konuVal = nullIfEmpty(readCell(sh, rowIdx, C.konu, r[C.konu], noMerge, mergeFloorRow));
  const zenginlestirme = nullIfEmpty(
    readCell(sh, rowIdx, C.zenginlestirme, r[C.zenginlestirme], noMerge, mergeFloorRow),
  );
  const okul_temelli_planlama =
    C.okul_temelli >= 0
      ? nullIfEmpty(readCell(sh, rowIdx, C.okul_temelli, r[C.okul_temelli], noMerge, mergeFloorRow))
      : curriculum === 'bilsem'
        ? zenginlestirme
        : null;
  const item: BilsemPlanWeekItem = {
    week_order: weekOrder,
    unite: uniteVal,
    konu: konuVal,
    kazanimlar: nullIfEmpty(readCell(sh, rowIdx, C.kazanimlar, r[C.kazanimlar], noMerge, mergeFloorRow)),
    ders_saati: ds,
    belirli_gun_haftalar: nullIfEmpty(
      readCell(sh, rowIdx, C.belirli_gun_haftalar, r[C.belirli_gun_haftalar], noMerge, mergeFloorRow),
    ),
    surec_bilesenleri: nullIfEmpty(
      readCell(sh, rowIdx, C.surec_bilesenleri, r[C.surec_bilesenleri], noMerge, mergeFloorRow),
    ),
    olcme_degerlendirme: nullIfEmpty(
      readCell(sh, rowIdx, C.olcme_degerlendirme, r[C.olcme_degerlendirme], noMerge, mergeFloorRow),
    ),
    sosyal_duygusal: nullIfEmpty(
      readCell(sh, rowIdx, C.sosyal_duygusal, r[C.sosyal_duygusal], noMerge, mergeFloorRow),
    ),
    degerler: nullIfEmpty(readCell(sh, rowIdx, C.degerler, r[C.degerler], noMerge, mergeFloorRow)),
    okuryazarlik_becerileri: nullIfEmpty(
      readCell(sh, rowIdx, C.okuryazarlik_becerileri, r[C.okuryazarlik_becerileri], noMerge, mergeFloorRow),
    ),
    zenginlestirme: zenginlestirme,
    okul_temelli_planlama: okul_temelli_planlama,
  };
  if (isPlanWeekItemHeaderNoise(item)) return;
  items.push(item);
}

/** Sabit şablon (.xlsx): başlık satırından sonra kullanıcı doldurur; satır sırası = hafta. */
export function parseYillikPlanSablonXlsx(
  buf: ArrayBuffer,
  options?: { defaultDersSaati?: number; curriculum?: YillikPlanUploadCurriculum },
): { items: BilsemPlanWeekItem[] } {
  const curriculum: YillikPlanUploadCurriculum = options?.curriculum === 'bilsem' ? 'bilsem' : 'meb';
  const defaultDersSaati =
    options?.defaultDersSaati != null && Number.isFinite(options.defaultDersSaati)
      ? Math.max(0, Math.round(options.defaultDersSaati))
      : 2;
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.includes('Sayfa1') ? 'Sayfa1' : wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel dosyasında sayfa yok.');
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' }) as unknown[][];

  const { row: headerRow, hasSure } = findHeaderRow(rows);
  if (headerRow < 0) {
    throw new Error('Geçersiz şablon. «Şablon indir» ile sabit dosyayı alın.');
  }

  const hrow = rows[headerRow] as unknown[];
  const C = resolveColMap(hrow);
  const noMerge = noMergeColsFor(C, curriculum);
  const items: BilsemPlanWeekItem[] = [];

  const sablon2 = curriculum === 'meb' && isSablon2FixedLayout(rows, headerRow);
  const dataStart = sablon2 ? SABLON2_DATA_START : headerRow + 1;
  const dataEnd = sablon2 ? SABLON2_DATA_END : rows.length - 1;

  if (!hasSure) {
    for (let i = dataStart; i <= dataEnd; i++) {
      const r = rows[i];
      if (!r) continue;
      const weekOrder = i - dataStart + 1;
      if (weekOrder > YILLIK_PLAN_UPLOAD_MAX_WEEKS) break;
      if (isGuideOnlyRow(sh, i, r, C, noMerge, dataStart)) continue;
      if (isHeaderLabelsRow(sh, i, r, C, noMerge, dataStart)) continue;
      if (isPlaceholderDemoRow(r, C)) continue;
      if (!rowHasPlanBody(sh, i, r, C, noMerge, dataStart)) continue;

      pushItem(items, sh, i, r, C, weekOrder, defaultDersSaati, noMerge, dataStart, curriculum);
    }
  } else {
    for (let i = dataStart; i <= dataEnd; i++) {
      const r = rows[i];
      if (!r) continue;
      if (isGuideOnlyRow(sh, i, r, C, noMerge, dataStart)) continue;
      if (isHeaderLabelsRow(sh, i, r, C, noMerge, dataStart)) continue;
      if (isPlaceholderDemoRow(r, C)) continue;

      const ay = readCell(sh, i, C.ay, r[C.ay], noMerge, dataStart);
      const ha = readCell(sh, i, C.hafta, r[C.hafta], noMerge, dataStart);
      const ds = dersSaatiCell(
        mergedValueAt(sh, i, C.ders_saati, r[C.ders_saati], { mergeFloorRow: dataStart }),
        defaultDersSaati,
      );

      if (isNonTeachingSureRow(ay, ha, ds)) continue;
      if (!rowHasPlanBody(sh, i, r, C, noMerge, dataStart)) continue;

      const wp = parseWeekLine(
        mergedValueAt(sh, i, C.ay, r[C.ay], { mergeFloorRow: dataStart }),
        mergedValueAt(sh, i, C.hafta, r[C.hafta], { mergeFloorRow: dataStart }),
      );
      if (wp.kind !== 'weeks') continue;

      for (const weekOrder of wp.weeks) {
        pushItem(items, sh, i, r, C, weekOrder, ds, noMerge, dataStart, curriculum);
      }
    }
  }

  if (!items.length) {
    throw new Error(
      'Öğretim haftası içeriği bulunamadı. Şablondaki örnek 1,2,3… satırlarını silmeyin; ÜNİTE/KONU ve diğer sütunlara gerçek metin yazın (yalnızca rakam bırakmayın).',
    );
  }
  return { items };
}
