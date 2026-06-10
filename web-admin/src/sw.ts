import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

const OFFLINE_FLUSH = 'uzaedu-flush-offline-queue';
const PUSH_RECEIVED = 'uzaedu-push-received';
const SYNC_TAG = 'uzaedu-api-retry';
const PERIODIC_TAG = 'uzaedu-periodic-retry';

interface SyncEvent extends ExtendableEvent {
  tag: string;
}

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const apiBypass = {
  matcher: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
    sameOrigin && (url.pathname.startsWith('/be-api/') || url.pathname.startsWith('/api/')),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiBypass, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();

import {
  buildPushNotificationContent,
  handleNotificationClick,
  syncAppBadgeFromPush,
  type PushPayload,
} from './sw/push-notification';

function notifyClientsPushReceived(): Promise<void> {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: PUSH_RECEIVED });
    }
  });
}

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return (event.data?.json() ?? {}) as PushPayload;
    } catch {
      return {} as PushPayload;
    }
  })();
  const { title, options } = buildPushNotificationContent(data);
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      syncAppBadgeFromPush(data.unreadCount),
      notifyClientsPushReceived(),
    ]),
  );
});

function flushOfflineToClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: OFFLINE_FLUSH });
    }
  });
}

self.addEventListener('sync', (event) => {
  const ev = event as SyncEvent;
  if (ev.tag !== SYNC_TAG && ev.tag !== PERIODIC_TAG) return;
  ev.waitUntil(flushOfflineToClients());
});

self.addEventListener('periodicsync', (event) => {
  const ev = event as SyncEvent;
  if (ev.tag !== PERIODIC_TAG) return;
  ev.waitUntil(flushOfflineToClients());
});

self.addEventListener('notificationclick', (event) => {
  handleNotificationClick(event);
});
