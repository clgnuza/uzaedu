import { useEffect, useRef } from 'react';
import {
  HABER_CONTENT_POLL_INTERVAL_MS,
  subscribeHaberContentRefresh,
} from '@/lib/haber-content-refresh-bus';

/**
 * Otomatik senkron (sunucu cron) sonrası listelerin yakalanması: görünür sekmede periyodik sessiz yenileme
 * + broadcastHaberContentRefresh() ile anında tetikleme.
 */
export function useHaberContentLiveRefresh(options: {
  authLoading: boolean;
  token: string | null | undefined;
  /** Sessiz: yükleme iskeleti göstermeden API’den çek */
  onSilentRefresh: () => void | Promise<void>;
  /** Açıkken interval kur */
  enabled?: boolean;
}): void {
  const { authLoading, token, onSilentRefresh, enabled = true } = options;
  const refreshRef = useRef(onSilentRefresh);
  refreshRef.current = onSilentRefresh;

  useEffect(() => {
    if (!enabled || authLoading || !token) return;
    const unsub = subscribeHaberContentRefresh(() => {
      void refreshRef.current();
    });
    return unsub;
  }, [enabled, authLoading, token]);

  useEffect(() => {
    if (!enabled || authLoading || !token) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshRef.current();
    };
    const id = window.setInterval(tick, HABER_CONTENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, authLoading, token]);
}
