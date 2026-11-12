/* geocode-service: find a hotel or address the traveler types (approved Nov 11 2026).
   Local provider: OpenStreetMap's free Nominatim search, only when the traveler taps Find and only while online.
   Only the typed text and the destination's area are sent; nothing about the traveler.
   Nominatim's usage policy: light use, no autocomplete, at most one request a second, credit OpenStreetMap.
   Later provider: Google (paid, needs approval and a terms check against our own maps). */

const URL_BASE = 'https://nominatim.openstreetmap.org/search';
let last = 0;

export const geocodeService = {
  credit: 'Search by OpenStreetMap',
  /* q: what the traveler typed. box: [west, south, east, north] to keep results inside the destination.
     Resolves { results: [{ name, address, lat, lng }] } or { error: 'offline' | 'failed' }. */
  async search(q, box) {
    q = (q || '').trim();
    if (!q) return { results: [] };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { error: 'offline' };
    const wait = 1100 - (Date.now() - last);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const p = new URLSearchParams({ format: 'jsonv2', q, limit: '6', addressdetails: '1', 'accept-language': 'en' });
    if (box) { p.set('viewbox', [box[0], box[3], box[2], box[1]].join(',')); p.set('bounded', '1'); }
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
      const r = await fetch(URL_BASE + '?' + p.toString(), ctl ? { signal: ctl.signal } : {});
      if (timer) clearTimeout(timer);
      if (!r.ok) return { error: 'failed' };
      const rows = await r.json();
      return {
        results: rows.map(x => {
          const a = x.address || {};
          const street = [a.house_number, a.road].filter(Boolean).join(' ');
          const area = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.town || a.village || a.city || '';
          return { name: x.name || street || (x.display_name || '').split(',')[0], address: [street, area].filter(Boolean).join(', ') || (x.display_name || ''), lat: +x.lat, lng: +x.lon };
        }).filter(x => isFinite(x.lat) && isFinite(x.lng))
      };
    } catch (e) {
      return { error: (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : 'failed' };
    }
  }
};
