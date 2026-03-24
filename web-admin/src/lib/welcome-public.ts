/** Kamu uç — auth gerekmez. Mobil / web istemci aynı yolu kullanır. */
export const WELCOME_TODAY_API_PATH = 'content/welcome-today';

export type WelcomeTodayResponse = {
  enabled: boolean;
  date_key: string;
  message: string | null;
};
