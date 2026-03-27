import type { WelcomeZodiacKey } from '@/lib/welcome-public';

export type WelcomeZodiacTheme = {
  key: WelcomeZodiacKey;
  name: string;
  rangeLabel: string;
  element: string;
  accentLabel: string;
  heroName: string;
  heroEmoji: string;
  shellClassName: string;
  orbClassName: string;
  badgeClassName: string;
  buttonClassName: string;
  textClassName: string;
};

export const WELCOME_ZODIAC_THEMES: WelcomeZodiacTheme[] = [
  {
    key: 'capricorn',
    name: 'Oğlak',
    rangeLabel: '22 Ara - 19 Oca',
    element: 'Toprak',
    accentLabel: 'Disiplin',
    heroName: 'Dağ Keçisi',
    heroEmoji: '🐐',
    shellClassName:
      'border-amber-500/20 bg-gradient-to-br from-stone-950 via-amber-950/80 to-orange-900 text-stone-50',
    orbClassName: 'bg-amber-300/15',
    badgeClassName: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    buttonClassName: 'bg-amber-100 text-stone-950 hover:bg-amber-50',
    textClassName: 'text-stone-200/90',
  },
  {
    key: 'aquarius',
    name: 'Kova',
    rangeLabel: '20 Oca - 18 Sub',
    element: 'Hava',
    accentLabel: 'Yenilik',
    heroName: 'Su Taşıyıcı',
    heroEmoji: '🌊',
    shellClassName:
      'border-sky-400/20 bg-gradient-to-br from-slate-950 via-sky-950/85 to-cyan-900 text-slate-50',
    orbClassName: 'bg-sky-300/15',
    badgeClassName: 'border-sky-300/20 bg-sky-200/10 text-sky-100',
    buttonClassName: 'bg-sky-100 text-slate-950 hover:bg-sky-50',
    textClassName: 'text-slate-200/90',
  },
  {
    key: 'pisces',
    name: 'Balık',
    rangeLabel: '19 Sub - 20 Mar',
    element: 'Su',
    accentLabel: 'Sezgi',
    heroName: 'Balık',
    heroEmoji: '🐟',
    shellClassName:
      'border-fuchsia-400/20 bg-gradient-to-br from-slate-950 via-fuchsia-950/80 to-indigo-900 text-slate-50',
    orbClassName: 'bg-fuchsia-300/15',
    badgeClassName: 'border-fuchsia-300/20 bg-fuchsia-200/10 text-fuchsia-100',
    buttonClassName: 'bg-fuchsia-100 text-slate-950 hover:bg-fuchsia-50',
    textClassName: 'text-slate-200/90',
  },
  {
    key: 'aries',
    name: 'Koç',
    rangeLabel: '21 Mar - 19 Nis',
    element: 'Ateş',
    accentLabel: 'Başlangıç',
    heroName: 'Koç',
    heroEmoji: '🐏',
    shellClassName:
      'border-rose-400/20 bg-gradient-to-br from-stone-950 via-rose-950/80 to-orange-900 text-stone-50',
    orbClassName: 'bg-rose-300/15',
    badgeClassName: 'border-rose-300/20 bg-rose-200/10 text-rose-100',
    buttonClassName: 'bg-rose-100 text-stone-950 hover:bg-rose-50',
    textClassName: 'text-stone-200/90',
  },
  {
    key: 'taurus',
    name: 'Boğa',
    rangeLabel: '20 Nis - 20 May',
    element: 'Toprak',
    accentLabel: 'Denge',
    heroName: 'Boğa',
    heroEmoji: '🐂',
    shellClassName:
      'border-emerald-400/20 bg-gradient-to-br from-stone-950 via-emerald-950/80 to-lime-900 text-stone-50',
    orbClassName: 'bg-emerald-300/15',
    badgeClassName: 'border-emerald-300/20 bg-emerald-200/10 text-emerald-100',
    buttonClassName: 'bg-emerald-100 text-stone-950 hover:bg-emerald-50',
    textClassName: 'text-stone-200/90',
  },
  {
    key: 'gemini',
    name: 'Ikizler',
    rangeLabel: '21 May - 20 Haz',
    element: 'Hava',
    accentLabel: 'Akış',
    heroName: 'Ikizler',
    heroEmoji: '♊',
    shellClassName:
      'border-yellow-400/20 bg-gradient-to-br from-slate-950 via-yellow-950/80 to-amber-900 text-slate-50',
    orbClassName: 'bg-yellow-300/15',
    badgeClassName: 'border-yellow-300/20 bg-yellow-200/10 text-yellow-100',
    buttonClassName: 'bg-yellow-100 text-slate-950 hover:bg-yellow-50',
    textClassName: 'text-slate-200/90',
  },
  {
    key: 'cancer',
    name: 'Yengec',
    rangeLabel: '21 Haz - 22 Tem',
    element: 'Su',
    accentLabel: 'Koruma',
    heroName: 'Yengeç',
    heroEmoji: '🦀',
    shellClassName:
      'border-blue-400/20 bg-gradient-to-br from-slate-950 via-blue-950/80 to-slate-900 text-slate-50',
    orbClassName: 'bg-blue-300/15',
    badgeClassName: 'border-blue-300/20 bg-blue-200/10 text-blue-100',
    buttonClassName: 'bg-blue-100 text-slate-950 hover:bg-blue-50',
    textClassName: 'text-slate-200/90',
  },
  {
    key: 'leo',
    name: 'Aslan',
    rangeLabel: '23 Tem - 22 Agu',
    element: 'Ateş',
    accentLabel: 'Parıltı',
    heroName: 'Aslan',
    heroEmoji: '🦁',
    shellClassName:
      'border-orange-400/20 bg-gradient-to-br from-stone-950 via-orange-950/85 to-amber-900 text-stone-50',
    orbClassName: 'bg-orange-300/15',
    badgeClassName: 'border-orange-300/20 bg-orange-200/10 text-orange-100',
    buttonClassName: 'bg-orange-100 text-stone-950 hover:bg-orange-50',
    textClassName: 'text-stone-200/90',
  },
  {
    key: 'virgo',
    name: 'Başak',
    rangeLabel: '23 Agu - 22 Eyl',
    element: 'Toprak',
    accentLabel: 'Netlik',
    heroName: 'Başak',
    heroEmoji: '♍',
    shellClassName:
      'border-lime-400/20 bg-gradient-to-br from-stone-950 via-lime-950/80 to-emerald-900 text-stone-50',
    orbClassName: 'bg-lime-300/15',
    badgeClassName: 'border-lime-300/20 bg-lime-200/10 text-lime-100',
    buttonClassName: 'bg-lime-100 text-stone-950 hover:bg-lime-50',
    textClassName: 'text-stone-200/90',
  },
  {
    key: 'libra',
    name: 'Terazi',
    rangeLabel: '23 Eyl - 22 Eki',
    element: 'Hava',
    accentLabel: 'Uyum',
    heroName: 'Terazi',
    heroEmoji: '⚖',
    shellClassName:
      'border-pink-400/20 bg-gradient-to-br from-slate-950 via-pink-950/80 to-violet-900 text-slate-50',
    orbClassName: 'bg-pink-300/15',
    badgeClassName: 'border-pink-300/20 bg-pink-200/10 text-pink-100',
    buttonClassName: 'bg-pink-100 text-slate-950 hover:bg-pink-50',
    textClassName: 'text-slate-200/90',
  },
  {
    key: 'scorpio',
    name: 'Akrep',
    rangeLabel: '23 Eki - 21 Kas',
    element: 'Su',
    accentLabel: 'Derinlik',
    heroName: 'Akrep',
    heroEmoji: '🦂',
    shellClassName:
      'border-violet-400/20 bg-gradient-to-br from-slate-950 via-violet-950/85 to-purple-900 text-slate-50',
    orbClassName: 'bg-violet-300/15',
    badgeClassName: 'border-violet-300/20 bg-violet-200/10 text-violet-100',
    buttonClassName: 'bg-violet-100 text-slate-950 hover:bg-violet-50',
    textClassName: 'text-slate-200/90',
  },
  {
    key: 'sagittarius',
    name: 'Yay',
    rangeLabel: '22 Kas - 21 Ara',
    element: 'Ateş',
    accentLabel: 'Keşif',
    heroName: 'Okçu',
    heroEmoji: '🏹',
    shellClassName:
      'border-teal-400/20 bg-gradient-to-br from-slate-950 via-teal-950/85 to-emerald-900 text-slate-50',
    orbClassName: 'bg-teal-300/15',
    badgeClassName: 'border-teal-300/20 bg-teal-200/10 text-teal-100',
    buttonClassName: 'bg-teal-100 text-slate-950 hover:bg-teal-50',
    textClassName: 'text-slate-200/90',
  },
];

export function formatDateKeyTr(dateKey: string): string {
  const [m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  if (!m || !d) return dateKey;
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Istanbul',
    }).format(new Date(2024, m - 1, d));
  } catch {
    return dateKey;
  }
}

export function getWelcomeZodiacKey(dateKey: string): WelcomeZodiacKey {
  const [month, day] = dateKey.split('-').map((x) => parseInt(x, 10));
  const value = month * 100 + day;
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

export function getWelcomeZodiacTheme(zodiacKey: WelcomeZodiacKey): WelcomeZodiacTheme {
  return WELCOME_ZODIAC_THEMES.find((item) => item.key === zodiacKey) ?? WELCOME_ZODIAC_THEMES[0];
}
