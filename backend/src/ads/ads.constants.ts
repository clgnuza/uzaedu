/** UI / dokümantasyon — backend zorunlu tutmaz */
export const AD_PLACEMENT_SUGGESTIONS: Record<'web' | 'ios' | 'android', string[]> = {
  web: ['banner_top', 'banner_sidebar', 'inline_article', 'footer_strip'],
  ios: ['banner_home', 'interstitial_cold_start', 'native_feed', 'rewarded_extra', 'market_rewarded_jeton'],
  android: ['banner_home', 'interstitial_exit', 'native_list', 'rewarded_extra', 'market_rewarded_jeton'],
};

/**
 * Google AdSense (yalnızca web) — `data-ad-format` / GPT / otomatik reklam türleri.
 * İstemci dokümana göre eşler; API serbest metin tutar.
 * @see https://support.google.com/adsense/
 */
export const ADSENSE_FORMAT_HINTS = [
  'auto',
  'fluid',
  'horizontal',
  'vertical',
  'rectangle',
  'display',
  'in_article',
  'in_feed',
  'multiplex',
  'matched_content',
  'link',
  'link_text',
  'anchor',
  'vignette',
  'side_rail',
  'parallax',
  'interstitial',
] as const;

/**
 * Google AdMob (yalnızca iOS/Android) — AdFormat / birim türü ile uyumlu anahtarlar.
 * @see https://developers.google.com/admob/android/banner
 * @see https://developers.google.com/admob/android/interstitial
 */
export const ADMOB_FORMAT_HINTS = [
  'banner',
  'adaptive_banner',
  'collapsible_banner',
  'interstitial',
  'rewarded',
  'rewarded_interstitial',
  'native',
  'native_advanced',
  'app_open',
] as const;

/** payload içinde beklenen anahtarlar (referans; API serbest JSON tutar) */
export const GOOGLE_PAYLOAD_KEYS = {
  adsense: ['publisher_id', 'slot_id', 'format', 'full_width_responsive'] as const,
  admob: ['app_id', 'ad_unit_id', 'ad_format'] as const,
} as const;

/** AdSense / AdMob program politikaları — istemci ve yönetim paneli referansı */
export const GOOGLE_AD_POLICY_LINKS = {
  adsense_program_policies: 'https://support.google.com/adsense/answer/48182',
  adsense_privacy_messages: 'https://support.google.com/adsense/answer/7670013',
  admob_policies: 'https://support.google.com/admob/answer/6128543',
  admob_ump: 'https://developers.google.com/admob/ump/android/quick-start',
  consent_mode_ads: 'https://developers.google.com/tag-platform/security/guides/consent',
} as const;
