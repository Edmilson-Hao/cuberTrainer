const CACHE_NAME = 'cuber-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css', // Corrigido de /style.css para ./css/style.css
  './js/app.js',
  './js/db.js',
  './js/data.js',
  './js/components/dashboard.js',
  './js/components/cases.js',
  './js/components/trainer.js',
  './js/components/timer.js',
  './js/components/history.js',
  './imagens/icon.png',    // Adicionado para garantir a instalação do PWA
  './imagens/splash.png',  // Adicionado para resolver o sumiço no celular
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Em vez de dar addAll direto, testamos os arquivos um por um
      return Promise.all(
        ASSETS.map((url) => {
          return cache.add(url).catch((err) => {
            console.error(`❌ Falha ao colocar no cache o arquivo: ${url}`, err);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  // Limpa caches antigos quando você atualizar a versão do app (ex: 'cuber-v2')
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((response) => {
        // Captura dinamicamente qualquer outra imagem ou recurso da pasta imagens
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