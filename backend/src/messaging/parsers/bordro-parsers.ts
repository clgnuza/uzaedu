/**
 * MEBBİS Puantaj, KBS Ek Ders Bordro, KBS Maaş Bordro parsers.
 * Mesaj formatı WhatsApp mobil ekranına göre optimize edilmiştir.
 * Her parser: kısa kişisel özet + okul iletişim notu üretir.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');

export type BordroTeacher = {
  name: string;
  tc?: string;
  phone?: string;
  messageText: string;
  rawRows: XRow[];
};

type XRow = Record<string, unknown>;

// ── Yardımcı ──────────────────────────────────────────────────────────────────

function readSheet(buf: Buffer): XRow[] {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<XRow>(sheet, { defval: '', raw: false });
}

function findCol(headers: string[], ...patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const h = headers.find((h) => pat.test(h));
    if (h) return h;
  }
  return null;
}

function normalizePhone(raw: unknown): string {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '90' + p.slice(1);
  if (p.length === 10) p = '90' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p.length >= 10 ? p : '';
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function currency(v: unknown): string {
  const raw = String(v ?? '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(raw);
  if (isNaN(n)) return String(v ?? '');
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

/** TC kimlik numarasını maskeler: 123***456 */
function maskTc(tc: string | undefined): string {
  if (!tc || tc.length < 6) return tc ?? '';
  const s = tc.trim();
  const head = s.slice(0, 3);
  const tail = s.slice(-3);
  const mid  = '*'.repeat(Math.max(1, s.length - 6));
  return `${head}${mid}${tail}`;
}

/** Okul adı + iletişim notu ile standart footer üretir */
function footer(schoolName: string, footerNote: string): string {
  return `${footerNote ? footerNote + '\n' : ''}İyi Çalışmalar...\n${schoolName ? schoolName : 'OgretmenPro'}`;
}

// ── MEBBİS Puantaj ────────────────────────────────────────────────────────────

export function parseMebbisPuantaj(buf: Buffer, donemLabel: string, schoolName = '', footerNote = ''): BordroTeacher[] {
  const rows = readSheet(buf);
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  const nameCol  = findCol(headers, /ad.*soyad|öğretmen.*ad|personel.*ad|name/i);
  const tcCol    = findCol(headers, /^tc$|kimlik.*no|t\.c\./i);
  const bransCol = findCol(headers, /branş|brans|ders|alan|subject/i);
  const toplamCol= findCol(headers, /toplam.*saat|toplam/i);
  const phoneCol = findCol(headers, /telefon|gsm|whatsapp|cep|phone/i);

  const groups = new Map<string, { rows: XRow[]; tc?: string; phone?: string }>();

  for (const r of rows) {
    const name = String(r[nameCol ?? headers[0]] ?? '').trim().toUpperCase();
    if (!name || name.length < 3) continue;
    if (!groups.has(name)) groups.set(name, { rows: [] });
    const g = groups.get(name)!;
    g.rows.push(r);
    if (tcCol && r[tcCol]) g.tc = fmt(r[tcCol]) || g.tc;
    if (phoneCol && r[phoneCol]) g.phone = normalizePhone(r[phoneCol]) || g.phone;
  }

  const defaultNote = footerNote || `Ek ders kontrol amaçlı puantaj ekte sunulmuştur. Hata olması durumunda${schoolName ? ' ' + schoolName + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`;

  return [...groups].map(([name, g]) => {
    const first  = g.rows[0];
    const toplam = toplamCol ? fmt(first[toplamCol]) : '';
    const brans  = bransCol  ? fmt(first[bransCol])  : '';

    const lines = [
      `👤 Sayın ${toTitleCase(name)},`,
      '',
      `- T.C. Kimlik No: ${maskTc(g.tc)}`,
      brans  ? `- Branş: ${brans}` : '',
      `- Dönem: ${donemLabel}`,
      toplam ? `- Toplam Saat: ${toplam} saat` : '',
      '',
      defaultNote,
      footer(schoolName, ''),
    ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));

    return { name, tc: g.tc, phone: g.phone, messageText: lines.join('\n').trim(), rawRows: g.rows };
  });
}

// ── KBS Ek Ders Bordro ───────────────────────────────────────────────────────

