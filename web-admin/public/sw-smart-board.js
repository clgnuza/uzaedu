const CACHE = "ogretmenpro-shell-v1";
const PRECACHE = ["/akilli-tahta"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith("/akilli-tahta")) return;
  e.respondWith(fetch(e.request).then((r) => {
    const c = r.clone();
    caches.open(CACHE).then((x) => x.put(e.request, c));
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match("/akilli-tahta"))));
});
