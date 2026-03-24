'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

const ADMIN_MESSAGES_UPDATED = 'admin-messages-updated';

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
    apiFetch<{ count: number }>('/admin-messages/unread-count', { token })
      .then((r) => setCount(r.count ?? 0))
      .catch(() => setCount(0));
  }, [token, role]);

  useEffect(() => {
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener(ADMIN_MESSAGES_UPDATED, handler);
    return () => window.removeEventListener(ADMIN_MESSAGES_UPDATED, handler);
  }, [fetchCount]);

  return count;
}
