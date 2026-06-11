const CACHE_NAME = 'cuber-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/data.js',
  '/js/components/dashboard.js',
  '/js/components/cases.js',
  '/js/components/trainer.js',
  '/js/components/timer.js',
  '/js/components/history.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((response) => {
        // Adiciona dinamicamente as imagens acessadas no cache
        if (e.request.url.includes('/imagens/')) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, response.clone());
            return response;
          });
        }
        return response;
      });
    })
  );
});