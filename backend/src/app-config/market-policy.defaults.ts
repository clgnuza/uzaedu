/** Superadmin market: modül başına jeton + ek ders maliyeti; IAP ürün listeleri (market_policy_config). */
/** Web-admin `web-admin/src/config/school-modules.ts` ile aynı anahtarlar kalmalı. */

export const MARKET_MODULE_KEYS = [
  'duty',
  'tv',
  'extra_lesson',
  'document',
  'outcome',
  'optical',
  'smart_board',
  'teacher_agenda',
  'bilsem',
  'school_profile',
  'school_reviews',
] as const;

export type MarketModuleKey = (typeof MARKET_MODULE_KEYS)[number];

export type MarketCurrencyPair = {
  jeton: number;
  ekders: number;
};

/** Okul / öğretmen tarafında aylık ve yıllık kullanım başına düşecek jeton + ek ders. */
export type MarketModuleScopeUsage = {
  monthly: MarketCurrencyPair;
  yearly: MarketCurrencyPair;
};

/** Modül girişinde gösterilecek kısa bilgilendirme + web yönlendirme / satın alma CTA (web / mobil). */
export type MarketModuleEntryNotice = {
  notice_tr: string | null;
  notice_en: string | null;
  /** Web içi yol; örn /market — null ise istemci /market kullanır */
  market_href: string | null;
  cta_market_tr: string | null;
  cta_market_en: string | null;
  /** Harici mağaza / satın alma sayfası (https) */
  purchase_href: string | null;
  cta_purchase_tr: string | null;
  cta_purchase_en: string | null;
};

export type MarketModulePriceRow = {
  school: MarketModuleScopeUsage;
  teacher: MarketModuleScopeUsage;
  entry_notice: MarketModuleEntryNotice;
};

/** Ondalık oran / miktar (örn. 0,2 jeton); API ve merge 6 ondalıkta normalize edilir. */
const RATIO_DECIMALS = 6;
const RATIO_MAX = 1_000_000_000;

export type MarketIapPack = {
  product_id: string;
  /** Satın alınca eklenecek jeton veya ek ders miktarı (ondalık olabilir) */
  amount: number;
  label?: string | null;
};

export type MarketIapSide = {
  jeton: MarketIapPack[];
  ekders: MarketIapPack[];
};

/**
 * Google Play / App Store dijital ürün ve IAP beklentileri için uygulamada gösterilecek metinler.
 * Hukuki danışmanlık değildir; metinleri kendi politikalarınıza göre doldurun.
 */
export type MarketStoreCompliance = {
  /** Satın alma öncesi/sonrası kısa bilgilendirme (TR) — sanal ürün, fiyat, vergi vb. */
  purchase_disclosure_tr: string | null;
  purchase_disclosure_en: string | null;
  /** İade, iptal, hesap sorunları ve destek kanalı özeti */
  refunds_and_support_note: string | null;
};

/** Abonelik yönetimi / iptal bağlantıları (Google Play / App Store) */
export type MarketSubscriptionUrls = {
  android_play_subscriptions_help_url: string | null;
  android_manage_play_subscriptions_url: string | null;
  apple_manage_subscriptions_url: string | null;
  apple_subscription_terms_note: string | null;
};

/** Çocuk / veli / KVKK ile ilgili uygulama içi metin alanları */
export type MarketMinorPrivacy = {
  not_targeting_children_note: string | null;
  parental_consent_note: string | null;
};

/**
 * Market ekranında ödüllü reklam (AdMob SSV) ile öğretmen jeton kazanımı.
 * Mobil: RewardedAd + ServerSideVerificationOptions.setUserId(öğretmen UUID).
 */
export type MarketRewardedAdJetonConfig = {
  enabled: boolean;
  jeton_per_reward: number;
  max_rewards_per_day: number;
  cooldown_seconds: number;
  /** Boş: tüm birimler; doluysa yalnızca bu AdMob ad unit ID (string) */
  allowed_ad_unit_ids: string[];
};

/** Öğretmen davet kodu ile kayıt: davet eden ve yeni öğretmen jeton ödülü */
export type MarketTeacherInviteJetonConfig = {
  enabled: boolean;
  jeton_for_invitee: number;
  jeton_for_inviter: number;
  /** 0 = sınırsız */
  max_invites_per_teacher: number;
  /** Üretilen kod uzunluğu (6–12) */
  code_length: number;
};

