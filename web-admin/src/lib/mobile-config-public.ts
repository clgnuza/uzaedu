import { cache } from 'react';

export type MobileAppPublic = {
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
  config_schema_version: string | null;
  default_locale: string | null;
  supported_locales: string[];
  mobile_maintenance_enabled: boolean;
  mobile_maintenance_message: string | null;
  in_app_review_enabled: boolean;
  push_notifications_enabled: boolean;
  ads_enabled: boolean;
  feature_flags: Record<string, boolean>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

const MOBILE_ISR = Math.min(
  86400,
  Math.max(10, parseInt(process.env.NEXT_PUBLIC_MOBILE_ISR || '60', 10) || 60),
);

export const fetchMobileConfigPublic = cache(async function fetchMobileConfigPublic(): Promise<MobileAppPublic | null> {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/mobile-config`, {
      next: { revalidate: MOBILE_ISR },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
});
