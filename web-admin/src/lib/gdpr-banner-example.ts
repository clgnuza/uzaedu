/**
 * Örnek çerez bildirimi metni (HTML, küçük punto üst bileşende).
 * KVKK (6698) aydınlatma / açık rıza ve GDPR (2016/679) m.6(1)(a), ePrivacy çerçevesiyle uyumlu özet —
 * yayına almadan kurum hukukundan onay alın; çerez türleri ve amaçları envanterinize göre güncelleyin.
 */
const COOKIE_POLICY_PLACEHOLDER = '__COOKIE_POLICY_PATH__';

export const GDPR_COOKIE_BANNER_EXAMPLE_HTML = `<p>Zorunlu çerez ve benzeri teknolojilerle sitenin güvenli çalışması, oturum ve dil tercihleri sağlanır. <strong>Analitik ve pazarlama</strong> amaçlı işlemler için kişisel veri, yalnızca <strong>açık rızanız</strong> varsa işlenir (KVKK m.5/2-ç; GDPR m.6(1)(a)).</p>
<p>İşlenme amaçları, saklama süreleri ve KVKK kapsamındaki haklarınız (bilgi, düzeltme, silme, itiraz vb.) <a href="/gizlilik">Aydınlatma Metni</a>’nde; çerez türleri ve yönetim <a href="${COOKIE_POLICY_PLACEHOLDER}">Çerez Politikası</a>’ndadır. Rızanızı dilediğiniz an geri çekebilir; tarayıcı ayarlarından çerezleri silebilir veya engelleyebilirsiniz.</p>`;

function normalizePolicyPath(cookiePolicyPath: string): string {
  const p = cookiePolicyPath.trim().replace(/\s/g, '') || '/cerez';
  return p.startsWith('/') ? p : `/${p}`;
}

/** Ayarlardaki çerez politikası path’ine göre örnek HTML üretir. */
export function buildGdprBannerExampleHtml(cookiePolicyPath: string): string {
  return GDPR_COOKIE_BANNER_EXAMPLE_HTML.replaceAll(COOKIE_POLICY_PLACEHOLDER, normalizePolicyPath(cookiePolicyPath));
}