export type MarketPolicyConfig = {
  /** GET /content/market-policy Cache-Control max-age (sn) */
  cache_ttl_market_policy: number;
  module_prices: Record<string, MarketModulePriceRow>;
  iap_android: MarketIapSide;
  iap_ios: MarketIapSide;
  store_compliance: MarketStoreCompliance;
  subscription_urls: MarketSubscriptionUrls;
  minor_privacy: MarketMinorPrivacy;
  rewarded_ad_jeton: MarketRewardedAdJetonConfig;
  teacher_invite_jeton: MarketTeacherInviteJetonConfig;
};

function zeroPair(): MarketCurrencyPair {
  return { jeton: 0, ekders: 0 };
}

function emptyScope(): MarketModuleScopeUsage {
  return { monthly: zeroPair(), yearly: zeroPair() };
}

/** Tüm modüller için ortak CTA; metinler modül bazında MODULE_ENTRY_NOTICES ile doldurulur. */
const ENTRY_CTA_DEFAULTS: MarketModuleEntryNotice = {
  notice_tr: null,
  notice_en: null,
  market_href: '/market',
  cta_market_tr: 'Cüzdan ve Market',
  cta_market_en: 'Wallet & Market',
  purchase_href: null,
  cta_purchase_tr: 'Google Play’de uygulamayı aç',
  cta_purchase_en: 'Open on Google Play',
};

/** Modül giriş paneli: TR/EN kısa açıklama (web-admin süperadmin varsayılanı). */
const MODULE_ENTRY_NOTICES: Record<MarketModuleKey, { tr: string; en: string }> = {
  duty: {
    tr: 'Nöbet planı ve nöbet süreçlerinde bazı işlemler jeton veya ek ders kullanımı gerektirebilir. Bakiyenizi Market üzerinden kontrol edebilirsiniz.',
    en: 'Some duty planning actions may use jeton or extra lesson credits. Check your balance on the Market page.',
  },
  tv: {
    tr: 'Duyuru TV içerikleri ve cihaz kullanımında tarifeye göre düşüm yapılabilir. Güncel tutarlar Market sayfasındadır.',
    en: 'Announcement TV content and devices may be billed per policy. See the Market page for current rates.',
  },
  extra_lesson: {
    tr: 'Ek ders hesaplama ve ilgili parametrelerde kullanım başına jeton veya ek ders düşebilir.',
    en: 'Extra lesson calculations and related parameters may debit jeton or extra lesson credits per use.',
  },
  document: {
    tr: 'Evrak şablonları ve belge üretiminde kullanım başına jeton veya ek ders düşebilir. Market’ten bakiyenizi yönetin.',
    en: 'Document templates and generation may charge jeton or extra lesson credits per use. Manage balance in Market.',
  },
  outcome: {
    tr: 'Kazanım takip ve plan içeriklerinde kullanım ücretleri politika tarifesine göre alınabilir.',
    en: 'Outcome tracking and plan content may incur usage fees per the published tariff.',
  },
  optical: {
    tr: 'Optik formlar ve optik okuma işlemlerinde jeton veya ek ders kullanımı uygulanabilir.',
    en: 'Optical forms and scanning may use jeton or extra lesson credits.',
  },
  smart_board: {
    tr: 'Akıllı tahta oturumları ve ilgili işlemlerde kullanım başına ücret düşebilir.',
    en: 'Smart board sessions and related actions may incur per-use charges.',
  },
  teacher_agenda: {
    tr: 'Öğretmen ajandası ve değerlendirme özelliklerinde kullanım ücretleri tarifeye göre alınabilir.',
    en: 'Teacher agenda and evaluation features may charge fees per the tariff.',
  },
  bilsem: {
    tr: 'BİLSEM takvim ve yıllık plan özelliklerinde jeton veya ek ders düşümü olabilir.',
    en: 'BİLSEM calendar and yearly plan features may debit jeton or extra lesson credits.',
  },
  school_profile: {
    tr: 'Okul tanıtım ve vitrin içeriğinde bazı işlemler ücretli olabilir; bakiyenizi Market’ten takip edin.',
    en: 'Some school profile and showcase actions may be paid; track balance in Market.',
  },
  school_reviews: {
    tr: 'Okul değerlendirme ve raporlarda kullanım başına jeton veya ek ders düşebilir.',
    en: 'School reviews and reports may charge jeton or extra lesson credits per use.',
  },
};

