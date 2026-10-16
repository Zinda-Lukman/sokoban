const CACHE_NAME = 'sokoban-shell-v2026-10-16';
const APP_VERSION = '2026-10-16';

const APP_SHELL = [
  './',
  './index.html',
  `./dist/bundle.js?v=${APP_VERSION}`,
  `./style/theme.css?v=${APP_VERSION}`,
  `./style/gamify.css?v=${APP_VERSION}`,
  `./style/info-button.css?v=${APP_VERSION}`,
  `./style/trophy.css?v=${APP_VERSION}`,
  `./style/style.css?v=${APP_VERSION}`,
  `./style/my-colours.css?v=${APP_VERSION}`,
  `./lib/sokoban.js?v=${APP_VERSION}`,
  './sounds/victory/victory1.mp3',
  './sounds/victory/victory2.mp3',
  './sounds/victory/victory3.mp3',
  './sounds/victory/victory4.mp3',
  './PNG/Ground/ground.png',
  './PNG/Environment/environment_04.png',
  './PNG/Crates/crate_04.png',
  './PNG/Crates/crate_05.png',
  './PNG/Crates/crate_30.png',
  './PNG/Player/player_01.png',
  './PNG/Player/player_04.png',
  './PNG/Player/player_13.png',
  './PNG/Player/player_16.png',
  './PNG/share_image.png',
  'https://telegram.org/js/telegram-web-app.js',
  'https://code.createjs.com/createjs-2015.11.26.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min.js',
  'https://code.jquery.com/jquery-3.2.1.min.js',
  'https://code.jquery.com/ui/1.12.0/jquery-ui.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Press+Start+2P&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&family=Inter:wght@400;500;600&display=swap',
  'https://fonts.gstatic.com/s/spacegrotesk/v16/vm8qdRbmXEYG0W3BvLTIVw.woff2',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2',
  'https://unpkg.com/tippy.js@6/dist/tippy.css',
  'https://unpkg.com/@popperjs/core@2',
  'https://unpkg.com/tippy.js@6'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => undefined))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isStaticAsset = isSameOrigin || requestUrl.origin === 'https://telegram.org' || requestUrl.origin === 'https://code.createjs.com' || requestUrl.origin === 'https://cdnjs.cloudflare.com' || requestUrl.origin === 'https://code.jquery.com' || requestUrl.origin === 'https://fonts.googleapis.com' || requestUrl.origin === 'https://fonts.gstatic.com' || requestUrl.origin === 'https://unpkg.com';

  if (!isStaticAsset) {
    return;
  }

  if (requestUrl.origin === self.location.origin && requestUrl.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 206 || networkResponse.type === 'opaqueredirect') {
            return networkResponse;
          }

          if (networkResponse.ok && networkResponse.type !== 'opaque') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || caches.match('./index.html'));

      return cachedResponse || fetchPromise;
    })
  );
});
