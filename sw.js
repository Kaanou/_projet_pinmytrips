const CACHE_NAME = 'pinmytrips-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './nojekyll'
];
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(networkResponse => {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', responseClone));
      return networkResponse;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cachedResponse => {
    return cachedResponse || fetch(event.request).then(networkResponse => {
      if (event.request.url.startsWith(self.location.origin)) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
      }
      return networkResponse;
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
    });
  }));
});
