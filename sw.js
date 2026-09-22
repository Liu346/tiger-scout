const CACHE = 'tiger-scout-v35-wide-qr-scanner';
const ASSETS = [
  '/', '/index.html', '/public/manifest.webmanifest', '/public/icon.svg', '/public/team-9072-logo.png',
  '/src/main.js', '/src/style.css',
  '/main.js', '/style.css', '/manifest.webmanifest', '/icon.svg', '/team-9072-logo.png',
  '/qrcode.min.js', '/qr-scanner.umd.min.js', '/qr-scanner-worker.min.js', '/chart.umd.min.js',
  '/public/vendor/qrcode.min.js', '/public/vendor/qr-scanner.umd.min.js',
  '/public/vendor/qr-scanner-worker.min.js', '/public/vendor/chart.umd.min.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && !response.redirected) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