function zeroRow(): MarketModulePriceRow {
  return {
    school: emptyScope(),
    teacher: emptyScope(),
    entry_notice: { ...ENTRY_CTA_DEFAULTS },
  };
}

function defaultModuleRowForKey(k: MarketModuleKey): MarketModulePriceRow {
  const t = MODULE_ENTRY_NOTICES[k];
  return {
    school: emptyScope(),
    teacher: emptyScope(),
    entry_notice: {
      ...ENTRY_CTA_DEFAULTS,
      notice_tr: t.tr,
      notice_en: t.en,
    },
  };
}

export function buildDefaultModulePrices(): Record<string, MarketModulePriceRow> {
  const o: Record<string, MarketModulePriceRow> = {};
  for (const k of MARKET_MODULE_KEYS) {
    o[k] = defaultModuleRowForKey(k);
  }
  return o;
}

const DEFAULT_STORE_COMPLIANCE: MarketStoreCompliance = {
  purchase_disclosure_tr:
    'Uygulama içi jeton ve ek ders paketleri sanal ürünlerdir; fiyatlar ve vergi Google Play / App Store’da gösterilir. Satın alma işlemi seçtiğiniz mağaza hesabınıza yansır.',
  purchase_disclosure_en:
    'In-app jeton and extra lesson packs are digital goods; prices and tax are shown in Google Play / App Store. Purchases are charged to your store account.',
  refunds_and_support_note:
    'İade, iptal ve abonelik yönetimi Google Play ve App Store kurallarına tabidir. Abonelikleri mağaza hesabınızdan yönetebilirsiniz. Destek için uygulama içi iletişim veya kurumunuzun belirlediği kanalı kullanın.',
};

const DEFAULT_SUBSCRIPTION_URLS: MarketSubscriptionUrls = {
  android_play_subscriptions_help_url: 'https://support.google.com/googleplay/answer/2476087',
  android_manage_play_subscriptions_url: 'https://play.google.com/store/account/subscriptions',
  apple_manage_subscriptions_url: 'https://apps.apple.com/account/subscriptions',
  apple_subscription_terms_note:
    'Abonelikleri App Store hesabınızdan (Ayarlar → Apple Kimliği → Abonelikler) veya yukarıdaki bağlantıdan yönetebilirsiniz.',
};

const DEFAULT_MINOR_PRIVACY: MarketMinorPrivacy = {
  not_targeting_children_note:
    'Bu uygulama okul ve öğretmen iş akışlarına yöneliktir; 13 yaş altı çocuklara özel bir hedef kitle olarak sunulmamaktadır. Kurumunuz farklı bir politika uyguluyorsa metni güncelleyin.',
  parental_consent_note:
    'Reşit olmayan kullanıcılar için veli/vasi onayı kurum politikalarınıza göre yürütülmelidir; gerekirse bu alanı kurum metninizle değiştirin.',
};

const DEFAULT_REWARDED_AD_JETON: MarketRewardedAdJetonConfig = {
  enabled: false,
  jeton_per_reward: 1,
  max_rewards_per_day: 10,
  cooldown_seconds: 90,
  allowed_ad_unit_ids: [],
};

const DEFAULT_TEACHER_INVITE_JETON: MarketTeacherInviteJetonConfig = {
  enabled: false,
  jeton_for_invitee: 5,
  jeton_for_inviter: 10,
  max_invites_per_teacher: 50,
  code_length: 8,
};

export const DEFAULT_MARKET_POLICY: MarketPolicyConfig = {
  cache_ttl_market_policy: 120,
  module_prices: buildDefaultModulePrices(),
  iap_android: { jeton: [], ekders: [] },
  iap_ios: { jeton: [], ekders: [] },
  store_compliance: { ...DEFAULT_STORE_COMPLIANCE },
  subscription_urls: { ...DEFAULT_SUBSCRIPTION_URLS },
  minor_privacy: { ...DEFAULT_MINOR_PRIVACY },
  rewarded_ad_jeton: { ...DEFAULT_REWARDED_AD_JETON },
  teacher_invite_jeton: { ...DEFAULT_TEACHER_INVITE_JETON },
};

