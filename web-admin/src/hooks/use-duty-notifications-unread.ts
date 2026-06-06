'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, shouldSkipOptionalApiCalls } from '@/lib/api';
import { readStaleJson, staleCacheKey, writeStaleJson } from '@/lib/pwa-read-cache';

const NOTIFICATIONS_UPDATED = 'notifications-updated';
const PUSH_RECEIVED_MESSAGE = 'uzaedu-push-received';

/** Aynı path + token için eşzamanlı tek fetch (sidebar + dashboard çift isteği önlenir). */
const unreadInflight = new Map<string, Promise<number>>();

const STALE_MS = 5 * 60 * 1000;

function sharedUnreadCount(path: string, token: string, onStale?: (n: number) => void): Promise<number> {
  const key = `${path}\t${token}`;
  const cacheKey = staleCacheKey(path, token);
  const stale = readStaleJson<number>(cacheKey, STALE_MS);
  if (stale != null) onStale?.(stale);

  let p = unreadInflight.get(key);
  if (!p) {
    p = apiFetch<{ count: number }>(path, { token })
      .then((r) => {
        const n = r.count ?? 0;
        writeStaleJson(cacheKey, n);
        return n;
      })
      .catch(() => stale ?? 0)
      .finally(() => {
        unreadInflight.delete(key);
      });
    unreadInflight.set(key, p);
  }
  return p;
}

export function emitNotificationsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED));
  }
}

const NOTIFICATION_ROLES = new Set(['teacher', 'school_admin', 'superadmin', 'moderator']);

/** Okunmamış nöbet bildirimi sayısı. */
export function useDutyNotificationsUnread(token: string | null, role: string | null) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(() => {
    if (!token || !role || !NOTIFICATION_ROLES.has(role)) {
      setCount(0);
      return;
    }
    if (shouldSkipOptionalApiCalls()) {
      setCount(0);
      return;
    }
    void sharedUnreadCount('/notifications/unread-count?event_type=duty', token, setCount).then(setCount);
  }, [token, role]);

  useEffect(() => {
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener(NOTIFICATIONS_UPDATED, handler);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', onVis);
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === PUSH_RECEIVED_MESSAGE) fetchCount();
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED, handler);
      document.removeEventListener('visibilitychange', onVis);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [fetchCount]);

  return count;
}

/** Okunmamış toplam inbox sayısı (market, nöbet, destek vb. tüm türler). */
export function useAllNotificationsUnread(token: string | null, role: string | null) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(() => {
    if (!token || !role || !NOTIFICATION_ROLES.has(role)) {
      setCount(0);
      return;
    }
    if (shouldSkipOptionalApiCalls()) {
      setCount(0);
      return;
    }
    void sharedUnreadCount('/notifications/unread-count', token, setCount).then(setCount);
  }, [token, role]);

  useEffect(() => {
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener(NOTIFICATIONS_UPDATED, handler);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', onVis);
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === PUSH_RECEIVED_MESSAGE) fetchCount();
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED, handler);
      document.removeEventListener('visibilitychange', onVis);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [fetchCount]);

  return count;
}
