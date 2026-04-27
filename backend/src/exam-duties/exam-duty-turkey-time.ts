/** Sınav görevi: tüm kullanıcıya gösterilen saatler Europe/Istanbul (UTC+3, DST yok). */

export const TURKEY_TZ = 'Europe/Istanbul';

/**
 * GPT’dan gelen `YYYY-MM-DD` veya `YYYY-MM-DD HH:mm` dizesini **Europe/Istanbul** duvar saatinde
 * açık `Date` yapar. `new Date("...23:59")` sunucu UTC’de yorumlanıp İstanbul gününe +1 kaymasın diye
 * tüm eşleşmeler `+03:00` ile biter. Saat yoksa (yalnız gün) öğlen TR (12:00) anchor kullanılır; böylece
 * `applyExamDutyWallClockInTurkey` ile aynı takvim günü varsayılan saat uygulanır.
 */
export function parseExamDutyGptYmdHmsInTurkey(s: string | null | undefined): Date | null {
  if (s == null || s === '') return null;
  const t = String(s).trim();
  if (!t || t.toLowerCase() === 'null') return null;
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!m) return null;
  const y = m[1]!.padStart(4, '0');
  const mo = m[2]!.padStart(2, '0');
  const d = m[3]!.padStart(2, '0');
  if (m[4] != null && m[5] != null) {
    return new Date(`${y}-${mo}-${d}T${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}:00+03:00`);
  }
  return new Date(`${y}-${mo}-${d}T12:00:00+03:00`);
}

/**
 * Takvim günü `d` (herhangi bir an) için, o günün İstanbul’daki tarihine superadmin HH:mm uygular.
 * DB’de tutulan an, o yerel saatte +03:00 ile eşlenir (setHours sunucu TZ’sine bağlı kalmaz).
 */
export function applyExamDutyWallClockInTurkey(d: Date | null, timeHHmm: string): Date | null {
  if (!d) return null;
  const ymd = d.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  const m = (timeHHmm || '00:00').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const h = m ? parseInt(m[1]!, 10) : 0;
  const min = m ? parseInt(m[2]!, 10) : 0;
  const hh = String(h).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+03:00`);
}

/** GPT sonuç tarihi yoksa: sınavın İstanbul takvim gününden bir gün önce + result_date varsayılan saati. */
export function turkeyDayBeforeExamWithWallClock(examInstant: Date, timeHHmm: string): Date {
  const examYmd = examInstant.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  const anchor = new Date(`${examYmd}T12:00:00+03:00`);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  const prevYmd = anchor.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  const noonPrev = new Date(`${prevYmd}T12:00:00+03:00`);
  return applyExamDutyWallClockInTurkey(noonPrev, timeHHmm) ?? noonPrev;
}

/** Şu anki saat HH:mm (İstanbul) */
export function getNowHHmmTurkey(now = new Date()): string {
  const s = now.toLocaleTimeString('en-GB', {
    timeZone: TURKEY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [a, b] = s.split(':');
  const h = String(parseInt(a ?? '0', 10)).padStart(2, '0');
  const m = String(parseInt(b ?? '0', 10)).padStart(2, '0');
  return `${h}:${m}`;
}

export function normalizeHHmm(s: string): string {
  const m = s.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return '09:00';
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}
