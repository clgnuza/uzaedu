'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

const NOTIFICATIONS_UPDATED = 'notifications-updated';

export function emitNotificationsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED));
  }
}

/** Okunmamış nöbet bildirimi sayısı. Teacher ve school_admin için. */
export function useDutyNotificationsUnread(token: string | null, role: string | null) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(() => {
    if (!token || (role !== 'teacher' && role !== 'school_admin')) {
      setCount(0);
      return;
    }
    apiFetch<{ count: number }>('/notifications/unread-count?event_type=duty', { token })
      .then((r) => setCount(r.count ?? 0))
      .catch(() => setCount(0));
  }, [token, role]);

  useEffect(() => {
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener(NOTIFICATIONS_UPDATED, handler);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED, handler);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchCount]);

  return count;
}

/** Okunmamış toplam inbox sayısı (market, nöbet, destek vb. tüm türler). Teacher ve school_admin için. */
export function useAllNotificationsUnread(token: string | null, role: string | null) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(() => {
    if (!token || (role !== 'teacher' && role !== 'school_admin')) {
      setCount(0);
      return;
    }
    apiFetch<{ count: number }>('/notifications/unread-count', { token })
      .then((r) => setCount(r.count ?? 0))
      .catch(() => setCount(0));
  }, [token, role]);

  useEffect(() => {
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener(NOTIFICATIONS_UPDATED, handler);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED, handler);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchCount]);

  return count;
}
