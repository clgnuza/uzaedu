/**
 * MEB resmi öğretim yılı çalışma takvimi.
 * Kaynak: meb.gov.tr genelgeleri.
 * Bilinen yıllar için deterministik tarih; diğerleri için hesaplama.
 */

import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { YILLIK_PLAN_MAX_WEEK_ORDER } from '../work-calendar/work-calendar.service';

export interface MebTatilBlock {
  week_start: string;
  week_end: string;
  tatil_label: string;
}

export interface MebYearConfig {
  /** 1. dönem ilk gün (Pazartesi) */
  donem1_baslangic: string;
  /** 1. dönem son gün (Cuma) */
  donem1_bitis: string;
  /** 2. dönem ilk gün (Pazartesi) */
  donem2_baslangic: string;
  /** 2. dönem son gün (Cuma) */
  donem2_bitis: string;
  /** Ara tatiller (1. dönem ara, yarıyıl, 2. dönem ara) */
  tatiller: MebTatilBlock[];
  /** Opsiyonel: Başlangıç seminer haftası (1. dönemden önce) */
  seminer_baslangic?: MebTatilBlock;
  /** Opsiyonel: Son seminer haftası (2. dönemden sonra) */
  seminer_son?: MebTatilBlock;
}

/** MEB resmi takvim – bilinen yıllar (meb.gov.tr genelgeleri) */
const MEB_CALENDAR: Record<string, MebYearConfig> = {
  '2024-2025': {
    donem1_baslangic: '2024-09-09',
    donem1_bitis: '2025-01-17',
    donem2_baslangic: '2025-02-03',
    donem2_bitis: '2025-06-20',
    tatiller: [
      { week_start: '2024-11-11', week_end: '2024-11-15', tatil_label: '1. DÖNEM ARA TATİLİ: 11-15 Kasım' },
      { week_start: '2025-01-20', week_end: '2025-01-31', tatil_label: 'YARIYIL TATİLİ: 20-31 Ocak' },
      { week_start: '2025-03-31', week_end: '2025-04-04', tatil_label: '2. DÖNEM ARA TATİLİ: 31 Mart - 4 Nisan' },
    ],
    seminer_baslangic: { week_start: '2024-09-02', week_end: '2024-09-08', tatil_label: 'Seminer Haftası & İlköğretim Uyum Haftası' },
    seminer_son: { week_start: '2025-06-23', week_end: '2025-06-27', tatil_label: 'Eğitim Öğretim Yılı Sonu Seminer Haftası' },
  },
  '2025-2026': {
    donem1_baslangic: '2025-09-08',
    donem1_bitis: '2026-01-16',
    donem2_baslangic: '2026-02-02',
    donem2_bitis: '2026-06-26',
    tatiller: [
      { week_start: '2025-11-10', week_end: '2025-11-14', tatil_label: '1. DÖNEM ARA TATİLİ: 10-14 Kasım' },
      { week_start: '2026-01-19', week_end: '2026-01-30', tatil_label: 'YARIYIL TATİLİ: 19-30 Ocak' },
      { week_start: '2026-03-16', week_end: '2026-03-20', tatil_label: '2. DÖNEM ARA TATİLİ: 16-20 Mart' },
    ],
    seminer_baslangic: { week_start: '2025-09-01', week_end: '2025-09-08', tatil_label: 'Seminer Haftası & İlköğretim Uyum Haftası' },
    seminer_son: { week_start: '2026-06-29', week_end: '2026-07-03', tatil_label: 'Eğitim Öğretim Yılı Sonu Seminer Haftası' },
  },
};

