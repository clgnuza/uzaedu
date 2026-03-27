/** Kamu uç — auth gerekmez. Mobil / web istemci aynı yolu kullanır. */
export const WELCOME_TODAY_API_PATH = 'content/welcome-today';

export type WelcomePopupMode = 'zodiac_auto';
export type WelcomeZodiacKey =
  | 'capricorn'
  | 'aquarius'
  | 'pisces'
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius';

export type WelcomeTodayResponse = {
  enabled: boolean;
  date_key: string;
  message: string | null;
  popup_enabled: boolean;
  popup_mode: WelcomePopupMode;
  zodiac_key: WelcomeZodiacKey;
};
