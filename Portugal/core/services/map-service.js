/* map-service: the only way the UI touches maps (interface approved Oct 9 2026).
   Provider now: bundled Leaflet with OpenStreetMap-based tiles; the illustrated map when offline.
   Later: google-map.js with the same functions. The provider draws only into the one element the UI hands it. */
import { CONFIG } from '../config/default-config.js';
import { leafletMap } from './providers/leaflet-map.js';
import { illustratedMap } from './providers/illustrated-map.js';
import { linkService } from './link-service.js';

const live = { leaflet: leafletMap }[CONFIG.providers.map] || leafletMap;
const prov = h => (h && h.kind === 'live') ? live : illustratedMap;

export const mapService = {
  /* Returns a handle. Falls back to the illustrated map when offline, or if live tiles fail to load. */
  create(containerEl, { center, zoom, onFallback } = {}) {
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (online && live.ready()) {
      const holder = {};
      const h = live.create(containerEl, {
        center, zoom,
        onTilesFailed: () => {
          const last = holder.state || {};
          live.destroy(h);
          const ih = illustratedMap.create(containerEl, { center });
          Object.assign(h, ih);
          if (last.you) illustratedMap.setUserLocation(h, last.you);
          if (last.places) illustratedMap.setMarkers(h, last.places, last.opts || {});
          onFallback && onFallback();
        }
      });
      h._holder = holder; holder.state = {};
      return h;
    }
    const h = illustratedMap.create(containerEl, { center });
    onFallback && setTimeout(onFallback, 0);
    return h;
  },
  setUserLocation(h, pos) { if (h._holder) h._holder.state.you = pos; prov(h).setUserLocation(h, pos); },
  setMarkers(h, places, opts) { if (h._holder) Object.assign(h._holder.state, { places, opts }); prov(h).setMarkers(h, places, opts); },
  focus(h, pt, zoom) { prov(h).focus(h, pt, zoom); },
  fitTo(h, points) { prov(h).fitTo(h, points); },
  resize(h) { prov(h).resize(h); },
  destroy(h) { if (h) prov(h).destroy(h); },
  isLive(h) { return !!h && h.kind === 'live'; },
  openInMapsLink(pt) { return { apple: linkService.appleMaps(pt), google: linkService.googleMaps(pt), walk: linkService.directions(pt, 'walking') }; }
};
