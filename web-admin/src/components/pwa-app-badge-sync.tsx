'use client';

import { useEffect } from 'react';
import { useAuthOptional } from '@/providers/auth-provider';
import { useAllNotificationsUnread } from '@/hooks/use-duty-notifications-unread';
import { syncAppBadge } from '@/lib/pwa-app-badge';
import { isPwaDisplayMode } from '@/lib/pwa-display';

/** PWA modunda okunmamış bildirim sayısını ikon rozetine yansıtır */
export function PwaAppBadgeSync() {
  const auth = useAuthOptional();
  const token = auth?.token ?? null;
  const role = auth?.role ?? null;
  const unread = useAllNotificationsUnread(token, role);

  useEffect(() => {
    if (!isPwaDisplayMode()) return;
    void syncAppBadge(unread);
  }, [unread]);

  useEffect(() => {
    return () => {
      void syncAppBadge(0);
    };
  }, []);

  return null;
}
