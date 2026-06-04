/**
 * MEBBİS Ek Ders Modülü + KBS Ek Ders V2 Excel okuma.
 * @see MEB Ek Ders Modülü Kılavuzu — "Ek Ders Listesi (KBS)" xls aktarımı
 * @see KBS Ek Ders V2 — puantaj yükleme: TC, Veri Tip, Gün1…GünN
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');

export type BordroExcelFormat =
  | 'mebbis_ek_ders_kbs'
  | 'kbs_puantaj_yukleme'
  | 'kbs_ek_ders_bordro'
  | 'kbs_maas_bordro'
  | 'generic';

export const BORDRO_FORMAT_LABELS: Record<BordroExcelFormat, string> = {
  mebbis_ek_ders_kbs: 'MEBBİS — Ek Ders Listesi (KBS) raporu',
  kbs_puantaj_yukleme: 'KBS — puantaj yükleme (TC + Veri Tip + günler)',
  kbs_ek_ders_bordro: 'KBS — hesaplanmış ek ders bordrosu',
  kbs_maas_bordro: 'KBS — maaş bordrosu',
  generic: 'Genel Excel (Ad/TC sütunları)',
};

export type XRow = Record<string, unknown>;

export type BordroTable = {
  rows: XRow[];
  headers: string[];
  format: BordroExcelFormat;
  sheetName: string;
};

export type BordroColumns = {
  name?: string;
  ad?: string;
  soyad?: string;
  tc?: string;
  phone?: string;
  unvan?: string;
  brans?: string;
  veriTip?: string;
  toplamSaat?: string;
  brut?: string;
  kesinti?: string;
  net?: string;
  dayCols: string[];
};

function normHeader(c: unknown): string {
  return String(c ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function cellToTc(v: unknown): string | null {
  if (v === '' || v === null || v === undefined) return null;
  let digits: string;
  if (typeof v === 'number' && Number.isFinite(v)) {
    digits = String(Math.abs(Math.trunc(v)));
  } else {
    digits = String(v).replace(/\D/g, '');
  }
  if (digits.length > 11) digits = digits.slice(-11);
  if (digits.length < 11) digits = digits.padStart(11, '0');
  if (!/^\d{11}$/.test(digits)) return null;
  return digits;
}

export function fmt(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function parseNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const raw = String(v ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function findCol(headers: string[], ...patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const h = headers.find((x) => pat.test(normHeader(x)));
    if (h) return h;
  }
  return null;
}

function isDayCol(h: string): boolean {
  const s = normHeader(h);
  return /^gün\s*\d+/i.test(s) || /^gun\s*\d+/i.test(s) || /^g\s*\d+$/i.test(s) || /^g\d+$/i.test(s);
}

function findHeaderRow(aoa: unknown[][]): { rowIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const row = aoa[i];
    if (!Array.isArray(row)) continue;
    const norms = row.map(normHeader);
    const hasTc = norms.some((s) => /t\.?\s*c\.?|tc\s*kimlik|kimlik\s*no|kimlik\s*numara/.test(s));
    const hasName = norms.some((s) =>
      /ad.*soyad|personel.*ad|personelin\s*ad|adı\s*soyadı|soyad.*ad/.test(s),
    );
    const hasVeriTip = norms.some((s) => /veri\s*tip/.test(s));
    const hasAd = norms.some((s) => /^adı?$|^ad\s/.test(s) || s === 'ad');
    const hasSoyad = norms.some((s) => /soyad/.test(s));
    if (hasTc && (hasName || (hasAd && hasSoyad) || hasVeriTip)) {
      return { rowIndex: i, headers: row.map((c) => String(c ?? '')) };
    }
  }
  const first = aoa[0];
  return { rowIndex: 0, headers: Array.isArray(first) ? first.map((c) => String(c ?? '')) : [] };
}

function sheetToRows(sheet: import('xlsx').WorkSheet): { aoa: unknown[][]; headers: string[]; dataRows: XRow[] } {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  const { rowIndex, headers } = findHeaderRow(aoa);
  const dataRows: XRow[] = [];
  for (let r = rowIndex + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;
    const obj: XRow = {};
    let nonEmpty = false;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `__col${c}`;
      const val = line[c] ?? '';
      if (String(val).trim() !== '') nonEmpty = true;
      obj[key] = val;
    }
    if (nonEmpty) dataRows.push(obj);
  }
  return { aoa, headers, dataRows };
}

export function detectBordroFormat(headers: string[], prefer: 'puantaj' | 'ek_bordro' | 'maas'): BordroExcelFormat {
  const hasVeriTip = !!findCol(headers, /veri\s*tip/i);
  const dayCols = headers.filter(isDayCol);
  const hasToplamSaat = !!findCol(headers, /toplam\s*saat|net\s*saat|fiili\s*saat|hesaplanan\s*saat|saat\s*toplam/i);
  const hasNetPay = !!findCol(
    headers,
    /net\s*ödenecek|net\s*ödenen|ödenecek\s*tutar|ödenen\s*tutar|net\s*tutar|net\s*ücret|net\s*maaş|net\s*maas/i,
  );
  const hasBrut = !!findCol(headers, /brüt|brut|brüt\s*ücret|brüt\s*maaş|brüt\s*tutar/i);
  const hasKesinti = !!findCol(headers, /kesinti|toplam\s*kesinti|kesintiler\s*toplam/i);

  if (prefer === 'maas' && (hasNetPay || hasBrut)) return 'kbs_maas_bordro';
  if (prefer === 'ek_bordro' && hasNetPay && (hasBrut || hasKesinti)) return 'kbs_ek_ders_bordro';
  if (hasVeriTip && dayCols.length >= 3) return 'kbs_puantaj_yukleme';
  if (hasVeriTip && hasToplamSaat) return 'mebbis_ek_ders_kbs';
  if (hasVeriTip) return 'mebbis_ek_ders_kbs';
  if (prefer === 'ek_bordro' && hasNetPay) return 'kbs_ek_ders_bordro';
  if (prefer === 'maas') return 'kbs_maas_bordro';
  return 'generic';
}

export function resolveColumns(headers: string[]): BordroColumns {
  const nameCol = findCol(
    headers,
    /adı\s*soyadı|ad\s*soyad|personelin\s*ad|personel.*soyad|personel\s*ad|öğretmen\s*ad|ad\s*ve\s*soyad/i,
  );
  const adCol = findCol(headers, /^adı?$|^ad\s*$/i);
  const soyadCol = findCol(headers, /soyad/i);
  const dayCols = headers.filter(isDayCol);

  return {
    name: nameCol ?? undefined,
    ad: adCol && !nameCol ? adCol : undefined,
    soyad: soyadCol && !nameCol ? soyadCol : undefined,
    tc:
      findCol(headers, /t\.?\s*c\.?\s*kimlik|tc\s*kimlik|kimlik\s*no|kimlik\s*numara|^tc$/i) ??
      undefined,
    phone: findCol(headers, /telefon|gsm|whatsapp|cep|phone/i) ?? undefined,
    unvan: findCol(headers, /ünvan|unvan|görev|personel\s*tür/i) ?? undefined,
    brans: findCol(headers, /branş|brans|atama\s*alan|ders\s*alan/i) ?? undefined,
    veriTip: findCol(headers, /veri\s*tip|veri\s*tipi|ödeme\s*tip/i) ?? undefined,
    toplamSaat: findCol(headers, /toplam\s*saat|net\s*saat|fiili\s*saat|hesaplanan\s*saat|saat\s*toplam|^saat$/i) ?? undefined,
    brut: findCol(headers, /brüt\s*ücret|brüt\s*maaş|brüt\s*tutar|brüt|brut/i) ?? undefined,
    kesinti: findCol(headers, /toplam\s*kesinti|kesintiler\s*toplam|^kesinti$/i) ?? undefined,
    net:
      findCol(
        headers,
        /net\s*ödenecek|net\s*ödenen|ödenecek\s*tutar|ödenen\s*tutar|net\s*tutar|net\s*ücret|net\s*maaş|net\s*maas|^net$/i,
      ) ?? undefined,
    dayCols,
  };
}

export function readBordroTable(
  buf: Buffer,
  prefer: 'puantaj' | 'ek_bordro' | 'maas',
): BordroTable {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  let best: BordroTable | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const { headers, dataRows } = sheetToRows(sheet);
    if (!dataRows.length) continue;
    const format = detectBordroFormat(headers, prefer);
    const score =
      dataRows.length * 10 +
      (format !== 'generic' ? 100 : 0) +
      (format === 'mebbis_ek_ders_kbs' || format === 'kbs_puantaj_yukleme' ? 50 : 0);
    const candidate: BordroTable = { rows: dataRows, headers, format, sheetName };
    const prevScore = best
      ? best.rows.length * 10 + (best.format !== 'generic' ? 100 : 0)
      : -1;
    if (!best || score > prevScore) {
      best = candidate;
    }
  }

  if (!best) {
    const sheetName = wb.SheetNames[0] ?? 'Sheet1';
    const sheet = wb.Sheets[sheetName];
    const { headers, dataRows } = sheet ? sheetToRows(sheet) : { headers: [], dataRows: [] };
    return {
      rows: dataRows,
      headers,
      format: detectBordroFormat(headers, prefer),
      sheetName,
    };
  }
  return best;
}

export function rowPersonName(r: XRow, cols: BordroColumns, headers: string[]): string {
  if (cols.name) return fmt(r[cols.name]).toUpperCase();
  const ad = cols.ad ? fmt(r[cols.ad]) : '';
  const soy = cols.soyad ? fmt(r[cols.soyad]) : '';
  const combined = `${ad} ${soy}`.trim().toUpperCase();
  if (combined.length >= 3) return combined;
  return fmt(r[headers[0] ?? '']).toUpperCase();
}

export function rowHours(r: XRow, cols: BordroColumns): number {
  if (cols.toplamSaat) return parseNum(r[cols.toplamSaat]);
  let sum = 0;
  for (const dc of cols.dayCols) sum += parseNum(r[dc]);
  return sum;
}

export function isSummaryRow(name: string): boolean {
  const n = name.trim().toUpperCase();
  if (!n || n.length < 3) return true;
  return /^(TOPLAM|GENEL|ARA\s*TOPLAM|ÖZET|Ozet)/.test(n);
}

export type PersonAggregate = {
  name: string;
  tc?: string;
  phone?: string;
  unvan?: string;
  brans?: string;
  veriTipLines: Array<{ tip: string; saat: number }>;
  totalHours: number;
  brutSum: number;
  kesintiSum: number;
  netSum: number;
  rawRows: XRow[];
};

export function aggregateBordroRows(table: BordroTable): Map<string, PersonAggregate> {
  const cols = resolveColumns(table.headers);
  const groups = new Map<string, PersonAggregate>();

  for (const r of table.rows) {
    const name = rowPersonName(r, cols, table.headers);
    if (isSummaryRow(name)) continue;

    const tc = cols.tc ? cellToTc(r[cols.tc]) ?? undefined : undefined;
    const key = tc ?? name;
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        name: tc ? name : name,
        tc,
        phone: cols.phone ? normalizePhone(r[cols.phone]) || undefined : undefined,
        unvan: cols.unvan ? fmt(r[cols.unvan]) : undefined,
        brans: cols.brans ? fmt(r[cols.brans]) : undefined,
        veriTipLines: [],
        totalHours: 0,
        brutSum: 0,
        kesintiSum: 0,
        netSum: 0,
        rawRows: [],
      });
    }
    const g = groups.get(key)!;
    g.rawRows.push(r);
    if (!g.name && name) g.name = name;
    if (tc) g.tc = tc;
    if (cols.phone && !g.phone) g.phone = normalizePhone(r[cols.phone]) || g.phone;
    if (cols.unvan && !g.unvan) g.unvan = fmt(r[cols.unvan]);
    if (cols.brans && !g.brans) g.brans = fmt(r[cols.brans]);

    const hours = rowHours(r, cols);
    if (hours > 0) {
      g.totalHours += hours;
      if (cols.veriTip) {
        const tip = fmt(r[cols.veriTip]) || 'Ek ders';
        const existing = g.veriTipLines.find((x) => x.tip === tip);
        if (existing) existing.saat += hours;
        else g.veriTipLines.push({ tip, saat: hours });
      }
    }

    if (cols.brut) g.brutSum += parseNum(r[cols.brut]);
    if (cols.kesinti) g.kesintiSum += parseNum(r[cols.kesinti]);
    if (cols.net) g.netSum += parseNum(r[cols.net]);
  }

  return groups;
}

export function normalizePhone(raw: unknown): string {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '90' + p.slice(1);
  if (p.length === 10) p = '90' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p.length >= 10 ? p : '';
}

export function formatHours(n: number): string {
  if (!n) return '';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

export function formatMoney(n: number): string {
  if (!n) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

/** Sekme kazıması → mevcut Excel parser zinciri */
export function rowsToWorkbookBuffer(headers: string[], rows: XRow[]): Buffer {
  const normalized = rows.map((r) => {
    const o: XRow = {};
    for (const h of headers) o[h] = r[h] ?? '';
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(normalized, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kazima');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
