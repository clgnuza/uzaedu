/// <reference lib="webworker" />
import {
  buildPushNotificationContent,
  handleNotificationClick,
  syncAppBadgeFromPush,
  type PushPayload,
} from './sw/push-notification';

declare const self: ServiceWorkerGlobalScope;

const PUSH_RECEIVED = 'uzaedu-push-received';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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

self.addEventListener('notificationclick', (event) => {
  handleNotificationClick(event);
});
