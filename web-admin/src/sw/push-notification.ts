export type PushPayload = {
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
  unreadCount?: number;
};

export const PUSH_ICON_PNG: Record<string, string> = {
  nobet: '/push-icons/nobet.png',
  ders_programi: '/push-icons/ders_programi.png',
  akilli_tahta: '/push-icons/akilli_tahta.png',
  sinav_gorevi: '/push-icons/sinav_gorevi.png',
  sinav_modulleri: '/push-icons/sinav_modulleri.png',
  destek: '/push-icons/destek.png',
  ajanda: '/push-icons/ajanda.png',
  bilsem: '/push-icons/bilsem.png',
  belirli_gun: '/push-icons/belirli_gun.png',
  mesaj_merkezi: '/push-icons/mesaj_merkezi.png',
  market: '/push-icons/market.png',
  yolluk: '/push-icons/yolluk.png',
  okul_degerlendirme: '/push-icons/okul_degerlendirme.png',
  duyuru: '/push-icons/duyuru.png',
  genel: '/push-icons/genel.png',
};

export const PUSH_BANNER_PNG: Record<string, string> = {
  nobet: '/push-icons/banners/nobet.png',
  ders_programi: '/push-icons/banners/ders_programi.png',
  akilli_tahta: '/push-icons/banners/akilli_tahta.png',
  sinav_gorevi: '/push-icons/banners/sinav_gorevi.png',
  sinav_modulleri: '/push-icons/banners/sinav_modulleri.png',
  destek: '/push-icons/banners/destek.png',
  ajanda: '/push-icons/banners/ajanda.png',
  bilsem: '/push-icons/banners/bilsem.png',
  belirli_gun: '/push-icons/banners/belirli_gun.png',
  mesaj_merkezi: '/push-icons/banners/mesaj_merkezi.png',
  market: '/push-icons/banners/market.png',
  yolluk: '/push-icons/banners/yolluk.png',
  okul_degerlendirme: '/push-icons/banners/okul_degerlendirme.png',
  duyuru: '/push-icons/banners/duyuru.png',
  genel: '/push-icons/banners/genel.png',
};

export const PUSH_BADGE_PNG = '/push-icons/badge.png';

export function pushAssetsForChannel(channel?: string) {
  const ch = channel?.trim() || 'genel';
  return {
    icon: PUSH_ICON_PNG[ch] ?? PUSH_ICON_PNG.genel,
    image: PUSH_BANNER_PNG[ch] ?? PUSH_BANNER_PNG.genel,
  };
}

export function buildPushNotificationContent(data: PushPayload): {
  title: string;
  options: NotificationOptions;
} {
  const channel = data.channel?.trim() || 'genel';
  const channelLabel = data.channelLabel?.trim();
  const rawTitle = data.title?.trim();
  const rawBody = data.body?.trim();
  const { icon, image } = pushAssetsForChannel(channel);

  const title = rawTitle || channelLabel || 'Uzaedu Öğretmen';
  const body =
    rawBody ||
    (channelLabel && rawTitle ? channelLabel : '') ||
    title;

  const vibrate: number[] | undefined = data.vibrate === false ? undefined : [100, 50, 100];

  return {
    title,
    options: {
      body,
      icon,
      badge: PUSH_BADGE_PNG,
      image,
      tag: data.tag || data.id || `uzaedu-${channel}`,
      data: {
        url: data.url || '/bildirimler',
        notificationId: data.id,
        channel,
      },
      requireInteraction: data.requireInteraction === true,
      silent: data.silent === true,
      timestamp: Date.now(),
      renotify: true,
      ...(vibrate ? { vibrate } : {}),
      actions: [
        { action: 'open', title: 'Aç' },
        { action: 'dismiss', title: 'Kapat' },
      ],
    },
  };
}

export async function syncAppBadgeFromPush(unreadCount: number | undefined): Promise<void> {
  if (typeof unreadCount !== 'number' || unreadCount < 0) return;
  const nav = self.navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge) return;
  try {
    if (unreadCount > 0) await nav.setAppBadge(Math.min(99, unreadCount));
    else await nav.clearAppBadge?.();
  } catch {
    /* ignore */
  }
}

export function safeNotificationUrl(raw: string): string {
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

export function handleNotificationClick(event: NotificationEvent): void {
  if (event.action === 'dismiss') {
    event.notification.close();
    return;
  }
  event.notification.close();
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
}
