/** Backend `ads.constants` ile uyumlu placement önerileri */
export const AD_PLACEMENT_SUGGESTIONS: Record<'web' | 'ios' | 'android', string[]> = {
  web: ['banner_top', 'banner_sidebar', 'inline_article', 'footer_strip'],
  ios: ['banner_home', 'interstitial_cold_start', 'native_feed', 'rewarded_extra', 'market_rewarded_jeton'],
  android: ['banner_home', 'interstitial_exit', 'native_list', 'rewarded_extra', 'market_rewarded_jeton'],
};

/** Backend `ADSENSE_FORMAT_HINTS` ile aynı kapsam */
export const ADSENSE_FORMATS = [
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

/** Backend `ADMOB_FORMAT_HINTS` ile aynı kapsam */
export const ADMOB_FORMATS = [
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

/** Backend `ads.constants` GOOGLE_AD_POLICY_LINKS ile aynı */
export const GOOGLE_AD_POLICY_LINKS = {
  adsense_program_policies: 'https://support.google.com/adsense/answer/48182',
  adsense_privacy_messages: 'https://support.google.com/adsense/answer/7670013',
  admob_policies: 'https://support.google.com/admob/answer/6128543',
  admob_ump: 'https://developers.google.com/admob/ump/android/quick-start',
  consent_mode_ads: 'https://developers.google.com/tag-platform/security/guides/consent',
} as const;

export type AdProviderUi = 'adsense' | 'admob' | 'custom';

/** Google AdSense (web): ca-pub + slot — GPT / adsbygoogle */
export function payloadTemplateAdsense(): string {
  return JSON.stringify(
    {
      publisher_id: 'ca-pub-xxxxxxxx',
      slot_id: '1234567890',
      format: 'auto',
      full_width_responsive: true,
    },
    null,
    2,
  );
}

/** Google AdMob (iOS/Android): uygulama + birim kimliği */
export function payloadTemplateAdmob(): string {
  return JSON.stringify(
    {
      app_id: 'ca-app-pub-xxxxxxxx~xxxxxxxx',
      ad_unit_id: 'ca-app-pub-xxxxxxxx/xxxxxxxx',
      ad_format: 'banner',
    },
    null,
    2,
  );
}

export function payloadTemplateCustomWeb(): string {
  return JSON.stringify(
    { image_url: 'https://', click_url: 'https://', alt: '' },
    null,
    2,
  );
}

export function payloadTemplateForProvider(provider: AdProviderUi, platform: 'web' | 'ios' | 'android'): string {
  if (provider === 'adsense') return payloadTemplateAdsense();
  if (provider === 'admob') return payloadTemplateAdmob();
  return platform === 'web' ? payloadTemplateCustomWeb() : payloadTemplateAdmob();
}
