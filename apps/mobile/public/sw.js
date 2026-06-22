/* Service worker mínimo para que la app sea instalable (PWA).
 * Estrategia network-first para navegación con caída a un shell cacheado,
 * de modo que reabrir la app instalada funcione aunque la red falle. */
const CACHE = 'impostor-v1';
const SHELL = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navegación: red primero, shell como respaldo offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // Otros GET: cache-first liviano.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)),
  );
});
