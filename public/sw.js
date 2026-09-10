// Minimal service worker for stits. Deliberately conservative: the app is
// gated by a login and all its data lives on the server, so caching
// authenticated HTML or API responses would risk serving stale or
// cross-session content.
//
// It ONLY caches immutable Next build assets (/_next/static/*) cache-first.
// It deliberately does NOT intercept page navigations: the app can't do
// anything useful offline, and an earlier version that answered failed
// navigations with an "/offline" page ended up showing "You're offline" to
// people who were online — a single fetch() inside a service worker can be
// rejected by antivirus web-shields, corporate TLS-inspection proxies, some
// VPNs, or flaky HTTP/3 even when the network is fine. Navigations now go
// straight to the network, which is the path that interference like that
// doesn't break.

const CACHE = "stits-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build output only. Everything else (pages, /api/*, RSC
  // payloads) is left entirely to the browser.
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
    )
  );
});
