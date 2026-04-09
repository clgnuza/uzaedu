/** GDPR / çerez — tek JSON (gdpr_config).
 * Örnek HTML metin şablonu: web-admin `src/lib/gdpr-banner-example.ts` (yayın öncesi hukuk onayı önerilir).
 * Politika şablonu: `docs/GUNCELLEME_VE_BAKIM_POLITIKASI.md`.
 */
export const DEFAULT_GDPR = {
  cookie_banner_enabled: true,
  /** Boşsa istemci "Çerez tercihleri" kullanır (mobil başlık + aria-label) */
  cookie_banner_title: null as string | null,
  /** Boşsa "Kabul et" */
  accept_button_label: null as string | null,
  /** Boşsa "Reddet" */
  reject_button_label: null as string | null,
  /** Boşsa istemci varsayılan metni kullanır */
  cookie_banner_body_html: null as string | null,
  /** Değişince mevcut çerez onayı geçersiz sayılır */
  consent_version: '1',
  data_controller_name: null as string | null,
  dpo_email: null as string | null,
  /** Çerez politikası sayfası path (site köküne göre) */
  cookie_policy_path: '/cerez',
  reject_button_visible: true,
  /** GET /content/gdpr Cache-Control max-age (sn) */
  cache_ttl_gdpr: 120,
} as const;
