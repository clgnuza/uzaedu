/** localStorage + banner yeniden açma (GDPR: rıza geri çekme / tercih değiştirme) */

export const LEGACY_CONSENT_KEY = 'ogretmenpro_cookie_consent';
export const GDPR_CONSENT_KEY = 'ogretmenpro_gdpr_consent';

export const COOKIE_CONSENT_RESET_EVENT = 'ogretmenpro:cookie-consent-reset';

export type CookieConsentChoice = 'accepted' | 'rejected';

export function readStoredConsent(consentVersion: string): CookieConsentChoice | null {
  try {
    const raw = localStorage.getItem(GDPR_CONSENT_KEY);
    if (raw) {
      const j = JSON.parse(raw) as { v?: string; choice?: string };
      if (j.v === consentVersion && (j.choice === 'accepted' || j.choice === 'rejected')) {
        return j.choice as CookieConsentChoice;
      }
    }
    const legacy = localStorage.getItem(LEGACY_CONSENT_KEY);
    if (legacy === 'accepted' || legacy === 'rejected') {
      if (consentVersion === '1') return legacy;
    }
  } catch {
    return null;
  }
  return null;
}

export function writeStoredConsent(consentVersion: string, choice: CookieConsentChoice): void {
  try {
    localStorage.setItem(GDPR_CONSENT_KEY, JSON.stringify({ v: consentVersion, choice }));
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    try {
      localStorage.setItem(LEGACY_CONSENT_KEY, choice);
    } catch {
      /* ignore */
    }
  }
}

export function clearAllStoredConsent(): void {
  try {
    localStorage.removeItem(GDPR_CONSENT_KEY);
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* ignore */
  }
}

/** Depolamayı temizler; çerez banner’ı yeniden göstermek için olay yayınlar. */
export function reopenCookiePreferences(): void {
  if (typeof window === 'undefined') return;
  clearAllStoredConsent();
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_RESET_EVENT));
}
