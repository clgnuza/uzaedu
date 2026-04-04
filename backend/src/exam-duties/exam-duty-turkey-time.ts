/** Sınav görevi: tüm kullanıcıya gösterilen saatler Europe/Istanbul (UTC+3, DST yok). */

export const TURKEY_TZ = 'Europe/Istanbul';

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
