/** Akademik takvim hafta etiketi — 0. hafta / tatil / seminer ayrımı */

export type AcademicWeekKind = 'seminer' | 'ara_tatil' | 'yariyil' | 'ogretim' | 'ozel';

type WeekLabelInput = {
  weekNumber: number;
  weekOrder?: number;
  title?: string | null;
  isTatil?: boolean;
  dateStart?: string | null;
  dateEnd?: string | null;
};

export function isNonTeachingWeek(week: WeekLabelInput): boolean {
  const order = week.weekOrder ?? week.weekNumber;
  return Boolean(week.isTatil || order === 0);
}

export function getAcademicWeekKind(week: WeekLabelInput): AcademicWeekKind {
  if (!isNonTeachingWeek(week)) return 'ogretim';
  const t = (week.title ?? '').toLocaleLowerCase('tr-TR');
  if (t.includes('seminer') || t.includes('uyum')) return 'seminer';
  if (t.includes('ara tatil')) return 'ara_tatil';
  if (t.includes('yarıyıl') || t.includes('yariyil')) return 'yariyil';
  return 'ozel';
}

const KIND_LABEL: Record<AcademicWeekKind, string> = {
  seminer: 'Seminer',
  ara_tatil: 'Ara tatil',
  yariyil: 'Yarıyıl tatili',
  ogretim: 'Öğretim haftası',
  ozel: 'Özel hafta',
};

export function getAcademicWeekKindLabel(week: WeekLabelInput): string {
  return KIND_LABEL[getAcademicWeekKind(week)];
}

/** Takvimde görünen ana başlık */
export function formatAcademicWeekHeading(week: WeekLabelInput): string {
  const title = week.title?.trim();
  if (isNonTeachingWeek(week)) {
    if (title) return title;
    return getAcademicWeekKindLabel(week);
  }
  const n = week.weekOrder && week.weekOrder > 0 ? week.weekOrder : week.weekNumber;
  if (title && !title.toLowerCase().includes(`${n}. hafta`)) {
    return title;
  }
  return `${n}. Hafta`;
}

/** Kısa etiket (şerit, seçici) */
export function formatAcademicWeekShort(week: WeekLabelInput): string {
  if (isNonTeachingWeek(week)) {
    const title = week.title?.trim();
    if (title) {
      const short = title.length > 28 ? `${title.slice(0, 26)}…` : title;
      return short;
    }
    return getAcademicWeekKindLabel(week);
  }
  const n = week.weekOrder && week.weekOrder > 0 ? week.weekOrder : week.weekNumber;
  return `${n}. hafta`;
}

export function findWeekIndexForDate(
  weeks: Array<{ dateStart?: string | null; dateEnd?: string | null }>,
  date: Date = new Date(),
): number {
  const t = date.getTime();
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    if (!w.dateStart || !w.dateEnd) continue;
    const start = new Date(`${w.dateStart}T00:00:00`).getTime();
    const end = new Date(`${w.dateEnd}T23:59:59`).getTime();
    if (t >= start && t <= end) return i;
  }
  return -1;
}

export function getCurrentWeekIndex(
  weeks: Array<{ dateStart?: string | null; dateEnd?: string | null }>,
): number {
  return findWeekIndexForDate(weeks, new Date());
}

export function isDateInAcademicWeek(
  week: { dateStart?: string | null; dateEnd?: string | null },
  date: Date = new Date(),
): boolean {
  if (!week.dateStart || !week.dateEnd) return false;
  const t = date.getTime();
  const start = new Date(`${week.dateStart}T00:00:00`).getTime();
  const end = new Date(`${week.dateEnd}T23:59:59`).getTime();
  return t >= start && t <= end;
}
