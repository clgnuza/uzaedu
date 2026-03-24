/** CAPTCHA / bot koruması — tek JSON (`captcha_config`). Gizli anahtar sunucuda kalır.
 * Politika özeti: `docs/GUNCELLEME_VE_BAKIM_POLITIKASI.md` (CAPTCHA bölümü eklenebilir).
 */
export const CAPTCHA_PROVIDERS = ['none', 'recaptcha_v2', 'recaptcha_v3', 'turnstile', 'hcaptcha'] as const;
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number];

export const DEFAULT_CAPTCHA = {
  enabled: false,
  provider: 'none' as CaptchaProvider,
  site_key: null as string | null,
  secret_key: null as string | null,
  /** reCAPTCHA v3 ve benzeri skor eşiği (0–1) */
  v3_min_score: 0.5,
  protect_login: true,
  protect_register: true,
  protect_forgot_password: false,
  /** GET /content/captcha Cache-Control max-age (sn) */
  cache_ttl_captcha: 120,
} as const;
