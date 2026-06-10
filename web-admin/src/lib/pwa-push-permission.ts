import { isPwaDisplayMode } from '@/lib/pwa-display';
import { canSubscribePushOnDevice } from '@/lib/web-push';

export const PWA_ONBOARDING_DONE_KEY = 'pwa-onboarding-v1-done';
export const PWA_ONBOARDING_PENDING_KEY = 'pwa-onboarding-pending';

/** Kurulum sihirbazı henüz tamamlanmadıysa otomatik izin isteme */
export function isPwaOnboardingActive(): boolean {
  try {
    if (localStorage.getItem(PWA_ONBOARDING_DONE_KEY) === '1') return false;
    return localStorage.getItem(PWA_ONBOARDING_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * PWA’da arka planda yalnızca mevcut aboneliği onarır; yeni izin penceresi açmaz.
 * İlk izin: onboarding veya Bildirimler → önce açıklama diyaloğu → kullanıcı onayı.
 */
export function shouldSilentRepairPushOnLogin(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isPwaDisplayMode()) return false;
  if (!canSubscribePushOnDevice().ok) return false;
  if (isPwaOnboardingActive()) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  return true;
}
