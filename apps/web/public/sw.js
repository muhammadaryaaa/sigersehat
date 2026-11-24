// Service worker SIGERSEHAT — PWA ringan.
// Prinsip: hanya aset statis satu origin yang dicache. Permintaan API (data
// kesehatan) TIDAK PERNAH dicache dan selalu ke jaringan.
const CACHE = "sigersehat-static-v1";
const STATIC_RE = /\.(?:webp|jpg|jpeg|png|svg|woff2|css|js|webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return; // API & tile peta: jaringan langsung
  if (url.pathname.startsWith("/api/")) return;
  if (!STATIC_RE.test(url.pathname)) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    }),
  );
});
