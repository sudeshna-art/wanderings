/* Wanderings offline support. Edition portugal. Version 202610091658 */
const EDITION = 'portugal';
const CACHE = 'wanderings-' + EDITION + '-202610091658';
const FILES = ["./", "./apple-touch-icon.png", "./art/algarve-mark.svg", "./art/algarve.svg", "./art/lisbon-mark.svg", "./art/lisbon.svg", "./content/cities.json", "./content/edition.json", "./content/essentials.json", "./content/phrases.json", "./content/places.json", "./core/config/default-config.js", "./core/models/schema.js", "./core/services/content-service.js", "./core/services/currency-service.js", "./core/services/fare-service.js", "./core/services/link-service.js", "./core/services/location-service.js", "./core/services/map-service.js", "./core/services/places-service.js", "./core/services/providers/illustrated-map.js", "./core/services/providers/leaflet-map.js", "./core/services/share-service.js", "./core/services/speech-service.js", "./core/services/storage-service.js", "./core/services/trip-service.js", "./core/styles/app.css", "./core/ui/app.js", "./core/ui/components.js", "./core/ui/dom.js", "./core/ui/screens/essentials.js", "./core/ui/screens/journal.js", "./core/ui/screens/phrases.js", "./core/ui/screens/places.js", "./core/ui/screens/plan.js", "./core/ui/screens/today.js", "./core/ui/screens/wanderer.js", "./core/ui/screens/welcome.js", "./core/ui/state.js", "./core/vendor/leaflet/LICENSE", "./core/vendor/leaflet/images/layers-2x.png", "./core/vendor/leaflet/images/layers.png", "./core/vendor/leaflet/images/marker-icon-2x.png", "./core/vendor/leaflet/images/marker-icon.png", "./core/vendor/leaflet/images/marker-shadow.png", "./core/vendor/leaflet/leaflet.css", "./core/vendor/leaflet/leaflet.js", "./edition.config.js", "./icon-192.png", "./icon-512.png", "./icon.svg", "./index.html", "./manifest.webmanifest"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('wanderings-' + EDITION + '-')).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('tile.openstreetmap.org')) return;   /* map tiles: never cached in bulk */
  if (url.hostname === 'api.frankfurter.dev') return;             /* live rate: network only */
  const scope = new URL(self.registration.scope);
  const mine = url.origin === location.origin && url.pathname.startsWith(scope.pathname);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mine && !fonts) return;                                     /* other editions and sites: leave alone */
  e.respondWith(fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
