export const WELCOME_ZODIAC_KEYS = [
  'capricorn',
  'aquarius',
  'pisces',
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
] as const;

export type WelcomeZodiacKey = (typeof WELCOME_ZODIAC_KEYS)[number];

function monthDayToNumber(dateKey: string): number {
  const [month, day] = dateKey.split('-').map((x) => parseInt(x, 10));
  return month * 100 + day;
}

export function getWelcomeZodiacKey(dateKey: string): WelcomeZodiacKey {
  const value = monthDayToNumber(dateKey);
  if (value >= 120 && value <= 218) return 'aquarius';
  if (value >= 219 && value <= 320) return 'pisces';
  if (value >= 321 && value <= 419) return 'aries';
  if (value >= 420 && value <= 520) return 'taurus';
  if (value >= 521 && value <= 620) return 'gemini';
  if (value >= 621 && value <= 722) return 'cancer';
  if (value >= 723 && value <= 822) return 'leo';
  if (value >= 823 && value <= 922) return 'virgo';
  if (value >= 923 && value <= 1022) return 'libra';
  if (value >= 1023 && value <= 1121) return 'scorpio';
  if (value >= 1122 && value <= 1221) return 'sagittarius';
  return 'capricorn';
}