function clampInt(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.min(1_000_000_000, Math.max(0, Math.round(x)));
}

/** Negatif olmayan ondalık oran / miktar (jeton, ek ders, IAP amount). */
export function clampNonNegativeRatio(n: unknown, fallback: number): number {
  let x: number;
  if (typeof n === 'number' && Number.isFinite(n)) {
    x = n;
  } else {
    const s = String(n ?? '')
      .trim()
      .replace(/\s/g, '')
      .replace(',', '.');
    x = parseFloat(s);
  }
  if (Number.isNaN(x) || !Number.isFinite(x)) return fallback;
  const c = Math.min(RATIO_MAX, Math.max(0, x));
  return Math.round(c * 10 ** RATIO_DECIMALS) / 10 ** RATIO_DECIMALS;
}

function sanitizePair(raw: unknown, fallback: MarketCurrencyPair): MarketCurrencyPair {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    jeton: clampNonNegativeRatio(o.jeton, fallback.jeton),
    ekders: clampNonNegativeRatio(o.ekders, fallback.ekders),
  };
}

function normalizeScope(raw: unknown, fallback: MarketModuleScopeUsage): MarketModuleScopeUsage {
  if (!raw || typeof raw !== 'object') {
    return {
      monthly: { ...fallback.monthly },
      yearly: { ...fallback.yearly },
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.monthly !== undefined || o.yearly !== undefined) {
    return {
      monthly: sanitizePair(o.monthly, fallback.monthly),
      yearly: sanitizePair(o.yearly, fallback.yearly),
    };
  }
  const legacy = sanitizePair(raw, fallback.monthly);
  return {
    monthly: { ...legacy },
    yearly: { ...legacy },
  };
}

function sanitizeRow(raw: unknown, fallback: MarketModulePriceRow): MarketModulePriceRow {
  if (!raw || typeof raw !== 'object') {
    return {
      school: {
        monthly: { ...fallback.school.monthly },
        yearly: { ...fallback.school.yearly },
      },
      teacher: {
        monthly: { ...fallback.teacher.monthly },
        yearly: { ...fallback.teacher.yearly },
      },
      entry_notice: { ...fallback.entry_notice },
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    school: normalizeScope(o.school, fallback.school),
    teacher: normalizeScope(o.teacher, fallback.teacher),
    entry_notice: sanitizeEntryNotice(o.entry_notice, fallback.entry_notice),
  };
}

function sanitizeIapList(raw: unknown): MarketIapPack[] {
  if (!Array.isArray(raw)) return [];
  const out: MarketIapPack[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const pid = typeof o.product_id === 'string' ? o.product_id.trim().slice(0, 200) : '';
    if (!pid) continue;
    out.push({
      product_id: pid,
      amount: clampNonNegativeRatio(o.amount, 0),
      label: o.label !== undefined && o.label !== null ? String(o.label).trim().slice(0, 120) || null : null,
    });
  }
  return out;
}

function sanitizeIapSide(raw: unknown, fallback: MarketIapSide): MarketIapSide {
  if (!raw || typeof raw !== 'object') return { jeton: [...fallback.jeton], ekders: [...fallback.ekders] };
  const o = raw as Record<string, unknown>;
  return {
    jeton: sanitizeIapList(o.jeton),
    ekders: sanitizeIapList(o.ekders),
  };
}

const COMPLIANCE_TEXT_MAX = 8000;
const ENTRY_NOTICE_MAX = 2000;
const ENTRY_CTA_LABEL_MAX = 96;

function sanitizeInternalMarketPath(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw)
    .replace(/\0/g, '')
    .trim()
    .slice(0, 256);
  if (!t) return null;
  if (!t.startsWith('/')) return null;
  if (t.includes('..') || t.includes('//')) return null;
  return t;
}

function sanitizeCtaLabel(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw)
    .replace(/\0/g, '')
    .trim()
    .slice(0, ENTRY_CTA_LABEL_MAX);
  return t.length ? t : null;
}

function sanitizeEntryNoticeText(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw)
    .replace(/\0/g, '')
    .trim()
    .slice(0, ENTRY_NOTICE_MAX);
  return t.length ? t : null;
}

function sanitizeHttpUrl(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw)
    .trim()
    .replace(/\s/g, '')
    .slice(0, 2048);
  if (!/^https:\/\//i.test(t)) return null;
  return t;
}