function parseDate(s: string): Date {
  return new Date(s + 'T12:00:00Z');
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pazartesi–Cuma haftası; date Pazartesi olmalı */
export interface WorkCalendarWeek {
  week_order: number;
  week_start: string;
  week_end: string;
  ay: string;
  hafta_label: string;
  is_tatil: boolean;
  tatil_label: string | null;
  sinav_etiketleri: string | null;
}

const AY_ADLARI: Record<number, string> = {
  0: 'OCAK', 1: 'ŞUBAT', 2: 'MART', 3: 'NİSAN', 4: 'MAYIS', 5: 'HAZİRAN',
  8: 'EYLÜL', 9: 'EKİM', 10: 'KASIM', 11: 'ARALIK',
};

function getAy(d: Date): string {
  const m = d.getUTCMonth();
  return AY_ADLARI[m] ?? '—';
}

/**
 * Öğretim yılı için MEB uyumlu 36 haftalık çalışma takvimi üretir.
 * Tatil ve seminer blokları week_order=0 ile ayrı kayıtlar olarak döner.
 */
export function generateMebWorkCalendar(academicYear: string): WorkCalendarWeek[] {
  const config = MEB_CALENDAR[academicYear];
  const [startYearStr, endYearStr] = academicYear.split('-');
  const startYear = parseInt(startYearStr ?? '2024', 10);

  const result: WorkCalendarWeek[] = [];

  if (config) {
    if (config.seminer_baslangic) {
      const s = config.seminer_baslangic;
      result.push({
        week_order: 0,
        week_start: s.week_start,
        week_end: s.week_end,
        ay: getAy(parseDate(s.week_start)),
        hafta_label: s.tatil_label,
        is_tatil: true,
        tatil_label: s.tatil_label,
        sinav_etiketleri: null,
      });
    }

    const d1Start = parseDate(config.donem1_baslangic);
    const d2Start = parseDate(config.donem2_baslangic);
    const d2End = parseDate(config.donem2_bitis);

    let teachingWeekNum = 0;
    let monday = new Date(d1Start);

    for (const tatil of config.tatiller) {
      const tatilStart = parseDate(tatil.week_start);
      const tatilEnd = parseDate(tatil.week_end);
      while (monday < tatilStart) {
        teachingWeekNum++;
        const weekEndDate = addDays(monday, 4);
        const ay = getAy(monday);
        const d1 = monday.getUTCDate();
        const d2 = weekEndDate.getUTCDate();
        const ay2 = getAy(weekEndDate);
        const label = ay === ay2 ? `${d1}-${d2} ${ay}` : `${d1} ${ay} - ${d2} ${ay2}`;
        result.push({
          week_order: teachingWeekNum,
          week_start: toDateStr(monday),
          week_end: toDateStr(weekEndDate),
          ay,
          hafta_label: `${teachingWeekNum}. Hafta: ${label}`,
          is_tatil: false,
          tatil_label: null,
          sinav_etiketleri: null,
        });
        monday = addDays(monday, 7);
      }
      result.push({
        week_order: 0,
        week_start: tatil.week_start,
        week_end: tatil.week_end,
        ay: getAy(tatilStart),
        hafta_label: tatil.tatil_label,
        is_tatil: true,
        tatil_label: tatil.tatil_label,
        sinav_etiketleri: null,
      });
      monday = addDays(tatilEnd, 3);
    }

    while (teachingWeekNum < YILLIK_PLAN_MAX_WEEK_ORDER && monday <= d2End) {
      teachingWeekNum++;
      const weekEndDate = addDays(monday, 4);
      if (weekEndDate > d2End) break;
      const ay = getAy(monday);
      const d1 = monday.getUTCDate();
      const d2 = weekEndDate.getUTCDate();
      const ay2 = getAy(weekEndDate);
      const label = ay === ay2 ? `${d1}-${d2} ${ay}` : `${d1} ${ay} - ${d2} ${ay2}`;
      result.push({
        week_order: teachingWeekNum,
        week_start: toDateStr(monday),
        week_end: toDateStr(weekEndDate),
        ay,
        hafta_label: `${teachingWeekNum}. Hafta: ${label}`,
        is_tatil: false,
        tatil_label: null,
        sinav_etiketleri: teachingWeekNum === 8 ? '1. Dönem 1. Sınav haftası' : null,
      });
      monday = addDays(monday, 7);
    }

    if (config.seminer_son) {
      const s = config.seminer_son;
      result.push({
        week_order: 0,
        week_start: s.week_start,
        week_end: s.week_end,
        ay: getAy(parseDate(s.week_start)),
        hafta_label: s.tatil_label,
        is_tatil: true,
        tatil_label: s.tatil_label,
        sinav_etiketleri: null,
      });
    }
  } else {
    const firstMonday = new Date(Date.UTC(startYear, 8, 1));
    while (firstMonday.getUTCDay() !== 1) {
      firstMonday.setUTCDate(firstMonday.getUTCDate() + 1);
    }
    for (let w = 1; w <= YILLIK_PLAN_MAX_WEEK_ORDER; w++) {
      const d = addDays(firstMonday, (w - 1) * 7);
      const ed = addDays(d, 4);
      const ay = getAy(d);
      result.push({
        week_order: w,
        week_start: toDateStr(d),
        week_end: toDateStr(ed),
        ay,
        hafta_label: `${w}. Hafta`,
        is_tatil: false,
        tatil_label: null,
        sinav_etiketleri: null,
      });
    }
  }

  return result;
}

/**
 * DB takvimi boşken yıllık plan için: sadece öğretim haftaları (week_order ≥ 1), ara tatil satırları (week_order=0) dahil değil.
 */
export function mebTeachingWeeksAsWorkCalendar(academicYear: string): WorkCalendar[] {
  if (!hasMebCalendar(academicYear)) return [];
  const year = academicYear.trim();
  const stamp = new Date();
  return generateMebWorkCalendar(year)
    .filter((w) => w.week_order >= 1 && w.week_order <= 38)
    .map((w) => {
      const e = new WorkCalendar();
      e.id = '00000000-0000-0000-0000-000000000001';
      e.academicYear = year;
      e.weekOrder = w.week_order;
      e.weekStart = w.week_start;
      e.weekEnd = w.week_end;
      e.ay = w.ay;
      e.haftaLabel = w.hafta_label;
      e.isTatil = w.is_tatil;
      e.tatilLabel = w.tatil_label;
      e.sinavEtiketleri = w.sinav_etiketleri;
      e.sortOrder = w.week_order;
      e.createdAt = stamp;
      e.updatedAt = stamp;
      return e;
    });
}

export function hasMebCalendar(academicYear: string): boolean {
  return academicYear in MEB_CALENDAR;
}

/** Hafta sırasına göre ay (MEB takvimi). Takvim boşsa ay hesabı için kullanılır. */
export function getAyForWeek(academicYear: string, weekOrder: number): string {
  const weeks = generateMebWorkCalendar(academicYear);
  const w = weeks.find((x) => x.week_order === weekOrder && x.week_order >= 1);
  return w?.ay ?? '';
}
