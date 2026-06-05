import { isPwaDisplayMode } from '@/lib/pwa-display';

export function suggestPasskeyDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Bu cihaz';
  const ua = navigator.userAgent;
  const pwa = isPwaDisplayMode();
  if (/iPhone/i.test(ua)) return pwa ? 'iPhone · PWA' : 'iPhone · Safari';
  if (/iPad/i.test(ua)) return pwa ? 'iPad · PWA' : 'iPad · Safari';
  if (/Android/i.test(ua)) return pwa ? 'Android · PWA' : 'Android · Chrome';
  if (/Windows/i.test(ua)) return pwa ? 'Windows · PWA' : 'Windows · Tarayıcı';
  if (/Macintosh|Mac OS/i.test(ua)) return pwa ? 'Mac · PWA' : 'Mac · Tarayıcı';
  return pwa ? 'Bu cihaz · PWA' : 'Bu cihaz';
}

export function passkeyDeviceTypeLabel(deviceType: string | null): string {
  if (deviceType === 'singleDevice') return 'Yerel cihaz';
  if (deviceType === 'multiDevice') return 'Senkron passkey';
  return 'Kayıtlı cihaz';
}

export function formatPasskeyDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
