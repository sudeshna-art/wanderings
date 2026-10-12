/* map-service: the only way the UI touches maps (interface approved Oct 9 2026; offline packs added Oct 10 2026).
   Order of preference:
     1. Vector map from the area's map pack saved on this phone (works with no signal).
     2. The same pack read from the edition's site, while online.
     3. Leaflet with OpenStreetMap tiles, while online, if the phone cannot draw vector maps.
     4. The illustrated map, offline with no saved pack.
   The provider draws only into the one element the UI hands it. Calls made before the map is ready are replayed. */
import { leafletMap } from './providers/leaflet-map.js?v=202610120955';
import { illustratedMap } from './providers/illustrated-map.js?v=202610120955';
import { maplibreMap, webglOK } from './providers/maplibre-map.js?v=202610120955';
import { mapPackService } from './mappack-service.js?v=202610120955';
import { linkService } from './link-service.js?v=202610120955';

const PROV = { vector: maplibreMap, live: leafletMap, illustrated: illustratedMap };
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

function replay(h) {
  const p = PROV[h.kind], st = h.state;
  if (st.places) p.setMarkers(h.impl, st.places, st.opts || {});
  if (st.you !== undefined) p.setUserLocation(h.impl, st.you);
  if (st.fit) p.fitTo(h.impl, st.fit); else if (st.focus) p.focus(h.impl, st.focus.pt, st.focus.zoom);
}
function use(h, kind, impl, info) {
  if (h.destroyed) { PROV[kind].destroy(impl); return; }
  h.kind = kind; h.impl = impl; replay(h);
  h.onMode && h.onMode(Object.assign({ mode: kind }, info || {}));
}
function fallback(h) {
  if (h.destroyed) return;
  if (h.impl) { try { PROV[h.kind].destroy(h.impl); } catch (e) {} h.el.innerHTML = ''; }
  if (online() && leafletMap.ready()) {
    const impl = leafletMap.create(h.el, { center: h.center, zoom: h.zoom, onTilesFailed: () => { leafletMap.destroy(impl); h.el.innerHTML = ''; use(h, 'illustrated', illustratedMap.create(h.el, { center: h.center }), { offline: true }); } });
    use(h, 'live', impl, { pack: h.pack, downloaded: false });
  } else {
    use(h, 'illustrated', illustratedMap.create(h.el, { center: h.center }), { offline: true, pack: h.pack, downloaded: false });
  }
}
async function init(h) {
  const pack = h.pack = await mapPackService.packFor(h.center);
  const file = pack ? await mapPackService.file(pack.id) : null;
  if (pack && (file || online()) && webglOK()) {
    try {
      const impl = await maplibreMap.create(h.el, {
        center: h.center, zoom: h.zoom,
        source: file ? { file } : { url: mapPackService.remoteUrl(pack) },
        onFail: () => { if (!file) fallback(h); },
        onMoveEnd: c => switchPack(h, c)
      });
      use(h, 'vector', impl, { pack, downloaded: !!file });
      return;
    } catch (e) { /* fall through */ }
  }
  fallback(h);
}
/* Panning into another area: switch to that area's pack if it can be read. */
async function switchPack(h, c) {
  if (h.kind !== 'vector' || h.switching) return;
  const pack = await mapPackService.packFor(c);
  if (!pack || (h.pack && pack.id === h.pack.id)) return;
  const file = await mapPackService.file(pack.id);
  if (!file && !online()) return;
  h.switching = true; h.pack = pack;
  maplibreMap.swapSource(h.impl, file ? { file } : { url: mapPackService.remoteUrl(pack) });
  h.switching = false;
  h.onMode && h.onMode({ mode: 'vector', pack, downloaded: !!file });
}

export const mapService = {
  /* onMode({ mode: 'vector'|'live'|'illustrated', pack, downloaded, offline }) tells the UI which map is showing. */
  create(containerEl, { center, zoom = 14, onFallback, onMode } = {}) {
    const h = { el: containerEl, center, zoom, kind: null, impl: null, state: {}, onMode: m => { onMode && onMode(m); if (m.mode === 'illustrated' && onFallback) onFallback(); } };
    init(h);
    return h;
  },
  /* The traveler is somewhere else than the map's area (first GPS fix): move to that area's pack. */
  async setArea(h, point) {
    if (!h || h.destroyed || !point) return;
    const pack = await mapPackService.packFor(point);
    if (!pack || (h.pack && pack.id === h.pack.id)) return;
    if (h.kind === 'vector') return switchPack(h, point);
    if (h.impl) { try { PROV[h.kind].destroy(h.impl); } catch (e) {} h.impl = null; h.el.innerHTML = ''; }
    h.center = point; init(h);
  },
  setUserLocation(h, pos) { h.state.you = pos || null; if (h.impl) PROV[h.kind].setUserLocation(h.impl, pos); },
  setMarkers(h, places, opts) { h.state.places = places; h.state.opts = opts; if (h.impl) PROV[h.kind].setMarkers(h.impl, places, opts); },
  focus(h, pt, zoom) { h.state.focus = { pt, zoom }; h.state.fit = null; if (h.impl) PROV[h.kind].focus(h.impl, pt, zoom); },
  fitTo(h, points) { h.state.fit = points; if (h.impl) PROV[h.kind].fitTo(h.impl, points); },
  resize(h) { if (h && h.impl) PROV[h.kind].resize(h.impl); },
  destroy(h) { if (!h) return; h.destroyed = true; if (h.impl) PROV[h.kind].destroy(h.impl); },
  isLive(h) { return !!h && (h.kind === 'vector' || h.kind === 'live'); },
  openInMapsLink(pt) { return { apple: linkService.appleMaps(pt), google: linkService.googleMaps(pt), walk: linkService.directions(pt, 'walking') }; }
};
