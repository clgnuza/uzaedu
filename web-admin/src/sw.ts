import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

const OFFLINE_FLUSH = 'uzaedu-flush-offline-queue';
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

type PushPayload = {
  id?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  channel?: string;
  channelLabel?: string;
  silent?: boolean;
  vibrate?: boolean;
  requireInteraction?: boolean;
};

const PUSH_ICON: Record<string, string> = {
  nobet: '/push-icons/nobet.svg',
  ders_programi: '/push-icons/ders_programi.svg',
  akilli_tahta: '/push-icons/akilli_tahta.svg',
  sinav_gorevi: '/push-icons/sinav_gorevi.svg',
  sinav_modulleri: '/push-icons/sinav_modulleri.svg',
  destek: '/push-icons/destek.svg',
  ajanda: '/push-icons/ajanda.svg',
  bilsem: '/push-icons/bilsem.svg',
  belirli_gun: '/push-icons/belirli_gun.svg',
  mesaj_merkezi: '/push-icons/mesaj_merkezi.svg',
  market: '/push-icons/market.svg',
  yolluk: '/push-icons/yolluk.svg',
  okul_degerlendirme: '/push-icons/okul_degerlendirme.svg',
  duyuru: '/push-icons/duyuru.svg',
  genel: '/push-icons/genel.svg',
};

function pushIconForChannel(channel?: string): string {
  if (channel && PUSH_ICON[channel]) return PUSH_ICON[channel];
  return '/icon-192.png';
}

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return (event.data?.json() ?? {}) as PushPayload;
    } catch {
      return {} as PushPayload;
    }
  })();
  const channel = data.channel?.trim() || 'genel';
  const channelLabel = data.channelLabel?.trim();
  const title = data.title?.trim() || 'Uzaedu';
  const body = data.body?.trim() || '';
  const icon = pushIconForChannel(channel);
  const silent = data.silent === true;
  const vibrate =
    data.vibrate === false ? undefined : ([120, 60, 120] as [number, number, number]);
  event.waitUntil(
    self.registration.showNotification(channelLabel ? `Uzaedu · ${channelLabel}` : title, {
      body: body || title,
      icon,
      badge: '/icon-192.png',
      tag: data.tag || data.id || `uzaedu-${channel}`,
      data: { url: data.url || '/bildirimler', notificationId: data.id, channel },
      requireInteraction: data.requireInteraction === true,
      silent,
      vibrate,
      actions: [{ action: 'open', title: 'Aç' }],
    }),
  );
});

function safeNotificationUrl(raw: string): string {
  try {
    const u = new URL(raw, self.location.origin);
    if (u.origin !== self.location.origin) return new URL('/bildirimler', self.location.origin).href;
    const blocked = ['/tv', '/bakim', '/login', '/register'];
    if (blocked.some((b) => u.pathname === b || u.pathname.startsWith(`${b}/`))) {
      return new URL('/dashboard', self.location.origin).href;
    }
    return u.href;
  } catch {
    return new URL('/bildirimler', self.location.origin).href;
  }
}

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
  const action = event.action;
  event.notification.close();
  if (action && action !== 'open') return;
  const raw = (event.notification.data?.url as string) || '/bildirimler';
  const target = safeNotificationUrl(raw);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          void (client as WindowClient).navigate(target);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
