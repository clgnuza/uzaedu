/**
 * Mesaj modülü Excel parsers.
 * Her parser verilen Buffer'dan alıcı listesi çıkarır.
 * Dönen format: ParsedRecipient[]
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');

export type ParsedRecipient = {
  recipientName: string;
  phone: string;
  studentName?: string;
  studentNumber?: string;
  className?: string;
  messageText: string;
  sortOrder?: number;
};

type XlRow = Record<string, unknown>;

function normalizePhone(raw: unknown): string {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '90' + p.slice(1);
  if (p.length === 10) p = '90' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

function xlSheet(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<XlRow>(sheet, { defval: '' });
  const headers = Object.keys(rows[0] ?? {});
  return { rows, headers };
}

function findCol(headers: string[], ...patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const h = headers.find((h) => pat.test(h));
    if (h) return h;
  }
  return null;
}

/**
 * Toplu mesaj — serbest format:
 * Zorunlu sütunlar: Adı Soyadı | Telefon
 * İsteğe bağlı: Mesaj
 */
export function parseTopluMesaj(buffer: Buffer, customMessage: string): ParsedRecipient[] {
  const { rows, headers } = xlSheet(buffer);
  const nameCol  = findCol(headers, /ad.*soyad|isim|name/i, /^ad$/i);
  const phoneCol = findCol(headers, /telefon|gsm|whatsapp|cep|mobil|phone/i);

  return rows.map((r, i) => {
    const name  = String(r[nameCol ?? headers[0]] ?? '').trim();
    const phone = normalizePhone(r[phoneCol ?? headers[1]]);
    const msg   = String(r['Mesaj'] ?? r['mesaj'] ?? '').trim() || customMessage.replace('{AD}', name);
    return { recipientName: name, phone, messageText: msg, sortOrder: i };
  }).filter((r) => r.recipientName && r.phone);
}

/**
 * Ek Ders — KBS/MEBBİS Excel:
 * Beklenen: Adı Soyadı | Telefon | Branş | Ek Ders Saati | Tutar
 */
export function parseEkDers(buffer: Buffer, template: string): ParsedRecipient[] {
  const { rows, headers } = xlSheet(buffer);
  const nameCol   = findCol(headers, /ad.*soyad|öğretmen.*ad|name/i);
  const phoneCol  = findCol(headers, /telefon|gsm|whatsapp|cep|phone/i);
  const bransCol  = findCol(headers, /branş|brans|ders|subject/i);
  const saatCol   = findCol(headers, /saat|ders.*say|hour/i);
  const tutarCol  = findCol(headers, /tutar|ücret|para|amount|tl/i);

  return rows.map((r, i) => {
    const name  = String(r[nameCol ?? headers[0]] ?? '').trim();
    const phone = normalizePhone(r[phoneCol ?? headers[1]]);
    const brans = String(r[bransCol ?? ''] ?? '').trim();
    const saat  = String(r[saatCol ?? ''] ?? '').trim();
    const tutar = String(r[tutarCol ?? ''] ?? '').trim();
    const msg   = template
      .replace('{AD}', name)
      .replace('{BRANS}', brans)
      .replace('{SAAT}', saat)
      .replace('{TUTAR}', tutar);
    return { recipientName: name, phone, messageText: msg, sortOrder: i };
  }).filter((r) => r.recipientName && r.phone);
}

/**
 * Maaş — KBS Excel:
 * Beklenen: Adı Soyadı | Telefon | Brüt Maaş | Net Maaş | Ay
 */
export function parseMaas(buffer: Buffer, template: string): ParsedRecipient[] {
  const { rows, headers } = xlSheet(buffer);
  const nameCol  = findCol(headers, /ad.*soyad|personel.*ad|name/i);
  const phoneCol = findCol(headers, /telefon|gsm|whatsapp|cep|phone/i);
  const brutCol  = findCol(headers, /brüt|brut|gross/i);
  const netCol   = findCol(headers, /net.*maaş|net/i);
  const ayCol    = findCol(headers, /ay|dönem|month/i);

  return rows.map((r, i) => {
    const name  = String(r[nameCol ?? headers[0]] ?? '').trim();
    const phone = normalizePhone(r[phoneCol ?? headers[1]]);
    const brut  = String(r[brutCol ?? ''] ?? '').trim();
    const net   = String(r[netCol ?? ''] ?? '').trim();
    const ay    = String(r[ayCol ?? ''] ?? '').trim();
    const msg   = template
      .replace('{AD}', name)
      .replace('{BRUT}', brut)
      .replace('{NET}', net)
      .replace('{AY}', ay);
    return { recipientName: name, phone, messageText: msg, sortOrder: i };
  }).filter((r) => r.recipientName && r.phone);
}

