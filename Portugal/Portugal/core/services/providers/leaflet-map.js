/* Leaflet map provider (bundled library, OpenStreetMap-based tiles for the beta).
   Implements the map-service interface. A later google-map.js implements the same functions. */
import { CONFIG } from '../../config/default-config.js';

const L = () => window.L;

function pinIcon(p, opts) {
  const sel = opts.selectedId === p.id;
  const label = p.number != null ? String(p.number) : '';
  const cls = 'wm-pin' + (p.number != null ? ' num' : '') + (p.hollow ? ' hollow' : '') + (sel ? ' sel' : '') + (p.went ? ' went' : '');
  return L().divIcon({ className: 'wm-pin-wrap', html: `<span class="${cls}" aria-hidden="true">${label}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
}

export const leafletMap = {
  ready() { return !!L(); },
  create(el, { center, zoom = 14, onTilesFailed }) {
    const map = L().map(el, { zoomControl: false, attributionControl: true, tap: true }).setView([center.lat, center.lng], zoom);
    L().control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix('');
    const tiles = L().tileLayer(CONFIG.map.tileUrl, { maxZoom: CONFIG.map.maxZoom, attribution: CONFIG.map.attribution, className: 'wm-tiles', crossOrigin: true }).addTo(map);
    let errors = 0, loaded = 0;
    tiles.on('tileload', () => { loaded++; });
    tiles.on('tileerror', () => { errors++; if (errors >= 4 && loaded === 0 && onTilesFailed) { onTilesFailed(); } });
    return { kind: 'live', map, markers: L().layerGroup().addTo(map), you: null, route: null };
  },
  setUserLocation(h, pos) {
    if (!pos) { if (h.you) { h.map.removeLayer(h.you); h.you = null; } return; }
    const icon = L().divIcon({ className: 'wm-you-wrap', html: '<span class="wm-you" aria-label="You are here"></span>', iconSize: [28, 28], iconAnchor: [14, 14] });
    if (!h.you) h.you = L().marker([pos.lat, pos.lng], { icon, keyboard: false, zIndexOffset: 1000 }).addTo(h.map);
    else h.you.setLatLng([pos.lat, pos.lng]);
  },
  setMarkers(h, places, opts = {}) {
    h.markers.clearLayers();
    if (h.route) { h.map.removeLayer(h.route); h.route = null; }
    places.forEach(p => {
      if (!p.location) return;
      const m = L().marker([p.location.lat, p.location.lng], { icon: pinIcon(p, opts), title: p.name, alt: p.name, riseOnHover: true });
      m.on('click', () => opts.onTap && opts.onTap(p.id));
      m.on('keypress', e => { if (e.originalEvent && e.originalEvent.key === 'Enter' && opts.onTap) opts.onTap(p.id); });
      h.markers.addLayer(m);
    });
    if (opts.route && places.length > 1) {
      const pts = (opts.routeStart ? [opts.routeStart] : []).concat(places.map(p => p.location)).map(l => [l.lat, l.lng]);
      h.route = L().polyline(pts, { className: 'wm-route', weight: 2, dashArray: '4 6', interactive: false }).addTo(h.map);
    }
  },
  focus(h, pt, zoom) { h.map.setView([pt.lat, pt.lng], zoom || h.map.getZoom(), { animate: true }); },
  fitTo(h, points) {
    const pts = points.filter(Boolean).map(p => [p.lat, p.lng]);
    if (!pts.length) return;
    if (pts.length === 1) { h.map.setView(pts[0], 15); return; }
    h.map.fitBounds(pts, { padding: [36, 36], maxZoom: 16 });
  },
  resize(h) { try { h.map.invalidateSize(); } catch (e) {} },
  destroy(h) { try { h.map.remove(); } catch (e) {} }
};
