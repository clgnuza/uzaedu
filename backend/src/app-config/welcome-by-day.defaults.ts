import { WELCOME_BY_DAY_ORDERED } from './welcome-366-pack';

/** Takvim sırası (şubat 29 dahil) — 366 gün; her gün benzersiz mesaj. */
const MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const EXPECTED = 366;

function allMmDdKeysLeap(): string[] {
  const keys: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const last = MONTH_DAYS_LEAP[m - 1];
    for (let d = 1; d <= last; d++) {
      keys.push(`${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return keys;
}

function buildWelcomeByDay(): Record<string, string> {
  const keys = allMmDdKeysLeap();
  if (keys.length !== EXPECTED || WELCOME_BY_DAY_ORDERED.length !== EXPECTED) {
    throw new Error(`welcome-by-day: MM-DD=${keys.length}, mesaj=${WELCOME_BY_DAY_ORDERED.length}`);
  }
  const out: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) {
    out[keys[i]] = WELCOME_BY_DAY_ORDERED[i];
  }
  return out;
}

export const WELCOME_BY_DAY_DEFAULT = buildWelcomeByDay();
