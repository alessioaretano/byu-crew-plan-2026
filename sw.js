// BYU 2026 Crew · Service Worker
// Sorgt dafür, dass die App auch bei Funkloch in Witikon weiterläuft.
// WICHTIG: Bei jedem index.html/sw.js Update Cache-Version hochzählen!
const CACHE = 'byu-crew-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Erlaube Page, neuen SW manuell zu aktivieren
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isHtmlRequest(req, url){
  return req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Wetter & QR-Service: Network-first (live Daten), Fallback Cache
  if (url.host === 'api.open-meteo.com' || url.host === 'api.qrserver.com') {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // HTML: Network-first (damit Updates ankommen), Fallback Cache (Funkloch)
  if (isHtmlRequest(req, url)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Andere Assets (Icons, Manifest, JS): Cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
