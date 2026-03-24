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
import { type MarketPolicyConfig, mergeMarketPolicyFromStored } from './market-policy.defaults';
import { sanitizeLegalHtml } from './legal-pages.sanitize';
import { mergeDevOpsFromStored, type DevOpsConfig } from './devops.defaults';

export type { MobileAppConfig } from './mobile.defaults';
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
};

const R2_KEYS = ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket', 'r2_public_url'] as const;
const MAIL_KEYS = ['mail_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name', 'smtp_secure', 'mail_app_base_url'] as const;
const UPLOAD_LIMIT_KEYS = ['upload_max_size_mb', 'upload_allowed_types'] as const;
const R2_SECRET_KEY = 'r2_secret_access_key';

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ALLOWED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

/** Kamuya açık web sitesi – iletişim, footer, sosyal bağlantılar (JSON). */
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
};

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
  recaptcha_site_key: string | null;
  pwa_short_name: string | null;
  theme_color: string | null;
  favicon_url: string | null;
  app_store_url: string | null;
  play_store_url: string | null;
  help_center_url: string | null;
  ads_enabled: boolean;
  ads_web_targeting_requires_cookie_consent: boolean;
};

export type GdprConfig = {
  cookie_banner_enabled: boolean;
  cookie_banner_body_html: string | null;
  consent_version: string;
  data_controller_name: string | null;
  dpo_email: string | null;
  cookie_policy_path: string;
  reject_button_visible: boolean;
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
    recaptcha_site_key: DEFAULT_WEB_EXTRAS.recaptcha_site_key,
    pwa_short_name: DEFAULT_WEB_EXTRAS.pwa_short_name,
    theme_color: DEFAULT_WEB_EXTRAS.theme_color,
    favicon_url: DEFAULT_WEB_EXTRAS.favicon_url,
    app_store_url: DEFAULT_WEB_EXTRAS.app_store_url,
    play_store_url: DEFAULT_WEB_EXTRAS.play_store_url,
    help_center_url: DEFAULT_WEB_EXTRAS.help_center_url,
    ads_enabled: DEFAULT_WEB_EXTRAS.ads_enabled,
    ads_web_targeting_requires_cookie_consent: DEFAULT_WEB_EXTRAS.ads_web_targeting_requires_cookie_consent,
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
    recaptcha_site_key:
      stored.recaptcha_site_key !== undefined ? (stored.recaptcha_site_key?.trim() || null) : d.recaptcha_site_key,
    pwa_short_name: stored.pwa_short_name !== undefined ? (stored.pwa_short_name?.trim() || null) : d.pwa_short_name,
    theme_color: stored.theme_color !== undefined ? (stored.theme_color?.trim() || null) : d.theme_color,
    favicon_url: stored.favicon_url !== undefined ? (stored.favicon_url?.trim() || null) : d.favicon_url,
    app_store_url: stored.app_store_url !== undefined ? (stored.app_store_url?.trim() || null) : d.app_store_url,
    play_store_url: stored.play_store_url !== undefined ? (stored.play_store_url?.trim() || null) : d.play_store_url,
    help_center_url: stored.help_center_url !== undefined ? (stored.help_center_url?.trim() || null) : d.help_center_url,
    ads_enabled: typeof stored.ads_enabled === 'boolean' ? stored.ads_enabled : d.ads_enabled,
    ads_web_targeting_requires_cookie_consent:
      typeof stored.ads_web_targeting_requires_cookie_consent === 'boolean'
        ? stored.ads_web_targeting_requires_cookie_consent
        : d.ads_web_targeting_requires_cookie_consent,
  };
}

function cloneGdprDefaults(): GdprConfig {
  return {
    cookie_banner_enabled: DEFAULT_GDPR.cookie_banner_enabled,
    cookie_banner_body_html: DEFAULT_GDPR.cookie_banner_body_html,
    consent_version: DEFAULT_GDPR.consent_version,
    data_controller_name: DEFAULT_GDPR.data_controller_name,
    dpo_email: DEFAULT_GDPR.dpo_email,
    cookie_policy_path: DEFAULT_GDPR.cookie_policy_path,
    reject_button_visible: DEFAULT_GDPR.reject_button_visible,
    cache_ttl_gdpr: DEFAULT_GDPR.cache_ttl_gdpr,
  };
}

