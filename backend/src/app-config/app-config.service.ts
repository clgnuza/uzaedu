import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { AppConfig } from './entities/app-config.entity';
import { DEFAULT_LEGAL_PAGES } from './legal-pages.defaults';
import { DEFAULT_WEB_EXTRAS } from './web-extras.defaults';
import { DEFAULT_GDPR } from './gdpr.defaults';
import { CAPTCHA_PROVIDERS, DEFAULT_CAPTCHA, type CaptchaProvider } from './captcha.defaults';
import { DEFAULT_MOBILE_APP, type MobileAppConfig } from './mobile.defaults';
import {
  DEFAULT_WELCOME_MODULE,
  type WelcomeModuleConfig,
  isValidMmDdKey,
  sanitizeWelcomePlainText,
} from './welcome-module.defaults';
import { getWelcomeZodiacKey, type WelcomeZodiacKey } from './welcome-zodiac.util';
import { type MarketPolicyConfig, mergeMarketPolicyFromStored } from './market-policy.defaults';
import { sanitizeLegalHtml } from './legal-pages.sanitize';
import { mergeDevOpsFromStored, type DevOpsConfig } from './devops.defaults';
import { DEFAULT_SCHOOL_REVIEWS_BLOCKED_TERMS } from './school-reviews-blocked-terms.defaults';
import { DEFAULT_MAIL_TEMPLATES, MAIL_TEMPLATE_IDS } from '../mail/mail-templates.defaults';
import { createNodemailerTransporter } from '../mail/nodemailer-transport';
import type { MailTemplateBlock, MailTemplateId, MailTemplatesStored } from '../mail/mail-templates.types';

export type { MobileAppConfig } from './mobile.defaults';
export type { MailTemplateBlock, MailTemplateId, MailTemplatesStored } from '../mail/mail-templates.types';
export type { DevOpsConfig } from './devops.defaults';
export type { WelcomeModuleConfig } from './welcome-module.defaults';
export type {
  MarketPolicyConfig,
  MarketStoreCompliance,
  MarketSubscriptionUrls,
  MarketMinorPrivacy,
} from './market-policy.defaults';

export type WelcomeTodayPublic = {
  enabled: boolean;
  date_key: string;
  message: string | null;
  popup_enabled: boolean;
  popup_mode: WelcomeModuleConfig['popup_mode'];
  zodiac_key: WelcomeZodiacKey;
};

/** Sunucuda Nest cron ile haber RSS senkronu – aralık (dakika) ve aç/kapa */
export type ContentSyncScheduleConfig = {
  enabled: boolean;
  interval_minutes: number;
};

/** Son senkron çalışması özeti (app_config.content_sync_status JSON) */
export type ContentSyncStatusRecord = {
  last_run_at: string | null;
  last_ok: boolean | null;
  last_message: string | null;
  last_total_created: number;
  last_trigger: 'manual' | 'cron' | null;
  last_source_errors: { source_key: string; source_label: string; error: string }[];
};

/** Döngüsel import olmadan senkron sonucunu kaydetmek için */
export type ContentSyncResultSnapshot = {
  ok: boolean;
  message: string;
  total_created: number;
  results: { source_key: string; source_label: string; error?: string }[];
};

const R2_KEYS = ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket', 'r2_public_url'] as const;
const MAIL_KEYS = ['mail_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name', 'smtp_secure', 'mail_app_base_url'] as const;
const UPLOAD_LIMIT_KEYS = ['upload_max_size_mb', 'upload_allowed_types'] as const;
const R2_SECRET_KEY = 'r2_secret_access_key';

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ALLOWED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

/** Admin shell alt bilgi satırı bağlantısı — çerez tercihi düğmesi. */
export const FOOTER_CONSENT_HREF = '__consent__';

export type WebPublicFooterNavItem = {
  label: string;
  href: string;
};

/** Kamuya açık web sitesi – iletişim, footer, sosyal bağlantılar (JSON). */
export type WebPublicHeaderShellStyle = 'glass' | 'solid' | 'minimal' | 'brand';

/** Üst şerit yüksekliği (varsayılan = tema CSS). */
export type WebPublicHeaderShellDensity = 'compact' | 'default' | 'comfortable';

export type WebPublicConfig = {
  contact_email: string | null;
  contact_phone: string | null;
  footer_tagline: string | null;
  social_x: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_youtube: string | null;
  privacy_policy_url: string | null;
  terms_url: string | null;
  /** Yılın sağında: örn. "© Uzaedu Öğretmen Web Admin" */
  footer_copyright_suffix: string | null;
  /** Alt bilgi gezinme (en fazla 8). href: iç yol, https:// veya __consent__ */
  footer_nav_items: WebPublicFooterNavItem[];
  /** Üst şerit logo altı (mobil); boşsa misafirde sayfa adı, girişte "Panel" */
  header_brand_subtitle: string | null;
  /** Üst şerit görünümü */
  header_shell_style: WebPublicHeaderShellStyle;
  /** Üst şerit yüksekliği */
  header_shell_density: WebPublicHeaderShellDensity;
  /** Cam/marka görünümünde üstte ince vurgu çizgisi */
  header_shell_accent: boolean;
};

const DEFAULT_WEB_PUBLIC: WebPublicConfig = {
  contact_email: null,
  contact_phone: null,
  footer_tagline: null,
  social_x: null,
  social_facebook: null,
  social_instagram: null,
  social_youtube: null,
  privacy_policy_url: null,
  terms_url: null,
  footer_copyright_suffix: '© Uzaedu Öğretmen Web Admin',
  footer_nav_items: [
    { label: 'Gizlilik', href: '/gizlilik' },
    { label: 'Kullanım Şartları', href: '/kullanim-sartlari' },
    { label: 'Çerez politikası', href: '/cerez' },
    { label: 'Rıza ayarları', href: FOOTER_CONSENT_HREF },
  ],
  header_brand_subtitle: null,
  header_shell_style: 'glass',
  header_shell_density: 'default',
  header_shell_accent: true,
};

const FOOTER_NAV_MAX = 8;

function sanitizeHeaderShellStyle(v: unknown): WebPublicHeaderShellStyle {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'solid' || s === 'minimal' || s === 'brand') return s;
  return 'glass';
}

function sanitizeHeaderShellDensity(v: unknown): WebPublicHeaderShellDensity {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'compact' || s === 'comfortable') return s;
  return 'default';
}

function sanitizeHeaderShellAccent(v: unknown): boolean {
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return true;
}

function sanitizeFooterNavItems(arr: unknown): WebPublicFooterNavItem[] {
  if (!Array.isArray(arr)) return [];
  const out: WebPublicFooterNavItem[] = [];
  for (const x of arr) {
    if (out.length >= FOOTER_NAV_MAX) break;
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const label = String(o.label ?? '').trim().slice(0, 64);
    if (!label) continue;
    let href = String(o.href ?? '').trim();
    if (!href) continue;
    if (href === FOOTER_CONSENT_HREF) {
      out.push({ label, href: FOOTER_CONSENT_HREF });
      continue;
    }
    if (/^https?:\/\//i.test(href)) {
      if (!href.startsWith('https://')) continue;
      try {
        const u = new URL(href);
        if (u.protocol !== 'https:') continue;
      } catch {
        continue;
      }
      if (href.length > 2048) continue;
      out.push({ label, href });
      continue;
    }
    if (href.includes('://')) continue;
    if (!href.startsWith('/')) href = `/${href}`;
    href = href.replace(/\s/g, '');
    if (href.length > 512) href = href.slice(0, 512);
    out.push({ label, href });
  }
  return out;
}

export type LegalPageContent = {
  title: string;
  meta_description: string;
  body_html: string;
  updated_at: string | null;
};

export type LegalPagesConfig = {
  privacy: LegalPageContent;
  terms: LegalPageContent;
  cookies: LegalPageContent;
};

export type LegalPageKey = keyof LegalPagesConfig;

const LEGAL_PAGE_KEYS: LegalPageKey[] = ['privacy', 'terms', 'cookies'];

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
  /** Alt çubuk yalnızca dar ekranda (önerilir) */
  bottom_bar_mobile_only: boolean;
};

export type WebExtrasConfig = {
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
  meta_description: string | null;
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

export type GdprConfig = {
  cookie_banner_enabled: boolean;
  cookie_banner_title: string | null;
  accept_button_label: string | null;
  reject_button_label: string | null;
  cookie_banner_body_html: string | null;
  consent_version: string;
  data_controller_name: string | null;
  dpo_email: string | null;
  cookie_policy_path: string;
  reject_button_visible: boolean;
  /** Kamu çerez şeridi görsel şablonu */
  cookie_banner_visual: 'gradient' | 'minimal' | 'brand';
  cache_ttl_gdpr: number;
};

export type CaptchaConfig = {
  enabled: boolean;
  provider: CaptchaProvider;
  site_key: string | null;
  secret_key: string | null;
  v3_min_score: number;
  protect_login: boolean;
  protect_register: boolean;
  protect_forgot_password: boolean;
  cache_ttl_captcha: number;
};

export type CaptchaPublic = Omit<CaptchaConfig, 'secret_key'>;

export type CaptchaConfigForAdmin = Omit<CaptchaConfig, 'secret_key'> & {
  secret_key: string | null;
};

const CAPTCHA_SECRET_MASK = '••••••••';

function clampCaptchaScore(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
  if (Number.isNaN(x)) return fallback;
  return Math.min(1, Math.max(0, x));
}

function normalizeCaptchaProvider(p: unknown): CaptchaProvider {
  const s = String(p ?? '').trim().toLowerCase();
  return (CAPTCHA_PROVIDERS as readonly string[]).includes(s) ? (s as CaptchaProvider) : 'none';
}

function clampCacheTtl(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.min(86400, Math.max(10, Math.round(x)));
}

function normalizeCookieBannerVisual(v: unknown): 'gradient' | 'minimal' | 'brand' {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'minimal' || s === 'brand') return s;
  return 'gradient';
}

const GUEST_SHELL_MAX_ITEMS = 8;

function cloneGuestPublicWebShellDefaults(): GuestPublicWebShellNav {
  const wx = DEFAULT_WEB_EXTRAS.guest_public_web_shell_nav;
  return {
    top_bar_enabled: wx.top_bar_enabled,
    top_bar_items: sanitizeGuestPublicNavItems(wx.top_bar_items),
    bottom_bar_enabled: wx.bottom_bar_enabled,
    bottom_bar_items: sanitizeGuestPublicNavItems(wx.bottom_bar_items),
    bottom_bar_mobile_only: wx.bottom_bar_mobile_only,
  };
}

function sanitizeGuestPublicNavItem(raw: unknown): GuestPublicWebShellNavItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = String(o.label ?? '').trim().slice(0, 64);
  if (!label) return null;
  let href = String(o.href ?? '').trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) {
    if (!href.startsWith('https://')) return null;
    try {
      const u = new URL(href);
      if (u.protocol !== 'https:') return null;
    } catch {
      return null;
    }
    if (href.length > 2048) return null;
  } else {
    if (href.includes('://')) return null;
    if (!href.startsWith('/')) href = `/${href}`;
    href = href.replace(/\s/g, '');
    if (href.length > 512) href = href.slice(0, 512);
  }
  let icon_key: string | null = null;
  if (o.icon_key != null && String(o.icon_key).trim()) {
    const ik = String(o.icon_key).trim().slice(0, 32);
    if (/^[a-z0-9_-]+$/i.test(ik)) icon_key = ik;
  }
  return { label, href, icon_key };
}

function sanitizeGuestPublicNavItems(arr: unknown): GuestPublicWebShellNavItem[] {
  if (!Array.isArray(arr)) return [];
  const out: GuestPublicWebShellNavItem[] = [];
  for (const x of arr) {
    if (out.length >= GUEST_SHELL_MAX_ITEMS) break;
    const it = sanitizeGuestPublicNavItem(x);
    if (it) out.push(it);
  }
  return out;
}

function mergeGuestPublicWebShellFromStored(
  stored: Partial<GuestPublicWebShellNav> | null | undefined,
  d: GuestPublicWebShellNav,
): GuestPublicWebShellNav {
  if (!stored || typeof stored !== 'object') return d;
  return {
    top_bar_enabled: typeof stored.top_bar_enabled === 'boolean' ? stored.top_bar_enabled : d.top_bar_enabled,
    top_bar_items: sanitizeGuestPublicNavItems(stored.top_bar_items ?? d.top_bar_items),
    bottom_bar_enabled: typeof stored.bottom_bar_enabled === 'boolean' ? stored.bottom_bar_enabled : d.bottom_bar_enabled,
    bottom_bar_items: sanitizeGuestPublicNavItems(stored.bottom_bar_items ?? d.bottom_bar_items),
    bottom_bar_mobile_only:
      typeof stored.bottom_bar_mobile_only === 'boolean' ? stored.bottom_bar_mobile_only : d.bottom_bar_mobile_only,
  };
}

function normalizeGuestPublicWebShellNav(input: unknown): GuestPublicWebShellNav {
  const d = cloneGuestPublicWebShellDefaults();
  if (!input || typeof input !== 'object') return d;
  return mergeGuestPublicWebShellFromStored(input as Partial<GuestPublicWebShellNav>, d);
}

function cloneWebExtrasDefaults(): WebExtrasConfig {
  return {
    gtm_id: DEFAULT_WEB_EXTRAS.gtm_id,
    ga4_measurement_id: DEFAULT_WEB_EXTRAS.ga4_measurement_id,
    maintenance_enabled: DEFAULT_WEB_EXTRAS.maintenance_enabled,
    maintenance_message_html: DEFAULT_WEB_EXTRAS.maintenance_message_html,
    maintenance_allowed_exact: [...DEFAULT_WEB_EXTRAS.maintenance_allowed_exact],
    maintenance_allowed_prefixes: [...DEFAULT_WEB_EXTRAS.maintenance_allowed_prefixes],
    cache_ttl_yayin_seo: DEFAULT_WEB_EXTRAS.cache_ttl_yayin_seo,
    cache_ttl_web_public: DEFAULT_WEB_EXTRAS.cache_ttl_web_public,
    cache_ttl_legal_pages: DEFAULT_WEB_EXTRAS.cache_ttl_legal_pages,
    cache_ttl_web_extras: DEFAULT_WEB_EXTRAS.cache_ttl_web_extras,
    global_robots_noindex: DEFAULT_WEB_EXTRAS.global_robots_noindex,
    default_og_image_url: DEFAULT_WEB_EXTRAS.default_og_image_url,
    meta_description: DEFAULT_WEB_EXTRAS.meta_description,
    recaptcha_site_key: DEFAULT_WEB_EXTRAS.recaptcha_site_key,
    pwa_short_name: DEFAULT_WEB_EXTRAS.pwa_short_name,
    theme_color: DEFAULT_WEB_EXTRAS.theme_color,
    favicon_url: DEFAULT_WEB_EXTRAS.favicon_url,
    app_store_url: DEFAULT_WEB_EXTRAS.app_store_url,
    play_store_url: DEFAULT_WEB_EXTRAS.play_store_url,
    help_center_url: DEFAULT_WEB_EXTRAS.help_center_url,
    support_enabled: DEFAULT_WEB_EXTRAS.support_enabled,
    ads_enabled: DEFAULT_WEB_EXTRAS.ads_enabled,
    ads_web_targeting_requires_cookie_consent: DEFAULT_WEB_EXTRAS.ads_web_targeting_requires_cookie_consent,
    guest_public_web_shell_nav: cloneGuestPublicWebShellDefaults(),
  };
}

