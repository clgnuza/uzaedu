import { GoogleAuth } from 'google-auth-library';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

function loadServiceAccountJson(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const p = resolve(raw);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Google Play — ürün satın alma token doğrulama (in-app ürün).
 * @see https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
 */
export async function verifyAndroidProductPurchase(params: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<{ ok: boolean; httpStatus?: number; body?: unknown; error?: string }> {
  const creds = loadServiceAccountJson();
  if (!creds?.client_email || !creds.private_key) {
    return { ok: false, error: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON tanımlı değil veya geçersiz.' };
  }
  const auth = new GoogleAuth({
    credentials: creds as { client_email: string; private_key: string },
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) {
    return { ok: false, error: 'Google OAuth token alınamadı.' };
  }
  const { packageName, productId, purchaseToken } = params;
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token}` },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, body, error: `Google API ${res.status}` };
  }
  return { ok: true, httpStatus: res.status, body };
}

export function getDefaultAndroidPackageName(): string | null {
  const v = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  return v?.length ? v : null;
}