/**
 * Günlük Devamsızlık — E-Okul Excel:
 * Beklenen: Öğrenci Adı | Okul No | Sınıf | Veli Adı | Veli Telefon | Devamsızlık Türü | Gün Sayısı
 * Değişkenler: {AD} {OGRENCI} {SINIF} {TARIH} {TUR} {GUN} {OKUL}
 */
export function parseDevamsizlik(buffer: Buffer, template: string, tarih: string): ParsedRecipient[] {
  const { rows, headers } = xlSheet(buffer);
  const stuNameCol  = findCol(headers, /öğrenci.*ad|ad.*soyad|isim|name/i);
  const stuNoCol    = findCol(headers, /okul.*no|numara|no$/i);
  const classCol    = findCol(headers, /sınıf|sinif|class/i);
  const parentCol   = findCol(headers, /veli.*ad|anne|baba|parent/i);
  const phoneCol    = findCol(headers, /telefon|gsm|whatsapp|cep|veli.*tel|phone/i);
  const typeCol     = findCol(headers, /devamsızlık.*tür|mazeret.*tür|tür|type|mazeret/i);
  const gunCol      = findCol(headers, /gün.*say|devamsızlık.*gün|gün|day|adet/i);

  return rows.map((r, i) => {
    const stuName = String(r[stuNameCol ?? headers[0]] ?? '').trim();
    const stuNo   = String(r[stuNoCol ?? ''] ?? '').trim();
    const cls     = String(r[classCol ?? ''] ?? '').trim();
    const parent  = String(r[parentCol ?? ''] ?? '').trim();
    const phone   = normalizePhone(r[phoneCol ?? headers[3]]);
    const type    = String(r[typeCol ?? ''] ?? '').trim() || 'Özürsüz';
    const gun     = gunCol ? String(r[gunCol] ?? '').trim() : '';
    const msg     = template
      .replace('{AD}', parent || stuName + ' Velisi')
      .replace('{OGRENCI}', stuName)
      .replace('{SINIF}', cls)
      .replace('{TARIH}', tarih)
      .replace('{TUR}', type)
      .replace('{GUN}', gun || '1 gün');
    return {
      recipientName: parent || stuName + ' Velisi',
      phone,
      studentName: stuName,
      studentNumber: stuNo,
      className: cls,
      messageText: msg,
      sortOrder: i,
    };
  }).filter((r) => r.studentName && r.phone);
}

/**
 * Ders Bazlı Devamsızlık — E-öğretmen Excel:
 * Beklenen: Öğrenci | Sınıf | Ders | Tarih/Saat | Veli Adı | Veli Telefon
 * Her öğrenci için birden fazla satır olabilir (farklı dersler).
 * Aynı veliye tek mesajda tüm dersleri toplu göndermek için gruplama yapar.
 */