function sanitizeEntryNotice(raw: unknown, fallback: MarketModuleEntryNotice): MarketModuleEntryNotice {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    notice_tr: o.notice_tr !== undefined ? sanitizeEntryNoticeText(o.notice_tr) : fallback.notice_tr,
    notice_en: o.notice_en !== undefined ? sanitizeEntryNoticeText(o.notice_en) : fallback.notice_en,
    market_href: o.market_href !== undefined ? sanitizeInternalMarketPath(o.market_href) : fallback.market_href,
    cta_market_tr: o.cta_market_tr !== undefined ? sanitizeCtaLabel(o.cta_market_tr) : fallback.cta_market_tr,
    cta_market_en: o.cta_market_en !== undefined ? sanitizeCtaLabel(o.cta_market_en) : fallback.cta_market_en,
    purchase_href: o.purchase_href !== undefined ? sanitizeHttpUrl(o.purchase_href) : fallback.purchase_href,
    cta_purchase_tr: o.cta_purchase_tr !== undefined ? sanitizeCtaLabel(o.cta_purchase_tr) : fallback.cta_purchase_tr,
    cta_purchase_en: o.cta_purchase_en !== undefined ? sanitizeCtaLabel(o.cta_purchase_en) : fallback.cta_purchase_en,
  };
}

function sanitizeComplianceText(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw)
    .replace(/\0/g, '')
    .trim()
    .slice(0, COMPLIANCE_TEXT_MAX);
  return t.length ? t : null;
}

function sanitizeCompliance(raw: unknown, fallback: MarketStoreCompliance): MarketStoreCompliance {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    purchase_disclosure_tr:
      o.purchase_disclosure_tr !== undefined
        ? sanitizeComplianceText(o.purchase_disclosure_tr)
        : fallback.purchase_disclosure_tr,
    purchase_disclosure_en:
      o.purchase_disclosure_en !== undefined
        ? sanitizeComplianceText(o.purchase_disclosure_en)
        : fallback.purchase_disclosure_en,
    refunds_and_support_note:
      o.refunds_and_support_note !== undefined
        ? sanitizeComplianceText(o.refunds_and_support_note)
        : fallback.refunds_and_support_note,
  };
}

function sanitizeSubscriptionUrls(raw: unknown, fallback: MarketSubscriptionUrls): MarketSubscriptionUrls {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    android_play_subscriptions_help_url:
      o.android_play_subscriptions_help_url !== undefined
        ? sanitizeHttpUrl(o.android_play_subscriptions_help_url)
        : fallback.android_play_subscriptions_help_url,
    android_manage_play_subscriptions_url:
      o.android_manage_play_subscriptions_url !== undefined
        ? sanitizeHttpUrl(o.android_manage_play_subscriptions_url)
        : fallback.android_manage_play_subscriptions_url,
    apple_manage_subscriptions_url:
      o.apple_manage_subscriptions_url !== undefined
        ? sanitizeHttpUrl(o.apple_manage_subscriptions_url)
        : fallback.apple_manage_subscriptions_url,
    apple_subscription_terms_note:
      o.apple_subscription_terms_note !== undefined
        ? sanitizeComplianceText(o.apple_subscription_terms_note)
        : fallback.apple_subscription_terms_note,
  };
}

function sanitizeMinorPrivacy(raw: unknown, fallback: MarketMinorPrivacy): MarketMinorPrivacy {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    not_targeting_children_note:
      o.not_targeting_children_note !== undefined
        ? sanitizeComplianceText(o.not_targeting_children_note)
        : fallback.not_targeting_children_note,
    parental_consent_note:
      o.parental_consent_note !== undefined
        ? sanitizeComplianceText(o.parental_consent_note)
        : fallback.parental_consent_note,
  };
}

function sanitizeAdUnitIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const s = String(x ?? '')
      .trim()
      .replace(/\s/g, '')
      .slice(0, 64);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= 40) break;
  }
  return out;
}

