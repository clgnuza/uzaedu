/** Backend `GOOGLE_AD_POLICY_LINKS` ile aynı anahtarlar */
export type AdsPublicPolicyLinks = Record<
  'adsense_program_policies' | 'adsense_privacy_messages' | 'admob_policies' | 'admob_ump' | 'consent_mode_ads',
  string
>;

export type AdsPublicClientHint = 'adsense_web' | 'admob_native' | 'custom';

/** GET /ads-public/active yanıtı `meta` — backend `AdsPublicMeta` ile uyumlu */
export type AdsPublicMeta = {
  ads_enabled: boolean;
  web_targeting_requires_cookie?: boolean;
  server_time: string;
  client_hint?: AdsPublicClientHint;
  privacy_policy_url?: string | null;
  non_personalized_ads_recommended: boolean;
  policy_links: AdsPublicPolicyLinks;
};

export type AdsPublicRow = {
  id: string;
  platform: 'web' | 'ios' | 'android';
  ad_provider: 'adsense' | 'admob' | 'custom';
  web_surface: 'desktop' | 'mobile' | 'all' | null;
  placement: string;
  format: string;
  title: string;
  payload: Record<string, unknown>;
  consent_mode: 'contextual' | 'targeting';
  active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdsPublicActiveResponse = {
  items: AdsPublicRow[];
  meta: AdsPublicMeta;
};

export type AdsPublicActiveQuery = {
  platform: 'web' | 'ios' | 'android';
  placement?: string;
  web_surface?: 'desktop' | 'mobile' | 'all';
  targeting_allowed?: boolean;
  cookie_consent?: 'accepted' | 'rejected';
};

/** `apiBase`: `getApiUrl('')` ile biten kök veya `http://localhost:4000/api` */
export function buildAdsPublicActiveUrl(apiBase: string, q: AdsPublicActiveQuery): string {
  const root = apiBase.replace(/\/$/, '');
  const u = new URL(`${root}/ads-public/active`);
  u.searchParams.set('platform', q.platform);
  if (q.placement) u.searchParams.set('placement', q.placement);
  if (q.platform === 'web' && q.web_surface && q.web_surface !== 'all') {
    u.searchParams.set('web_surface', q.web_surface);
  }
  if (q.targeting_allowed === true) u.searchParams.set('targeting_allowed', 'true');
  if (q.targeting_allowed === false) u.searchParams.set('targeting_allowed', 'false');
  if (q.cookie_consent) u.searchParams.set('cookie_consent', q.cookie_consent);
  return u.toString();
}
