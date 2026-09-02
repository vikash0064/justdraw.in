// JustDraw PWA Service Worker
const CACHE_NAME = 'justdraw-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/app-logo.png',
  '/justdraw-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Never cache API or WebSocket requests
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
    return;
  }

  // Network-first strategy for dynamic SPA pages
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