function sanitizeTeacherInviteJeton(
  raw: unknown,
  fallback: MarketTeacherInviteJetonConfig,
): MarketTeacherInviteJetonConfig {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  const maxInv =
    typeof o.max_invites_per_teacher === 'number'
      ? clampInt(o.max_invites_per_teacher, fallback.max_invites_per_teacher)
      : fallback.max_invites_per_teacher;
  const clen =
    typeof o.code_length === 'number' ? clampInt(o.code_length, fallback.code_length) : fallback.code_length;
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : fallback.enabled,
    jeton_for_invitee: clampNonNegativeRatio(o.jeton_for_invitee ?? fallback.jeton_for_invitee, fallback.jeton_for_invitee),
    jeton_for_inviter: clampNonNegativeRatio(o.jeton_for_inviter ?? fallback.jeton_for_inviter, fallback.jeton_for_inviter),
    max_invites_per_teacher: Math.min(1_000_000, Math.max(0, maxInv)),
    code_length: Math.min(12, Math.max(6, clen)),
  };
}

function sanitizeRewardedAdJeton(raw: unknown, fallback: MarketRewardedAdJetonConfig): MarketRewardedAdJetonConfig {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  const maxDay =
    typeof o.max_rewards_per_day === 'number'
      ? clampInt(o.max_rewards_per_day, fallback.max_rewards_per_day)
      : fallback.max_rewards_per_day;
  const cooldown =
    typeof o.cooldown_seconds === 'number'
      ? clampInt(o.cooldown_seconds, fallback.cooldown_seconds)
      : fallback.cooldown_seconds;
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : fallback.enabled,
    jeton_per_reward: clampNonNegativeRatio(o.jeton_per_reward ?? fallback.jeton_per_reward, fallback.jeton_per_reward),
    max_rewards_per_day: Math.min(500, Math.max(1, maxDay)),
    cooldown_seconds: Math.min(86400, Math.max(0, cooldown)),
    allowed_ad_unit_ids:
      o.allowed_ad_unit_ids !== undefined ? sanitizeAdUnitIdList(o.allowed_ad_unit_ids) : fallback.allowed_ad_unit_ids,
  };
}

export function mergeMarketPolicyFromStored(stored: Partial<MarketPolicyConfig> | null): MarketPolicyConfig {
  const d: MarketPolicyConfig = {
    cache_ttl_market_policy: DEFAULT_MARKET_POLICY.cache_ttl_market_policy,
    module_prices: buildDefaultModulePrices(),
    iap_android: { jeton: [], ekders: [] },
    iap_ios: { jeton: [], ekders: [] },
    store_compliance: { ...DEFAULT_STORE_COMPLIANCE },
    subscription_urls: { ...DEFAULT_SUBSCRIPTION_URLS },
    minor_privacy: { ...DEFAULT_MINOR_PRIVACY },
    rewarded_ad_jeton: { ...DEFAULT_REWARDED_AD_JETON },
    teacher_invite_jeton: { ...DEFAULT_TEACHER_INVITE_JETON },
  };
  if (!stored || typeof stored !== 'object') return d;
  if (stored.cache_ttl_market_policy !== undefined) {
    d.cache_ttl_market_policy = clampInt(stored.cache_ttl_market_policy, DEFAULT_MARKET_POLICY.cache_ttl_market_policy);
    if (d.cache_ttl_market_policy < 10) d.cache_ttl_market_policy = 10;
    if (d.cache_ttl_market_policy > 86400) d.cache_ttl_market_policy = 86400;
  }
  const basePrices = buildDefaultModulePrices();
  const mp = stored.module_prices && typeof stored.module_prices === 'object' ? stored.module_prices : null;
  for (const k of MARKET_MODULE_KEYS) {
    const row = mp ? (mp as Record<string, unknown>)[k] : undefined;
    d.module_prices[k] = sanitizeRow(row, basePrices[k] ?? zeroRow());
  }
  d.iap_android = sanitizeIapSide(stored.iap_android, d.iap_android);
  d.iap_ios = sanitizeIapSide(stored.iap_ios, d.iap_ios);
  d.store_compliance = sanitizeCompliance(stored.store_compliance, d.store_compliance);
  d.subscription_urls = sanitizeSubscriptionUrls(stored.subscription_urls, d.subscription_urls);
  d.minor_privacy = sanitizeMinorPrivacy(stored.minor_privacy, d.minor_privacy);
  d.rewarded_ad_jeton = sanitizeRewardedAdJeton(stored.rewarded_ad_jeton, d.rewarded_ad_jeton);
  d.teacher_invite_jeton = sanitizeTeacherInviteJeton(stored.teacher_invite_jeton, d.teacher_invite_jeton);
  return d;
}
