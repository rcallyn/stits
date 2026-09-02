// Minimal service worker for stits. Deliberately conservative: this app is
// gated by a login and its data lives on the server, so caching authenticated
// HTML or API responses would risk serving another session's content or stale
// data. It only:
//   - precaches a static, auth-free /offline fallback page and the icons
//   - serves immutable Next build assets (/_next/static/*) cache-first
//   - answers failed page navigations with the offline page
//   - never touches /api/* or any other request

const CACHE = "stits-v1";
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon", "/apple-icon"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build output: cache-first, populate on first hit.
  if (url.pathname.startsWith("/_next/static/")) {
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
    return;
  }

  // Page navigations: network-first, fall back to the offline page when the
  // network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
  }
});
