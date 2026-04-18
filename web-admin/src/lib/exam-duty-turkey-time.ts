/** Sınav görevi tarihleri — Europe/Istanbul (+03:00 sabit). Backend ile aynı mantık. */

export const TURKEY_TZ = 'Europe/Istanbul';

/**
 * Verilen anın İstanbul takvim gününe `timeHH:mm` duvar saati uygular (+03:00).
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
