// S10 BizSmartHub — Service Worker
const CACHE_NAME = 'bizsmarthub-v1';
const STATIC_ASSETS = ['/dashboard', '/login', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only cache GET requests; skip API calls
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.port === '3202' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/sync/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
