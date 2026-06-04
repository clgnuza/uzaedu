'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/api';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import {
  flushOfflineQueue,
  OFFLINE_QUEUE_FLUSH_MESSAGE,
  listOfflineQueue,
  registerBackgroundSync,
} from '@/lib/pwa-offline-queue';
import { emitNotificationsUpdated } from '@/hooks/use-duty-notifications-unread';

async function replayItem(item: {
  path: string;
  apiBase: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl(item.path, item.apiBase || resolveDefaultApiBase()), {
      method: item.method,
      headers: item.headers,
      body: item.body,
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PwaOfflineSync() {
  useEffect(() => {
    const flush = async () => {
      const pending = await listOfflineQueue();
      if (pending.length === 0) return;
      const { sent, failed } = await flushOfflineQueue(replayItem);
      if (sent > 0) {
        emitNotificationsUpdated();
        toast.success(`${sent} bekleyen işlem gönderildi`);
      }
      if (failed > 0 && sent === 0) {
        toast.error('Bazı çevrimdışı işlemler gönderilemedi');
      }
    };

    const onOnline = () => void flush();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === OFFLINE_QUEUE_FLUSH_MESSAGE) void flush();
    };

    window.addEventListener('online', onOnline);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    if (navigator.onLine) void flush();

    return () => {
      window.removeEventListener('online', onOnline);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    void registerBackgroundSync();
  }, []);

  return null;
}