export function parseDersDevamsizlik(buffer: Buffer, template: string, tarih: string): ParsedRecipient[] {
  const { rows, headers } = xlSheet(buffer);
  const stuNameCol = findCol(headers, /öğrenci.*ad|ad.*soyad|isim|name/i);
  const classCol   = findCol(headers, /sınıf|sinif|class/i);
  const lessonCol  = findCol(headers, /ders|lesson|subject|branş/i);
  const periodCol  = findCol(headers, /saat|ders.*saat|dönem|periyot|zaman|period/i);
  const parentCol  = findCol(headers, /veli.*ad|anne|baba|parent/i);
  const phoneCol   = findCol(headers, /telefon|gsm|whatsapp|cep|veli.*tel|phone/i);
  const dateCol    = findCol(headers, /tarih|date/i);

  // Aynı öğrenciye ait satırları gruplama (telefon bazında)
  const grouped = new Map<string, {
    stuName: string; cls: string; parent: string; phone: string;
    dersler: Array<{ ders: string; period: string; date: string }>;
  }>();

  for (const r of rows) {
    const stuName = String(r[stuNameCol ?? headers[0]] ?? '').trim();
    const phone   = normalizePhone(r[phoneCol ?? headers[5]]);
    if (!stuName || !phone) continue;

    const cls    = String(r[classCol ?? ''] ?? '').trim();
    const ders   = String(r[lessonCol ?? ''] ?? '').trim() || 'Belirtilmemiş';
    const period = String(r[periodCol ?? ''] ?? '').trim();
    const parent = String(r[parentCol ?? ''] ?? '').trim();
    const dt     = String(r[dateCol ?? ''] ?? tarih).trim();

    const key = phone;
    if (!grouped.has(key)) {
      grouped.set(key, { stuName, cls, parent, phone, dersler: [] });
    }
    grouped.get(key)!.dersler.push({ ders, period, date: dt || tarih });
  }

  const result: ParsedRecipient[] = [];
  let i = 0;
  for (const [, g] of grouped) {
    // [1.Ders, 2.Ders, 3.Ders] formatı (örnekteki gibi)
    const dersListInline = g.dersler.map((d) => d.period ? d.period + '.Ders' : d.ders).join(', ');
    const dersListFull   = g.dersler.map((d) => `• ${d.ders}${d.period ? ' (' + d.period + '. saat)' : ''}`).join('\n');
    const msg = template
      .replace('{AD}', g.parent || g.stuName + ' Velisi')
      .replace('{OGRENCI}', g.stuName)
      .replace('{SINIF}', g.cls)
      .replace('{TARIH}', tarih)
      .replace('{DERSLER_INLINE}', `[${dersListInline}]`)
      .replace('{DERSLER}', dersListFull);
    result.push({
      recipientName: g.parent || g.stuName + ' Velisi',
      phone: g.phone,
      studentName: g.stuName,
      className: g.cls,
      messageText: msg,
      sortOrder: i++,
    });
  }
  return result;
}

/**
 * Evci / Çarşı İzin — E-Okul Excel:
 * Beklenen: Öğrenci Adı | No | Sınıf | Veli Ad | Veli Telefon | İzin Türü | Çıkış Tarih | Dönüş Tarih
 * Değişkenler: {AD} {OGRENCI} {SINIF} {TUR} {TARIH} {CIKIS} {DONUS} {OKUL}
 */
export function parseIzin(buffer: Buffer, template: string, tarih: string): ParsedRecipient[] {
  const { rows, headers } = xlSheet(buffer);
  const stuNameCol = findCol(headers, /öğrenci.*ad|ad.*soyad|isim|name/i);
  const stuNoCol   = findCol(headers, /okul.*no|numara|no$/i);
  const classCol   = findCol(headers, /sınıf|sinif|class/i);
  const parentCol  = findCol(headers, /veli.*ad|anne|baba|parent/i);
  const phoneCol   = findCol(headers, /telefon|gsm|whatsapp|cep|veli.*tel|phone/i);
  const typeCol    = findCol(headers, /tür|type|izin.*tür/i);
  const cikisCol   = findCol(headers, /çıkış.*tarih|izin.*başl|başlangıç|cikis/i);
  const donusCol   = findCol(headers, /dönüş.*tarih|pansiyon.*dönüş|bitiş|donus/i);
  const dateCol    = cikisCol ?? findCol(headers, /tarih|date/i);

  return rows.map((r, i) => {
    const stuName = String(r[stuNameCol ?? headers[0]] ?? '').trim();
    const stuNo   = String(r[stuNoCol ?? ''] ?? '').trim();
    const cls     = String(r[classCol ?? ''] ?? '').trim();
    const parent  = parentCol ? String(r[parentCol] ?? '').trim() : '';
    const phone   = normalizePhone(r[phoneCol ?? headers[3]]);
    const type    = String(r[typeCol ?? ''] ?? 'Evci İzni').trim();
    const cikis   = cikisCol ? String(r[cikisCol] ?? '').trim() : (dateCol ? String(r[dateCol] ?? tarih).trim() : tarih);
    const donus   = donusCol ? String(r[donusCol] ?? '').trim() : '';
    const msg     = template
      .replace('{AD}', parent || stuName + ' Velisi')
      .replace('{OGRENCI}', stuName)
      .replace('{SINIF}', cls)
      .replace('{TARIH}', cikis || tarih)
      .replace('{CIKIS}', cikis || tarih)
      .replace('{DONUS}', donus || '-')
      .replace('{TUR}', type);
    return {
      recipientName: parent || stuName + ' Velisi',
      phone,
      studentName: stuName,
      studentNumber: stuNo,
      className: cls,
      messageText: msg,
      sortOrder: i,
    };
  }).filter((r) => r.studentName && r.phone);
}
