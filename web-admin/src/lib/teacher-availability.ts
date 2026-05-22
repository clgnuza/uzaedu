/** Müsait değil → ızgara anahtarları: `gün:*` (tüm gün) veya `gün:ders` */

export type UnavailablePeriod = { day_of_week: number; lesson_num?: number };

export function periodsToBlockedKeys(periods: UnavailablePeriod[]): Set<string> {
  const set = new Set<string>();
  for (const p of periods) {
    if (p.lesson_num == null) set.add(`${p.day_of_week}:*`);
    else set.add(`${p.day_of_week}:${p.lesson_num}`);
  }
  return set;
}

export function blockedKeysToPeriods(keys: Set<string>): UnavailablePeriod[] {
  const out: UnavailablePeriod[] = [];
  for (const k of keys) {
    const [d, l] = k.split(':');
    const day = Number(d);
    if (!day || day < 1 || day > 7) continue;
    if (l === '*') out.push({ day_of_week: day });
    else {
      const lesson = Number(l);
      if (lesson >= 1) out.push({ day_of_week: day, lesson_num: lesson });
    }
  }
  return out.sort((a, b) => a.day_of_week - b.day_of_week || (a.lesson_num ?? 0) - (b.lesson_num ?? 0));
}

export function isSlotBlocked(keys: Set<string>, day: number, lesson: number): boolean {
  return keys.has(`${day}:*`) || keys.has(`${day}:${lesson}`);
}

export function toggleSlotBlocked(
  keys: Set<string>,
  day: number,
  lesson: number,
  maxLessons: number,
): Set<string> {
  const next = new Set(keys);
  const dayKey = `${day}:*`;
  const cellKey = `${day}:${lesson}`;

  if (next.has(dayKey)) {
    next.delete(dayKey);
    for (let l = 1; l <= maxLessons; l++) {
      if (l !== lesson) next.add(`${day}:${l}`);
    }
    return next;
  }
  if (next.has(cellKey)) next.delete(cellKey);
  else next.add(cellKey);
  return next;
}

export function toggleDayBlocked(keys: Set<string>, day: number, maxLessons: number): Set<string> {
  const next = new Set(keys);
  const dayKey = `${day}:*`;
  const prefix = `${day}:`;

  if (next.has(dayKey)) {
    for (const k of [...next]) {
      if (k.startsWith(prefix)) next.delete(k);
    }
    return next;
  }
  for (const k of [...next]) {
    if (k.startsWith(prefix)) next.delete(k);
  }
  next.add(dayKey);
  return next;
}

export function clearDayBlocks(keys: Set<string>, day: number): Set<string> {
  const next = new Set(keys);
  const prefix = `${day}:`;
  for (const k of [...next]) {
    if (k.startsWith(prefix)) next.delete(k);
  }
  return next;
}
