"use strict";
(() => {
  // src/sw/push-notification.ts
  var PUSH_ICON_PNG = {
    nobet: "/push-icons/nobet.png",
    ders_programi: "/push-icons/ders_programi.png",
    akilli_tahta: "/push-icons/akilli_tahta.png",
    sinav_gorevi: "/push-icons/sinav_gorevi.png",
    sinav_modulleri: "/push-icons/sinav_modulleri.png",
    destek: "/push-icons/destek.png",
    ajanda: "/push-icons/ajanda.png",
    bilsem: "/push-icons/bilsem.png",
    belirli_gun: "/push-icons/belirli_gun.png",
    mesaj_merkezi: "/push-icons/mesaj_merkezi.png",
    market: "/push-icons/market.png",
    yolluk: "/push-icons/yolluk.png",
    okul_degerlendirme: "/push-icons/okul_degerlendirme.png",
    duyuru: "/push-icons/duyuru.png",
    genel: "/push-icons/genel.png"
  };
  var PUSH_BANNER_PNG = {
    nobet: "/push-icons/banners/nobet.png",
    ders_programi: "/push-icons/banners/ders_programi.png",
    akilli_tahta: "/push-icons/banners/akilli_tahta.png",
    sinav_gorevi: "/push-icons/banners/sinav_gorevi.png",
    sinav_modulleri: "/push-icons/banners/sinav_modulleri.png",
    destek: "/push-icons/banners/destek.png",
    ajanda: "/push-icons/banners/ajanda.png",
    bilsem: "/push-icons/banners/bilsem.png",
    belirli_gun: "/push-icons/banners/belirli_gun.png",
    mesaj_merkezi: "/push-icons/banners/mesaj_merkezi.png",
    market: "/push-icons/banners/market.png",
    yolluk: "/push-icons/banners/yolluk.png",
    okul_degerlendirme: "/push-icons/banners/okul_degerlendirme.png",
    duyuru: "/push-icons/banners/duyuru.png",
    genel: "/push-icons/banners/genel.png"
  };
  var PUSH_BADGE_PNG = "/push-icons/badge.png";
  function pushAssetsForChannel(channel) {
    const ch = channel?.trim() || "genel";
    return {
      icon: PUSH_ICON_PNG[ch] ?? PUSH_ICON_PNG.genel,
      image: PUSH_BANNER_PNG[ch] ?? PUSH_BANNER_PNG.genel
    };
  }
  function buildPushNotificationContent(data) {
    const channel = data.channel?.trim() || "genel";
    const channelLabel = data.channelLabel?.trim();
    const rawTitle = data.title?.trim();
    const rawBody = data.body?.trim();
    const { icon, image } = pushAssetsForChannel(channel);
    const title = rawTitle || channelLabel || "Uzaedu \xD6\u011Fretmen";
    const body = rawBody || (channelLabel && rawTitle ? channelLabel : "") || title;
    const vibrate = data.vibrate === false ? void 0 : [100, 50, 100];
    return {
      title,
      options: {
        body,
        icon,
        badge: PUSH_BADGE_PNG,
        image,
        tag: data.tag || data.id || `uzaedu-${channel}`,
        data: {
          url: data.url || "/bildirimler",
          notificationId: data.id,
          channel
        },
        requireInteraction: data.requireInteraction === true,
        silent: data.silent === true,
        timestamp: Date.now(),
        renotify: true,
        ...vibrate ? { vibrate } : {},
        actions: [
          { action: "open", title: "A\xE7" },
          { action: "dismiss", title: "Kapat" }
        ]
      }
    };
  }
  async function syncAppBadgeFromPush(unreadCount) {
    if (typeof unreadCount !== "number" || unreadCount < 0) return;
    const nav = self.navigator;
    if (!nav.setAppBadge) return;
    try {
      if (unreadCount > 0) await nav.setAppBadge(Math.min(99, unreadCount));
      else await nav.clearAppBadge?.();
    } catch {
    }
  }
  function safeNotificationUrl(raw) {
    try {
      const u = new URL(raw, self.location.origin);
      if (u.origin !== self.location.origin) return new URL("/bildirimler", self.location.origin).href;
      const blocked = ["/tv", "/bakim", "/login", "/register"];
      if (blocked.some((b) => u.pathname === b || u.pathname.startsWith(`${b}/`))) {
        return new URL("/dashboard", self.location.origin).href;
      }
      return u.href;
    } catch {
      return new URL("/bildirimler", self.location.origin).href;
    }
  }
  function handleNotificationClick(event) {
    if (event.action === "dismiss") {
      event.notification.close();
      return;
    }
    event.notification.close();
    const raw = event.notification.data?.url || "/bildirimler";
    const target = safeNotificationUrl(raw);
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const client of list) {
          if ("focus" in client && client.url.startsWith(self.location.origin)) {
            void client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
    );
  }

  // src/sw-push-standalone.ts
  var PUSH_RECEIVED = "uzaedu-push-received";
  self.addEventListener("install", () => {
    self.skipWaiting();
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });
  function notifyClientsPushReceived() {
    return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: PUSH_RECEIVED });
      }
    });
  }
  self.addEventListener("push", (event) => {
    const data = (() => {
      try {
        return event.data?.json() ?? {};
      } catch {
        return {};
      }
    })();
    const { title, options } = buildPushNotificationContent(data);
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, options),
        syncAppBadgeFromPush(data.unreadCount),
        notifyClientsPushReceived()
      ])
    );
  });
  self.addEventListener("notificationclick", (event) => {
    handleNotificationClick(event);
  });
})();