export function parseEkDersBordro(buf: Buffer, donemLabel: string, schoolName = '', footerNote = ''): BordroTeacher[] {
  const rows = readSheet(buf);
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  const nameCol  = findCol(headers, /ad.*soyad|öğretmen.*ad|personel.*ad|name/i);
  const tcCol    = findCol(headers, /^tc$|kimlik.*no|t\.c\./i);
  const netCol   = findCol(headers, /net.*tutar|ödenecek|net.*ücret|toplam.*tutar|net/i);
  const phoneCol = findCol(headers, /telefon|gsm|whatsapp|cep|phone/i);

  const groups = new Map<string, { rows: XRow[]; tc?: string; phone?: string }>();

  for (const r of rows) {
    const name = String(r[nameCol ?? headers[0]] ?? '').trim().toUpperCase();
    if (!name || name.length < 3) continue;
    if (!groups.has(name)) groups.set(name, { rows: [] });
    const g = groups.get(name)!;
    g.rows.push(r);
    if (tcCol && r[tcCol]) g.tc = fmt(r[tcCol]) || g.tc;
    if (phoneCol && r[phoneCol]) g.phone = normalizePhone(r[phoneCol]) || g.phone;
  }

  const defaultNote = footerNote || `Ek ders bordro detayları ekte sunulmuştur. Hata olması durumunda${schoolName ? ' ' + schoolName + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`;

  return [...groups].map(([name, g]) => {
    // Birden fazla satır varsa net tutarı topla
    let netToplam = 0;
    for (const r of g.rows) {
      const v = parseFloat(String(r[netCol ?? ''] ?? '').replace(/\./g, '').replace(',', '.'));
      if (!isNaN(v)) netToplam += v;
    }
    const netStr = netToplam > 0 ? currency(netToplam) : (netCol ? fmt(g.rows[0][netCol]) : '');

    const lines = [
      `👤 Sayın ${toTitleCase(name)},`,
      '',
      `- T.C. Kimlik No: ${maskTc(g.tc)}`,
      `- Bordro Türü: Ek Ders`,
      `- Dönem: ${donemLabel}`,
      netStr ? `- Net Ödenecek Tutar: ${netStr}` : '',
      '',
      defaultNote,
      footer(schoolName, ''),
    ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));

    return { name, tc: g.tc, phone: g.phone, messageText: lines.join('\n').trim(), rawRows: g.rows };
  });
}

// ── KBS Maaş Bordro ───────────────────────────────────────────────────────────

export function parseMaasBordro(buf: Buffer, donemLabel: string, schoolName = '', footerNote = ''): BordroTeacher[] {
  const rows = readSheet(buf);
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  const nameCol  = findCol(headers, /ad.*soyad|personel.*ad|name/i);
  const tcCol    = findCol(headers, /^tc$|kimlik.*no|t\.c\./i);
  const netCol   = findCol(headers, /net.*maaş|net.*ödenecek|net.*tutar|^net$/i);
  const phoneCol = findCol(headers, /telefon|gsm|whatsapp|cep|phone/i);

  const groups = new Map<string, { rows: XRow[]; tc?: string; phone?: string }>();

  for (const r of rows) {
    const name = String(r[nameCol ?? headers[0]] ?? '').trim().toUpperCase();
    if (!name || name.length < 3) continue;
    if (!groups.has(name)) groups.set(name, { rows: [] });
    const g = groups.get(name)!;
    g.rows.push(r);
    if (tcCol && r[tcCol]) g.tc = fmt(r[tcCol]) || g.tc;
    if (phoneCol && r[phoneCol]) g.phone = normalizePhone(r[phoneCol]) || g.phone;
  }

  const defaultNote = footerNote || `Maaş bordro detayları ekte sunulmuştur. Hata olması durumunda${schoolName ? ' ' + schoolName + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`;

  return [...groups].map(([name, g]) => {
    const first  = g.rows[0];
    const netRaw = netCol ? fmt(first[netCol]) : '';
    const netStr = netRaw ? currency(netRaw) : '';

    const lines = [
      `👤 Sayın ${toTitleCase(name)},`,
      '',
      `- T.C. Kimlik No: ${maskTc(g.tc)}`,
      `- Bordro Türü: Maaş`,
      `- Dönem: ${donemLabel}`,
      netStr ? `- Net Ödenecek Tutar: ${netStr}` : '',
      '',
      defaultNote,
      footer(schoolName, ''),
    ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));

    return { name, tc: g.tc, phone: g.phone, messageText: lines.join('\n').trim(), rawRows: g.rows };
  });
}

// ── Yardımcı: Title Case (TÜRKÇE) ─────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\bı/g, 'ı')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\bI\b/g, 'I');
}