function mergeGdprFromStored(stored: Partial<GdprConfig> | null): GdprConfig {
  const d = cloneGdprDefaults();
  if (!stored || typeof stored !== 'object') return d;
  return {
    cookie_banner_enabled:
      typeof stored.cookie_banner_enabled === 'boolean' ? stored.cookie_banner_enabled : d.cookie_banner_enabled,
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
};

const DEFAULT_EXAM_DUTY_SYNC_OPTIONS: ExamDutySyncOptions = {
  skip_past_exam_date: false,
  recheck_max_count: 1,
  fetch_timeout_ms: 30000,
  log_gpt_usage: false,
  add_draft_without_dates: true,
  max_new_per_sync: 1,
};

const EXAM_DUTY_TIME_KEYS = ['application_start', 'application_end', 'application_approval_end', 'result_date', 'exam_date', 'exam_date_end'] as const;

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
    const ratingMax = parseInt((await this.getValue('school_reviews_rating_max')) || '5', 10);
    const moderationMode = (await this.getValue('school_reviews_moderation_mode')) || 'auto';
    const allowQuestions = (await this.getValue('school_reviews_allow_questions'))?.toLowerCase() !== 'false';
    const questionsRequireModeration = (await this.getValue('school_reviews_questions_moderation'))?.toLowerCase() === 'true';
    return {
      enabled: enabled ?? false,
      rating_min: Number.isNaN(ratingMin) || ratingMin < 1 ? 1 : Math.min(ratingMin, 5),
      rating_max: Number.isNaN(ratingMax) || ratingMax > 5 ? 5 : Math.max(ratingMax, 1),
      moderation_mode: moderationMode === 'moderation' ? 'moderation' : 'auto',
      allow_questions: allowQuestions ?? true,
      questions_require_moderation: questionsRequireModeration ?? false,
    };
  }

  async updateSchoolReviewsConfig(dto: Partial<SchoolReviewsConfig>): Promise<void> {
    if (dto.enabled !== undefined) await this.setValue('school_reviews_enabled', dto.enabled ? 'true' : 'false');
    if (dto.rating_min !== undefined) await this.setValue('school_reviews_rating_min', String(Math.max(1, Math.min(5, dto.rating_min))));
    if (dto.rating_max !== undefined) await this.setValue('school_reviews_rating_max', String(Math.max(1, Math.min(5, dto.rating_max))));
    if (dto.moderation_mode !== undefined) await this.setValue('school_reviews_moderation_mode', dto.moderation_mode);
    if (dto.allow_questions !== undefined) await this.setValue('school_reviews_allow_questions', dto.allow_questions ? 'true' : 'false');
    if (dto.questions_require_moderation !== undefined) await this.setValue('school_reviews_questions_moderation', dto.questions_require_moderation ? 'true' : 'false');
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
      title: title?.trim() || 'Haber Yayını – Öğretmen Pro',
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
      return { ...DEFAULT_WEB_PUBLIC, ...parsed };
    } catch {
      return { ...DEFAULT_WEB_PUBLIC };
    }
  }

  async updateWebPublicConfig(dto: Partial<WebPublicConfig>): Promise<void> {
    const current = await this.getWebPublicConfig();
    const next: WebPublicConfig = { ...current };
    const keys = Object.keys(DEFAULT_WEB_PUBLIC) as (keyof WebPublicConfig)[];
    for (const k of keys) {
      if (dto[k] === undefined) continue;
      const v = dto[k];
      next[k] = typeof v === 'string' ? (v.trim() || null) : v;
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
    if (dto.pwa_short_name !== undefined) next.pwa_short_name = dto.pwa_short_name?.trim() || null;
    if (dto.theme_color !== undefined) next.theme_color = dto.theme_color?.trim() || null;
    if (dto.favicon_url !== undefined) next.favicon_url = dto.favicon_url?.trim() || null;
    if (dto.app_store_url !== undefined) next.app_store_url = dto.app_store_url?.trim() || null;
    if (dto.play_store_url !== undefined) next.play_store_url = dto.play_store_url?.trim() || null;
    if (dto.help_center_url !== undefined) next.help_center_url = dto.help_center_url?.trim() || null;
    if (dto.ads_enabled !== undefined) next.ads_enabled = !!dto.ads_enabled;
    if (dto.ads_web_targeting_requires_cookie_consent !== undefined) {
      next.ads_web_targeting_requires_cookie_consent = !!dto.ads_web_targeting_requires_cookie_consent;
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
    sync_options: ExamDutySyncOptions;
  }> {
    const enabled = (await this.getValue('exam_duty_gpt_enabled'))?.toLowerCase() === 'true';
    const apiKey = await this.getValue('exam_duty_openai_api_key');
    const raw = await this.getValue('exam_duty_default_times');
    const defaultTimes: ExamDutyDefaultTimes = {};
    for (const k of EXAM_DUTY_TIME_KEYS) {
      defaultTimes[k] = k === 'application_end' ? '23:59' : '00:00';
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
    return {
      gpt_enabled: enabled ?? false,
      openai_api_key: apiKey?.trim() ? '••••••••' : null,
      default_times: defaultTimes,
      sync_options: syncOptions,
    };
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
      };
    } catch {
      return { ...DEFAULT_EXAM_DUTY_SYNC_OPTIONS };
    }
  }

  async updateExamDutySyncConfig(dto: {
    gpt_enabled?: boolean;
    openai_api_key?: string | null;
    default_times?: ExamDutyDefaultTimes;
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
        const v = dto.default_times[k]?.trim() || '00:00';
        valid[k] = /^([01]?\d|2[0-3]):([0-5]\d)$/.test(v) ? v : '00:00';
      }
      await this.setValue('exam_duty_default_times', JSON.stringify(valid));
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
      };
      await this.setValue('exam_duty_sync_options', JSON.stringify(next));
    }
  }

  /** Sınav görevi alan bazlı varsayılan saat (HH:mm). Sync'te kullanılır. application_end varsayılan 23:59 (son gün). */
  async getExamDutyDefaultTimes(): Promise<ExamDutyDefaultTimes> {
    const cfg = await this.getExamDutySyncConfig();
    const out: ExamDutyDefaultTimes = {};
    for (const k of EXAM_DUTY_TIME_KEYS) {
      out[k] = cfg.default_times[k] ?? (k === 'application_end' ? '23:59' : '00:00');
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
    return {
      mail_enabled: enabled,
      smtp_host: cfg.smtp_host ?? '',
      smtp_port: Number.isNaN(port) ? 587 : port,
      smtp_user: cfg.smtp_user ?? '',
      smtp_pass: cfg.smtp_pass ? '••••••••' : null,
      smtp_from: cfg.smtp_from ?? '',
      smtp_from_name: cfg.smtp_from_name ?? 'Öğretmen Pro',
      smtp_secure: secure,
      mail_app_base_url: cfg.mail_app_base_url ?? null,
    };
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
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
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
      smtp_from_name: cfg.smtp_from_name ?? 'Öğretmen Pro',
      smtp_secure: secure,
      mail_app_base_url: cfg.mail_app_base_url ?? null,
    };
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
    };
  }

  async getWelcomeModuleConfig(): Promise<WelcomeModuleConfig> {
    const raw = await this.getValue(this.welcomeModuleConfigKey);
    if (!raw?.trim()) return { ...DEFAULT_WELCOME_MODULE, by_day: {} };
    try {
      const parsed = JSON.parse(raw) as Partial<WelcomeModuleConfig>;
      return this.mergeWelcomeModuleFromStored(parsed);
    } catch {
      return { ...DEFAULT_WELCOME_MODULE, by_day: {} };
    }
  }

  async updateWelcomeModuleConfig(dto: Partial<WelcomeModuleConfig>): Promise<void> {
    const current = await this.getWelcomeModuleConfig();
    const next: WelcomeModuleConfig = {
      enabled: current.enabled,
      by_day: { ...current.by_day },
      fallback_message: current.fallback_message,
      cache_ttl_welcome: current.cache_ttl_welcome,
    };
    if (dto.enabled !== undefined) next.enabled = !!dto.enabled;
    if (dto.fallback_message !== undefined) {
      next.fallback_message = dto.fallback_message ? sanitizeWelcomePlainText(dto.fallback_message) : null;
    }
    if (dto.cache_ttl_welcome !== undefined) {
      next.cache_ttl_welcome = clampCacheTtl(dto.cache_ttl_welcome, DEFAULT_WELCOME_MODULE.cache_ttl_welcome);
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
    if (!cfg.enabled) {
      return { enabled: false, date_key, message: null };
    }
    const dayMsg = cfg.by_day[date_key]?.trim();
    const fallback = cfg.fallback_message?.trim();
    const message = (dayMsg || fallback || null) as string | null;
    return { enabled: true, date_key, message };
  }

  async getWelcomeModulePublicCacheMaxAge(): Promise<number> {
    const c = await this.getWelcomeModuleConfig();
    return clampCacheTtl(c.cache_ttl_welcome, DEFAULT_WELCOME_MODULE.cache_ttl_welcome);
  }
}

export type SchoolReviewsConfig = {
  enabled: boolean;
  rating_min: number;
  rating_max: number;
  moderation_mode: 'auto' | 'moderation';
  allow_questions: boolean;
  questions_require_moderation: boolean;
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
