/* Wanderings data shapes, defaults, upgrades and pure helpers.
   No DOM, no network, no storage in this file. */

export const SCHEMA_VERSION = 1;
export const TRAVEL_STYLES = ['flow', 'planner', 'wanderer'];
export const LEG_MODES = ['driver', 'taxi', 'car', 'train', 'bus', 'flight'];

const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function newStay(cityId = '') {
  return { city_id: cityId, start: '', end: '', label: '', neighborhood_id: '', address: '' };
}

export function newTrip(editionId) {
  return {
    schema_version: SCHEMA_VERSION,
    trip_id: uid('t'),
    edition_id: editionId,
    traveler_name: '',
    home_currency: '',
    stays: [],
    legs: [],
    arrival: { via: '', flight: '' },
    departure: { via: '', flight: '' },
    refs: '',
    travel_style: 'flow',
    onboarded: false,
    saved: [],       // [{ place_id, status: 'want' | 'went' }]
    booked: [],      // place ids marked as booked
    plan: [],        // [{ item_id, date, time, ord }]
    journal: [],     // [{ id, d, txt, place_id, place, city_id, stars, photos: [], visit }]
    custom: [],      // traveler's own places
    favs: [],        // favorite phrases
    prefs: { tab: 'today', city: '', pview: '', ptab: 'Restaurant', pfilter: 'all', cdir: 'local2home', camt: '20', pmode: 'timeline', pday: '', cover: null, coverMode: 'sketch', igSel: [], wSel: [], wShared: [], installTipDone: false }
  };
}

/* Upgrade older saved data safely. Unknown fields are kept. */
export function migrateTrip(t, editionId) {
  const base = newTrip(editionId);
  if (!t || typeof t !== 'object') return base;
  const out = Object.assign({}, base, t);
  out.prefs = Object.assign({}, base.prefs, t.prefs || {});
  out.arrival = Object.assign({}, base.arrival, t.arrival || {});
  out.departure = Object.assign({}, base.departure, t.departure || {});
  ['stays', 'legs', 'saved', 'booked', 'plan', 'journal', 'custom', 'favs'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!TRAVEL_STYLES.includes(out.travel_style)) out.travel_style = 'flow';
  out.schema_version = SCHEMA_VERSION;
  return out;
}

