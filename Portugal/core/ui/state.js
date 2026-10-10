/* Shared UI state: the loaded trip and edition content, plus lookups. Talks to the outside only through services. */
import { tripService } from '../services/trip-service.js';
import { currentCityId, stayForCity, sortedStays, localISO } from '../models/schema.js';

export const S = { trip: null, C: null, mounts: [], cleanups: [] };

export const save = () => tripService.save(S.trip);
export const P = () => S.trip.prefs;

export const cityIds = () => S.C.edition.city_ids;
export const cityOf = id => S.C.cities.find(c => c.city_id === id) || S.C.cities[0];
export const cityName = id => { const c = cityOf(id); return c.short_name || c.name; };
/* "Lisbon awaits" / "The Algarve awaits" */
export const cityTitle = id => { const n = cityOf(id).name; return n.charAt(0).toUpperCase() + n.slice(1); };
export const curCityId = () => currentCityId(S.trip, cityIds());
export const curCity = () => cityOf(curCityId());
export const autoCityId = () => currentCityId(Object.assign({}, S.trip, { prefs: Object.assign({}, S.trip.prefs, { city: '' }) }), cityIds());

export const allPlaces = () => S.C.places.concat(S.trip.custom);
export const placeById = id => allPlaces().find(p => p.id === id) || null;
export const placesIn = (cityId, cats) => allPlaces().filter(p => p.city_id === cityId && (!cats || cats.includes(p.category)));
export function itemInfo(id) {
  const p = placeById(id);
  return p ? { name: p.name, kind: p.kind || 'landmark', city_id: p.city_id, location: p.location, place: p } : { name: 'Plan item', kind: 'landmark', city_id: '', location: null };
}

export const hoodOf = (cityId, hoodId) => (cityOf(cityId).neighborhoods || []).find(n => n.id === hoodId) || null;
export const stayHere = (cityId = curCityId()) => stayForCity(S.trip, cityId);
export function homePoint(cityId = curCityId()) {
  const s = stayHere(cityId); const h = s && hoodOf(cityId, s.neighborhood_id);
  return h && h.center ? { lat: h.center.lat, lng: h.center.lng, name: s.label || 'Where I’m staying', hood: h } : null;
}
export const isPlanner = () => S.trip.travel_style === 'planner';
export const isWanderer = () => S.trip.travel_style === 'wanderer';
export const hasStays = () => sortedStays(S.trip).length > 0;

/* Named points for taxi estimates and the driver card: home, airports, stations, places. */
export function spot(id, cityId = curCityId()) {
  const c = cityOf(cityId);
  if (id === '__home') { const h = homePoint(cityId); const s = stayHere(cityId); return h ? { location: h, name: h.name, local: (s && s.address) || h.hood.name } : null; }
  if (id.startsWith('__air:')) { const a = (c.airports || []).find(x => x.id === id.slice(6)); return a ? { location: a.location, name: a.short, local: a.local } : null; }
  if (id.startsWith('__st:')) { const st = (c.stations || []).find(x => x.id === id.slice(5)); return st ? { location: st.location, name: st.name, local: st.local } : null; }
  const p = placeById(id); return p && p.location ? { location: p.location, name: p.name, local: p.name } : null;
}
export function spotOptions(cityId = curCityId()) {
  const c = cityOf(cityId); const o = [];
  if (homePoint(cityId)) o.push(['__home', (stayHere(cityId).label || 'Where I’m staying') + ' (home base)']);
  (c.airports || []).forEach(a => o.push(['__air:' + a.id, a.short]));
  (c.stations || []).forEach(s => o.push(['__st:' + s.id, s.name]));
  placesIn(cityId).filter(p => p.location && p.category !== 'experience').forEach(p => o.push([p.id, p.name]));
  return o;
}

export const today = () => localISO();
export function addMount(fn) { S.mounts.push(fn); }
export function addCleanup(fn) { S.cleanups.push(fn); }
export function runCleanups() { const c = S.cleanups.splice(0); c.forEach(f => { try { f(); } catch (e) {} }); }
export function runMounts() { const m = S.mounts.splice(0); m.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