function mergeWebExtrasFromStored(stored: Partial<WebExtrasConfig> | null): WebExtrasConfig {
  const d = cloneWebExtrasDefaults();
  if (!stored || typeof stored !== 'object') return d;
  return {
    gtm_id: stored.gtm_id !== undefined ? (stored.gtm_id?.trim() || null) : d.gtm_id,
    ga4_measurement_id:
      stored.ga4_measurement_id !== undefined ? (stored.ga4_measurement_id?.trim() || null) : d.ga4_measurement_id,
    maintenance_enabled: typeof stored.maintenance_enabled === 'boolean' ? stored.maintenance_enabled : d.maintenance_enabled,
    maintenance_message_html:
      stored.maintenance_message_html !== undefined
        ? stored.maintenance_message_html
          ? sanitizeLegalHtml(stored.maintenance_message_html)
          : null
        : d.maintenance_message_html,
    maintenance_allowed_exact: Array.isArray(stored.maintenance_allowed_exact)
      ? stored.maintenance_allowed_exact.map((s) => String(s).trim()).filter(Boolean)
      : d.maintenance_allowed_exact,
    maintenance_allowed_prefixes: Array.isArray(stored.maintenance_allowed_prefixes)
      ? stored.maintenance_allowed_prefixes.map((s) => String(s).trim()).filter(Boolean)
      : d.maintenance_allowed_prefixes,
    cache_ttl_yayin_seo: clampCacheTtl(stored.cache_ttl_yayin_seo, d.cache_ttl_yayin_seo),
    cache_ttl_web_public: clampCacheTtl(stored.cache_ttl_web_public, d.cache_ttl_web_public),
    cache_ttl_legal_pages: clampCacheTtl(stored.cache_ttl_legal_pages, d.cache_ttl_legal_pages),
    cache_ttl_web_extras: clampCacheTtl(stored.cache_ttl_web_extras, d.cache_ttl_web_extras),
    global_robots_noindex:
      typeof stored.global_robots_noindex === 'boolean' ? stored.global_robots_noindex : d.global_robots_noindex,
    default_og_image_url:
      stored.default_og_image_url !== undefined ? (stored.default_og_image_url?.trim() || null) : d.default_og_image_url,
    meta_description:
      stored.meta_description !== undefined ? (stored.meta_description?.trim() || null) : d.meta_description,
    recaptcha_site_key:
      stored.recaptcha_site_key !== undefined ? (stored.recaptcha_site_key?.trim() || null) : d.recaptcha_site_key,
    pwa_short_name: stored.pwa_short_name !== undefined ? (stored.pwa_short_name?.trim() || null) : d.pwa_short_name,
    theme_color: stored.theme_color !== undefined ? (stored.theme_color?.trim() || null) : d.theme_color,
    favicon_url: stored.favicon_url !== undefined ? (stored.favicon_url?.trim() || null) : d.favicon_url,
    app_store_url: stored.app_store_url !== undefined ? (stored.app_store_url?.trim() || null) : d.app_store_url,
    play_store_url: stored.play_store_url !== undefined ? (stored.play_store_url?.trim() || null) : d.play_store_url,
    help_center_url: stored.help_center_url !== undefined ? (stored.help_center_url?.trim() || null) : d.help_center_url,
    support_enabled: typeof stored.support_enabled === 'boolean' ? stored.support_enabled : d.support_enabled,
    ads_enabled: typeof stored.ads_enabled === 'boolean' ? stored.ads_enabled : d.ads_enabled,
    ads_web_targeting_requires_cookie_consent:
      typeof stored.ads_web_targeting_requires_cookie_consent === 'boolean'
        ? stored.ads_web_targeting_requires_cookie_consent
        : d.ads_web_targeting_requires_cookie_consent,
    guest_public_web_shell_nav: mergeGuestPublicWebShellFromStored(stored.guest_public_web_shell_nav, d.guest_public_web_shell_nav),
  };
}

function cloneGdprDefaults(): GdprConfig {
  return {
    cookie_banner_enabled: DEFAULT_GDPR.cookie_banner_enabled,
    cookie_banner_title: DEFAULT_GDPR.cookie_banner_title,
    accept_button_label: DEFAULT_GDPR.accept_button_label,
    reject_button_label: DEFAULT_GDPR.reject_button_label,
    cookie_banner_body_html: DEFAULT_GDPR.cookie_banner_body_html,
    consent_version: DEFAULT_GDPR.consent_version,
    data_controller_name: DEFAULT_GDPR.data_controller_name,
    dpo_email: DEFAULT_GDPR.dpo_email,
    cookie_policy_path: DEFAULT_GDPR.cookie_policy_path,
    reject_button_visible: DEFAULT_GDPR.reject_button_visible,
    cookie_banner_visual: normalizeCookieBannerVisual(DEFAULT_GDPR.cookie_banner_visual),
    cache_ttl_gdpr: DEFAULT_GDPR.cache_ttl_gdpr,
  };
}

function mergeGdprFromStored(stored: Partial<GdprConfig> | null): GdprConfig {
  const d = cloneGdprDefaults();
  if (!stored || typeof stored !== 'object') return d;
  return {
    cookie_banner_enabled:
      typeof stored.cookie_banner_enabled === 'boolean' ? stored.cookie_banner_enabled : d.cookie_banner_enabled,
    cookie_banner_title:
      stored.cookie_banner_title !== undefined
        ? stored.cookie_banner_title
          ? String(stored.cookie_banner_title).trim().slice(0, 120) || null
          : null
        : d.cookie_banner_title,
    accept_button_label:
      stored.accept_button_label !== undefined
        ? stored.accept_button_label
          ? String(stored.accept_button_label).trim().slice(0, 64) || null
          : null
        : d.accept_button_label,
    reject_button_label:
      stored.reject_button_label !== undefined
        ? stored.reject_button_label
          ? String(stored.reject_button_label).trim().slice(0, 64) || null
          : null
        : d.reject_button_label,
    cookie_banner_body_html:
      stored.cookie_banner_body_html !== undefined
        ? stored.cookie_banner_body_html
          ? sanitizeLegalHtml(stored.cookie_banner_body_html)
          : null
        : d.cookie_banner_body_html,
    consent_version:
      stored.consent_version !== undefined
        ? String(stored.consent_version).trim().slice(0, 32) || d.consent_version
        : d.consent_version,
    data_controller_name:
      stored.data_controller_name !== undefined
        ? (stored.data_controller_name?.trim() || null)
        : d.data_controller_name,
    dpo_email: stored.dpo_email !== undefined ? (stored.dpo_email?.trim() || null) : d.dpo_email,
    cookie_policy_path:
      stored.cookie_policy_path !== undefined
        ? String(stored.cookie_policy_path).trim().replace(/\s/g, '') || d.cookie_policy_path
        : d.cookie_policy_path,
    reject_button_visible:
      typeof stored.reject_button_visible === 'boolean' ? stored.reject_button_visible : d.reject_button_visible,
    cookie_banner_visual:
      stored.cookie_banner_visual !== undefined
        ? normalizeCookieBannerVisual(stored.cookie_banner_visual)
        : d.cookie_banner_visual,
    cache_ttl_gdpr: clampCacheTtl(stored.cache_ttl_gdpr, d.cache_ttl_gdpr),
  };
}

function cloneCaptchaDefaults(): CaptchaConfig {
  return {
    enabled: DEFAULT_CAPTCHA.enabled,
    provider: DEFAULT_CAPTCHA.provider,
    site_key: DEFAULT_CAPTCHA.site_key,
    secret_key: DEFAULT_CAPTCHA.secret_key,
    v3_min_score: DEFAULT_CAPTCHA.v3_min_score,
    protect_login: DEFAULT_CAPTCHA.protect_login,
    protect_register: DEFAULT_CAPTCHA.protect_register,
    protect_forgot_password: DEFAULT_CAPTCHA.protect_forgot_password,
    cache_ttl_captcha: DEFAULT_CAPTCHA.cache_ttl_captcha,
  };
}

function mergeCaptchaFromStored(stored: Partial<CaptchaConfig> | null): CaptchaConfig {
  const d = cloneCaptchaDefaults();
  if (!stored || typeof stored !== 'object') return d;
  const provider = stored.provider !== undefined ? normalizeCaptchaProvider(stored.provider) : d.provider;
  let enabled = typeof stored.enabled === 'boolean' ? stored.enabled : d.enabled;
  if (provider === 'none') {
    enabled = false;
  }
  return {
    enabled,
    provider,
    site_key: stored.site_key !== undefined ? (stored.site_key?.trim() || null) : d.site_key,
    secret_key: stored.secret_key !== undefined ? (stored.secret_key?.trim() || null) : d.secret_key,
    v3_min_score: stored.v3_min_score !== undefined ? clampCaptchaScore(stored.v3_min_score, d.v3_min_score) : d.v3_min_score,
    protect_login: typeof stored.protect_login === 'boolean' ? stored.protect_login : d.protect_login,
    protect_register: typeof stored.protect_register === 'boolean' ? stored.protect_register : d.protect_register,
    protect_forgot_password:
      typeof stored.protect_forgot_password === 'boolean' ? stored.protect_forgot_password : d.protect_forgot_password,
    cache_ttl_captcha: clampCacheTtl(stored.cache_ttl_captcha, d.cache_ttl_captcha),
  };
}

function sanitizeFeatureFlags(input: unknown): Record<string, boolean> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = String(k).trim();
    if (!key || key.length > 128) continue;
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

/** tr, en, tr-TR gibi locale kodları */
function sanitizeSupportedLocales(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input) || input.length === 0) return [...fallback];
  const raw = input.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const valid = raw.filter((c) => /^[a-z]{2}(-[a-z]{2})?$/.test(c));
  return valid.length ? [...new Set(valid)] : [...fallback];
}

function cloneMobileDefaults(): MobileAppConfig {
  return {
    ...DEFAULT_MOBILE_APP,
    feature_flags: { ...DEFAULT_MOBILE_APP.feature_flags },
    supported_locales: [...DEFAULT_MOBILE_APP.supported_locales],
  };
}

function mergeMobileFromStored(stored: Partial<MobileAppConfig> | null): MobileAppConfig {
  const d = cloneMobileDefaults();
  if (!stored || typeof stored !== 'object') return d;
  return {
    cache_ttl_mobile_config: clampCacheTtl(stored.cache_ttl_mobile_config, d.cache_ttl_mobile_config),
    ios_min_version: stored.ios_min_version !== undefined ? (stored.ios_min_version?.trim() || null) : d.ios_min_version,
    android_min_version:
      stored.android_min_version !== undefined ? (stored.android_min_version?.trim() || null) : d.android_min_version,
    ios_latest_version:
      stored.ios_latest_version !== undefined ? (stored.ios_latest_version?.trim() || null) : d.ios_latest_version,
    android_latest_version:
      stored.android_latest_version !== undefined ? (stored.android_latest_version?.trim() || null) : d.android_latest_version,
    force_update_ios: typeof stored.force_update_ios === 'boolean' ? stored.force_update_ios : d.force_update_ios,
    force_update_android:
      typeof stored.force_update_android === 'boolean' ? stored.force_update_android : d.force_update_android,
    update_message:
      stored.update_message !== undefined
        ? stored.update_message
          ? sanitizeLegalHtml(stored.update_message)
          : null
        : d.update_message,
    ios_bundle_id: stored.ios_bundle_id !== undefined ? (stored.ios_bundle_id?.trim() || null) : d.ios_bundle_id,
    android_application_id:
      stored.android_application_id !== undefined ? (stored.android_application_id?.trim() || null) : d.android_application_id,
    ios_app_store_id:
      stored.ios_app_store_id !== undefined
        ? (String(stored.ios_app_store_id).replace(/\D/g, '').slice(0, 20) || null)
        : d.ios_app_store_id,
    app_store_url: stored.app_store_url !== undefined ? (stored.app_store_url?.trim() || null) : d.app_store_url,
    play_store_url: stored.play_store_url !== undefined ? (stored.play_store_url?.trim() || null) : d.play_store_url,
    marketing_url: stored.marketing_url !== undefined ? (stored.marketing_url?.trim() || null) : d.marketing_url,
    faq_url: stored.faq_url !== undefined ? (stored.faq_url?.trim() || null) : d.faq_url,
    privacy_policy_url:
      stored.privacy_policy_url !== undefined ? (stored.privacy_policy_url?.trim() || null) : d.privacy_policy_url,
    terms_url: stored.terms_url !== undefined ? (stored.terms_url?.trim() || null) : d.terms_url,
    help_center_url: stored.help_center_url !== undefined ? (stored.help_center_url?.trim() || null) : d.help_center_url,
    support_email: stored.support_email !== undefined ? (stored.support_email?.trim() || null) : d.support_email,
    universal_link_host:
      stored.universal_link_host !== undefined ? (stored.universal_link_host?.trim() || null) : d.universal_link_host,
    url_scheme: stored.url_scheme !== undefined ? (stored.url_scheme?.trim().replace(/^:+/, '') || null) : d.url_scheme,
    api_base_url_public:
      stored.api_base_url_public !== undefined ? (stored.api_base_url_public?.trim() || null) : d.api_base_url_public,
    config_schema_version:
      stored.config_schema_version !== undefined
        ? (String(stored.config_schema_version).trim().slice(0, 32) || null)
        : d.config_schema_version,
    default_locale:
      stored.default_locale !== undefined
        ? (String(stored.default_locale).trim().toLowerCase().slice(0, 16) || d.default_locale)
        : d.default_locale,
    supported_locales:
      stored.supported_locales !== undefined
        ? sanitizeSupportedLocales(stored.supported_locales, d.supported_locales)
        : d.supported_locales,
    mobile_maintenance_enabled:
      typeof stored.mobile_maintenance_enabled === 'boolean'
        ? stored.mobile_maintenance_enabled
        : d.mobile_maintenance_enabled,
    mobile_maintenance_message:
      stored.mobile_maintenance_message !== undefined
        ? stored.mobile_maintenance_message
          ? sanitizeLegalHtml(stored.mobile_maintenance_message)
          : null
        : d.mobile_maintenance_message,
    in_app_review_enabled:
      typeof stored.in_app_review_enabled === 'boolean' ? stored.in_app_review_enabled : d.in_app_review_enabled,
    push_notifications_enabled:
      typeof stored.push_notifications_enabled === 'boolean'
        ? stored.push_notifications_enabled
        : d.push_notifications_enabled,
    ads_enabled: typeof stored.ads_enabled === 'boolean' ? stored.ads_enabled : d.ads_enabled,
    feature_flags: stored.feature_flags !== undefined ? sanitizeFeatureFlags(stored.feature_flags) : d.feature_flags,
  };
}

function mergeLegalPagesFromStored(
  stored: Partial<Record<LegalPageKey, Partial<LegalPageContent>>> | null,
): LegalPagesConfig {
  const out = {} as LegalPagesConfig;
  for (const k of LEGAL_PAGE_KEYS) {
    const d = DEFAULT_LEGAL_PAGES[k];
    const s = stored?.[k];
    out[k] = {
      title: s?.title?.trim() || d.title,
      meta_description: s?.meta_description?.trim() || d.meta_description,
      body_html: s?.body_html?.trim() || d.body_html,
      updated_at: typeof s?.updated_at === 'string' ? s.updated_at : null,
    };
  }
  return out;
}

/** Sınav görevi alan bazlı varsayılan saat (HH:mm) */
export type ExamDutyDefaultTimes = {
  application_start?: string;
  application_end?: string;
  application_approval_end?: string;
  result_date?: string;
  exam_date?: string;
  exam_date_end?: string;
};

/** Öğretmen anlık kutusu: ilgili günde İstanbul’da bu HH:mm’de bir kez (cron saat başı). Yayın = publish anında. */
export type ExamDutyNotificationTimes = {
  deadline: string;
  approval_day: string;
  exam_minus_1d: string;
  exam_plus_1d: string;
};

const DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES: ExamDutyNotificationTimes = {
  deadline: '09:00',
  approval_day: '09:00',
  exam_minus_1d: '09:00',
  exam_plus_1d: '09:00',
};

const EXAM_DUTY_NOTIFICATION_KEYS = ['deadline', 'approval_day', 'exam_minus_1d', 'exam_plus_1d'] as const;

/** Sınav görevi sync ek seçenekleri – backend/sync davranışı */
export type ExamDutySyncOptions = {
  skip_past_exam_date: boolean;
  recheck_max_count: number;
  fetch_timeout_ms: number;
  log_gpt_usage: boolean;
  /** true ise: tarih çıkarılamayan başvuru duyuruları yine de taslak olarak eklenir (tarihleri admin doldurur) */
  add_draft_without_dates: boolean;
  /** Her sync çalıştırmasında en fazla kaç yeni duyuru ekleneceği (0 = sınırsız). 1 = her sync'te en fazla 1 duyuru. */
  max_new_per_sync: number;
  /** Planlı otomatik sync (Europe/Istanbul HH:mm), en fazla 12 */
  sync_schedule_times: string[];
  /** Yeni/geri yüklenen duyuru: yalnızca superadmin inbox */
  notify_superadmin_on_sync_items: boolean;
  /** Sync + GPT ile yeni eklenen duyuruyu hemen yayınla (publish_now bildirimi gider) */
  auto_publish_gpt_sync_duties: boolean;
  /**
   * true: aynı kategoride sınav takvimi çakışması veya aynı son başvuru günü olan ikinci duyuru eklenmez.
   * false: yalnızca kaynak URL / external_id ile tekrar engellenir (takvim dedup kapalı).
   */
  dedupe_exam_schedule: boolean;
  /** Scrape: 0–14 = 1–15. slayt; her tam sync’te yalnızca bu slayt içerik kontrolüne alınır, sonra +1 (mod 15). */
  scrape_slider_slot_index: number;
};

const DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES = ['09:00', '13:00', '17:00', '21:00'];

function normalizeExamDutySyncScheduleTimes(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES];
  const out = new Set<string>();
  for (const x of raw) {
    const s = String(x).trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(s)) continue;
    const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (m) out.add(`${m[1]!.padStart(2, '0')}:${m[2]}`);
  }
  const arr = [...out].sort();
  return arr.length > 0 ? arr.slice(0, 12) : [...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES];
}

const DEFAULT_EXAM_DUTY_SYNC_OPTIONS: ExamDutySyncOptions = {
  skip_past_exam_date: false,
  recheck_max_count: 1,
  fetch_timeout_ms: 30000,
  log_gpt_usage: false,
  add_draft_without_dates: true,
  max_new_per_sync: 1,
  sync_schedule_times: [...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES],
  notify_superadmin_on_sync_items: true,
  auto_publish_gpt_sync_duties: false,
  dedupe_exam_schedule: true,
  scrape_slider_slot_index: 0,
};

const EXAM_DUTY_TIME_KEYS = ['application_start', 'application_end', 'application_approval_end', 'result_date', 'exam_date', 'exam_date_end'] as const;

/** DB’de exam_duty_default_times yokken veya alan eksikken kullanılan İstanbul duvar saati (sadece gün seçildiğinde uygulanır). */
const EXAM_DUTY_DEFAULT_TIMES_PRESET: Record<(typeof EXAM_DUTY_TIME_KEYS)[number], string> = {
  application_start: '00:00',
  application_end: '23:59',
  application_approval_end: '11:00',
  result_date: '10:00',
  exam_date: '06:00',
  exam_date_end: '05:00',
};

export type R2Config = {
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket: string;
  r2_public_url: string;
};

