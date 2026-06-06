/** Dev / hizli push test - minimal worker */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
const PUSH_ICON = { nobet: '/push-icons/nobet.svg', ders_programi: '/push-icons/ders_programi.svg', akilli_tahta: '/push-icons/akilli_tahta.svg', sinav_gorevi: '/push-icons/sinav_gorevi.svg', sinav_modulleri: '/push-icons/sinav_modulleri.svg', destek: '/push-icons/destek.svg', ajanda: '/push-icons/ajanda.svg', bilsem: '/push-icons/bilsem.svg', belirli_gun: '/push-icons/belirli_gun.svg', mesaj_merkezi: '/push-icons/mesaj_merkezi.svg', market: '/push-icons/market.svg', yolluk: '/push-icons/yolluk.svg', okul_degerlendirme: '/push-icons/okul_degerlendirme.svg', duyuru: '/push-icons/duyuru.svg', genel: '/push-icons/genel.svg' };
function pushIcon(channel) { return (channel && PUSH_ICON[channel]) || '/icon-192.png'; }
async function syncAppBadgeFromPush(unreadCount) {
  if (typeof unreadCount !== 'number' || unreadCount < 0) return;
  if (!self.navigator.setAppBadge) return;
  try {
    if (unreadCount > 0) await self.navigator.setAppBadge(Math.min(99, unreadCount));
    else await self.navigator.clearAppBadge?.();
  } catch { /* */ }
}
function notifyClientsPushReceived() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) client.postMessage({ type: 'uzaedu-push-received' });
  });
}
self.addEventListener('push', (event) => {
  let data = {}; try { data = event.data?.json() ?? {}; } catch { /* */ }
  const channel = String(data.channel || 'genel').trim() || 'genel';
  const channelLabel = data.channelLabel?.trim();
  const title = String(data.title || 'Uzaedu').trim() || 'Uzaedu';
  const body = String(data.body || '').trim();
  const silent = data.silent === true;
  const vibrate = data.vibrate === false ? undefined : [120, 60, 120];
  event.waitUntil(Promise.all([
    self.registration.showNotification(channelLabel ? `Uzaedu · ${channelLabel}` : title, { body: body || title, icon: pushIcon(channel), badge: '/icon-192.png', tag: data.tag || data.id || `uzaedu-${channel}`, data: { url: data.url || '/bildirimler', notificationId: data.id, channel }, requireInteraction: data.requireInteraction === true, silent, ...(vibrate ? { vibrate } : {}) }),
    syncAppBadgeFromPush(data.unreadCount),
    notifyClientsPushReceived(),
  ]));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action && event.action !== 'open') return;
  const raw = event.notification.data?.url || '/bildirimler';
  let target; try { const u = new URL(raw, self.location.origin); target = u.origin === self.location.origin ? u.href : new URL('/bildirimler', self.location.origin).href; } catch { target = new URL('/bildirimler', self.location.origin).href; }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => { for (const client of list) { if (client.url.startsWith(self.location.origin) && 'focus' in client) { void client.navigate(target); return client.focus(); } } return self.clients.openWindow(target); }));
});
