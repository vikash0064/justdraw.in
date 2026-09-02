// JustDraw PWA Service Worker
const CACHE_NAME = 'justdraw-pwa-v2';
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

  const url = new URL(event.request.url);

  // Never intercept API, WebSocket, auth, or upload requests
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/uploads')
  ) {
    return;
  }

  // Network-first with guaranteed valid Response fallback (Never return undefined to respondWith)
  event.respondWith(
    fetch(event.request).catch(async () => {
      const match = await caches.match(event.request);
      if (match) return match;
      if (event.request.mode === 'navigate') {
        const root = await caches.match('/');
        if (root) return root;
      }
      return new Response('Network unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});
