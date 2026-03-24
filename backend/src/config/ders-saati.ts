/**
 * MEB haftalık ders saati – ders/sınıf bazlı.
 * Kaynak: TTKB haftalık ders çizelgeleri (ttkb.meb.gov.tr).
 * subject_code: base code (turkce, matematik, cografya vb.; _maarif son eki çıkarılır).
 */
export type DersSaatiEntry = { gradeMin: number; gradeMax: number; saat: number };

const DERS_SAATI_MAP: Record<string, DersSaatiEntry[]> = {
  turkce: [
    { gradeMin: 1, gradeMax: 4, saat: 10 },
    { gradeMin: 5, gradeMax: 8, saat: 6 },
  ],
  turk_dili_edebiyati: [{ gradeMin: 9, gradeMax: 12, saat: 5 }],
  matematik: [
    { gradeMin: 1, gradeMax: 4, saat: 5 },
    { gradeMin: 5, gradeMax: 8, saat: 5 },
    { gradeMin: 9, gradeMax: 12, saat: 6 },
  ],
  hayat_bilgisi: [{ gradeMin: 1, gradeMax: 3, saat: 4 }],
  fen_bilimleri: [
    { gradeMin: 4, gradeMax: 4, saat: 3 },
    { gradeMin: 5, gradeMax: 8, saat: 4 },
    { gradeMin: 9, gradeMax: 12, saat: 4 },
  ],
  sosyal_bilgiler: [
    { gradeMin: 4, gradeMax: 4, saat: 3 },
    { gradeMin: 5, gradeMax: 8, saat: 3 },
  ],
  ingilizce: [
    { gradeMin: 2, gradeMax: 4, saat: 2 },
    { gradeMin: 5, gradeMax: 8, saat: 4 },
    { gradeMin: 9, gradeMax: 12, saat: 4 },
  ],
  din_kulturu: [
    { gradeMin: 4, gradeMax: 8, saat: 2 },
    { gradeMin: 9, gradeMax: 12, saat: 1 },
  ],
  muzik: [{ gradeMin: 1, gradeMax: 12, saat: 2 }],
  gorsel_sanatlar: [{ gradeMin: 1, gradeMax: 12, saat: 2 }],
  beden_egitimi_oyun: [{ gradeMin: 1, gradeMax: 4, saat: 2 }],
  beden_egitimi: [{ gradeMin: 5, gradeMax: 12, saat: 2 }],
  cografya: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
  tarih: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
  fizik: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
  kimya: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
  biyoloji: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
  felsefe: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
  tc_inkilap: [{ gradeMin: 8, gradeMax: 8, saat: 2 }],
  bil_tek_yazilim: [{ gradeMin: 5, gradeMax: 8, saat: 2 }],
  bilgisayar_bilimi: [{ gradeMin: 9, gradeMax: 12, saat: 2 }],
};

/** Statik config'ten ders saati (AppConfig yoksa fallback). */
export function getDersSaatiStatic(subjectCode: string, grade: number): number {
  const base = (subjectCode ?? '')
    .toLowerCase()
    .trim()
    .replace(/_maarif(_[a-z]+)?$/, '')
    .replace(/_maarif$/, '');
  const entries = DERS_SAATI_MAP[base];
  if (!entries?.length) return 2;
  const e = entries.find((x) => grade >= x.gradeMin && grade <= x.gradeMax);
  return e?.saat ?? 2;
}

/** subject_code + grade için MEB haftalık ders saati. Statik config (AppConfig'ten önce kullanılmak üzere export). */
export function getDersSaati(subjectCode: string, grade: number): number {
  return getDersSaatiStatic(subjectCode, grade);
}
