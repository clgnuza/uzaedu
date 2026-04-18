/** Haberler / yayın sayfaları: zamanlama kaydı veya senkron sonrası anında yenileme sinyali */
export const HABER_CONTENT_REFRESH_STORAGE_KEY = 'ogp_haber_content_refresh';
const HABER_CONTENT_REFRESH_EVENT = 'ogp-haber-content-refresh';

export function broadcastHaberContentRefresh(): void {
  try {
    localStorage.setItem(HABER_CONTENT_REFRESH_STORAGE_KEY, String(Date.now()));
  } catch {
    /* private mode vb. */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HABER_CONTENT_REFRESH_EVENT));
  }
}

export function subscribeHaberContentRefresh(handler: () => void): () => void {
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === HABER_CONTENT_REFRESH_STORAGE_KEY && e.newValue) handler();
  };
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(HABER_CONTENT_REFRESH_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(HABER_CONTENT_REFRESH_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** Backend içerik zamanlayıcı tick’i ile aynı: 5 dk */
export const HABER_CONTENT_POLL_INTERVAL_MS = 300_000;
