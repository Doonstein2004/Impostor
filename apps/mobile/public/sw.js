/* Service worker mínimo para que la app sea instalable (PWA).
 * Estrategia network-first para navegación con caída a un shell cacheado,
 * de modo que reabrir la app instalada funcione aunque la red falle.
 *
 * IMPORTANTE — versionado de CACHE:
 * Este string DEBE cambiar en cada deploy que toque este archivo. El navegador
 * solo reinstala el service worker cuando el contenido de sw.js difiere byte a
 * byte del que ya tiene instalado; si nunca cambia, `CACHE` queda fijo para
 * siempre y `activate()` nunca limpia nada. Bug real detectado: quedó fijo en
 * 'impostor-v1' desde que se creó, así que assets viejos (JS/CSS con hash de
 * un build anterior) podían quedar cacheados indefinidamente cache-first sin
 * revalidar, y un fetch fallido en un asset crítico sin cache tiraba una
 * promesa sin manejar que rompía la carga entera (pantalla negra sin error
 * visible). Subir este número fuerza a todos los navegadores con una versión
 * vieja instalada a purgar su cache en el próximo visit, sin pedirle al
 * usuario que borre nada a mano. */
const CACHE = 'impostor-v2';
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

  // Otros GET: cache-first, pero si no está cacheado y la red falla (offline,
  // asset con hash viejo ya no disponible, etc.) no debe tirar una promesa
  // sin manejar — eso puede tumbar la carga de un chunk JS crítico y dejar
  // la pantalla en negro sin ningún error visible para el usuario.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(() => Response.error());
    }),
  );
});
