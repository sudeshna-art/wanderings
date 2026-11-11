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
    traveler_language: 'en',
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
    bookings: [],    // [{ id, kind, title, date, time, end_date, end_time, from, to, where, ref, note, city_id, source }] (Oct 11 2026)
    emergency: { name: '', phone: '' },   // the traveler's own emergency contact, on this phone only
    meetup: null,    // { name, location, date, time, place_id } "Meet back here at…"
    party: { kids: '', kid_ages: '', easy_walk: '' },   // who's traveling (Oct 12 2026): kids 'yes'|'no'|'', easy_walk 'yes'|''
    food: { prefs: [], allergies: [], other: '' },       // food notes (Oct 12 2026), on this phone only
    occasions: [],   // [{ id, what, date }] special occasions (Oct 12 2026)
    drivers: [],     // [{ id, name, phone, whatsapp, area, note }] the traveler's own trusted drivers (Oct 12 2026)
    me_id: uid('p'), // this traveler's id in a group plan (Oct 12 2026)
    people: [],      // [{ id, name, arrive, leave, hood, address }] the others traveling together, each with their own dates
    group: null,     // { id, from, shared_at } set when the plan came from, or was shared with, the group
    prefs: { tab: 'today', city: '', pview: '', ptab: '', pfilter: 'all', cdir: 'local2home', camt: '20', pmode: 'timeline', pday: '', cover: null, coverMode: 'sketch', igSel: [], wSel: [], wShared: [], installTipDone: false }
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
  ['stays', 'legs', 'saved', 'booked', 'plan', 'journal', 'custom', 'favs', 'bookings'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.emergency = Object.assign({}, base.emergency, t.emergency || {});
  out.party = Object.assign({}, base.party, t.party || {});
  out.food = Object.assign({}, base.food, t.food || {});
  ['prefs', 'allergies'].forEach(k => { if (!Array.isArray(out.food[k])) out.food[k] = []; });
  ['occasions', 'drivers', 'people'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!out.me_id) out.me_id = uid('p');
  if (!TRAVEL_STYLES.includes(out.travel_style)) out.travel_style = 'flow';
  if (!out.traveler_language) out.traveler_language = 'en';
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
export function addToDay(trip, id, date, time = '', who) {
  const prev = trip.plan.find(p => p.item_id === id);
  if (who === undefined) who = prev && prev.who;   /* keep who's going when an item moves */
  trip.plan = trip.plan.filter(p => p.item_id !== id);
  const items = itemsOn(trip, date);
  let idx = items.length;
  if (time) { const j = items.findIndex(p => p.time && p.time > time); if (j >= 0) idx = j; }
  items.splice(idx, 0, Object.assign({ item_id: id, date, time, ord: 0 }, who && who.length ? { who } : {}));
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

/* ---------- bookings in one place (Oct 11 2026) ---------- */
export const BOOKING_KINDS = [
  ['flight', 'Flight'], ['stay', 'Hotel or stay'], ['train', 'Train'], ['bus', 'Coach or bus'],
  ['car', 'Driver, transfer or car'], ['tour', 'Tour or tickets'], ['restaurant', 'Restaurant'], ['other', 'Other']
];
export const bookingKindLabel = k => (BOOKING_KINDS.find(x => x[0] === k) || BOOKING_KINDS[BOOKING_KINDS.length - 1])[1];
export function newBooking(kind = 'other') {
  return { id: uid('b'), kind, title: '', date: '', time: '', end_date: '', end_time: '', from: '', to: '', where: '', ref: '', note: '', city_id: '', source: 'manual', contact: '', cancel_by: '' };
}
const bkey = b => (b.date || '9999') + ' ' + (b.time || '99:99');
export const sortedBookings = trip => (trip.bookings || []).slice().sort((a, b) => bkey(a).localeCompare(bkey(b)));
/* What happens on a day: each booking that starts that day, plus check-outs and arrivals that end that day. */
export function bookingsOn(trip, day) {
  const out = [];
  sortedBookings(trip).forEach(b => {
    if (b.date === day) out.push({ b, role: 'start', time: b.time });
    else if (b.end_date === day && b.kind === 'stay') out.push({ b, role: 'end', time: b.end_time });
  });
  return out.sort((x, y) => (x.time || '99').localeCompare(y.time || '99'));
}
export function upsertBooking(trip, b) {
  const i = trip.bookings.findIndex(x => x.id === b.id);
  if (i >= 0) trip.bookings[i] = b; else trip.bookings.push(b);
}
export function removeBooking(trip, id) { trip.bookings = trip.bookings.filter(x => x.id !== id); }

/* ---------- who's traveling, food notes, occasions, my drivers (Oct 12 2026) ---------- */
export const FOOD_PREFS = [['no_pork', 'No pork'], ['no_beef', 'No beef'], ['pescatarian', 'Pescatarian'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['simple', 'Simple, plain food']];
export const FOOD_ALLERGIES = [['seafood', 'Fish and shellfish'], ['shellfish', 'Shellfish only'], ['nuts', 'Nuts'], ['peanuts', 'Peanuts'], ['gluten', 'Gluten'], ['dairy', 'Dairy'], ['eggs', 'Eggs']];
export const OCCASIONS = [['birthday', 'Birthday'], ['anniversary', 'Anniversary'], ['nye', 'New Year’s Eve'], ['holiday', 'Holiday'], ['celebration', 'Celebration'], ['other', 'Other']];
export const occasionLabel = k => (OCCASIONS.find(x => x[0] === k) || OCCASIONS[OCCASIONS.length - 1])[1];
export const newOccasion = (what = 'birthday', date = '') => ({ id: uid('o'), what, date, note: '' });
export const newDriver = () => ({ id: uid('d'), name: '', phone: '', whatsapp: '', area: '', note: '' });
export const hasKids = trip => !!(trip.party && trip.party.kids === 'yes');
export const easyWalk = trip => !!(trip.party && trip.party.easy_walk === 'yes');
export const hasFoodNotes = trip => !!(trip.food && ((trip.food.prefs || []).length || (trip.food.allergies || []).length || (trip.food.other || '').trim()));
/* Ages typed as "8, 10" or "15". */
export const kidAges = trip => String((trip.party && trip.party.kid_ages) || '').split(/[^0-9]+/).filter(Boolean).map(Number).filter(n => n < 18);
/* Is a place a good fit for the group's kids? place.access.kids: true (any age) or a minimum age; place.access.teens: true. */
export function goodForKids(place, trip) {
  const a = (place && place.access) || {};
  if (!a.kids && !a.teens) return false;
  const ages = kidAges(trip);
  if (!ages.length) return true;
  const min = a.kids === true ? 0 : (+a.kids || 0);
  return ages.some(n => n >= 13 ? !!(a.teens || (a.kids && n >= min)) : !!a.kids && n >= min);
}
/* Words for warnings about walking (place.access.warn). */
export const WALK_WARN = { steep: 'Steep in places', ramps: 'Long ramps', stairs: 'Stairs', cobblestones: 'Cobblestones', long_walk: 'Long walks, few seats', uneven: 'Uneven ground', no_shade: 'Little shade', rough_water: 'Strong waves at times', no_lifeguard: 'No lifeguard' };
/* Food tags on places, matched to the traveler's food notes. Returns [{ text, tone: 'warn'|'ok' }]. */
export function foodFlags(place, trip) {
  const tags = (place && place.food && place.food.tags) || [], f = (trip && trip.food) || {}, pr = f.prefs || [], al = f.allergies || [];
  const out = [];
  const fishAllergy = al.includes('seafood') || al.includes('shellfish');
  if (fishAllergy && (tags.includes('seafood_forward') || tags.includes('seafood'))) out.push({ text: 'Lots of seafood here', tone: 'warn' });
  if (fishAllergy && tags.includes('shared_fryer')) out.push({ text: 'Shared fryers: ask first', tone: 'warn' });
  if (pr.includes('no_pork') && tags.includes('pork_heavy')) out.push({ text: 'Pork in many dishes: ask', tone: 'warn' });
  if (pr.includes('pescatarian') && !fishAllergy && (tags.includes('seafood_forward') || tags.includes('seafood'))) out.push({ text: 'Good for pescatarians', tone: 'ok' });
  if ((pr.includes('vegetarian') || pr.includes('vegan')) && tags.includes('veg')) out.push({ text: 'Vegetarian options', tone: 'ok' });
  if (pr.includes('simple') && tags.includes('simple')) out.push({ text: 'Plain options (chicken, fries)', tone: 'ok' });
  return out;
}

/* ---------- traveling together (Oct 12 2026) ---------- */
/* Everyone on the trip, this traveler first: [{ id, name, arrive, leave, hood, me }]. Her own dates come from her stays. */
export function everyone(trip) {
  const r = tripRange(trip), st = sortedStays(trip)[0];
  const me = { id: trip.me_id, name: trip.traveler_name || 'Me', arrive: r.start, leave: r.end, hood: st ? st.neighborhood_id : '', me: true };
  return [me].concat((trip.people || []).map(p => Object.assign({}, p, { name: p.name || 'Someone' })));
}
export const isGroup = trip => (trip.people || []).length > 0;
export const newPerson = () => ({ id: uid('p'), name: '', arrive: '', leave: '', hood: '', address: '' });
/* Who is on the island that day (arrival and departure days count). */
export const hereOn = (trip, iso) => everyone(trip).filter(p => p.arrive && iso >= p.arrive && iso <= (p.leave || p.arrive));
/* Days to plan: this traveler's days plus everyone else's, so the group plan covers the whole family's stay. */
export function planDays(trip) {
  const set = new Set(tripDays(trip));
  (trip.people || []).forEach(p => {
    if (!p.arrive) return;
    const d = dayDate(p.arrive), e = dayDate(p.leave || p.arrive);
    for (let i = 0; d <= e && i < 60; i++) { set.add(localISO(d)); d.setDate(d.getDate() + 1); }
  });
  return [...set].sort();
}
/* Plan items are for everyone unless "who" lists people. */
export const whoOf = item => (item && item.who && item.who.length) ? item.who : null;
export function whoText(trip, who) {
  if (!who) return 'Everyone';
  const names = everyone(trip).filter(p => who.includes(p.id)).map(p => p.me ? 'You' : p.name);
  return names.length ? names.join(', ') : 'Everyone';
}

/* ---------- opening days ---------- */
const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
export const weekdayOf = iso => new Date(iso + 'T00:00:00').getDay();
/* place.closed: weekday numbers (0 = Sunday). place.closed_dates: yearly dates as "MM-DD" (holidays, Oct 12 2026).
   True when the place is shut on that date. */
export const closedOn = (place, iso) => !!(place && iso && ((place.closed || []).includes(weekdayOf(iso)) || (place.closed_dates || []).includes(iso.slice(5))));
export const closedText = place => (place && place.closed_note) || ((place && (place.closed || []).length) ? 'Closed ' + place.closed.map(d => DAY_NAMES[d]).join(' and ') : '');

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

/* ---------- phrases in the traveler's language ---------- */
/* Accepts the current object format { t, say, m: {en, es, ...}, t_by } and the older [local, say, english] arrays. */
export function phraseFor(entry, lang = 'en') {
  if (Array.isArray(entry)) return { key: entry[0], t: entry[0], say: entry[1], m: entry[2] };
  const t = (entry.t_by && entry.t_by[lang]) || entry.t;
  return { key: entry.t, t, say: entry.say, m: (entry.m && (entry.m[lang] || entry.m.en)) || '' };
}
/* Same base language as the destination, e.g. a Portuguese speaker in Portugal. */
export const speaksLocal = (lang, destLang) => !!lang && !!destLang && lang.split('-')[0] === destLang.split('-')[0];