/* ---------- geography ---------- */
export function km(a, b) {
  if (!a || !b) return null;
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* walking minutes, rounded to 5, from straight-line distance with a street factor */
export function walkMinutes(a, b) {
  const d = km(a, b); if (d == null) return null;
  return Math.max(5, Math.round(d * 1.3 / 4.5 * 60 / 5) * 5);
}

/* ---------- dates ---------- */
export const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const dayDate = iso => new Date(iso + 'T00:00:00');

export function sortedStays(trip) {
  return trip.stays.filter(s => s.city_id).slice().sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
}
export function tripRange(trip) {
  const st = sortedStays(trip).filter(s => s.start);
  if (!st.length) return { start: '', end: '' };
  const start = st[0].start;
  const end = st.reduce((m, s) => { const e = s.end || s.start; return e > m ? e : m; }, start);
  return { start, end };
}
export function tripDays(trip) {
  const { start, end } = tripRange(trip);
  if (!start) return [];
  const out = []; const d = dayDate(start); const e = dayDate(end || start);
  for (let i = 0; d <= e && i < 60; i++) { out.push(localISO(d)); d.setDate(d.getDate() + 1); }
  return out;
}
/* The stay that covers a date. On a travel day (one stay ends, the next starts) the new stay wins. */
export function stayOn(trip, iso) {
  const st = sortedStays(trip);
  let hit = null;
  st.forEach(s => { if (s.start && iso >= s.start && iso <= (s.end || s.start)) hit = s; });
  return hit;
}
export function stage(trip, today = localISO()) {
  const { start, end } = tripRange(trip);
  if (!start) return { k: 'before', days: null };
  const total = Math.round((dayDate(end || start) - dayDate(start)) / 864e5) + 1;
  if (today < start) return { k: 'before', days: Math.round((dayDate(start) - dayDate(today)) / 864e5), total };
  if (today > (end || start)) return { k: 'after', total };
  return { k: 'during', day: Math.round((dayDate(today) - dayDate(start)) / 864e5) + 1, total };
}
/* Current city: the traveler's own choice from the switcher wins; otherwise today's stay;
   before the trip, the first stay; after it, the last. */
export function currentCityId(trip, cityIds, today = localISO()) {
  if (trip.prefs.city && cityIds.includes(trip.prefs.city)) return trip.prefs.city;
  const s = stayOn(trip, today);
  if (s) return s.city_id;
  const st = sortedStays(trip);
  if (st.length) return today > (tripRange(trip).end || '') && tripRange(trip).end ? st[st.length - 1].city_id : st[0].city_id;
  return cityIds[0];
}
export function stayForCity(trip, cityId, today = localISO()) {
  const s = stayOn(trip, today);
  if (s && s.city_id === cityId) return s;
  return sortedStays(trip).find(x => x.city_id === cityId) || null;
}
/* Legs follow the stays: one leg between each pair of consecutive stays in different cities. Keeps chosen modes. */
export function syncLegs(trip) {
  const st = sortedStays(trip); const legs = [];
  for (let i = 1; i < st.length; i++) {
    if (st[i].city_id === st[i - 1].city_id) continue;
    const old = trip.legs.find(l => l.from_city_id === st[i - 1].city_id && l.to_city_id === st[i].city_id);
    legs.push({ from_city_id: st[i - 1].city_id, to_city_id: st[i].city_id, date: st[i].start || '', mode: old ? old.mode : '' });
  }
  trip.legs = legs;
  return trip;
}

/* ---------- saved, booked, plan ---------- */
export const statusOf = (trip, id) => (trip.saved.find(s => s.place_id === id) || {}).status;
export function setStatus(trip, id, status) {
  trip.saved = trip.saved.filter(s => s.place_id !== id);
  if (status) trip.saved.push({ place_id: id, status });
}
export const isBooked = (trip, id) => trip.booked.includes(id);
export function setBooked(trip, id, on) {
  trip.booked = trip.booked.filter(x => x !== id);
  if (on) trip.booked.push(id);
}
export const planOf = (trip, id) => trip.plan.find(p => p.item_id === id) || null;
export function itemsOn(trip, day) {
  return trip.plan.filter(p => p.date === day).sort((a, b) => ((a.ord ?? 1e9) - (b.ord ?? 1e9)) || (a.time || '99').localeCompare(b.time || '99'));
}
export function addToDay(trip, id, date, time = '') {
  trip.plan = trip.plan.filter(p => p.item_id !== id);
  const items = itemsOn(trip, date);
  let idx = items.length;
  if (time) { const j = items.findIndex(p => p.time && p.time > time); if (j >= 0) idx = j; }
  items.splice(idx, 0, { item_id: id, date, time, ord: 0 });
  items.forEach((p, i) => { p.ord = i; });
  trip.plan = trip.plan.filter(p => p.date !== date).concat(items);
}
export function removeFromPlan(trip, id) { trip.plan = trip.plan.filter(p => p.item_id !== id); }
export function moveItem(trip, id, dir) {
  const p = planOf(trip, id); if (!p) return;
  const items = itemsOn(trip, p.date); const i = items.findIndex(x => x.item_id === id); const j = i + dir;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  items.forEach((x, n) => { x.ord = n; });
}

/* ---------- edition content helpers ---------- */
export const BOOKING_LABEL = { required: 'Must book', optional: 'Booking optional', none: 'No ticket needed' };
export const URGENCY_LABEL = { book_soon: 'Book soon', flexible: 'Flexible' };
export function isLive(fact) { return !!(fact && fact.checked && fact.source); }
/* Short form for narrow price columns: "€45", "from €25.50". */
export function priceShort(price) {
  if (!price || price.amount == null) return '';
  const sym = { EUR: '€', USD: '$', AED: 'AED ' }[price.currency_code] || (price.currency_code + ' ');
  return (price.from ? 'from ' : '') + sym + (Number.isInteger(price.amount) ? price.amount : price.amount.toFixed(2));
}
export function priceText(price) {
  if (!price) return '';
  if (price.text) return price.text;
  if (price.amount == null) return '';
  const sym = { EUR: '€', USD: '$', AED: 'AED ' }[price.currency_code] || (price.currency_code + ' ');
  return (price.from ? 'from ' : '') + sym + (Number.isInteger(price.amount) ? price.amount : price.amount.toFixed(2));
}
