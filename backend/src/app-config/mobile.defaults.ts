/**
 * Mobil istemci uzaktan yapılandırma — tek JSON (mobile_app_config).
 * Günlük hoşgeldin metni (auth yok): `GET /api/content/welcome-today` — `enabled`, `message`, `date_key`.
 * Operasyonel güncelleme/bakım politikası şablonu: depo `docs/GUNCELLEME_VE_BAKIM_POLITIKASI.md`.
 */
export type MobileAppConfig = {
  cache_ttl_mobile_config: number;
  ios_min_version: string | null;
  android_min_version: string | null;
  ios_latest_version: string | null;
  android_latest_version: string | null;
  force_update_ios: boolean;
  force_update_android: boolean;
  update_message: string | null;
  ios_bundle_id: string | null;
  android_application_id: string | null;
  /** App Store Connect sayısal uygulama kimliği (itunes.apple.com/app/id…) */
  ios_app_store_id: string | null;
  app_store_url: string | null;
  play_store_url: string | null;
  marketing_url: string | null;
  faq_url: string | null;
  privacy_policy_url: string | null;
  terms_url: string | null;
  help_center_url: string | null;
  support_email: string | null;
  universal_link_host: string | null;
  url_scheme: string | null;
  api_base_url_public: string | null;
  /** İstemci yerel önbellek / uyumluluk için (örn. artırınca eski önbellek temizlenir) */
  config_schema_version: string | null;
  default_locale: string | null;
  supported_locales: string[];
  mobile_maintenance_enabled: boolean;
  mobile_maintenance_message: string | null;
  in_app_review_enabled: boolean;
  push_notifications_enabled: boolean;
  /** Reklam API ana şalteri (iOS/Android; GET /ads-public boş döner) */
  ads_enabled: boolean;
  feature_flags: Record<string, boolean>;
};

export const DEFAULT_MOBILE_APP: MobileAppConfig = {
  cache_ttl_mobile_config: 60,
  ios_min_version: null,
  android_min_version: null,
  ios_latest_version: null,
  android_latest_version: null,
  force_update_ios: false,
  force_update_android: false,
  update_message: null,
  ios_bundle_id: null,
  android_application_id: null,
  ios_app_store_id: null,
  app_store_url: null,
  play_store_url: null,
  marketing_url: null,
  faq_url: null,
  privacy_policy_url: null,
  terms_url: null,
  help_center_url: null,
  support_email: null,
  universal_link_host: null,
  url_scheme: null,
  api_base_url_public: null,
  config_schema_version: '1',
  default_locale: 'tr',
  supported_locales: ['tr', 'en'],
  mobile_maintenance_enabled: false,
  mobile_maintenance_message: null,
  in_app_review_enabled: false,
  push_notifications_enabled: true,
  ads_enabled: true,
  feature_flags: {},
};
