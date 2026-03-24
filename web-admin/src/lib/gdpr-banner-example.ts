/**
 * Örnek çerez bildirimi metni (HTML).
 * AB GDPR (2016/679), ePrivacy çerçevesi ve KVKK aydınlatma ilkelerine uygun örnek şablon —
 * yayına almadan kurumunuzun hukuk birimiyle doğrulayın.
 */
const COOKIE_POLICY_PLACEHOLDER = '__COOKIE_POLICY_PATH__';

export const GDPR_COOKIE_BANNER_EXAMPLE_HTML = `<p><strong>Çerezler ve benzeri teknolojiler.</strong> Bu siteyi sunmak, güvenliği sağlamak, tercihlerinizi hatırlamak ve yalnızca açık rızanız olduğunda istatistik veya pazarlama amaçlı çerezleri kullanmak için veri işliyoruz.</p>
<p>Kişisel verileriniz; <a href="/gizlilik">Aydınlatma Metni</a> ve <a href="${COOKIE_POLICY_PLACEHOLDER}">Çerez Politikası</a> kapsamında işlenir. Zorunlu olmayan çerezler için hukuki dayanak açık rızanızdır (GDPR m.6(1)(a)). Rızanızı dilediğiniz zaman geri çekebilir; tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz.</p>
<p><em>Bu metin örnektir; nihai metin ve kategoriler veri envanterinize göre güncellenmelidir.</em></p>`;

function normalizePolicyPath(cookiePolicyPath: string): string {
  const p = cookiePolicyPath.trim().replace(/\s/g, '') || '/cerez';
  return p.startsWith('/') ? p : `/${p}`;
}

/** Ayarlardaki çerez politikası path’ine göre örnek HTML üretir. */
export function buildGdprBannerExampleHtml(cookiePolicyPath: string): string {
  return GDPR_COOKIE_BANNER_EXAMPLE_HTML.replaceAll(COOKIE_POLICY_PLACEHOLDER, normalizePolicyPath(cookiePolicyPath));
}
