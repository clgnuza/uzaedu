import { cache } from 'react';

export type GuestPublicWebShellNavItem = {
  label: string;
  href: string;
  icon_key: string | null;
};

export type GuestPublicWebShellNav = {
  top_bar_enabled: boolean;
  top_bar_items: GuestPublicWebShellNavItem[];
  bottom_bar_enabled: boolean;
  bottom_bar_items: GuestPublicWebShellNavItem[];
  bottom_bar_mobile_only: boolean;
};

export type WebExtrasPublic = {
  gtm_id: string | null;
  ga4_measurement_id: string | null;
  maintenance_enabled: boolean;
  maintenance_message_html: string | null;
  maintenance_allowed_exact: string[];
  maintenance_allowed_prefixes: string[];
  cache_ttl_yayin_seo: number;
  cache_ttl_web_public: number;
  cache_ttl_legal_pages: number;
  cache_ttl_web_extras: number;
  global_robots_noindex: boolean;
  default_og_image_url: string | null;
  recaptcha_site_key: string | null;
  pwa_short_name: string | null;
  theme_color: string | null;
  favicon_url: string | null;
  app_store_url: string | null;
  play_store_url: string | null;
  help_center_url: string | null;
  support_enabled: boolean;
  ads_enabled: boolean;
  ads_web_targeting_requires_cookie_consent: boolean;
  guest_public_web_shell_nav: GuestPublicWebShellNav;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

/** ISR süresi; sunucudaki cache_ttl_web_extras ile uyumlu tutun (varsayılan 30). */
const WEB_EXTRAS_ISR = Math.min(
  86400,
  Math.max(10, parseInt(process.env.NEXT_PUBLIC_WEB_EXTRAS_ISR || '30', 10) || 30),
);

export const fetchWebExtrasPublic = cache(async function fetchWebExtrasPublic(): Promise<WebExtrasPublic | null> {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/web-extras`, {
      next: { revalidate: WEB_EXTRAS_ISR },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
});
