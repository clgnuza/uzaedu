export function localMinutesNow(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

/** [start, end) aralığında mı; gece yarısını geçen aralıklar desteklenir. */
export function isWithinQuietWindow(nowMin: number, startMin: number, endMin: number): boolean {
  const start = ((startMin % 1440) + 1440) % 1440;
  const end = ((endMin % 1440) + 1440) % 1440;
  if (start === end) return false;
  if (start > end) return nowMin >= start || nowMin < end;
  return nowMin >= start && nowMin < end;
}

export function isQuietHoursActive(params: {
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
  timezone: string;
}): boolean {
  if (!params.enabled) return false;
  const now = localMinutesNow(params.timezone || 'Europe/Istanbul');
  return isWithinQuietWindow(now, params.startMinutes, params.endMinutes);
}
