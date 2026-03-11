const CACHE_NAME = 'driverhub-v5-static-2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/display',
  '/display/laptop',
  '/audio',
  '/network',
  '/chipset',
  '/global/tailwind.css',
  '/global/search.js',
  '/global/driverLoader.js',
  '/global/favorites.js',
  '/feeds/drivers.json',
  '/feeds/drivers-delta.json',
  '/feeds/trust-metrics.json',
  '/feeds/audio-drivers.json',
  '/feeds/network-drivers.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; }).map(function(key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  const isPageOrFeed = event.request.mode === 'navigate'
    || requestUrl.pathname.endsWith('.html')
    || requestUrl.pathname.startsWith('/feeds/');

  if (isPageOrFeed) {
    event.respondWith(
      fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.ok && requestUrl.origin === self.location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return Response.error();
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.ok && requestUrl.origin === self.location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return cachedResponse;
      });
    })
  );
});
