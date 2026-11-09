// Luna Offline: works with no signal. The app's own files are kept on the phone; apps/Google/Claude always go to the network.
const VERSION = 'ac5f9e4a92';
const CACHE = 'luna-offline-' + VERSION;
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'passport/config.js', 'passport/google.js', 'passport/passport.js', 'passport/ui.js', 'passport/passport.css', 'passport/theme.json',
  'web/brain.js', 'web/claude.js', 'web/store.js', 'web/connect.js', 'web/shim.js', 'web/settings.js', 'web/web.css',
  'vendor/anthropic-sdk-1.3.0.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('luna-offline-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;            // Google, Claude, Workers: network only
  // network first (fresh when online), the kept copy when offline
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); if (r.ok) caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
