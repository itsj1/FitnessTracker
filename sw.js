// Service worker de Muscu : permet d'ouvrir l'appli hors ligne.
// Stratégie : réseau d'abord (tu as toujours la dernière version quand tu es en ligne),
// et si le réseau est absent ou trop lent (> 3 s), on sert la copie gardée en cache.
// Les appels à api.github.com (synchro) ne sont JAMAIS interceptés.

const CACHE = 'muscu-v1';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // laisse passer GitHub API & co
  e.respondWith(networkFirst(req));
});

function networkFirst(req) {
  return new Promise(resolve => {
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => fromCache().then(r => r && resolve(r)), 3000);
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        clearTimeout(timer);
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        resolve(res);
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then(r => resolve(r || Response.error()));
      });
  });
}
