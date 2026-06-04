'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAllNotificationsUnread } from '@/hooks/use-duty-notifications-unread';
import { syncAppBadge } from '@/lib/pwa-app-badge';
import { isPwaDisplayMode } from '@/lib/pwa-display';

/** PWA modunda okunmamış bildirim sayısını ikon rozetine yansıtır */
export function PwaAppBadgeSync() {
  const { token, user } = useAuth();
  const role = user?.role ?? null;
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
