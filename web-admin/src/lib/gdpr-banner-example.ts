/**
 * Örnek çerez bildirimi metni (HTML, küçük punto üst bileşende).
 * KVKK (6698) aydınlatma / açık rıza ve GDPR (2016/679) m.6(1)(a), ePrivacy çerçevesiyle uyumlu özet —
 * yayına almadan kurum hukukundan onay alın; çerez türleri ve amaçları envanterinize göre güncelleyin.
 */
const COOKIE_POLICY_PLACEHOLDER = '__COOKIE_POLICY_PATH__';

export const GDPR_COOKIE_BANNER_EXAMPLE_HTML = `<p><strong>Zorunlu çerezler</strong> siteyi çalıştırır; <strong>analitik ve pazarlama</strong> yalnızca açık rızanızla (KVKK/GDPR). <a href="/gizlilik">Aydınlatma</a> · <a href="${COOKIE_POLICY_PLACEHOLDER}">Çerez Politikası</a></p>`;

function normalizePolicyPath(cookiePolicyPath: string): string {
  const p = cookiePolicyPath.trim().replace(/\s/g, '') || '/cerez';
  return p.startsWith('/') ? p : `/${p}`;
}

/** Ayarlardaki çerez politikası path’ine göre örnek HTML üretir. */
export function buildGdprBannerExampleHtml(cookiePolicyPath: string): string {
  return GDPR_COOKIE_BANNER_EXAMPLE_HTML.replaceAll(COOKIE_POLICY_PLACEHOLDER, normalizePolicyPath(cookiePolicyPath));
}
