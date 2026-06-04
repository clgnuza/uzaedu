/** PWA kurulum / görünüm — mevcut gtag/dataLayer varsa olay gönderir */
export function trackPwaEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dl)) {
      dl.push({ event: name, ...params });
    }
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') {
      gtag('event', name, params ?? {});
    }
  } catch {
    /* ignore */
  }
}
