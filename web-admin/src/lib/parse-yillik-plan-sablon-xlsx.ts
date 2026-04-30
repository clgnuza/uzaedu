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

/** Örnek şablon (yiillik-plan-sablon.xlsx) sütunları ↔ API / Word (MEB sıra: AY, HAFTA, DERS SAATİ, ÜNİTE, KONU, …) */
export const YILLIK_PLAN_SABLON_COLUMN_HELP: { excel: string; api: string; note: string }[] = [
  { excel: 'AY', api: '—', note: 'Word’de ay alanı çalışma takviminden gelir.' },
  {
    excel: 'HAFTA',
    api: 'week_order',
    note: 'N. Hafta / 6-7. Hafta aralığı; tatil (tarih) satırları veritabanına yazılmaz, yalnız 1–38 öğretim haftaları.',
  },
  { excel: 'DERS SAATİ', api: 'ders_saati', note: 'Word tablosunda haftadan sonra; tatilde 0.' },
  { excel: 'ÜNİTE / TEMA', api: 'unite', note: 'Ders saatinden sonra' },
  { excel: 'KONU (İÇERİK ÇERÇEVESİ)', api: 'konu', note: 'Word → konu' },
  { excel: 'ÖĞRENME ÇIKTILARI', api: 'kazanimlar', note: 'Word tablosunda öğrenme çıktıları / ogrenme_ciktilari' },
  { excel: 'SÜREÇ BİLEŞENLERİ', api: 'surec_bilesenleri', note: 'Word → surec_bilesenleri' },
  { excel: 'ÖLÇME VE DEĞERLENDİRME', api: 'olcme_degerlendirme', note: 'Word → olcme_degerlendirme' },
  { excel: 'SOSYAL - DUYGUSAL …', api: 'sosyal_duygusal', note: 'Word → sosyal_duygusal' },
  { excel: 'DEĞERLER', api: 'degerler', note: 'Word → degerler' },
  { excel: 'OKURYAZARLIK BECERİLERİ', api: 'okuryazarlik_becerileri', note: 'Word → okuryazarlik_becerileri' },
  { excel: 'BELİRLİ GÜN VE HAFTALAR', api: 'belirli_gun_haftalar', note: 'Word → belirli_gun_haftalar' },
  {
    excel: 'FARKLILAŞTIRMA (+ isteğe okul temelli aynı sütun)',
    api: 'zenginlestirme / okul_temelli_planlama',
    note: 'İki ayrı sütun varsa satırda ayrı; tek Excel sütununda aynı metin her iki alana yazılır. Word’de dikey birleşik hücrede tek metin gösterilir (haftalara göre tekrarlanmaz).',
  },
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
  /(TAT[İI]L|YARIYIL|D[ÖO]NEM\s+ARA|D[ÖO]NEM\s+SONU|KARNE|BAYRAM|RESM[İI]\s+TAT[İI]L|ARA\s+TAT[İI]L[İI])/i;

function isHolidayLabel(ay: string, hafta: string): boolean {
  return HOLIDAY_PHRASE_RE.test(`${ay} ${hafta}`);
}

/** "10 - 14 Kasım" / "19 Ocak - 30 Ocak" (N. Hafta yok) — lastWeek+1 ile öğretim haftası sayılmamalı. */
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

function parseWeekLine(ayRaw: unknown, haftaRaw: unknown, lastWeek: number): WeekParse {
  const ay = cell(ayRaw);
  const oneHa = String(haftaRaw ?? '').replace(/\r\n/g, ' ').replace(/\r/g, ' ');
  if (isHolidayLabel(ay, oneHa)) return { kind: 'holiday' };
  if (isTatilRowByDateShape(ay, oneHa)) return { kind: 'holiday' };
  const combined = `${ay} ${oneHa}`.replace(/\s+/g, ' ');

  const rangeDash = combined.match(/(\d+)\s*[-–—]\s*(\d+)\s*\.\s*Hafta/i);
  if (rangeDash) {
    const a = parseInt(rangeDash[1], 10);
    const b = parseInt(rangeDash[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b >= a && b <= 38) {
      const weeks: number[] = [];
      for (let w = a; w <= b; w++) weeks.push(w);
      return { kind: 'weeks', weeks };
    }
  }
  const rangeVe = combined.match(/(\d+)\s*\.\s*ve\s*(\d+)\s*\.\s*Hafta/i);
  if (rangeVe) {
    const a = parseInt(rangeVe[1], 10);
    const b = parseInt(rangeVe[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b >= a && b <= 38) {
      const weeks: number[] = [];
      for (let w = a; w <= b; w++) weeks.push(w);
      return { kind: 'weeks', weeks };
    }
  }
  const fromH = parseWeekOrderFromHaftaCell(haftaRaw) ?? parseWeekOrderFromHaftaCell(ayRaw);
  if (fromH != null) {
    if (fromH < 1 || fromH > 38) return { kind: 'unknown' };
    return { kind: 'weeks', weeks: [fromH] };
  }
  if (lastWeek > 0 && lastWeek < 38) return { kind: 'weeks', weeks: [lastWeek + 1] };
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
): unknown {
  const hasRaw = String(raw ?? '').trim().length > 0;
  if (hasRaw) return raw;
  const merges = (sh['!merges'] ?? []) as XLSX.Range[];
  for (const m of merges) {
    if (row < m.s.r || row > m.e.r || col < m.s.c || col > m.e.c) continue;
    const addr = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
    return sh[addr]?.v ?? raw;
  }
  return raw;
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
    ay: find((s) => s === 'AY' || /^AY(\s|\/)/.test(s), 0),
    hafta: find(
      (s) => s.includes('HAFTA') && !s.includes('BELİRLİ') && !s.includes('BELIRLI') && !s.includes('BELIRLI GUN'),
      1,
    ),
    ders_saati: find((s) => s.includes('DERS') && (s.includes('SAAT') || s.includes('SAATİ')), 2),
    unite: find((s) => s.includes('ÜNİTE') || s.includes('UNITE') || (s.includes('TEMA') && s.length < 32), 3),
    konu: find(
      (s) => s.includes('KONU') || s.includes('İÇERİK') || s.includes('ICERIK') || s.includes('ÇERÇEVE') || s.includes('CERCEVE'),
      4,
    ),
    kazanimlar: find(
      (s) => s.includes('ÖĞRENME') || s.includes('OGRENME') || s.includes('ÇIKTI') || s.includes('CIKTI'),
      5,
    ),
    surec_bilesenleri: find((s) => s.includes('SÜREÇ') || s.includes('SUREC'), 6),
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

function dersSaatiCell(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 2;
}

/** “yiillik-plan-sablon” düzeni: 1. satır başlık birleşik, 2. satır sütun adları, veri 3. satırdan. */
export function parseYillikPlanSablonXlsx(buf: ArrayBuffer): { items: BilsemPlanWeekItem[] } {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.includes('Sayfa1') ? 'Sayfa1' : wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel dosyasında sayfa yok.');
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' }) as unknown[][];

  let headerRow = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;
    const h1 = String(r[1] ?? '').toUpperCase();
    const h3 = String(r[3] ?? '').toUpperCase();
    if (h1.includes('HAFT') && (h3.includes('ÜNİTE') || h3.includes('UNITE') || h3.includes('TEMA'))) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error(
      'Bu Excel Bilsem yıllık plan şablonu gibi görünmüyor (HAFTA ve ÜNİTE/TEMA başlıkları bulunamadı). Örnek şablonu indirip düzenleyin.',
    );
  }

  const hrow = rows[headerRow] as unknown[];
  const C = resolveColMap(hrow);
  const minLen = Math.max(8, C.zenginlestirme, C.okul_temelli >= 0 ? C.okul_temelli : 0) + 1;
  const items: BilsemPlanWeekItem[] = [];
  let lastWeek = 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < minLen) continue;
    const ay = cell(mergedValueAt(sh, i, C.ay, r[C.ay]));
    const ha = cell(mergedValueAt(sh, i, C.hafta, r[C.hafta]));
    const hasBody =
      isHolidayLabel(ay, ha) ||
      !!ha ||
      !!nullIfEmpty(cell(mergedValueAt(sh, i, C.unite, r[C.unite]))) ||
      !!nullIfEmpty(cell(mergedValueAt(sh, i, C.konu, r[C.konu]))) ||
      !!nullIfEmpty(cell(mergedValueAt(sh, i, C.kazanimlar, r[C.kazanimlar]))) ||
      !!nullIfEmpty(cell(mergedValueAt(sh, i, C.surec_bilesenleri, r[C.surec_bilesenleri])));
    if (!hasBody) continue;

    const wp = parseWeekLine(
      mergedValueAt(sh, i, C.ay, r[C.ay]),
      mergedValueAt(sh, i, C.hafta, r[C.hafta]),
      lastWeek,
    );
    if (wp.kind === 'unknown') continue;

    if (wp.kind === 'holiday') {
      continue;
    }

    const rr = [...r];
    rr[C.zenginlestirme] = mergedValueAt(sh, i, C.zenginlestirme, r[C.zenginlestirme]);
    if (C.okul_temelli >= 0) {
      rr[C.okul_temelli] = mergedValueAt(sh, i, C.okul_temelli, r[C.okul_temelli]);
    }
    const fo = pairFarkOkul(rr, C);

    for (const weekOrder of wp.weeks) {
      if (weekOrder < 1 || weekOrder > 38) continue;
      items.push({
        week_order: weekOrder,
        unite: nullIfEmpty(cell(mergedValueAt(sh, i, C.unite, r[C.unite]))),
        konu: nullIfEmpty(cell(mergedValueAt(sh, i, C.konu, r[C.konu]))),
        kazanimlar: nullIfEmpty(cell(mergedValueAt(sh, i, C.kazanimlar, r[C.kazanimlar]))),
        ders_saati: dersSaatiCell(mergedValueAt(sh, i, C.ders_saati, r[C.ders_saati])),
        belirli_gun_haftalar: nullIfEmpty(
          cell(mergedValueAt(sh, i, C.belirli_gun_haftalar, r[C.belirli_gun_haftalar])),
        ),
        surec_bilesenleri: nullIfEmpty(
          cell(mergedValueAt(sh, i, C.surec_bilesenleri, r[C.surec_bilesenleri])),
        ),
        olcme_degerlendirme: nullIfEmpty(
          cell(mergedValueAt(sh, i, C.olcme_degerlendirme, r[C.olcme_degerlendirme])),
        ),
        sosyal_duygusal: nullIfEmpty(
          cell(mergedValueAt(sh, i, C.sosyal_duygusal, r[C.sosyal_duygusal])),
        ),
        degerler: nullIfEmpty(cell(mergedValueAt(sh, i, C.degerler, r[C.degerler]))),
        okuryazarlik_becerileri: nullIfEmpty(
          cell(mergedValueAt(sh, i, C.okuryazarlik_becerileri, r[C.okuryazarlik_becerileri])),
        ),
        zenginlestirme: fo.zenginlestirme,
        okul_temelli_planlama: fo.okul_temelli_planlama,
      });
      lastWeek = weekOrder;
    }
  }

  if (!items.length) {
    throw new Error('Geçerli hafta satırı çıkarılamadı. HAFTA sütununda “1. Hafta:” biçimini kullanın.');
  }
  if (!items.some((x) => x.week_order >= 1)) {
    throw new Error('Yalnızca tatil satırları algılandı. Öğretim haftaları için “N. Hafta:” veya AY+HAFTA sütunlarını doldurun.');
  }
  return { items };
}
