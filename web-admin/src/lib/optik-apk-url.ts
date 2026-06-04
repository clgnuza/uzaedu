import { normalizePublicSiteUrl } from '@/lib/site-url';
import type { MobileAppPublic } from '@/lib/mobile-config-public';

export const OPTIK_APK_FILENAME = 'uzaedu-optik.apk';
export const OPTIK_APK_PUBLIC_PATH = `/downloads/${OPTIK_APK_FILENAME}`;

export function resolveOptikApkDownloadUrl(
  mobile: Pick<MobileAppPublic, 'apk_download_url' | 'apk_sideload_enabled'> | null | undefined,
): string | null {
  if (mobile && mobile.apk_sideload_enabled === false) return null;
  const configured = mobile?.apk_download_url?.trim();
  if (configured) return configured;
  const base = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, '');
  return `${base}${OPTIK_APK_PUBLIC_PATH}`;
}

export function isOptikApkSideloadVisible(
  mobile: Pick<MobileAppPublic, 'apk_sideload_enabled' | 'play_store_url'> | null | undefined,
): boolean {
  if (mobile?.apk_sideload_enabled === false) return false;
  return true;
}
