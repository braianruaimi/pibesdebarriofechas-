const CACHE_NAME = 'pibes-de-barrio-v2';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './qrcode.min.js',
  './script.js',
  './manifest.webmanifest',
  './fonts/bebas-neue-400.ttf',
  './fonts/creepster-400.ttf',
  './fonts/montserrat-400.ttf',
  './fonts/montserrat-700.ttf',
  './fonts/montserrat-900.ttf',
  './fonts/rock-salt-400.ttf',
  './image/logopibes.png',
  './image/Pablo cuomo.png',
  './image/icon-192.png',
  './image/icon-512.png',
  './image/icon-maskable-192.png',
  './image/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});