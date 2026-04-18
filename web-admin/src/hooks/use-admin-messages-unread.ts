'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, shouldSkipOptionalApiCalls } from '@/lib/api';

const ADMIN_MESSAGES_UPDATED = 'admin-messages-updated';

const adminUnreadInflight = new Map<string, Promise<number>>();

function sharedAdminUnreadCount(token: string): Promise<number> {
  const key = token;
  let p = adminUnreadInflight.get(key);
  if (!p) {
    p = apiFetch<{ count: number }>('/admin-messages/unread-count', { token })
      .then((r) => r.count ?? 0)
      .catch(() => 0)
      .finally(() => {
        adminUnreadInflight.delete(key);
      });
    adminUnreadInflight.set(key, p);
  }
  return p;
}

export function emitAdminMessagesUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_MESSAGES_UPDATED));
  }
}

/**
 * Okunmamış sistem mesajı sayısı. Sadece school_admin için.
 */
export function useAdminMessagesUnread(token: string | null, role: string | null) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(() => {
    if (!token || role !== 'school_admin') {
      setCount(0);
      return;
    }
    if (shouldSkipOptionalApiCalls()) {
      setCount(0);
      return;
    }
    void sharedAdminUnreadCount(token).then(setCount);
  }, [token, role]);

  useEffect(() => {
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener(ADMIN_MESSAGES_UPDATED, handler);
    return () => window.removeEventListener(ADMIN_MESSAGES_UPDATED, handler);
  }, [fetchCount]);

  return count;
}
