/* MapLibre map provider: vector maps from the edition's PMTiles packs (OpenStreetMap data, Protomaps).
   Works fully offline when the pack is saved on the phone; reads the pack from the site while online otherwise.
   Implements the map-service interface. Libraries are bundled in core/vendor and loaded only when a map opens. */

const base = new URL('../../vendor/', import.meta.url).href;
let libs = null, protocol = null, styleJSON = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
}
function loadCSS(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}
async function ensureLibs() {
  if (!libs) libs = (async () => {
    loadCSS(base + 'maplibre/maplibre-gl.css');
    if (!window.maplibregl) await loadScript(base + 'maplibre/maplibre-gl.js');
    if (!window.pmtiles) await loadScript(base + 'pmtiles/pmtiles.js');
    protocol = new window.pmtiles.Protocol();
    window.maplibregl.addProtocol('pmtiles', protocol.tile);
    const r = await fetch(base + 'maplibre/style.json'); styleJSON = await r.json();
  })();
  return libs;
}
export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}
/* source: { file } for a pack saved on the phone, or { url } to read from the site. */
function styleFor(source) {
  let key;
  if (source.file) { const pm = new window.pmtiles.PMTiles(new window.pmtiles.FileSource(source.file)); protocol.add(pm); key = source.file.name; }
  else { const pm = new window.pmtiles.PMTiles(source.url); protocol.add(pm); key = source.url; }
  const s = JSON.parse(JSON.stringify(styleJSON));
  s.glyphs = base + 'maplibre/fonts/{fontstack}/{range}.pbf';
  s.sources.protomaps.url = 'pmtiles://' + key;
  return s;
}
function pinEl(p, opts) {
  const sel = opts.selectedId === p.id;
  const cls = 'wm-pin' + (p.number != null ? ' num' : '') + (p.hollow ? ' hollow' : '') + (sel ? ' sel' : '') + (p.went ? ' went' : '');
  const wrap = document.createElement('button');
  wrap.type = 'button'; wrap.className = 'wm-pin-wrap ml'; wrap.setAttribute('aria-label', p.name);
  wrap.innerHTML = `<span class="${cls}" aria-hidden="true">${p.number != null ? p.number : ''}</span>`;
  wrap.addEventListener('click', e => { e.stopPropagation(); opts.onTap && opts.onTap(p.id); });
  return wrap;
}
const ROUTE = 'wm-route';
function drawRoute(h) {
  const m = h.map; if (!m || !m.isStyleLoaded()) return;
  if (m.getLayer(ROUTE)) m.removeLayer(ROUTE);
  if (m.getSource(ROUTE)) m.removeSource(ROUTE);
  if (!h.route || h.route.length < 2) return;
  m.addSource(ROUTE, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: h.route.map(p => [p.lng, p.lat]) } } });
  m.addLayer({ id: ROUTE, type: 'line', source: ROUTE, paint: { 'line-color': '#00677A', 'line-width': 2, 'line-dasharray': [2, 3] } });
}

export const maplibreMap = {
  ensureLibs, webglOK,
  /* Resolves a handle once the map is ready to draw. onFail() is called if tiles cannot be read. */
  async create(el, { center, zoom = 14, source, onFail, onMoveEnd }) {
    await ensureLibs();
    const L = window.maplibregl;
    const map = new L.Map({ container: el, style: styleFor(source), center: [center.lng, center.lat], zoom, maxZoom: 18, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false });
    map.touchZoomRotate.disableRotation();
    map.addControl(new L.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new L.NavigationControl({ showCompass: false }), 'bottom-right');
    const h = { kind: 'vector', map, markers: [], you: null, route: null, source };
    let tileErrors = 0, loaded = false;
    map.on('load', () => { loaded = true; drawRoute(h); });
    map.on('styledata', () => drawRoute(h));
    map.on('error', e => { if (e && e.sourceId === 'protomaps' || /pmtiles|tile/i.test(String(e && e.error && e.error.message))) { tileErrors++; if (tileErrors >= 3 && !loaded && onFail) onFail(); } });
    map.on('moveend', () => { const c = map.getCenter(); onMoveEnd && onMoveEnd({ lat: c.lat, lng: c.lng }); });
    await new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; map.once('load', fin); setTimeout(fin, 6000); });
    return h;
  },
  swapSource(h, source) { h.source = source; h.map.setStyle(styleFor(source)); },
  setUserLocation(h, pos) {
    if (!pos) { if (h.you) { h.you.remove(); h.you = null; } return; }
    if (!h.you) { const el = document.createElement('div'); el.className = 'wm-you-wrap ml'; el.innerHTML = '<span class="wm-you" aria-label="You are here"></span>'; h.you = new window.maplibregl.Marker({ element: el }).setLngLat([pos.lng, pos.lat]).addTo(h.map); }
    else h.you.setLngLat([pos.lng, pos.lat]);
  },
  setMarkers(h, places, opts = {}) {
    h.markers.forEach(m => m.remove()); h.markers = [];
    places.forEach(p => { if (!p.location) return; h.markers.push(new window.maplibregl.Marker({ element: pinEl(p, opts) }).setLngLat([p.location.lng, p.location.lat]).addTo(h.map)); });
    h.route = opts.route && places.length > 1 ? (opts.routeStart ? [opts.routeStart] : []).concat(places.filter(p => p.location).map(p => p.location)) : null;
    drawRoute(h);
  },
  focus(h, pt, zoom) { h.map.easeTo({ center: [pt.lng, pt.lat], zoom: zoom || h.map.getZoom() }); },
  fitTo(h, points) {
    const pts = points.filter(Boolean);
    if (!pts.length) return;
    if (pts.length === 1) { h.map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 15 }); return; }
    const b = new window.maplibregl.LngLatBounds(); pts.forEach(p => b.extend([p.lng, p.lat]));
    h.map.fitBounds(b, { padding: 40, maxZoom: 16, duration: 0 });
  },
  resize(h) { try { h.map.resize(); } catch (e) {} },
  destroy(h) { try { h.map.remove(); } catch (e) {} }
};
