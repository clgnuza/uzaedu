/**
 * MEBBİS Puantaj, KBS Ek Ders Bordro, KBS Maaş Bordro — mesaj üretimi.
 */

import {
  aggregateBordroRows,
  BORDRO_FORMAT_LABELS,
  BordroExcelFormat,
  formatHours,
  formatMoney,
  readBordroTable,
  rowsToWorkbookBuffer,
  XRow,
} from './bordro-excel';

export type BordroSource = 'excel' | 'mebbis_scrape' | 'kbs_scrape';

export function parseBordroFromRows(
  type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro',
  headers: string[],
  rows: XRow[],
  donemLabel: string,
  schoolName = '',
  footerNote = '',
): BordroParseResult {
  const buf = rowsToWorkbookBuffer(headers, rows);
  if (type === 'mebbis_puantaj') return parseMebbisPuantaj(buf, donemLabel, schoolName, footerNote);
  if (type === 'ek_ders_bordro') return parseEkDersBordro(buf, donemLabel, schoolName, footerNote);
  return parseMaasBordro(buf, donemLabel, schoolName, footerNote);
}

export type { BordroExcelFormat };
export { BORDRO_FORMAT_LABELS };

export type BordroTeacher = {
  name: string;
  tc?: string;
  phone?: string;
  messageText: string;
  rawRows: XRow[];
};

export type BordroParseResult = {
  teachers: BordroTeacher[];
  excelFormat: BordroExcelFormat;
  excelFormatLabel: string;
};

function maskTc(tc: string | undefined): string {
  if (!tc || tc.length < 6) return tc ?? '';
  const s = tc.trim();
  const head = s.slice(0, 3);
  const tail = s.slice(-3);
  const mid = '*'.repeat(Math.max(1, s.length - 6));
  return `${head}${mid}${tail}`;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

const MEB_KBS_OFFICIAL_NOTE =
  'Resmî ödeme KBS üzerinden yapılır; bu mesaj bilgilendirme amaçlıdır.';

function buildFooter(defaultNote: string, schoolName: string, extraLine?: string): string[] {
  return [
    defaultNote,
    extraLine || MEB_KBS_OFFICIAL_NOTE,
    '────────',
    'İyi çalışmalar.',
    schoolName || 'Uzaedu Öğretmen',
  ];
}

function veriTipBlock(lines: Array<{ tip: string; saat: number }>, max = 8): string[] {
  if (!lines.length) return [];
  const out = ['• Veri tipi özeti:'];
  const sorted = [...lines].sort((a, b) => b.saat - a.saat);
  for (const { tip, saat } of sorted.slice(0, max)) {
    out.push(`  – ${tip}: ${formatHours(saat)} saat`);
  }
  if (sorted.length > max) out.push(`  – … +${sorted.length - max} kalem`);
  return out;
}

// ── MEBBİS Puantaj ────────────────────────────────────────────────────────────

export function parseMebbisPuantaj(
  buf: Buffer,
  donemLabel: string,
  schoolName = '',
  footerNote = '',
): BordroParseResult {
  const table = readBordroTable(buf, 'puantaj');
  const groups = aggregateBordroRows(table);
  const defaultNote =
    footerNote ||
    `Ek ders kontrol amaçlı puantaj sunulmuştur (kaynak: ${BORDRO_FORMAT_LABELS[table.format]}). Hata olması durumunda${schoolName ? ' ' + schoolName + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz. MEBBİS onayı ile KBS saatleri aynı olmalıdır.`;

  const teachers: BordroTeacher[] = [...groups].map(([key, g]) => {
    const name = g.name || key;
    const body = [
      '📋 MEBBİS Puantaj',
      '',
      `Sayın ${toTitleCase(name)},`,
      '',
      g.tc ? `• T.C. Kimlik No: ${maskTc(g.tc)}` : '',
      g.unvan ? `• Ünvan: ${g.unvan}` : '',
      g.brans ? `• Branş: ${g.brans}` : '',
      `• Dönem: ${donemLabel}`,
      g.totalHours > 0 ? `• Toplam saat: ${formatHours(g.totalHours)} saat` : '',
      ...veriTipBlock(g.veriTipLines),
      '',
      ...buildFooter(defaultNote, schoolName),
    ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));

    return { name, tc: g.tc, phone: g.phone, messageText: body.join('\n').trim(), rawRows: g.rawRows };
  });

  return { teachers, excelFormat: table.format, excelFormatLabel: BORDRO_FORMAT_LABELS[table.format] };
}

