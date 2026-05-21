export type TvLessonTimeSlot = { num: number; start: string; end: string };

/** TV JSON ders saati (start/end veya start_time/end_time). */
export function normalizeTvLessonSlots(raw: unknown[] | undefined): TvLessonTimeSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: TvLessonTimeSlot[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const num = Number(o.num ?? o.lesson_num);
    const start = String(o.start ?? o.start_time ?? '').trim();
    const end = String(o.end ?? o.end_time ?? '').trim();
    if (Number.isFinite(num) && num >= 1 && start && end) out.push({ num, start, end });
  }
  return out;
}

export function parseTvClockToMinutes(s: string): number {
  const [h, m] = String(s).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** JS getDay() → 1=Pzt … 7=Paz */
export function tvTurkishDowFromDate(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Şu anki dakikada devam eden ders numaraları (bitiş hariç — akıllı tahta ile uyumlu). */
export function getActiveLessonNumsAt(
  slotList: TvLessonTimeSlot[] | undefined,
  nowMins: number,
): number[] {
  if (!slotList?.length) return [];
  const nums: number[] = [];
  for (const lt of slotList) {
    const start = parseTvClockToMinutes(lt.start);
    const end = parseTvClockToMinutes(lt.end);
    if (nowMins >= start && nowMins < end) nums.push(lt.num);
  }
  return nums;
}

const TV_LUNCH_GAP_MIN_MINUTES = 25;

/** Aktif ders yokken alt şerit metni (teneffüs / öğle / okul dışı). */
export function getTvNowInClassIdleMessage(
  slotList: TvLessonTimeSlot[] | undefined,
  nowMins: number,
): string {
  if (!slotList?.length) return 'Şu an ders yok';
  if (getActiveLessonNumsAt(slotList, nowMins).length > 0) return '';

  const sorted = [...slotList].sort(
    (a, b) => parseTvClockToMinutes(a.start) - parseTvClockToMinutes(b.start),
  );
  const firstStart = parseTvClockToMinutes(sorted[0].start);
  const lastEnd = parseTvClockToMinutes(sorted[sorted.length - 1].end);

  if (nowMins < firstStart) {
    return `Dersler ${sorted[0].start}’da başlıyor`;
  }
  if (nowMins >= lastEnd) {
    return 'Okul saati bitti';
  }

  let lunchGap: { start: number; end: number; span: number } | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = parseTvClockToMinutes(sorted[i].end);
    const gapEnd = parseTvClockToMinutes(sorted[i + 1].start);
    const span = gapEnd - gapStart;
    if (span >= TV_LUNCH_GAP_MIN_MINUTES && (!lunchGap || span > lunchGap.span)) {
      lunchGap = { start: gapStart, end: gapEnd, span };
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = parseTvClockToMinutes(sorted[i].end);
    const gapEnd = parseTvClockToMinutes(sorted[i + 1].start);
    if (nowMins >= gapStart && nowMins < gapEnd) {
      const nextStart = sorted[i + 1].start;
      const isLunch = lunchGap != null && gapStart === lunchGap.start;
      return isLunch
        ? `Öğle arası — sonraki ders ${nextStart}`
        : `Teneffüs — sonraki ders ${nextStart}`;
    }
  }

  return 'Şu an ders yok';
}

/** TV ders programı tablosu: Pzt–Cum (1–5). */
export const TV_TIMETABLE_WEEK_DAYS = [1, 2, 3, 4, 5] as const;
export const TV_TIMETABLE_DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'] as const;

/** 1=Pazartesi … 7=Pazar */
export const TV_TIMETABLE_DAY_NAMES = [
  '',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
] as const;

export function normTvClassSection(cls: string): string {
  return cls.trim().toLocaleLowerCase('tr-TR');
}

export function pickTvLessonSlotsForDay(
  times: TvLessonTimeSlot[] | undefined,
  timesWeekend: TvLessonTimeSlot[] | undefined,
  turkishDow: number,
): TvLessonTimeSlot[] | undefined {
  const isWeekend = turkishDow === 6 || turkishDow === 7;
  if (isWeekend && timesWeekend && timesWeekend.length > 0) return timesWeekend;
  return times;
}

/** Orta alan TV tablosu: bir slaytta en fazla sınıf sütunu (scale-to-fit ile sığdırılır). */
export const TV_TIMETABLE_CLASSES_PER_SLIDE = 10;

/** TV hücresinde uzun ders adı — kelime sınırında kısalt */
export function abbreviateTvSubject(subject: string, maxLen = 16): string {
  const s = subject.trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const sp = cut.lastIndexOf(' ');
  if (sp > 6) return `${cut.slice(0, sp)}…`;
  return `${cut}…`;
}

export function getTodayClassSectionsForTv(
  data: { entries: Array<{ day: number; class: string }>; sections: string[] },
  turkishToday: number,
): string[] {
  const todayClasses = new Set<string>();
  for (const e of data.entries) {
    if (e.day === turkishToday && e.class.trim()) todayClasses.add(e.class.trim());
  }
  const fromList = data.sections.filter((s) => s.trim());
  const ordered =
    fromList.length > 0 ? fromList.filter((s) => todayClasses.has(s.trim())) : [...todayClasses];
  const list = ordered.length > 0 ? ordered : fromList;
  return [...list].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
}

export function chunkTvTimetableClassSections(
  sections: string[],
  maxPerSlide: number = TV_TIMETABLE_CLASSES_PER_SLIDE,
): string[][] {
  if (sections.length === 0) return [];
  if (sections.length <= maxPerSlide) return [sections];
  const chunks: string[][] = [];
  for (let i = 0; i < sections.length; i += maxPerSlide) {
    chunks.push(sections.slice(i, i + maxPerSlide));
  }
  return chunks;
}

export function parseTimetableGridChunkIndex(id: string): number {
  const m = id.match(/^_timetable-grid-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}
