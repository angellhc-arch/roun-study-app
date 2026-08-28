const CACHE_NAME = 'roun-study-app-shell-v4';
const APP_SHELL = [
  '/',
  '/roun_study_app.html',
  '/manifest.webmanifest',
  '/icons/frog-192.png',
  '/icons/frog-512.png',
  '/icons/frog-512-maskable.png',
  '/icons/frog-apple-touch-icon.png',
  '/icons/frog-home.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isDynamicData =
    url.hostname.includes('supabase.co') ||
    (isSameOrigin && url.pathname.startsWith('/api/'));

  if (isDynamicData) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/roun_study_app.html'))
    );
    return;
  }

  if (!isSameOrigin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