/** Admin UI için: secret maskeleyerek döner */
export type R2ConfigForAdmin = Omit<R2Config, 'r2_secret_access_key'> & {
  r2_secret_access_key: string | null; // "••••••••" veya null (yapılandırılmamış)
  upload_max_size_mb: number;
  upload_allowed_types: string[];
};

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppConfig)
    private readonly repo: Repository<AppConfig>,
  ) {}

  private async getValue(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    return row?.value ?? null;
  }

  private async setValue(key: string, value: string | null): Promise<void> {
    const row = await this.repo.findOne({ where: { key } });
    if (row) {
      row.value = value;
      await this.repo.save(row);
    } else {
      await this.repo.save(this.repo.create({ key, value }));
    }
  }

  /** R2 ayarlarını al – UploadService için (server-side, secret dahil) */
  async getR2Config(): Promise<Partial<R2Config>> {
    const result: Partial<R2Config> = {};
    for (const k of R2_KEYS) {
      const v = await this.getValue(k);
      if (v != null && v.trim()) (result as Record<string, string>)[k] = v.trim();
    }
    return result;
  }

  /** R2 ayarlarını al – Admin UI için (secret maskeli) */
  async getR2ConfigForAdmin(): Promise<R2ConfigForAdmin> {
    const values = await Promise.all([...R2_KEYS, ...UPLOAD_LIMIT_KEYS].map((k) => this.getValue(k)));
    const cfg: Record<string, string | null> = {};
    [...R2_KEYS, ...UPLOAD_LIMIT_KEYS].forEach((k, i) => {
      cfg[k] = values[i]?.trim() || null;
    });
    const maxMb = cfg.upload_max_size_mb ? parseFloat(cfg.upload_max_size_mb) : DEFAULT_MAX_SIZE_MB;
    const typesRaw = cfg.upload_allowed_types || DEFAULT_ALLOWED_TYPES;
    const types = typesRaw.split(',').map((t) => t.trim()).filter(Boolean);
    return {
      r2_account_id: cfg.r2_account_id ?? '',
      r2_access_key_id: cfg.r2_access_key_id ?? '',
      r2_secret_access_key: cfg.r2_secret_access_key ? '••••••••' : null,
      r2_bucket: cfg.r2_bucket ?? '',
      r2_public_url: cfg.r2_public_url ?? '',
      upload_max_size_mb: Number.isNaN(maxMb) || maxMb < 0.1 ? DEFAULT_MAX_SIZE_MB : Math.min(maxMb, 50),
      upload_allowed_types: types.length > 0 ? types : DEFAULT_ALLOWED_TYPES.split(','),
    };
  }

  /** Yükleme limitleri – UploadService için */
  async getUploadLimits(): Promise<{ maxSizeBytes: number; allowedTypes: string[] }> {
    const maxMb = await this.getValue('upload_max_size_mb');
    const typesRaw = await this.getValue('upload_allowed_types');
    const mb = maxMb ? parseFloat(maxMb) : DEFAULT_MAX_SIZE_MB;
    const types = (typesRaw || DEFAULT_ALLOWED_TYPES).split(',').map((t) => t.trim()).filter(Boolean);
    return {
      maxSizeBytes: (Number.isNaN(mb) || mb < 0.1 ? DEFAULT_MAX_SIZE_MB : Math.min(mb, 50)) * 1024 * 1024,
      allowedTypes: types.length > 0 ? types : DEFAULT_ALLOWED_TYPES.split(','),
    };
  }

  /** R2 bağlantısını test et – bucket erişimini doğrula */
  async testR2Connection(): Promise<{ ok: boolean; message: string }> {
    const config = await this.getR2Config();
    const { r2_account_id, r2_access_key_id, r2_secret_access_key, r2_bucket } = config;

    if (!r2_account_id || !r2_access_key_id || !r2_secret_access_key || !r2_bucket) {
      throw new BadRequestException({
        code: 'R2_NOT_CONFIGURED',
        message: 'R2 ayarları eksik. Lütfen tüm alanları doldurup kaydedin.',
      });
    }

    try {
      const endpoint = `https://${r2_account_id}.r2.cloudflarestorage.com`;
      const client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: r2_access_key_id,
          secretAccessKey: r2_secret_access_key,
        },
      });

      await client.send(
        new ListObjectsV2Command({
          Bucket: r2_bucket,
          MaxKeys: 1,
        })
      );

      return { ok: true, message: 'R2 bağlantısı başarılı.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      return { ok: false, message: `Bağlantı hatası: ${msg}` };
    }
  }

  /** R2 ayarlarını güncelle – superadmin tarafından */
  async updateR2Config(dto: Partial<Record<keyof R2Config, string | null>> & {
    upload_max_size_mb?: number | string | null;
    upload_allowed_types?: string[] | string | null;
  }): Promise<void> {
    for (const k of R2_KEYS) {
      const v = dto[k];
      if (v === undefined) continue;
      const trimmed = typeof v === 'string' ? v.trim() || null : null;
      if (k === R2_SECRET_KEY && trimmed === '') continue; // Boş = değiştirme
      await this.setValue(k, trimmed);
    }
    if (dto.upload_max_size_mb !== undefined) {
      const v = dto.upload_max_size_mb;
      const num = typeof v === 'number' ? v : (v != null && v !== '' ? parseFloat(String(v)) : null);
      await this.setValue('upload_max_size_mb', num != null && !Number.isNaN(num) ? String(Math.max(0.1, Math.min(50, num))) : null);
    }
    if (dto.upload_allowed_types !== undefined) {
      const v = dto.upload_allowed_types;
      const arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map((t) => t.trim()).filter(Boolean) : []);
      await this.setValue('upload_allowed_types', arr.length > 0 ? arr.join(',') : null);
    }
  }

  /** Okul değerlendirme modülü ayarları. Superadmin tarafından yönetilir. */
  async getSchoolReviewsConfig(): Promise<SchoolReviewsConfig> {
    const enabled = (await this.getValue('school_reviews_enabled'))?.toLowerCase() === 'true';
    const ratingMin = parseInt((await this.getValue('school_reviews_rating_min')) || '1', 10);
    const ratingMax = parseInt((await this.getValue('school_reviews_rating_max')) || '10', 10);
    const moderationMode = (await this.getValue('school_reviews_moderation_mode')) || 'auto';
    const allowQuestions = (await this.getValue('school_reviews_allow_questions'))?.toLowerCase() !== 'false';
    const questionsModerationRaw = await this.getValue('school_reviews_questions_moderation');
    const questionsRequireModeration =
      questionsModerationRaw == null || questionsModerationRaw.trim() === ''
        ? moderationMode === 'moderation'
        : questionsModerationRaw.toLowerCase() === 'true';
    let contentRulesParsed: unknown;
    const rawCr = await this.getValue('school_reviews_content_rules');
    if (rawCr?.trim()) {
      try {
        contentRulesParsed = JSON.parse(rawCr) as unknown;
      } catch {
        contentRulesParsed = undefined;
      }
    }
    const content_rules = this.mergeSchoolReviewsContentRules(contentRulesParsed);
    let penaltyRulesParsed: unknown;
    const rawPr = await this.getValue('school_reviews_penalty_rules');
    if (rawPr?.trim()) {
      try {
        penaltyRulesParsed = JSON.parse(rawPr) as unknown;
      } catch {
        penaltyRulesParsed = undefined;
      }
    }
    const penalty_rules = this.mergeSchoolReviewsPenaltyRules(penaltyRulesParsed);
    return {
      enabled: enabled ?? false,
      rating_min: Number.isNaN(ratingMin) || ratingMin < 1 ? 1 : Math.min(ratingMin, 10),
      rating_max: Number.isNaN(ratingMax) || ratingMax > 10 ? 10 : Math.max(ratingMax, 1),
      moderation_mode: moderationMode === 'moderation' ? 'moderation' : 'auto',
      allow_questions: allowQuestions ?? true,
      questions_require_moderation: questionsRequireModeration,
      content_rules,
      penalty_rules,
    };
  }

  private mergeSchoolReviewsPenaltyRules(raw: unknown, seed?: SchoolReviewsPenaltyRules): SchoolReviewsPenaltyRules {
    const base: SchoolReviewsPenaltyRules = seed
      ? { ...seed }
      : { ...DEFAULT_SCHOOL_REVIEWS_PENALTY_RULES };
    if (!raw || typeof raw !== 'object') return base;
    const o = raw as Partial<SchoolReviewsPenaltyRules>;
    if (typeof o.enabled === 'boolean') base.enabled = o.enabled;
    if (typeof o.strikes_until_ban === 'number' && !Number.isNaN(o.strikes_until_ban)) {
      base.strikes_until_ban = Math.max(1, Math.min(20, Math.round(o.strikes_until_ban)));
    }
    if (typeof o.ban_duration_days === 'number' && !Number.isNaN(o.ban_duration_days)) {
      base.ban_duration_days = Math.max(1, Math.min(3650, Math.round(o.ban_duration_days)));
    }
    if (typeof o.reset_strikes_on_ban === 'boolean') base.reset_strikes_on_ban = o.reset_strikes_on_ban;
    return base;
  }

  private cloneDefaultContentRules(): SchoolReviewsContentRules {
    return {
      daily_report_limit_per_actor: DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.daily_report_limit_per_actor,
      reasons: {
        spam: { ...DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.reasons.spam },
        uygunsuz: { ...DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.reasons.uygunsuz },
        yanlis_bilgi: { ...DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.reasons.yanlis_bilgi },
        diger: { ...DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.reasons.diger },
      },
      profanity_block_enabled: DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.profanity_block_enabled,
      blocked_terms: [...DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES.blocked_terms],
    };
  }

  /** DB JSON veya PATCH gövdesi: seed (mevcut ayarlar veya varsayılan) + doğrulama. */
  private mergeSchoolReviewsContentRules(raw: unknown, seed?: SchoolReviewsContentRules): SchoolReviewsContentRules {
    const base: SchoolReviewsContentRules = seed
      ? {
          daily_report_limit_per_actor: seed.daily_report_limit_per_actor,
          reasons: {
            spam: { ...seed.reasons.spam },
            uygunsuz: { ...seed.reasons.uygunsuz },
            yanlis_bilgi: { ...seed.reasons.yanlis_bilgi },
            diger: { ...seed.reasons.diger },
          },
          profanity_block_enabled: seed.profanity_block_enabled,
          blocked_terms: [...seed.blocked_terms],
        }
      : this.cloneDefaultContentRules();
    if (!raw || typeof raw !== 'object') {
      if (!Object.values(base.reasons).some((r) => r.enabled)) base.reasons.diger.enabled = true;
      return base;
    }
    const o = raw as Partial<SchoolReviewsContentRules>;
    if (typeof o.daily_report_limit_per_actor === 'number' && !Number.isNaN(o.daily_report_limit_per_actor)) {
      base.daily_report_limit_per_actor = Math.max(1, Math.min(50, Math.round(o.daily_report_limit_per_actor)));
    }
    if (o.reasons && typeof o.reasons === 'object') {
      const keys: SchoolReviewReportReasonKey[] = ['spam', 'uygunsuz', 'yanlis_bilgi', 'diger'];
      for (const k of keys) {
        const it = (o.reasons as Record<string, Partial<SchoolReviewsReasonItem>>)[k];
        if (!it || typeof it !== 'object') continue;
        if (typeof it.label === 'string' && it.label.trim()) {
          base.reasons[k].label = it.label.trim().slice(0, 200);
        }
        if (typeof it.hint === 'string') {
          base.reasons[k].hint = it.hint.trim().slice(0, 400);
        }
        if (typeof it.enabled === 'boolean') {
          base.reasons[k].enabled = it.enabled;
        }
      }
    }
    if (!Object.values(base.reasons).some((r) => r.enabled)) {
      base.reasons.diger.enabled = true;
    }
    if (typeof o.profanity_block_enabled === 'boolean') {
      base.profanity_block_enabled = o.profanity_block_enabled;
    }
    if (Array.isArray(o.blocked_terms)) {
      const cleaned: string[] = [];
      for (const x of o.blocked_terms) {
        if (typeof x !== 'string') continue;
        const t = x.trim().slice(0, 80);
        if (t.length >= 2 && cleaned.length < 300) cleaned.push(t);
      }
      base.blocked_terms = cleaned;
    }
    return base;
  }

  /** Herkese açık: bildirim formu seçenekleri (yalnızca açık sebepler). */
  async getSchoolReviewsReportRulesPublic(): Promise<{
    reasons: { value: SchoolReviewReportReasonKey; label: string; hint: string }[];
    daily_report_limit_per_actor: number;
    profanity_block_active: boolean;
  }> {
    const cfg = await this.getSchoolReviewsConfig();
    const r = cfg.content_rules;
    const order: SchoolReviewReportReasonKey[] = ['spam', 'uygunsuz', 'yanlis_bilgi', 'diger'];
    const reasons = order
      .filter((k) => r.reasons[k]?.enabled)
      .map((k) => ({
        value: k,
        label: r.reasons[k].label,
        hint: r.reasons[k].hint,
      }));
    return {
      reasons,
      daily_report_limit_per_actor: r.daily_report_limit_per_actor,
      profanity_block_active: r.profanity_block_enabled && r.blocked_terms.length > 0,
    };
  }

  async updateSchoolReviewsConfig(dto: SchoolReviewsConfigPatch): Promise<void> {
    const current = await this.getSchoolReviewsConfig();
    let nextMin = dto.rating_min !== undefined ? dto.rating_min : current.rating_min;
    let nextMax = dto.rating_max !== undefined ? dto.rating_max : current.rating_max;
    nextMin = Math.max(1, Math.min(10, Math.round(nextMin)));
    nextMax = Math.max(1, Math.min(10, Math.round(nextMax)));
    if (dto.rating_min !== undefined || dto.rating_max !== undefined) {
      if (nextMin > nextMax) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Minimum puan, maksimum puandan büyük olamaz.',
        });
      }
    }

    if (dto.enabled !== undefined) await this.setValue('school_reviews_enabled', dto.enabled ? 'true' : 'false');
    if (dto.rating_min !== undefined) await this.setValue('school_reviews_rating_min', String(nextMin));
    if (dto.rating_max !== undefined) await this.setValue('school_reviews_rating_max', String(nextMax));
    if (dto.moderation_mode !== undefined) await this.setValue('school_reviews_moderation_mode', dto.moderation_mode);
    if (dto.allow_questions !== undefined) await this.setValue('school_reviews_allow_questions', dto.allow_questions ? 'true' : 'false');
    if (dto.questions_require_moderation !== undefined) {
      await this.setValue('school_reviews_questions_moderation', dto.questions_require_moderation ? 'true' : 'false');
    }
    if (dto.content_rules !== undefined) {
      const merged = this.mergeSchoolReviewsContentRules(dto.content_rules, current.content_rules);
      await this.setValue('school_reviews_content_rules', JSON.stringify(merged));
    }
    if (dto.penalty_rules !== undefined) {
      const merged = this.mergeSchoolReviewsPenaltyRules(dto.penalty_rules, current.penalty_rules);
      await this.setValue('school_reviews_penalty_rules', JSON.stringify(merged));
    }
  }

  /** Tüm ders/sınıf için haftalık ders saati. Önce app_config, yoksa static fallback. */
  async getDersSaati(subjectCode: string, grade: number): Promise<number> {
    const { getDersSaatiStatic } = await import('../config/ders-saati');
    const config = await this.getDersSaatiConfig();
    const base = (subjectCode ?? '').toLowerCase().trim().replace(/_maarif(_[a-z]+)?$/, '').replace(/_maarif$/, '');
    const byGrade = config[base];
    if (byGrade && typeof byGrade[grade] === 'number' && byGrade[grade] >= 0 && byGrade[grade] <= 10) {
      return Math.round(byGrade[grade]);
    }
    return getDersSaatiStatic(subjectCode, grade);
  }

  /** Ders saati ayarlarını oku – Evrak ayarlar sayfası için. */
  async getDersSaatiConfig(): Promise<DersSaatiConfig> {
    const raw = await this.getValue('ders_saati');
    if (!raw?.trim()) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, Record<string, number>>;
      const result: DersSaatiConfig = {};
      for (const [subj, grades] of Object.entries(parsed)) {
        if (grades && typeof grades === 'object') {
          result[subj] = {};
          for (const [g, s] of Object.entries(grades)) {
            const gn = parseInt(g, 10);
            if (Number.isFinite(gn) && gn >= 1 && gn <= 12 && typeof s === 'number' && s >= 0 && s <= 10) {
              result[subj][gn] = Math.round(s);
            }
          }
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  /** Haber Yayın sayfası SEO ayarları. Public metadata için kullanılır. */
  async getYayinSeoConfig(): Promise<YayinSeoConfig> {
    const title = await this.getValue('yayin_seo_title');
    const description = await this.getValue('yayin_seo_description');
    const ogImage = await this.getValue('yayin_seo_og_image');
    const robots = await this.getValue('yayin_seo_robots');
    const keywords = await this.getValue('yayin_seo_keywords');
    const siteUrl = await this.getValue('yayin_seo_site_url');
    const siteName = await this.getValue('yayin_seo_site_name');
    return {
      title: title?.trim() || 'Haber Yayını – Uzaedu Öğretmen',
      description: description?.trim() || '',
      og_image: ogImage?.trim() || null,
      robots: robots?.trim() === 'index' ? 'index' : 'noindex',
      keywords: keywords?.trim() || '',
      site_url: siteUrl?.trim() || null,
      site_name: siteName?.trim() || null,
    };
  }

  /** Yayın SEO ayarlarını güncelle – superadmin tarafından. */
  async updateYayinSeoConfig(
    dto: Partial<{
      title?: string | null;
      description?: string | null;
      og_image?: string | null;
      robots?: 'index' | 'noindex';
      keywords?: string | null;
      site_url?: string | null;
      site_name?: string | null;
    }>,
  ): Promise<void> {
    if (dto.title !== undefined) await this.setValue('yayin_seo_title', dto.title?.trim() || null);
    if (dto.description !== undefined) await this.setValue('yayin_seo_description', dto.description?.trim() || null);
    if (dto.og_image !== undefined) await this.setValue('yayin_seo_og_image', dto.og_image?.trim() || null);
    if (dto.robots !== undefined) await this.setValue('yayin_seo_robots', dto.robots === 'index' ? 'index' : 'noindex');
    if (dto.keywords !== undefined) await this.setValue('yayin_seo_keywords', dto.keywords?.trim() || null);
    if (dto.site_url !== undefined) await this.setValue('yayin_seo_site_url', dto.site_url?.trim() || null);
    if (dto.site_name !== undefined) await this.setValue('yayin_seo_site_name', dto.site_name?.trim() || null);
  }

  private readonly webPublicConfigKey = 'web_public_config';

  /** Genel web (footer, iletişim, sosyal) – public sayfalar için. */
  async getWebPublicConfig(): Promise<WebPublicConfig> {
    const raw = await this.getValue(this.webPublicConfigKey);
    if (!raw?.trim()) return { ...DEFAULT_WEB_PUBLIC };
    try {
      const parsed = JSON.parse(raw) as Partial<WebPublicConfig>;
      const merged = { ...DEFAULT_WEB_PUBLIC, ...parsed };
      merged.footer_nav_items = sanitizeFooterNavItems(merged.footer_nav_items);
      merged.header_shell_style = sanitizeHeaderShellStyle(merged.header_shell_style);
      merged.header_shell_density = sanitizeHeaderShellDensity(merged.header_shell_density);
      merged.header_shell_accent = sanitizeHeaderShellAccent(merged.header_shell_accent);
      if (merged.footer_copyright_suffix !== undefined && merged.footer_copyright_suffix !== null) {
        merged.footer_copyright_suffix = merged.footer_copyright_suffix.trim() || null;
      }
      if (merged.header_brand_subtitle !== undefined && merged.header_brand_subtitle !== null) {
        merged.header_brand_subtitle = merged.header_brand_subtitle.trim().slice(0, 120) || null;
      }
      return merged;
    } catch {
      return { ...DEFAULT_WEB_PUBLIC };
    }
  }

  async updateWebPublicConfig(dto: Partial<WebPublicConfig>): Promise<void> {
    const current = await this.getWebPublicConfig();
    const next: WebPublicConfig = { ...current };
    if (dto.footer_nav_items !== undefined) {
      next.footer_nav_items = sanitizeFooterNavItems(dto.footer_nav_items);
    }
    if (dto.header_shell_style !== undefined) {
      next.header_shell_style = sanitizeHeaderShellStyle(dto.header_shell_style);
    }
    if (dto.header_brand_subtitle !== undefined) {
      next.header_brand_subtitle = dto.header_brand_subtitle?.trim().slice(0, 120) || null;
    }
    if (dto.header_shell_density !== undefined) {
      next.header_shell_density = sanitizeHeaderShellDensity(dto.header_shell_density);
    }
    if (dto.header_shell_accent !== undefined) {
      next.header_shell_accent = sanitizeHeaderShellAccent(dto.header_shell_accent);
    }
    const keys = Object.keys(DEFAULT_WEB_PUBLIC) as (keyof WebPublicConfig)[];
    for (const k of keys) {
      if (
        k === 'footer_nav_items' ||
        k === 'header_shell_style' ||
        k === 'header_brand_subtitle' ||
        k === 'header_shell_density' ||
        k === 'header_shell_accent'
      )
        continue;
      if (dto[k] === undefined) continue;
      const v = dto[k];
      if (typeof v === 'string') {
        next[k] = (v.trim() || null) as WebPublicConfig[typeof k];
      }
    }
    await this.setValue(this.webPublicConfigKey, JSON.stringify(next));
  }

  private readonly legalPagesConfigKey = 'legal_pages_config';

  /** Gizlilik / şartlar / çerez sayfaları — public ve admin. */
  async getLegalPagesConfig(): Promise<LegalPagesConfig> {
    const raw = await this.getValue(this.legalPagesConfigKey);
    let parsed: Partial<Record<LegalPageKey, Partial<LegalPageContent>>> | null = null;
    if (raw?.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    return mergeLegalPagesFromStored(parsed);
  }

  async updateLegalPagesConfig(
    dto: Partial<
      Record<LegalPageKey, Partial<Pick<LegalPageContent, 'title' | 'meta_description' | 'body_html'>>>
    >,
  ): Promise<void> {
    const raw = await this.getValue(this.legalPagesConfigKey);
    let parsed: Partial<Record<LegalPageKey, Partial<LegalPageContent>>> | null = null;
    if (raw?.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const merged = mergeLegalPagesFromStored(parsed);
    const now = new Date().toISOString();
    for (const key of LEGAL_PAGE_KEYS) {
      const patch = dto[key];
      if (!patch) continue;
      if (patch.title !== undefined) merged[key].title = patch.title?.trim() || merged[key].title;
      if (patch.meta_description !== undefined) merged[key].meta_description = patch.meta_description?.trim() ?? '';
      if (patch.body_html !== undefined) merged[key].body_html = sanitizeLegalHtml(patch.body_html ?? '');
      merged[key].updated_at = now;
    }
    await this.setValue(this.legalPagesConfigKey, JSON.stringify(merged));
  }

  private readonly webExtrasConfigKey = 'web_extras_config';

  /** Yalnızca DB’deki JSON — captcha ile birleştirilmez (PATCH tutarlılığı için). */
  private async getWebExtrasStoredOnly(): Promise<WebExtrasConfig> {
    const raw = await this.getValue(this.webExtrasConfigKey);
    if (!raw?.trim()) return cloneWebExtrasDefaults();
    try {
      const parsed = JSON.parse(raw) as Partial<WebExtrasConfig>;
      return mergeWebExtrasFromStored(parsed);
    } catch {
      return cloneWebExtrasDefaults();
    }
  }

  async getWebExtrasConfig(): Promise<WebExtrasConfig> {
    const merged = await this.getWebExtrasStoredOnly();
    const cap = await this.getCaptchaConfig();
    if (cap.enabled && cap.provider !== 'none' && cap.site_key?.trim()) {
      merged.recaptcha_site_key = cap.site_key.trim();
    }
    return merged;
  }

  async updateWebExtrasConfig(dto: Partial<WebExtrasConfig>): Promise<void> {
    const current = await this.getWebExtrasStoredOnly();
    const next: WebExtrasConfig = { ...current };
    if (dto.gtm_id !== undefined) next.gtm_id = dto.gtm_id?.trim() || null;
    if (dto.ga4_measurement_id !== undefined) next.ga4_measurement_id = dto.ga4_measurement_id?.trim() || null;
    if (dto.maintenance_enabled !== undefined) next.maintenance_enabled = !!dto.maintenance_enabled;
    if (dto.maintenance_message_html !== undefined) {
      next.maintenance_message_html = dto.maintenance_message_html
        ? sanitizeLegalHtml(dto.maintenance_message_html)
        : null;
    }
    if (dto.maintenance_allowed_exact !== undefined) {
      next.maintenance_allowed_exact = Array.isArray(dto.maintenance_allowed_exact)
        ? dto.maintenance_allowed_exact.map((s) => String(s).trim()).filter(Boolean)
        : current.maintenance_allowed_exact;
    }
    if (dto.maintenance_allowed_prefixes !== undefined) {
      next.maintenance_allowed_prefixes = Array.isArray(dto.maintenance_allowed_prefixes)
        ? dto.maintenance_allowed_prefixes.map((s) => String(s).trim()).filter(Boolean)
        : current.maintenance_allowed_prefixes;
    }
    if (dto.cache_ttl_yayin_seo !== undefined) next.cache_ttl_yayin_seo = clampCacheTtl(dto.cache_ttl_yayin_seo, 300);
    if (dto.cache_ttl_web_public !== undefined) next.cache_ttl_web_public = clampCacheTtl(dto.cache_ttl_web_public, 300);
    if (dto.cache_ttl_legal_pages !== undefined) next.cache_ttl_legal_pages = clampCacheTtl(dto.cache_ttl_legal_pages, 120);
    if (dto.cache_ttl_web_extras !== undefined) next.cache_ttl_web_extras = clampCacheTtl(dto.cache_ttl_web_extras, 30);
    if (dto.global_robots_noindex !== undefined) next.global_robots_noindex = !!dto.global_robots_noindex;
    if (dto.default_og_image_url !== undefined) next.default_og_image_url = dto.default_og_image_url?.trim() || null;
    if (dto.meta_description !== undefined) next.meta_description = dto.meta_description?.trim() || null;
    if (dto.recaptcha_site_key !== undefined) next.recaptcha_site_key = dto.recaptcha_site_key?.trim() || null;
    if (dto.pwa_short_name !== undefined) next.pwa_short_name = dto.pwa_short_name?.trim() || null;
    if (dto.theme_color !== undefined) next.theme_color = dto.theme_color?.trim() || null;
    if (dto.favicon_url !== undefined) next.favicon_url = dto.favicon_url?.trim() || null;
    if (dto.app_store_url !== undefined) next.app_store_url = dto.app_store_url?.trim() || null;
    if (dto.play_store_url !== undefined) next.play_store_url = dto.play_store_url?.trim() || null;
    if (dto.help_center_url !== undefined) next.help_center_url = dto.help_center_url?.trim() || null;
    if (dto.support_enabled !== undefined) next.support_enabled = !!dto.support_enabled;
    if (dto.ads_enabled !== undefined) next.ads_enabled = !!dto.ads_enabled;
    if (dto.ads_web_targeting_requires_cookie_consent !== undefined) {
      next.ads_web_targeting_requires_cookie_consent = !!dto.ads_web_targeting_requires_cookie_consent;
    }
    if (dto.guest_public_web_shell_nav !== undefined) {
      next.guest_public_web_shell_nav = normalizeGuestPublicWebShellNav(dto.guest_public_web_shell_nav);
    }
    await this.setValue(this.webExtrasConfigKey, JSON.stringify(next));
  }

  private readonly gdprConfigKey = 'gdpr_config';

  async getGdprConfig(): Promise<GdprConfig> {
    const raw = await this.getValue(this.gdprConfigKey);
    if (!raw?.trim()) return cloneGdprDefaults();
    try {
      const parsed = JSON.parse(raw) as Partial<GdprConfig>;
      return mergeGdprFromStored(parsed);
    } catch {
      return cloneGdprDefaults();
    }
  }

  async updateGdprConfig(dto: Partial<GdprConfig>): Promise<void> {
    const current = await this.getGdprConfig();
    const next: GdprConfig = { ...current };
    if (dto.cookie_banner_enabled !== undefined) next.cookie_banner_enabled = !!dto.cookie_banner_enabled;
    if (dto.cookie_banner_title !== undefined) {
      next.cookie_banner_title = dto.cookie_banner_title ? String(dto.cookie_banner_title).trim().slice(0, 120) : null;
    }
    if (dto.accept_button_label !== undefined) {
      next.accept_button_label = dto.accept_button_label ? String(dto.accept_button_label).trim().slice(0, 64) : null;
    }
    if (dto.reject_button_label !== undefined) {
      next.reject_button_label = dto.reject_button_label ? String(dto.reject_button_label).trim().slice(0, 64) : null;
    }
    if (dto.cookie_banner_body_html !== undefined) {
      next.cookie_banner_body_html = dto.cookie_banner_body_html
        ? sanitizeLegalHtml(dto.cookie_banner_body_html)
        : null;
    }
    if (dto.consent_version !== undefined) {
      next.consent_version = String(dto.consent_version).trim().slice(0, 32) || current.consent_version;
    }
    if (dto.data_controller_name !== undefined) next.data_controller_name = dto.data_controller_name?.trim() || null;
    if (dto.dpo_email !== undefined) next.dpo_email = dto.dpo_email?.trim() || null;
    if (dto.cookie_policy_path !== undefined) {
      next.cookie_policy_path = String(dto.cookie_policy_path).trim().replace(/\s/g, '') || current.cookie_policy_path;
    }
    if (dto.reject_button_visible !== undefined) next.reject_button_visible = !!dto.reject_button_visible;
    if (dto.cookie_banner_visual !== undefined) {
      next.cookie_banner_visual = normalizeCookieBannerVisual(dto.cookie_banner_visual);
    }
    if (dto.cache_ttl_gdpr !== undefined) next.cache_ttl_gdpr = clampCacheTtl(dto.cache_ttl_gdpr, 120);
    await this.setValue(this.gdprConfigKey, JSON.stringify(next));
  }

  private readonly captchaConfigKey = 'captcha_config';

  async getCaptchaConfig(): Promise<CaptchaConfig> {
    const raw = await this.getValue(this.captchaConfigKey);
    if (raw?.trim()) {
      try {
        return mergeCaptchaFromStored(JSON.parse(raw) as Partial<CaptchaConfig>);
      } catch {
        return cloneCaptchaDefaults();
      }
    }
    const wxRaw = await this.getValue(this.webExtrasConfigKey);
    let siteFromWx: string | null = null;
    if (wxRaw?.trim()) {
      try {
        const p = JSON.parse(wxRaw) as Partial<WebExtrasConfig>;
        siteFromWx = p.recaptcha_site_key?.trim() || null;
      } catch {
        siteFromWx = null;
      }
    }
    if (siteFromWx) {
      return mergeCaptchaFromStored({
        site_key: siteFromWx,
        enabled: true,
        provider: 'recaptcha_v3',
      });
    }
    return cloneCaptchaDefaults();
  }

  async getCaptchaConfigForAdmin(): Promise<CaptchaConfigForAdmin> {
    const c = await this.getCaptchaConfig();
    return {
      ...c,
      secret_key: c.secret_key ? CAPTCHA_SECRET_MASK : null,
    };
  }

  toCaptchaPublic(c: CaptchaConfig): CaptchaPublic {
    const { secret_key, ...rest } = c;
    void secret_key;
    return rest;
  }

  async getCaptchaPublic(): Promise<CaptchaPublic> {
    const c = await this.getCaptchaConfig();
    const p = this.toCaptchaPublic(c);
    if (!c.enabled || c.provider === 'none') {
      return {
        ...p,
        enabled: false,
        provider: 'none',
        site_key: null,
      };
    }
    return p;
  }

  async updateCaptchaConfig(dto: Partial<CaptchaConfig & { secret_key?: string | null }>): Promise<void> {
    const current = await this.getCaptchaConfig();
    const next: CaptchaConfig = { ...current };
    if (dto.enabled !== undefined) next.enabled = !!dto.enabled;
    if (dto.provider !== undefined) {
      next.provider = normalizeCaptchaProvider(dto.provider);
      if (next.provider === 'none') next.enabled = false;
    }
    if (dto.site_key !== undefined) next.site_key = dto.site_key?.trim() || null;
    if (dto.secret_key !== undefined) {
      const s = dto.secret_key;
      if (s === null || s === '') {
        next.secret_key = null;
      } else {
        const t = String(s).trim();
        if (t && t !== CAPTCHA_SECRET_MASK) next.secret_key = t;
      }
    }
    if (dto.v3_min_score !== undefined) next.v3_min_score = clampCaptchaScore(dto.v3_min_score, current.v3_min_score);
    if (dto.protect_login !== undefined) next.protect_login = !!dto.protect_login;
    if (dto.protect_register !== undefined) next.protect_register = !!dto.protect_register;
    if (dto.protect_forgot_password !== undefined) next.protect_forgot_password = !!dto.protect_forgot_password;
    if (dto.cache_ttl_captcha !== undefined) next.cache_ttl_captcha = clampCacheTtl(dto.cache_ttl_captcha, 120);
    if (next.provider === 'none') next.enabled = false;
    await this.setValue(this.captchaConfigKey, JSON.stringify(next));
  }

  private readonly devopsConfigKey = 'devops_config';

  async getDevOpsConfig(): Promise<DevOpsConfig> {
    const raw = await this.getValue(this.devopsConfigKey);
    if (!raw?.trim()) return mergeDevOpsFromStored(null);
    try {
      const parsed = JSON.parse(raw) as Partial<DevOpsConfig>;
      return mergeDevOpsFromStored(parsed);
    } catch {
      return mergeDevOpsFromStored(null);
    }
  }

  async updateDevOpsConfig(dto: Partial<DevOpsConfig>): Promise<void> {
    const current = await this.getDevOpsConfig();
    const next: DevOpsConfig = { ...current };
    if (dto.git_repo_url !== undefined) {
      const t = dto.git_repo_url?.trim().slice(0, 500) || null;
      next.git_repo_url = t;
    }
    if (dto.git_default_branch !== undefined) {
      const t = dto.git_default_branch?.trim().slice(0, 64);
      next.git_default_branch = t || 'main';
    }
    if (dto.cicd_url !== undefined) {
      next.cicd_url = dto.cicd_url?.trim().slice(0, 500) || null;
    }
    if (dto.production_api_url !== undefined) {
      next.production_api_url = dto.production_api_url?.trim().slice(0, 500) || null;
    }
    if (dto.production_web_url !== undefined) {
      next.production_web_url = dto.production_web_url?.trim().slice(0, 500) || null;
    }
    if (dto.deploy_notes !== undefined) {
      const t = dto.deploy_notes != null ? String(dto.deploy_notes).trim().slice(0, 12000) : '';
      next.deploy_notes = t || null;
    }
    await this.setValue(this.devopsConfigKey, JSON.stringify(next));
  }

  private readonly mobileAppConfigKey = 'mobile_app_config';

  async getMobileAppConfig(): Promise<MobileAppConfig> {
    const raw = await this.getValue(this.mobileAppConfigKey);
    if (!raw?.trim()) return cloneMobileDefaults();
    try {
      const parsed = JSON.parse(raw) as Partial<MobileAppConfig>;
      return mergeMobileFromStored(parsed);
    } catch {
      return cloneMobileDefaults();
    }
  }

  async updateMobileAppConfig(dto: Partial<MobileAppConfig>): Promise<void> {
    const current = await this.getMobileAppConfig();
    const next: MobileAppConfig = {
      ...current,
      feature_flags: { ...current.feature_flags },
      supported_locales: [...current.supported_locales],
    };
    if (dto.cache_ttl_mobile_config !== undefined) {
      next.cache_ttl_mobile_config = clampCacheTtl(dto.cache_ttl_mobile_config, 60);
    }
    if (dto.ios_min_version !== undefined) next.ios_min_version = dto.ios_min_version?.trim() || null;
    if (dto.android_min_version !== undefined) next.android_min_version = dto.android_min_version?.trim() || null;
    if (dto.ios_latest_version !== undefined) next.ios_latest_version = dto.ios_latest_version?.trim() || null;
    if (dto.android_latest_version !== undefined) next.android_latest_version = dto.android_latest_version?.trim() || null;
    if (dto.force_update_ios !== undefined) next.force_update_ios = !!dto.force_update_ios;
    if (dto.force_update_android !== undefined) next.force_update_android = !!dto.force_update_android;
    if (dto.update_message !== undefined) {
      next.update_message = dto.update_message ? sanitizeLegalHtml(dto.update_message) : null;
    }
    if (dto.ios_bundle_id !== undefined) next.ios_bundle_id = dto.ios_bundle_id?.trim() || null;
    if (dto.android_application_id !== undefined) next.android_application_id = dto.android_application_id?.trim() || null;
    if (dto.ios_app_store_id !== undefined) {
      next.ios_app_store_id = dto.ios_app_store_id ? String(dto.ios_app_store_id).replace(/\D/g, '').slice(0, 20) || null : null;
    }
    if (dto.app_store_url !== undefined) next.app_store_url = dto.app_store_url?.trim() || null;
    if (dto.play_store_url !== undefined) next.play_store_url = dto.play_store_url?.trim() || null;
    if (dto.marketing_url !== undefined) next.marketing_url = dto.marketing_url?.trim() || null;
    if (dto.faq_url !== undefined) next.faq_url = dto.faq_url?.trim() || null;
    if (dto.privacy_policy_url !== undefined) next.privacy_policy_url = dto.privacy_policy_url?.trim() || null;
    if (dto.terms_url !== undefined) next.terms_url = dto.terms_url?.trim() || null;
    if (dto.help_center_url !== undefined) next.help_center_url = dto.help_center_url?.trim() || null;
    if (dto.support_email !== undefined) next.support_email = dto.support_email?.trim() || null;
    if (dto.universal_link_host !== undefined) next.universal_link_host = dto.universal_link_host?.trim() || null;
    if (dto.url_scheme !== undefined) {
      next.url_scheme = dto.url_scheme ? dto.url_scheme.trim().replace(/^:+/, '').replace(/:+$/, '') || null : null;
    }
    if (dto.api_base_url_public !== undefined) next.api_base_url_public = dto.api_base_url_public?.trim() || null;
    if (dto.config_schema_version !== undefined) {
      next.config_schema_version = dto.config_schema_version ? String(dto.config_schema_version).trim().slice(0, 32) : null;
    }
    if (dto.default_locale !== undefined) {
      next.default_locale = dto.default_locale
        ? String(dto.default_locale).trim().toLowerCase().slice(0, 16)
        : DEFAULT_MOBILE_APP.default_locale;
    }
    if (dto.supported_locales !== undefined) {
      next.supported_locales = sanitizeSupportedLocales(dto.supported_locales, next.supported_locales);
    }
    if (dto.mobile_maintenance_enabled !== undefined) next.mobile_maintenance_enabled = !!dto.mobile_maintenance_enabled;
    if (dto.mobile_maintenance_message !== undefined) {
      next.mobile_maintenance_message = dto.mobile_maintenance_message
        ? sanitizeLegalHtml(dto.mobile_maintenance_message)
        : null;
    }
    if (dto.in_app_review_enabled !== undefined) next.in_app_review_enabled = !!dto.in_app_review_enabled;
    if (dto.push_notifications_enabled !== undefined) next.push_notifications_enabled = !!dto.push_notifications_enabled;
    if (dto.ads_enabled !== undefined) next.ads_enabled = !!dto.ads_enabled;
    if (dto.feature_flags !== undefined) {
      next.feature_flags = sanitizeFeatureFlags(dto.feature_flags);
    }
    await this.setValue(this.mobileAppConfigKey, JSON.stringify(next));
  }

  /** Kamu API Cache-Control max-age (sn). */
  async getPublicCacheMaxAge(
    kind:
      | 'yayin_seo'
      | 'web_public'
      | 'legal_pages'
      | 'web_extras'
      | 'mobile_config'
      | 'market_policy'
      | 'gdpr'
      | 'captcha',
  ): Promise<number> {
    if (kind === 'mobile_config') {
      const m = await this.getMobileAppConfig();
      return m.cache_ttl_mobile_config;
    }
    if (kind === 'market_policy') {
      const mp = await this.getMarketPolicyConfig();
      return mp.cache_ttl_market_policy;
    }
    if (kind === 'gdpr') {
      const g = await this.getGdprConfig();
      return g.cache_ttl_gdpr;
    }
    if (kind === 'captcha') {
      const c = await this.getCaptchaConfig();
      return c.cache_ttl_captcha;
    }
    const cfg = await this.getWebExtrasConfig();
    if (kind === 'yayin_seo') return cfg.cache_ttl_yayin_seo;
    if (kind === 'web_public') return cfg.cache_ttl_web_public;
    if (kind === 'legal_pages') return cfg.cache_ttl_legal_pages;
    return cfg.cache_ttl_web_extras;
  }

  /** Ders saati ayarlarını kaydet. */
  async updateDersSaatiConfig(dto: DersSaatiConfig): Promise<void> {
    const sanitized: Record<string, Record<string, number>> = {};
    for (const [subj, grades] of Object.entries(dto)) {
      if (!subj?.trim() || !grades || typeof grades !== 'object') continue;
      sanitized[subj.trim().toLowerCase()] = {};
      for (const [g, s] of Object.entries(grades)) {
        const gn = parseInt(g, 10);
        if (Number.isFinite(gn) && gn >= 1 && gn <= 12 && typeof s === 'number' && s >= 0 && s <= 10) {
          sanitized[subj.trim().toLowerCase()][String(gn)] = Math.round(s);
        }
      }
    }
    await this.setValue('ders_saati', JSON.stringify(sanitized));
  }

  /** Optik / Açık Uçlu modülü ayarlarını al – superadmin için (API key maskeli) */
  async getOptikConfig(): Promise<OptikConfig> {
    const enabled = (await this.getValue('optik_module_enabled'))?.toLowerCase() === 'true';
    const lang = (await this.getValue('optik_default_language'))?.toLowerCase();
    const apiKey = await this.getValue('optik_openai_api_key');
    const model = (await this.getValue('optik_openai_model'))?.trim() || 'gpt-4o-mini';
    const temp = parseFloat((await this.getValue('optik_openai_temperature')) || '0');
    const ocr = (await this.getValue('optik_ocr_provider'))?.toLowerCase();
    const threshold = parseFloat((await this.getValue('optik_confidence_threshold')) || '0.7');
    const modesRaw = await this.getValue('optik_grade_modes');
    const limitRaw = await this.getValue('optik_daily_limit_per_user');
    const cacheTtl = parseInt((await this.getValue('optik_key_text_cache_ttl_hours')) || '24', 10);

    const modes = modesRaw?.trim()
      ? modesRaw.split(',').map((m) => m.trim()).filter(Boolean)
      : OPTIK_DEFAULT_MODES;

    const validOcr = ['google', 'azure', 'openai_vision', 'placeholder'].includes(ocr || '')
      ? ocr as OptikConfig['ocr_provider']
      : 'placeholder';

    const googleProjectId = (await this.getValue('optik_ocr_google_project_id'))?.trim() || null;
    const googleCreds = await this.getValue('optik_ocr_google_credentials');
    const googleLocation = (await this.getValue('optik_ocr_google_location'))?.trim() || null;
    const googleProcessorId = (await this.getValue('optik_ocr_google_processor_id'))?.trim() || null;
    const azureEndpoint = (await this.getValue('optik_ocr_azure_endpoint'))?.trim() || null;
    const azureKey = await this.getValue('optik_ocr_azure_api_key');
    const azureModel = (await this.getValue('optik_ocr_azure_model'))?.trim() || null;
    const ocrTimeoutRaw = await this.getValue('optik_ocr_timeout_seconds');
    const ocrRetryRaw = await this.getValue('optik_ocr_retry_count');
    const ocrLang = (await this.getValue('optik_ocr_language_hint'))?.toLowerCase();

    return {
      module_enabled: enabled ?? false,
      default_language: lang === 'en' ? 'en' : 'tr',
      openai_api_key: apiKey?.trim() ? '••••••••' : null,
      openai_model: model,
      openai_temperature: Number.isNaN(temp) || temp < 0 || temp > 2 ? 0 : temp,
      ocr_provider: validOcr,
      ocr_google_project_id: googleProjectId,
      ocr_google_credentials: googleCreds?.trim() ? '••••••••' : null,
      ocr_google_location: googleLocation,
      ocr_google_processor_id: googleProcessorId,
      ocr_azure_endpoint: azureEndpoint,
      ocr_azure_api_key: azureKey?.trim() ? '••••••••' : null,
      ocr_azure_model: azureModel,
      ocr_timeout_seconds: ocrTimeoutRaw ? parseInt(ocrTimeoutRaw, 10) : null,
      ocr_retry_count: ocrRetryRaw ? parseInt(ocrRetryRaw, 10) : null,
      ocr_language_hint: ocrLang === 'tr' || ocrLang === 'en' ? ocrLang : null,
      confidence_threshold: Number.isNaN(threshold) || threshold < 0 || threshold > 1 ? 0.7 : threshold,
      grade_modes: modes.length > 0 ? modes : OPTIK_DEFAULT_MODES,
      daily_limit_per_user: limitRaw?.trim() ? parseInt(limitRaw, 10) : null,
      key_text_cache_ttl_hours: Number.isNaN(cacheTtl) || cacheTtl < 1 ? 24 : Math.min(cacheTtl, 168),
    };
  }

  /** Optik ayarlarını güncelle – superadmin tarafından */
  async updateOptikConfig(dto: Partial<OptikConfig>): Promise<void> {
    if (dto.module_enabled !== undefined) {
      await this.setValue('optik_module_enabled', dto.module_enabled ? 'true' : 'false');
    }
    if (dto.default_language !== undefined) {
      await this.setValue('optik_default_language', dto.default_language === 'en' ? 'en' : 'tr');
    }
    if (dto.openai_api_key !== undefined) {
      const v = dto.openai_api_key?.trim() || null;
      if (v && v !== '••••••••') await this.setValue('optik_openai_api_key', v);
      // Boş, maskeli (••••••••) veya aynı = değiştirme
    }
    if (dto.openai_model !== undefined) await this.setValue('optik_openai_model', dto.openai_model?.trim() || 'gpt-4o-mini');
    if (dto.openai_temperature !== undefined) {
      const t = Math.max(0, Math.min(2, dto.openai_temperature));
      await this.setValue('optik_openai_temperature', String(t));
    }
    if (dto.ocr_provider !== undefined) {
      const valid = ['google', 'azure', 'openai_vision', 'placeholder'].includes(dto.ocr_provider)
        ? dto.ocr_provider
        : 'placeholder';
      await this.setValue('optik_ocr_provider', valid);
    }
    if (dto.ocr_google_project_id !== undefined) {
      await this.setValue('optik_ocr_google_project_id', dto.ocr_google_project_id?.trim() || null);
    }
    if (dto.ocr_google_credentials !== undefined) {
      const v = dto.ocr_google_credentials?.trim() || null;
      if (v && v !== '••••••••') await this.setValue('optik_ocr_google_credentials', v);
    }
    if (dto.ocr_google_location !== undefined) {
      await this.setValue('optik_ocr_google_location', dto.ocr_google_location?.trim() || null);
    }
    if (dto.ocr_google_processor_id !== undefined) {
      await this.setValue('optik_ocr_google_processor_id', dto.ocr_google_processor_id?.trim() || null);
    }
    if (dto.ocr_azure_endpoint !== undefined) {
      await this.setValue('optik_ocr_azure_endpoint', dto.ocr_azure_endpoint?.trim() || null);
    }
    if (dto.ocr_azure_api_key !== undefined) {
      const v = dto.ocr_azure_api_key?.trim() || null;
      if (v && v !== '••••••••') await this.setValue('optik_ocr_azure_api_key', v);
    }
    if (dto.ocr_azure_model !== undefined) {
      await this.setValue('optik_ocr_azure_model', dto.ocr_azure_model?.trim() || null);
    }
    if (dto.ocr_timeout_seconds !== undefined) {
      const v = dto.ocr_timeout_seconds;
      await this.setValue('optik_ocr_timeout_seconds', v == null ? null : String(Math.max(1, Math.min(120, v))));
    }
    if (dto.ocr_retry_count !== undefined) {
      const v = dto.ocr_retry_count;
      await this.setValue('optik_ocr_retry_count', v == null ? null : String(Math.max(0, Math.min(5, v))));
    }
    if (dto.ocr_language_hint !== undefined) {
      const v = dto.ocr_language_hint === 'tr' || dto.ocr_language_hint === 'en' ? dto.ocr_language_hint : null;
      await this.setValue('optik_ocr_language_hint', v);
    }
    if (dto.confidence_threshold !== undefined) {
      const t = Math.max(0, Math.min(1, dto.confidence_threshold));
      await this.setValue('optik_confidence_threshold', String(t));
    }
    if (dto.grade_modes !== undefined) {
      const arr = Array.isArray(dto.grade_modes)
        ? dto.grade_modes.filter((m) => typeof m === 'string' && m.trim())
        : OPTIK_DEFAULT_MODES;
      await this.setValue('optik_grade_modes', arr.length > 0 ? arr.join(',') : OPTIK_DEFAULT_MODES.join(','));
    }
    if (dto.daily_limit_per_user !== undefined) {
      const v = dto.daily_limit_per_user;
      await this.setValue('optik_daily_limit_per_user', v == null ? null : String(Math.max(0, v)));
    }
    if (dto.key_text_cache_ttl_hours !== undefined) {
      const h = Math.max(1, Math.min(168, dto.key_text_cache_ttl_hours));
      await this.setValue('optik_key_text_cache_ttl_hours', String(h));
    }
  }

  /** Sınav görevi sync ayarları – GPT ile tarih/link çıkarma (Optik tarzı) + sync seçenekleri */
  async getExamDutySyncConfig(): Promise<{
    gpt_enabled: boolean;
    openai_api_key: string | null;
    default_times: ExamDutyDefaultTimes;
    notification_times: ExamDutyNotificationTimes;
    sync_options: ExamDutySyncOptions;
  }> {
    const enabled = (await this.getValue('exam_duty_gpt_enabled'))?.toLowerCase() === 'true';
    const apiKey = await this.getValue('exam_duty_openai_api_key');
    const raw = await this.getValue('exam_duty_default_times');
    const defaultTimes: ExamDutyDefaultTimes = {};
    for (const k of EXAM_DUTY_TIME_KEYS) {
      defaultTimes[k] = EXAM_DUTY_DEFAULT_TIMES_PRESET[k];
    }
    if (raw?.trim()) {
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const k of EXAM_DUTY_TIME_KEYS) {
          const v = parsed[k]?.trim();
          if (v && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) defaultTimes[k] = v;
        }
      } catch {
        /* ignore */
      }
    }
    const syncOptions = await this.getExamDutySyncOptions();
    const notification_times = await this.getExamDutyNotificationTimes();
    return {
      gpt_enabled: enabled ?? false,
      openai_api_key: apiKey?.trim() ? '••••••••' : null,
      default_times: defaultTimes,
      notification_times,
      sync_options: syncOptions,
    };
  }

  /** Planlı sınav görevi bildirim saatleri (Europe/Istanbul). */
  async getExamDutyNotificationTimes(): Promise<ExamDutyNotificationTimes> {
    const raw = await this.getValue('exam_duty_notification_times');
    const out: ExamDutyNotificationTimes = { ...DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES };
    if (raw?.trim()) {
      try {
        const p = JSON.parse(raw) as Partial<Record<keyof ExamDutyNotificationTimes, string>>;
        for (const k of EXAM_DUTY_NOTIFICATION_KEYS) {
          const v = p[k]?.trim();
          if (v && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) {
            const m = v.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
            if (m) out[k] = `${m[1]!.padStart(2, '0')}:${m[2]}`;
          }
        }
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  /** Sınav görevi sync ek seçenekleri – skip_past_exam_date, recheck_max_count, fetch_timeout_ms, log_gpt_usage */
  async getExamDutySyncOptions(): Promise<ExamDutySyncOptions> {
    const raw = await this.getValue('exam_duty_sync_options');
    if (!raw?.trim()) return { ...DEFAULT_EXAM_DUTY_SYNC_OPTIONS };
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const maxNew = Number(parsed.max_new_per_sync);
      return {
        skip_past_exam_date: parsed.skip_past_exam_date === true,
        recheck_max_count: Math.max(1, Math.min(10, Number(parsed.recheck_max_count) || 1)),
        fetch_timeout_ms: Math.max(5000, Math.min(60000, Number(parsed.fetch_timeout_ms) || 30000)),
        log_gpt_usage: parsed.log_gpt_usage === true,
        add_draft_without_dates: parsed.add_draft_without_dates === true,
        max_new_per_sync: maxNew < 0 ? 0 : Math.min(500, maxNew || 0),
        sync_schedule_times: normalizeExamDutySyncScheduleTimes(parsed.sync_schedule_times),
        notify_superadmin_on_sync_items: parsed.notify_superadmin_on_sync_items !== false,
        auto_publish_gpt_sync_duties: parsed.auto_publish_gpt_sync_duties === true,
        dedupe_exam_schedule: parsed.dedupe_exam_schedule !== false,
        scrape_slider_slot_index: Math.min(
          14,
          Math.max(0, Math.floor(Number(parsed.scrape_slider_slot_index)) || 0),
        ),
      };
    } catch {
      return { ...DEFAULT_EXAM_DUTY_SYNC_OPTIONS };
    }
  }

  /** Tam scrape sync sonrası slayt sırasını 0..14 arasında bir artırır. */
  async advanceExamDutyScrapeSliderSlot(): Promise<void> {
    const cur = await this.getExamDutySyncOptions();
    const nextIdx = ((cur.scrape_slider_slot_index ?? 0) + 1) % 15;
    const next: ExamDutySyncOptions = { ...cur, scrape_slider_slot_index: nextIdx };
    await this.setValue('exam_duty_sync_options', JSON.stringify(next));
  }

  /** Planlı sınav görevi RSS/scrape sync tetik saatleri (İstanbul HH:mm). */
  async getExamDutySyncScheduleTimes(): Promise<string[]> {
    const o = await this.getExamDutySyncOptions();
    return o.sync_schedule_times?.length ? o.sync_schedule_times : [...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES];
  }

  async updateExamDutySyncConfig(dto: {
    gpt_enabled?: boolean;
    openai_api_key?: string | null;
    default_times?: ExamDutyDefaultTimes;
    notification_times?: Partial<ExamDutyNotificationTimes>;
    sync_options?: Partial<ExamDutySyncOptions>;
  }): Promise<void> {
    if (dto.gpt_enabled !== undefined) {
      await this.setValue('exam_duty_gpt_enabled', dto.gpt_enabled ? 'true' : 'false');
    }
    if (dto.openai_api_key !== undefined) {
      const v = dto.openai_api_key?.trim() || null;
      if (v && v !== '••••••••') await this.setValue('exam_duty_openai_api_key', v);
    }
    if (dto.default_times !== undefined) {
      const valid: Record<string, string> = {};
      for (const k of EXAM_DUTY_TIME_KEYS) {
        const fallback = EXAM_DUTY_DEFAULT_TIMES_PRESET[k];
        const v = dto.default_times[k]?.trim() || fallback;
        valid[k] = /^([01]?\d|2[0-3]):([0-5]\d)$/.test(v) ? v : fallback;
      }
      await this.setValue('exam_duty_default_times', JSON.stringify(valid));
    }
    if (dto.notification_times !== undefined) {
      const cur = await this.getExamDutyNotificationTimes();
      const next: ExamDutyNotificationTimes = { ...cur };
      for (const k of EXAM_DUTY_NOTIFICATION_KEYS) {
        const v = dto.notification_times[k]?.trim();
        if (v && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) {
          const m = v.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
          if (m) next[k] = `${m[1]!.padStart(2, '0')}:${m[2]}`;
        }
      }
      await this.setValue('exam_duty_notification_times', JSON.stringify(next));
    }
    if (dto.sync_options !== undefined) {
      const current = await this.getExamDutySyncOptions();
      const maxNew = dto.sync_options.max_new_per_sync ?? current.max_new_per_sync;
      const next: ExamDutySyncOptions = {
        skip_past_exam_date: dto.sync_options.skip_past_exam_date ?? current.skip_past_exam_date,
        recheck_max_count: Math.max(1, Math.min(10, dto.sync_options.recheck_max_count ?? current.recheck_max_count)),
        fetch_timeout_ms: Math.max(5000, Math.min(60000, dto.sync_options.fetch_timeout_ms ?? current.fetch_timeout_ms)),
        log_gpt_usage: dto.sync_options.log_gpt_usage ?? current.log_gpt_usage,
        add_draft_without_dates: dto.sync_options.add_draft_without_dates ?? current.add_draft_without_dates,
        max_new_per_sync: maxNew < 0 ? 0 : Math.min(500, maxNew),
        sync_schedule_times:
          dto.sync_options.sync_schedule_times !== undefined
            ? normalizeExamDutySyncScheduleTimes(dto.sync_options.sync_schedule_times)
            : current.sync_schedule_times,
        notify_superadmin_on_sync_items:
          dto.sync_options.notify_superadmin_on_sync_items !== undefined
            ? Boolean(dto.sync_options.notify_superadmin_on_sync_items)
            : current.notify_superadmin_on_sync_items,
        auto_publish_gpt_sync_duties:
          dto.sync_options.auto_publish_gpt_sync_duties !== undefined
            ? dto.sync_options.auto_publish_gpt_sync_duties === true
            : current.auto_publish_gpt_sync_duties,
        dedupe_exam_schedule:
          dto.sync_options.dedupe_exam_schedule !== undefined
            ? dto.sync_options.dedupe_exam_schedule !== false
            : current.dedupe_exam_schedule,
        scrape_slider_slot_index:
          dto.sync_options.scrape_slider_slot_index !== undefined
            ? Math.min(14, Math.max(0, Math.floor(Number(dto.sync_options.scrape_slider_slot_index)) || 0))
            : current.scrape_slider_slot_index,
      };
      await this.setValue('exam_duty_sync_options', JSON.stringify(next));
    }
  }

  /** Sınav görevi alan bazlı varsayılan saat (HH:mm). Sync'te kullanılır. */
  async getExamDutyDefaultTimes(): Promise<ExamDutyDefaultTimes> {
    const cfg = await this.getExamDutySyncConfig();
    const out: ExamDutyDefaultTimes = {};
    for (const k of EXAM_DUTY_TIME_KEYS) {
      out[k] = cfg.default_times[k] ?? EXAM_DUTY_DEFAULT_TIMES_PRESET[k];
    }
    return out;
  }

  /** Sınav görevi sync için GPT açık mı */
  async isExamDutyGptEnabled(): Promise<boolean> {
    const cfg = await this.getExamDutySyncConfig();
    return cfg.gpt_enabled;
  }

  /** Sınav görevi GPT için API anahtarı – önce app_config, yoksa OPENAI_API_KEY env */
  async getExamDutyOpenAiKey(): Promise<string | null> {
    const v = await this.getValue('exam_duty_openai_api_key');
    if (v?.trim()) return v.trim();
    const env = process.env.OPENAI_API_KEY;
    return env?.trim() || null;
  }

  /** Optik için OpenAI API anahtarını al – OCR/GPT servisleri için (server-side, gerçek key) */
  async getOptikOpenAiKey(): Promise<string | null> {
    const v = await this.getValue('optik_openai_api_key');
    return v?.trim() || null;
  }

  /** Mail (SMTP) ayarlarını al – Admin UI için (şifre maskeli) */
  async getMailConfig(): Promise<MailConfigForAdmin> {
    const values = await Promise.all(MAIL_KEYS.map((k) => this.getValue(k)));
    const cfg: Record<string, string | null> = {};
    MAIL_KEYS.forEach((k, i) => {
      cfg[k] = values[i]?.trim() || null;
    });
    const enabled = (cfg.mail_enabled || '').toLowerCase() === 'true';
    const port = cfg.smtp_port ? parseInt(cfg.smtp_port, 10) : 587;
    const secure = (cfg.smtp_secure || '').toLowerCase() === 'true';
    const notify = await this.getValue('contact_form_notify_email');
    return {
      mail_enabled: enabled,
      smtp_host: cfg.smtp_host ?? '',
      smtp_port: Number.isNaN(port) ? 587 : port,
      smtp_user: cfg.smtp_user ?? '',
      smtp_pass: cfg.smtp_pass ? '••••••••' : null,
      smtp_from: cfg.smtp_from ?? '',
      smtp_from_name: cfg.smtp_from_name ?? 'Uzaedu Öğretmen',
      smtp_secure: secure,
      mail_app_base_url: cfg.mail_app_base_url ?? null,
      contact_form_notify_email: notify?.trim() || null,
    };
  }

  /** İletişim formu bildirim adresi (tek anahtar; MailService için) */
  async getContactFormNotifyEmailSetting(): Promise<string | null> {
    const v = await this.getValue('contact_form_notify_email');
    return v?.trim() || null;
  }

  /** Mail ayarlarını güncelle – superadmin tarafından */
  async updateMailConfig(dto: Partial<MailConfigForAdmin>): Promise<void> {
    if (dto.mail_enabled !== undefined) {
      await this.setValue('mail_enabled', dto.mail_enabled ? 'true' : 'false');
    }
    if (dto.smtp_host !== undefined) await this.setValue('smtp_host', (typeof dto.smtp_host === 'string' ? dto.smtp_host : '').trim() || null);
    if (dto.smtp_port !== undefined) {
      const p = typeof dto.smtp_port === 'number' ? dto.smtp_port : parseInt(String(dto.smtp_port), 10);
      await this.setValue('smtp_port', Number.isNaN(p) ? null : String(Math.max(1, Math.min(65535, p))));
    }
    if (dto.smtp_user !== undefined) await this.setValue('smtp_user', (typeof dto.smtp_user === 'string' ? dto.smtp_user : '').trim() || null);
    if (dto.smtp_pass !== undefined) {
      const v = typeof dto.smtp_pass === 'string' ? dto.smtp_pass.trim() : null;
      if (v && v !== '••••••••') await this.setValue('smtp_pass', v);
    }
    if (dto.smtp_from !== undefined) await this.setValue('smtp_from', (typeof dto.smtp_from === 'string' ? dto.smtp_from : '').trim() || null);
    if (dto.smtp_from_name !== undefined) await this.setValue('smtp_from_name', (typeof dto.smtp_from_name === 'string' ? dto.smtp_from_name : '').trim() || null);
    if (dto.smtp_secure !== undefined) await this.setValue('smtp_secure', dto.smtp_secure ? 'true' : 'false');
    if (dto.mail_app_base_url !== undefined) await this.setValue('mail_app_base_url', (typeof dto.mail_app_base_url === 'string' ? dto.mail_app_base_url : '').trim() || null);
    if (dto.contact_form_notify_email !== undefined) {
      await this.setValue(
        'contact_form_notify_email',
        (typeof dto.contact_form_notify_email === 'string' ? dto.contact_form_notify_email : '').trim() || null,
      );
    }
  }

  /** Mail SMTP bağlantısını test et */
  async testMailConnection(): Promise<{ ok: boolean; message: string }> {
    const config = await this.getMailConfigForSending();
    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
      return {
        ok: false,
        message: 'SMTP ayarları eksik. Host, kullanıcı ve şifre gerekli.',
      };
    }
    try {
      const transporter = createNodemailerTransporter({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure,
        auth: { user: config.smtp_user, pass: config.smtp_pass },
      });
      await transporter.verify();
      return { ok: true, message: 'SMTP bağlantısı başarılı.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      return { ok: false, message: `Bağlantı hatası: ${msg}` };
    }
  }

  /** Mail göndermek için tam config (server-side, şifre dahil). MailService kullanır. */
  async getMailConfigForSending(): Promise<MailConfigForSending> {
    const values = await Promise.all(MAIL_KEYS.map((k) => this.getValue(k)));
    const cfg: Record<string, string | null> = {};
    MAIL_KEYS.forEach((k, i) => {
      cfg[k] = values[i]?.trim() || null;
    });
    const enabled = (cfg.mail_enabled || '').toLowerCase() === 'true';
    const port = cfg.smtp_port ? parseInt(cfg.smtp_port, 10) : 587;
    const secure = (cfg.smtp_secure || '').toLowerCase() === 'true';
    return {
      mail_enabled: enabled,
      smtp_host: cfg.smtp_host ?? '',
      smtp_port: Number.isNaN(port) ? 587 : port,
      smtp_user: cfg.smtp_user ?? '',
      smtp_pass: cfg.smtp_pass ?? '',
      smtp_from: cfg.smtp_from ?? cfg.smtp_user ?? '',
      smtp_from_name: cfg.smtp_from_name ?? 'Uzaedu Öğretmen',
      smtp_secure: secure,
      mail_app_base_url: cfg.mail_app_base_url ?? null,
    };
  }

  private readonly mailTemplatesJsonKey = 'mail_templates_json';

  /** Birleşik şablonlar (varsayılan + DB üzerine yazılan). MailService ve admin UI. */
  async getMailTemplatesMerged(): Promise<Record<MailTemplateId, MailTemplateBlock>> {
    const raw = await this.getValue(this.mailTemplatesJsonKey);
    let stored: MailTemplatesStored = {};
    if (raw?.trim()) {
      try {
        stored = JSON.parse(raw) as MailTemplatesStored;
      } catch {
        stored = {};
      }
    }
    const out = {} as Record<MailTemplateId, MailTemplateBlock>;
    for (const id of MAIL_TEMPLATE_IDS) {
      const d = DEFAULT_MAIL_TEMPLATES[id];
      const s = stored[id];
      out[id] = {
        subject: s?.subject?.trim() ? s.subject : d.subject,
        html: s?.html?.trim() ? s.html : d.html,
        text: s?.text?.trim() ? s.text : d.text,
      };
    }
    return out;
  }

  async updateMailTemplates(dto: MailTemplatesStored): Promise<void> {
    const raw = await this.getValue(this.mailTemplatesJsonKey);
    let current: MailTemplatesStored = {};
    if (raw?.trim()) {
      try {
        current = JSON.parse(raw) as MailTemplatesStored;
      } catch {
        current = {};
      }
    }
    for (const id of Object.keys(dto) as MailTemplateId[]) {
      if (!MAIL_TEMPLATE_IDS.includes(id)) continue;
      const patch = dto[id];
      if (!patch) continue;
      current[id] = { ...current[id], ...patch };
    }
    await this.setValue(this.mailTemplatesJsonKey, JSON.stringify(current));
  }

  /** Optik OpenAI bağlantısını test et */
  async testOptikConnection(): Promise<{ ok: boolean; message: string }> {
    const apiKey = await this.getOptikOpenAiKey();
    if (!apiKey) {
      return { ok: false, message: 'OpenAI API anahtarı tanımlı değil. Lütfen AI/GPT sekmesinde kaydedin.' };
    }
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: apiKey.trim() });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Merhaba' }],
        max_tokens: 5,
      });
      const reply = completion.choices?.[0]?.message?.content?.trim();
      const ok = !!reply;
      return {
        ok,
        message: ok ? 'OpenAI API bağlantısı başarılı.' : `Beklenmeyen yanıt: ${reply}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      return { ok: false, message: `OpenAI çağrısı başarısız: ${msg}` };
    }
  }

  private readonly welcomeModuleConfigKey = 'welcome_module_config';
  private readonly marketPolicyConfigKey = 'market_policy_config';

  async getMarketPolicyConfig(): Promise<MarketPolicyConfig> {
    const raw = await this.getValue(this.marketPolicyConfigKey);
    if (!raw?.trim()) return mergeMarketPolicyFromStored(null);
    try {
      const parsed = JSON.parse(raw) as Partial<MarketPolicyConfig>;
      return mergeMarketPolicyFromStored(parsed);
    } catch {
      return mergeMarketPolicyFromStored(null);
    }
  }

  async updateMarketPolicyConfig(dto: Partial<MarketPolicyConfig>): Promise<void> {
    const current = await this.getMarketPolicyConfig();
    const merged: Partial<MarketPolicyConfig> = {
      ...current,
      ...dto,
      module_prices:
        dto.module_prices !== undefined ? { ...current.module_prices, ...dto.module_prices } : current.module_prices,
      store_compliance:
        dto.store_compliance !== undefined
          ? { ...current.store_compliance, ...dto.store_compliance }
          : current.store_compliance,
      subscription_urls:
        dto.subscription_urls !== undefined
          ? { ...current.subscription_urls, ...dto.subscription_urls }
          : current.subscription_urls,
      minor_privacy:
        dto.minor_privacy !== undefined ? { ...current.minor_privacy, ...dto.minor_privacy } : current.minor_privacy,
      rewarded_ad_jeton:
        dto.rewarded_ad_jeton !== undefined
          ? { ...current.rewarded_ad_jeton, ...dto.rewarded_ad_jeton }
          : current.rewarded_ad_jeton,
      teacher_invite_jeton:
        dto.teacher_invite_jeton !== undefined
          ? { ...current.teacher_invite_jeton, ...dto.teacher_invite_jeton }
          : current.teacher_invite_jeton,
      entitlement_exchange:
        dto.entitlement_exchange !== undefined
          ? { ...current.entitlement_exchange, ...dto.entitlement_exchange }
          : current.entitlement_exchange,
    };
    const next = mergeMarketPolicyFromStored(merged);
    await this.setValue(this.marketPolicyConfigKey, JSON.stringify(next));
  }

  private mergeWelcomeModuleFromStored(stored: Partial<WelcomeModuleConfig> | null): WelcomeModuleConfig {
    const d = { ...DEFAULT_WELCOME_MODULE, by_day: { ...DEFAULT_WELCOME_MODULE.by_day } };
    if (!stored || typeof stored !== 'object') return d;
    const by: Record<string, string> = { ...d.by_day };
    if (stored.by_day && typeof stored.by_day === 'object') {
      for (const [k, v] of Object.entries(stored.by_day)) {
        const key = String(k).trim();
        if (!isValidMmDdKey(key)) continue;
        const text = sanitizeWelcomePlainText(typeof v === 'string' ? v : '');
        if (text) by[key] = text;
      }
    }
    return {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : d.enabled,
      by_day: by,
      fallback_message:
        stored.fallback_message !== undefined
          ? (stored.fallback_message ? sanitizeWelcomePlainText(stored.fallback_message) : null)
          : d.fallback_message,
      cache_ttl_welcome:
        stored.cache_ttl_welcome !== undefined
          ? clampCacheTtl(stored.cache_ttl_welcome, DEFAULT_WELCOME_MODULE.cache_ttl_welcome)
          : d.cache_ttl_welcome,
      popup_enabled: typeof stored.popup_enabled === 'boolean' ? stored.popup_enabled : d.popup_enabled,
      popup_mode: stored.popup_mode === 'zodiac_auto' ? stored.popup_mode : d.popup_mode,
    };
  }

  async getWelcomeModuleConfig(): Promise<WelcomeModuleConfig> {
    const raw = await this.getValue(this.welcomeModuleConfigKey);
    if (!raw?.trim()) return this.mergeWelcomeModuleFromStored(null);
    try {
      const parsed = JSON.parse(raw) as Partial<WelcomeModuleConfig>;
      return this.mergeWelcomeModuleFromStored(parsed);
    } catch {
      return this.mergeWelcomeModuleFromStored(null);
    }
  }

  async updateWelcomeModuleConfig(dto: Partial<WelcomeModuleConfig>): Promise<void> {
    const current = await this.getWelcomeModuleConfig();
    const next: WelcomeModuleConfig = {
      enabled: current.enabled,
      by_day: { ...current.by_day },
      fallback_message: current.fallback_message,
      cache_ttl_welcome: current.cache_ttl_welcome,
      popup_enabled: current.popup_enabled,
      popup_mode: current.popup_mode,
    };
    if (dto.enabled !== undefined) next.enabled = !!dto.enabled;
    if (dto.fallback_message !== undefined) {
      next.fallback_message = dto.fallback_message ? sanitizeWelcomePlainText(dto.fallback_message) : null;
    }
    if (dto.cache_ttl_welcome !== undefined) {
      next.cache_ttl_welcome = clampCacheTtl(dto.cache_ttl_welcome, DEFAULT_WELCOME_MODULE.cache_ttl_welcome);
    }
    if (dto.popup_enabled !== undefined) next.popup_enabled = !!dto.popup_enabled;
    if (dto.popup_mode !== undefined) {
      next.popup_mode = dto.popup_mode === 'zodiac_auto' ? dto.popup_mode : DEFAULT_WELCOME_MODULE.popup_mode;
    }
    if (dto.by_day !== undefined && dto.by_day && typeof dto.by_day === 'object') {
      next.by_day = {};
      for (const [k, v] of Object.entries(dto.by_day)) {
        const key = String(k).trim();
        if (!isValidMmDdKey(key)) continue;
        const text = sanitizeWelcomePlainText(typeof v === 'string' ? v : '');
        if (text) next.by_day[key] = text;
      }
    }
    await this.setValue(this.welcomeModuleConfigKey, JSON.stringify(next));
  }

  /** Türkiye saatine göre bugünün MM-DD anahtarı */
  private static dateKeyIstanbul(d = new Date()): string {
    const s = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return s.slice(5);
  }

  async getWelcomeTodayPublic(): Promise<WelcomeTodayPublic> {
    const cfg = await this.getWelcomeModuleConfig();
    const date_key = AppConfigService.dateKeyIstanbul();
    const zodiac_key = getWelcomeZodiacKey(date_key);
    if (!cfg.enabled) {
      return {
        enabled: false,
        date_key,
        message: null,
        popup_enabled: cfg.popup_enabled,
        popup_mode: cfg.popup_mode,
        zodiac_key,
      };
    }
    const dayMsg = cfg.by_day[date_key]?.trim();
    const fallback = cfg.fallback_message?.trim();
    const message = (dayMsg || fallback || null) as string | null;
    return {
      enabled: true,
      date_key,
      message,
      popup_enabled: cfg.popup_enabled,
      popup_mode: cfg.popup_mode,
      zodiac_key,
    };
  }

  async getWelcomeModulePublicCacheMaxAge(): Promise<number> {
    const c = await this.getWelcomeModuleConfig();
    return clampCacheTtl(c.cache_ttl_welcome, DEFAULT_WELCOME_MODULE.cache_ttl_welcome);
  }

  /** Haber içerik senkronu – zamanlayıcı (cron) aralığı ve aç/kapa */
  async getContentSyncSchedule(): Promise<ContentSyncScheduleConfig> {
    const raw = await this.getValue('content_sync_schedule');
    const defaults: ContentSyncScheduleConfig = { enabled: false, interval_minutes: 360 };
    if (!raw?.trim()) return defaults;
    try {
      const p = JSON.parse(raw) as Record<string, unknown>;
      const interval = Math.max(15, Math.min(10080, Number(p.interval_minutes) || 360));
      return {
        enabled: p.enabled === true,
        interval_minutes: interval,
      };
    } catch {
      return defaults;
    }
  }

  async updateContentSyncSchedule(dto: Partial<ContentSyncScheduleConfig>): Promise<void> {
    const current = await this.getContentSyncSchedule();
    const next: ContentSyncScheduleConfig = {
      enabled: dto.enabled !== undefined ? !!dto.enabled : current.enabled,
      interval_minutes:
        dto.interval_minutes !== undefined
          ? Math.max(15, Math.min(10080, Number(dto.interval_minutes) || current.interval_minutes))
          : current.interval_minutes,
    };
    await this.setValue('content_sync_schedule', JSON.stringify(next));
  }

  async getContentSyncStatus(): Promise<ContentSyncStatusRecord> {
    const raw = await this.getValue('content_sync_status');
    const empty: ContentSyncStatusRecord = {
      last_run_at: null,
      last_ok: null,
      last_message: null,
      last_total_created: 0,
      last_trigger: null,
      last_source_errors: [],
    };
    if (!raw?.trim()) return empty;
    try {
      const p = JSON.parse(raw) as Record<string, unknown>;
      const errs = Array.isArray(p.last_source_errors) ? p.last_source_errors : [];
      return {
        last_run_at: typeof p.last_run_at === 'string' ? p.last_run_at : null,
        last_ok: p.last_ok === true || p.last_ok === false ? p.last_ok : null,
        last_message: typeof p.last_message === 'string' ? p.last_message : null,
        last_total_created: Math.max(0, Number(p.last_total_created) || 0),
        last_trigger: p.last_trigger === 'manual' || p.last_trigger === 'cron' ? p.last_trigger : null,
        last_source_errors: errs
          .filter((x): x is { source_key: string; source_label?: string; error?: string } =>
            Boolean(x && typeof x === 'object' && typeof (x as { source_key?: string }).source_key === 'string'),
          )
          .map((x) => ({
            source_key: x.source_key,
            source_label: String(x.source_label ?? ''),
            error: String(x.error ?? '').slice(0, 500),
          })),
      };
    } catch {
      return empty;
    }
  }

  /** RSS haber senkron sonucunu kaydet (manuel veya zamanlayıcı) */
  async recordContentSyncResult(result: ContentSyncResultSnapshot, trigger: 'manual' | 'cron'): Promise<void> {
    const errors = (result.results ?? [])
      .filter((r) => r.error)
      .map((r) => ({
        source_key: r.source_key,
        source_label: r.source_label,
        error: String(r.error).slice(0, 500),
      }));
    const status: ContentSyncStatusRecord = {
      last_run_at: new Date().toISOString(),
      last_ok: result.ok,
      last_message: (result.message ?? '').slice(0, 2000),
      last_total_created: result.total_created ?? 0,
      last_trigger: trigger,
      last_source_errors: errors,
    };
    await this.setValue('content_sync_status', JSON.stringify(status));
  }

  async recordContentSyncFailure(err: unknown, trigger: 'manual' | 'cron'): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);
    const status: ContentSyncStatusRecord = {
      last_run_at: new Date().toISOString(),
      last_ok: false,
      last_message: msg.slice(0, 2000),
      last_total_created: 0,
      last_trigger: trigger,
      last_source_errors: [],
    };
    await this.setValue('content_sync_status', JSON.stringify(status));
  }

  private readonly examDutyFeeCatalogKey = 'exam_duty_fee_catalog';

  async getExamDutyFeeCatalog(): Promise<ExamDutyFeeCatalog> {
    const raw = await this.getValue(this.examDutyFeeCatalogKey);
    if (!raw?.trim()) return { ...DEFAULT_EXAM_DUTY_FEE_CATALOG };
    try {
      const parsed = JSON.parse(raw) as ExamDutyFeeCatalog;
      return sanitizeExamDutyFeeCatalog(parsed);
    } catch {
      return { ...DEFAULT_EXAM_DUTY_FEE_CATALOG };
    }
  }

  async updateExamDutyFeeCatalog(dto: ExamDutyFeeCatalog): Promise<void> {
    const next = sanitizeExamDutyFeeCatalog(dto);
    await this.setValue(this.examDutyFeeCatalogKey, JSON.stringify(next));
  }
}

/** Sınav görev ücret referans tablosu (ÖSYM / AÖF vb.) — app_config JSON. */
export type ExamDutyFeeRoleRow = {
  key: string;
  label: string;
  brut_tl: number;
};

export type ExamDutyFeeCategory = {
  id: string;
  label: string;
  description?: string | null;
  roles: ExamDutyFeeRoleRow[];
};

export type ExamDutyFeeTaxBracketRef = {
  max_matrah: number;
  rate_percent: number;
};

export type ExamDutyFeeCatalog = {
  version: string;
  period_label: string;
  /** Örn. basın özeti / tebliğ — resmi belge ile doğrulama önerilir */
  source_note: string;
  /** Net ücret; ücretlinin GV matrahı ve diğer gelirlerle birlikte dilime göre değişir */
  gv_note: string;
  gv_exemption_max_tl: number;
  dv_exemption_max_tl: number;
  stamp_duty_rate_binde: number;
  gv_brackets: ExamDutyFeeTaxBracketRef[];
  categories: ExamDutyFeeCategory[];
};

/** 2026 Oca–Haz ÖSYM brüt ücretleri: kamu/egitim sitelerindeki tablolara göre (resmi ÖSYM tebliği ile doğrulayın). */
const DEFAULT_EXAM_DUTY_FEE_CATALOG: ExamDutyFeeCatalog = {
  version: '2',
  period_label: '2026 1. dönem (Ocak–Haziran)',
  source_note:
    '2026 MEB/ÖSYM tabloları kamu mevzuat özetlerinden derlenmiştir. Anadolu AÖF ve ATA AÖF kalemleri yayımlanan net tutarlardan %15 GV + binde 7,59 DV varsayımıyla yaklaşık brüte çevrilmiştir. AUZEF için son yayımlı 2025-2026 güz dönemi tablosu kullanılmıştır.',
  gv_note:
    'Net ücret, brüt üzerinden seçilen GV oranı ve damga vergisi düşülerek tahmini hesaplanır. GV ve DV istisna alanları aylık maaşta önceden kullanılan tutar üzerinden ilerler.',
  gv_exemption_max_tl: 4211.33,
  dv_exemption_max_tl: 33030,
  stamp_duty_rate_binde: 7.59,
  gv_brackets: [
    { max_matrah: 190_000, rate_percent: 15 },
    { max_matrah: 400_000, rate_percent: 20 },
    { max_matrah: 1_500_000, rate_percent: 27 },
    { max_matrah: 5_300_000, rate_percent: 35 },
    { max_matrah: 9_999_999_999, rate_percent: 40 },
  ],
  categories: [
    {
      id: 'meb_klasik',
      label: 'MEB ortak / açık lise sınavları',
      description: '2026 Ocak-Temmuz MEB yazılı ve açık lise sınav görevleri için brüt tablo.',
      roles: [
        { key: 'bina_yoneticisi', label: 'Bina yöneticisi', brut_tl: 2636.95 },
        { key: 'bina_yonetici_yard', label: 'Bina yönetici yardımcısı', brut_tl: 2359.38 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 2289.99 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 2220.59 },
        { key: 'yedek_gozetmen', label: 'Yedek gözetmen', brut_tl: 1665.45 },
        { key: 'yardimci_engelli_gozetmen', label: 'Yardımcı engelli gözetmen', brut_tl: 2775.74 },
      ],
    },
    {
      id: 'meb_esinav',
      label: 'MEB e-Sınav',
      description: '2026 Ocak-Temmuz MEB e-sınav görevleri için brüt tablo.',
      roles: [
        { key: 'uygulama_sorumlusu', label: 'E-sınav uygulama sorumlusu', brut_tl: 2081.81 },
        { key: 'salon_baskani', label: 'E-sınav salon başkanı', brut_tl: 1804.23 },
        { key: 'gozetmen', label: 'E-sınav gözetmeni', brut_tl: 1665.45 },
      ],
    },
    {
      id: 'osym',
      label: 'ÖSYM merkezi sınavlar',
      description: '2026 Ocak-Temmuz ÖSYM merkezi sınav görevleri için brüt tablo.',
      roles: [
        { key: 'bina_sinav_sorumlusu', label: 'Bina sınav sorumlusu', brut_tl: 4163.61 },
        { key: 'bina_sinav_sorumlusu_yard', label: 'Bina sınav sorumlusu yardımcısı', brut_tl: 2775.74 },
        { key: 'bina_yoneticisi', label: 'Bina yöneticisi', brut_tl: 2775.74 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 2498.17 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 2081.81 },
        { key: 'yedek_gozetmen', label: 'Yedek gözetmen', brut_tl: 1665.45 },
      ],
    },
    {
      id: 'anadolu_aof_tr',
      label: 'Anadolu Üniversitesi AÖF (Türkiye geneli)',
      description: '2026 yayımlı net tablo baz alınarak yaklaşık brüte çevrilmiştir.',
      roles: [
        { key: 'bina_sinav_sorumlusu', label: 'Bina sınav sorumlusu', brut_tl: 1959.68 },
        { key: 'bina_sinav_sorumlusu_yard', label: 'Bina sınav sorumlusu yardımcısı', brut_tl: 1609.75 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 1399.77 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 1189.81 },
      ],
    },
    {
      id: 'anadolu_aof_istanbul',
      label: 'Anadolu Üniversitesi AÖF (İstanbul)',
      description: '2026 yayımlı net tablo baz alınarak yaklaşık brüte çevrilmiştir.',
      roles: [
        { key: 'bina_sinav_sorumlusu', label: 'Bina sınav sorumlusu', brut_tl: 2275.76 },
        { key: 'bina_sinav_sorumlusu_yard', label: 'Bina sınav sorumlusu yardımcısı', brut_tl: 1869.36 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 1625.54 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 1381.7 },
      ],
    },
    {
      id: 'auzef_tr',
      label: 'İstanbul Üniversitesi AUZEF (Türkiye geneli)',
      description: 'Son yayımlı 2025-2026 güz dönemi net tablo baz alınarak yaklaşık brüte çevrilmiştir.',
      roles: [
        { key: 'bina_sinav_sorumlusu', label: 'Bina sınav sorumlusu', brut_tl: 1289.27 },
        { key: 'bina_sinav_sorumlusu_yard', label: 'Bina sınav sorumlusu yardımcısı', brut_tl: 1059.04 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 920.91 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 782.78 },
      ],
    },
    {
      id: 'auzef_istanbul',
      label: 'İstanbul Üniversitesi AUZEF (İstanbul)',
      description: 'Son yayımlı 2025-2026 güz dönemi net tablo baz alınarak yaklaşık brüte çevrilmiştir.',
      roles: [
        { key: 'bina_sinav_sorumlusu', label: 'Bina sınav sorumlusu', brut_tl: 1497.2 },
        { key: 'bina_sinav_sorumlusu_yard', label: 'Bina sınav sorumlusu yardımcısı', brut_tl: 1229.85 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 1069.43 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 909.02 },
      ],
    },
    {
      id: 'ata_aof',
      label: 'Atatürk Üniversitesi ATA AÖF',
      description: '2026 yayımlı net tablo baz alınarak yaklaşık brüte çevrilmiştir.',
      roles: [
        { key: 'bina_sinav_sorumlusu', label: 'Bina sınav sorumlusu', brut_tl: 1870.67 },
        { key: 'bina_sinav_sorumlusu_yard', label: 'Bina sınav sorumlusu yardımcısı', brut_tl: 1556.81 },
        { key: 'bina_yoneticisi', label: 'Bina yöneticisi', brut_tl: 1455.43 },
        { key: 'salon_baskani', label: 'Salon başkanı', brut_tl: 1387.38 },
        { key: 'gozetmen', label: 'Gözetmen', brut_tl: 1194.35 },
        { key: 'yedek_gorevli', label: 'Yedek görevli', brut_tl: 1180.46 },
        { key: 'engelli_salonu_gorevlisi', label: 'Engelli salon görevlisi', brut_tl: 1387.38 },
      ],
    },
  ],
};

function sanitizeExamDutyFeeCatalog(input: ExamDutyFeeCatalog): ExamDutyFeeCatalog {
  const gv_brackets = Array.isArray(input.gv_brackets)
    ? input.gv_brackets
        .filter(
          (b): b is ExamDutyFeeTaxBracketRef =>
            b != null &&
            typeof b === 'object' &&
            typeof (b as ExamDutyFeeTaxBracketRef).max_matrah === 'number' &&
            typeof (b as ExamDutyFeeTaxBracketRef).rate_percent === 'number',
        )
        .map((b) => ({
          max_matrah: Math.max(0, Math.min(9_999_999_999, Math.floor(b.max_matrah))),
          rate_percent: Math.max(0, Math.min(100, Math.round(b.rate_percent * 100) / 100)),
        }))
    : DEFAULT_EXAM_DUTY_FEE_CATALOG.gv_brackets;

  const categories = Array.isArray(input.categories)
    ? input.categories
        .filter(
          (c): c is ExamDutyFeeCategory =>
            c != null &&
            typeof c === 'object' &&
            typeof (c as ExamDutyFeeCategory).id === 'string' &&
            typeof (c as ExamDutyFeeCategory).label === 'string' &&
            Array.isArray((c as ExamDutyFeeCategory).roles),
        )
        .map((c) => ({
          id: String(c.id).slice(0, 64),
          label: String(c.label).slice(0, 200),
          description: c.description != null ? String(c.description).slice(0, 500) : null,
          roles: (c.roles ?? [])
            .filter(
              (r): r is ExamDutyFeeRoleRow =>
                r != null &&
                typeof r === 'object' &&
                typeof (r as ExamDutyFeeRoleRow).key === 'string' &&
                typeof (r as ExamDutyFeeRoleRow).label === 'string' &&
                typeof (r as ExamDutyFeeRoleRow).brut_tl === 'number',
            )
            .map((r) => ({
              key: String(r.key).slice(0, 80),
              label: String(r.label).slice(0, 300),
              brut_tl: Math.max(0, Math.min(999_999, Math.round(Number(r.brut_tl) * 100) / 100)),
            })),
        }))
    : DEFAULT_EXAM_DUTY_FEE_CATALOG.categories;

  return {
    version: String(input.version ?? '1').slice(0, 32),
    period_label: String(input.period_label ?? DEFAULT_EXAM_DUTY_FEE_CATALOG.period_label).slice(0, 200),
    source_note: String(input.source_note ?? '').slice(0, 2000),
    gv_note: String(input.gv_note ?? DEFAULT_EXAM_DUTY_FEE_CATALOG.gv_note).slice(0, 2000),
    gv_exemption_max_tl:
      typeof input.gv_exemption_max_tl === 'number'
        ? Math.max(0, Math.min(999_999, Math.round(input.gv_exemption_max_tl * 100) / 100))
        : DEFAULT_EXAM_DUTY_FEE_CATALOG.gv_exemption_max_tl,
    dv_exemption_max_tl:
      typeof input.dv_exemption_max_tl === 'number'
        ? Math.max(0, Math.min(9_999_999, Math.round(input.dv_exemption_max_tl * 100) / 100))
        : DEFAULT_EXAM_DUTY_FEE_CATALOG.dv_exemption_max_tl,
    stamp_duty_rate_binde:
      typeof input.stamp_duty_rate_binde === 'number'
        ? Math.max(0, Math.min(999, Math.round(input.stamp_duty_rate_binde * 100) / 100))
        : DEFAULT_EXAM_DUTY_FEE_CATALOG.stamp_duty_rate_binde,
    gv_brackets: gv_brackets.length > 0 ? gv_brackets : DEFAULT_EXAM_DUTY_FEE_CATALOG.gv_brackets,
    categories: categories.length > 0 ? categories : DEFAULT_EXAM_DUTY_FEE_CATALOG.categories,
  };
}

export type SchoolReviewReportReasonKey = 'spam' | 'uygunsuz' | 'yanlis_bilgi' | 'diger';

export type SchoolReviewsReasonItem = {
  label: string;
  hint: string;
  enabled: boolean;
};

export type SchoolReviewsContentRules = {
  /** Aynı cihaz/kullanıcı başına 24 saat içinde en fazla bildirim (1–50). */
  daily_report_limit_per_actor: number;
  reasons: Record<SchoolReviewReportReasonKey, SchoolReviewsReasonItem>;
  /** Açıksa `blocked_terms` alt dizgisi geçen yorum/soru/cevap (ve bildirim notu) reddedilir. */
  profanity_block_enabled: boolean;
  /** Her biri 2–80 karakter; en fazla 300 satır. Türkçe büyük/küçük harf duyarsız eşleşme. */
  blocked_terms: string[];
};

export const DEFAULT_SCHOOL_REVIEWS_CONTENT_RULES: SchoolReviewsContentRules = {
  daily_report_limit_per_actor: 10,
  reasons: {
    spam: { label: 'Spam veya tekrar', hint: 'Çoklanan veya istenmeyen içerik', enabled: true },
    uygunsuz: { label: 'Uygunsuz dil', hint: 'Hakaret, nefret söylemi veya taciz', enabled: true },
    yanlis_bilgi: { label: 'Yanıltıcı bilgi', hint: 'Kasıtlı veya zararlı yanlışlık', enabled: true },
    diger: { label: 'Diğer', hint: 'Kısaca açıklayın', enabled: true },
  },
  profanity_block_enabled: false,
  blocked_terms: [...DEFAULT_SCHOOL_REVIEWS_BLOCKED_TERMS],
};

/** Onaylı raporlara göre içerik yazarına otomatik site yasağı (süper yönetici «ceza» ile strike ekler) */
export type SchoolReviewsPenaltyRules = {
  enabled: boolean;
  strikes_until_ban: number;
  ban_duration_days: number;
  /** Eşik aşıldığında strike sayacını sıfırla */
  reset_strikes_on_ban: boolean;
};

export const DEFAULT_SCHOOL_REVIEWS_PENALTY_RULES: SchoolReviewsPenaltyRules = {
  enabled: true,
  strikes_until_ban: 3,
  ban_duration_days: 30,
  reset_strikes_on_ban: true,
};

export type SchoolReviewsConfig = {
  enabled: boolean;
  rating_min: number;
  rating_max: number;
  moderation_mode: 'auto' | 'moderation';
  allow_questions: boolean;
  questions_require_moderation: boolean;
  /** Bildirim diyaloğu metinleri, görünürlük ve günlük bildirim limiti */
  content_rules: SchoolReviewsContentRules;
  penalty_rules: SchoolReviewsPenaltyRules;
};

/** PATCH gövdesi: iç içe nesneler kısmi olabilir */
export type SchoolReviewsConfigPatch = Partial<Omit<SchoolReviewsConfig, 'penalty_rules' | 'content_rules'>> & {
  content_rules?: SchoolReviewsContentRules;
  penalty_rules?: Partial<SchoolReviewsPenaltyRules>;
};

/** Ders saati config: { subject_code: { grade: saat } } – örn. { turkce: { 1: 10, 2: 10 }, matematik: { 1: 5 } } */
export type DersSaatiConfig = Record<string, Record<number, number>>;

/** Optik / Açık Uçlu AI Puanlama modülü ayarları. Superadmin tarafından yönetilir. */
export type OptikConfig = {
  module_enabled: boolean;
  default_language: 'tr' | 'en';
  openai_api_key: string | null; // Admin'de maskeli (••••••••)
  openai_model: string;
  openai_temperature: number;
  ocr_provider: 'google' | 'azure' | 'openai_vision' | 'placeholder';
  /** Google Document AI */
  ocr_google_project_id: string | null;
  ocr_google_credentials: string | null; // Admin'de maskeli
  ocr_google_location: string | null; // us, eu vb.
  ocr_google_processor_id: string | null;
  /** Azure Form Recognizer */
  ocr_azure_endpoint: string | null;
  ocr_azure_api_key: string | null; // Admin'de maskeli
  ocr_azure_model: string | null; // prebuilt-read, prebuilt-document vb.
  /** Harici OCR (Google/Azure) genel ayarlar */
  ocr_timeout_seconds: number | null;
  ocr_retry_count: number | null;
  ocr_language_hint: 'tr' | 'en' | null; // Override varsayılan dil
  confidence_threshold: number;
  grade_modes: string[];
  daily_limit_per_user: number | null;
  key_text_cache_ttl_hours: number;
};

const OPTIK_DEFAULT_MODES = ['CONTENT', 'LANGUAGE', 'CONTENT_LANGUAGE', 'MATH_FINAL', 'MATH_STEPS'];

export type YayinSeoConfig = {
  title: string;
  description: string;
  og_image: string | null;
  robots: 'index' | 'noindex';
  keywords: string;
  site_url: string | null;
  site_name: string | null;
};

/** Mail (SMTP) ayarları – Admin UI için (şifre maskeli) */
export type MailConfigForAdmin = {
  mail_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string | null;
  smtp_from: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  mail_app_base_url: string | null;
  /** İletişim formu bildirimi (SMTP ile); boşsa sunucu varsayılanı */
  contact_form_notify_email: string | null;
};

/** Mail göndermek için tam config (server-side) */
export type MailConfigForSending = {
  mail_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  mail_app_base_url: string | null;
};