// ── KBS Ek Ders Bordro ───────────────────────────────────────────────────────

export function parseEkDersBordro(
  buf: Buffer,
  donemLabel: string,
  schoolName = '',
  footerNote = '',
): BordroParseResult {
  const table = readBordroTable(buf, 'ek_bordro');
  const groups = aggregateBordroRows(table);
  const defaultNote =
    footerNote ||
    `Ek ders bordro detayları sunulmuştur (kaynak: ${BORDRO_FORMAT_LABELS[table.format]}). Hata olması durumunda${schoolName ? ' ' + schoolName + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`;

  const teachers: BordroTeacher[] = [...groups].map(([key, g]) => {
    const name = g.name || key;
    const netStr = g.netSum > 0 ? formatMoney(g.netSum) : '';
    const brutStr = g.brutSum > 0 ? formatMoney(g.brutSum) : '';
    const kesStr = g.kesintiSum > 0 ? formatMoney(g.kesintiSum) : '';

    const body = [
      '📋 Ek ders bordrosu',
      '',
      `Sayın ${toTitleCase(name)},`,
      '',
      g.tc ? `• T.C. Kimlik No: ${maskTc(g.tc)}` : '',
      '• Bordro türü: Ek ders (KBS)',
      g.unvan ? `• Ünvan: ${g.unvan}` : '',
      `• Dönem: ${donemLabel}`,
      g.totalHours > 0 ? `• Toplam saat: ${formatHours(g.totalHours)} saat` : '',
      ...veriTipBlock(g.veriTipLines, 6),
      brutStr ? `• Brüt tutar: ${brutStr}` : '',
      kesStr ? `• Kesintiler: ${kesStr}` : '',
      netStr ? `• Net ödenecek tutar: ${netStr}` : '',
      '',
      ...buildFooter(defaultNote, schoolName),
    ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));

    return { name, tc: g.tc, phone: g.phone, messageText: body.join('\n').trim(), rawRows: g.rawRows };
  });

  return { teachers, excelFormat: table.format, excelFormatLabel: BORDRO_FORMAT_LABELS[table.format] };
}

// ── KBS Maaş Bordro ───────────────────────────────────────────────────────────

export function parseMaasBordro(
  buf: Buffer,
  donemLabel: string,
  schoolName = '',
  footerNote = '',
): BordroParseResult {
  const table = readBordroTable(buf, 'maas');
  const groups = aggregateBordroRows(table);
  const defaultNote =
    footerNote ||
    `Maaş bordro detayları sunulmuştur (kaynak: ${BORDRO_FORMAT_LABELS[table.format]}). Hata olması durumunda${schoolName ? ' ' + schoolName + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`;

  const teachers: BordroTeacher[] = [...groups].map(([key, g]) => {
    const name = g.name || key;
    const netStr = g.netSum > 0 ? formatMoney(g.netSum) : '';
    const brutStr = g.brutSum > 0 ? formatMoney(g.brutSum) : '';
    const kesStr = g.kesintiSum > 0 ? formatMoney(g.kesintiSum) : '';

    const body = [
      '📋 Maaş bordrosu',
      '',
      `Sayın ${toTitleCase(name)},`,
      '',
      g.tc ? `• T.C. Kimlik No: ${maskTc(g.tc)}` : '',
      '• Bordro türü: Maaş (KBS)',
      g.unvan ? `• Ünvan: ${g.unvan}` : '',
      `• Dönem: ${donemLabel}`,
      brutStr ? `• Brüt maaş: ${brutStr}` : '',
      kesStr ? `• Kesintiler: ${kesStr}` : '',
      netStr ? `• Net ödenecek tutar: ${netStr}` : '',
      '',
      ...buildFooter(defaultNote, schoolName),
    ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));

    return { name, tc: g.tc, phone: g.phone, messageText: body.join('\n').trim(), rawRows: g.rawRows };
  });

  return { teachers, excelFormat: table.format, excelFormatLabel: BORDRO_FORMAT_LABELS[table.format] };
}
