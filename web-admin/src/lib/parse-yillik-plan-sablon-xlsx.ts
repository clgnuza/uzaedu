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

/** Örnek şablon (yiillik-plan-sablon.xlsx) sütunları ↔ API / Word satırı */
export const YILLIK_PLAN_SABLON_COLUMN_HELP: { excel: string; api: string; note: string }[] = [
  { excel: 'AY', api: '—', note: 'Word’de ay alanı çalışma takviminden gelir.' },
  { excel: 'HAFTA', api: 'week_order', note: '“N. Hafta:” ifadesinden hafta numarası okunur (1–38).' },
  { excel: 'DERS SAATİ', api: 'ders_saati', note: 'Haftalık saat; tatilde 0.' },
  { excel: 'ÜNİTE / TEMA', api: 'unite', note: 'Word → unite' },
  { excel: 'KONU (İÇERİK ÇERÇEVESİ)', api: 'konu', note: 'Word → konu' },
  { excel: 'ÖĞRENME ÇIKTILARI', api: 'kazanimlar', note: 'Word tablosunda öğrenme çıktıları / ogrenme_ciktilari' },
  { excel: 'SÜREÇ BİLEŞENLERİ', api: 'surec_bilesenleri', note: 'Word → surec_bilesenleri' },
  { excel: 'ÖLÇME VE DEĞERLENDİRME', api: 'olcme_degerlendirme', note: 'Word → olcme_degerlendirme' },
  { excel: 'SOSYAL - DUYGUSAL …', api: 'sosyal_duygusal', note: 'Word → sosyal_duygusal' },
  { excel: 'DEĞERLER', api: 'degerler', note: 'Word → degerler' },
  { excel: 'OKURYAZARLIK BECERİLERİ', api: 'okuryazarlik_becerileri', note: 'Word → okuryazarlik_becerileri' },
  { excel: 'BELİRLİ GÜN VE HAFTALAR', api: 'belirli_gun_haftalar', note: 'Word → belirli_gun_haftalar' },
  { excel: 'FARKLILAŞTIRMA', api: 'zenginlestirme', note: 'Word → zenginlestirme' },
  { excel: 'OKUL TEMELLİ PLANLAMA', api: 'okul_temelli_planlama', note: 'Word → okul_temelli_planlama' },
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

  const C = {
    hafta: 1,
    ders_saati: 2,
    unite: 3,
    konu: 4,
    kazanimlar: 5,
    surec_bilesenleri: 6,
    olcme_degerlendirme: 7,
    sosyal_duygusal: 8,
    degerler: 9,
    okuryazarlik_becerileri: 10,
    belirli_gun_haftalar: 11,
    zenginlestirme: 12,
    okul_temelli_planlama: 13,
  };

  const byWeek = new Map<number, BilsemPlanWeekItem>();
  let lastWeek = 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 8) continue;
    const ha = cell(r[C.hafta]);
    const hasBody =
      !!ha ||
      !!nullIfEmpty(cell(r[C.unite])) ||
      !!nullIfEmpty(cell(r[C.konu])) ||
      !!nullIfEmpty(cell(r[C.kazanimlar])) ||
      !!nullIfEmpty(cell(r[C.surec_bilesenleri]));
    if (!hasBody) continue;

    let weekOrder = parseWeekOrderFromHaftaCell(r[C.hafta]);
    if (weekOrder == null) {
      if (lastWeek > 0 && lastWeek < 38) weekOrder = lastWeek + 1;
      else continue;
    }
    if (weekOrder < 1 || weekOrder > 38) continue;

    const item: BilsemPlanWeekItem = {
      week_order: weekOrder,
      unite: nullIfEmpty(cell(r[C.unite])),
      konu: nullIfEmpty(cell(r[C.konu])),
      kazanimlar: nullIfEmpty(cell(r[C.kazanimlar])),
      ders_saati: dersSaatiCell(r[C.ders_saati]),
      belirli_gun_haftalar: nullIfEmpty(cell(r[C.belirli_gun_haftalar])),
      surec_bilesenleri: nullIfEmpty(cell(r[C.surec_bilesenleri])),
      olcme_degerlendirme: nullIfEmpty(cell(r[C.olcme_degerlendirme])),
      sosyal_duygusal: nullIfEmpty(cell(r[C.sosyal_duygusal])),
      degerler: nullIfEmpty(cell(r[C.degerler])),
      okuryazarlik_becerileri: nullIfEmpty(cell(r[C.okuryazarlik_becerileri])),
      zenginlestirme: nullIfEmpty(cell(r[C.zenginlestirme])),
      okul_temelli_planlama: nullIfEmpty(cell(r[C.okul_temelli_planlama])),
    };
    byWeek.set(weekOrder, item);
    lastWeek = weekOrder;
  }

  const items = [...byWeek.values()].sort((a, b) => a.week_order - b.week_order);
  if (!items.length) {
    throw new Error('Geçerli hafta satırı çıkarılamadı. HAFTA sütununda “1. Hafta:” biçimini kullanın.');
  }
  return { items };
}
