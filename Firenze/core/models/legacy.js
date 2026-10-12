/* Upgrade data saved by the first Wanderings app (the single-file Andiamo Firenze beta, "v0") into today's trip shape.
   Pure function: no storage, no DOM. trip-service calls it once, only when this edition has no saved trip yet
   and the edition config names a legacy key. Nothing is deleted from the old app, so it keeps working. */
import { newTrip, newStay, SCHEMA_VERSION } from './schema.js?v=202610120955';

const KIND = { restaurant: 'food', cafe: 'cafe', landmark: 'landmark', market: 'market', museum: 'museum', shop: 'shop', garden: 'garden', view: 'view' };

export function fromV0(old, cfg) {
  const t = newTrip(cfg.editionId);
  if (!old || typeof old !== 'object') return t;
  const L = cfg.legacy || {};
  const customIds = new Set((old.custom || []).map(c => c.id));
  const pid = x => !x ? '' : customIds.has(x) ? x : (L.idPrefix || '') + ((L.idMap || {})[x] || x);
  const city = L.cityId || '';

  t.traveler_name = old.name || '';
  t.home_currency = L.homeCurrency || '';
  t.travel_style = ['flow', 'planner'].includes(old.style) ? old.style : 'flow';
  t.onboarded = !!old.onboarded;
  const tr = old.trip || {}, dates = old.dates || {};
  t.arrival = { via: tr.inVia || '', flight: tr.inFlight || '' };
  t.departure = { via: tr.outVia || '', flight: tr.outFlight || '' };
  t.refs = tr.refs || '';
  t.stays = (Array.isArray(old.stays) && old.stays.length ? old.stays : [{}]).map((s, i) => Object.assign(newStay(city), {
    start: i === 0 ? dates.start || '' : '', end: i === 0 ? dates.end || '' : '',
    label: s.label || '', neighborhood_id: s.hood || '', address: s.address || ''
  }));

  t.saved = Object.entries(old.status || {}).filter(([, v]) => v === 'want' || v === 'went').map(([k, v]) => ({ place_id: pid(k), status: v }));
  const booked = new Set();
  Object.entries(old.booked || {}).forEach(([k, on]) => { if (!on) return; booked.add(pid(k)); ((L.bookAlso || {})[k] || []).forEach(x => booked.add(pid(x))); });
  t.booked = [...booked];
  t.plan = Object.entries(old.sched || {}).filter(([, v]) => v && v.date).map(([k, v]) => ({ item_id: pid(k), date: v.date, time: v.time || '', ord: v.ord ?? 0 }));
  t.custom = (old.custom || []).map(c => ({ id: c.id, city_id: city, custom: true, name: c.name || 'My place', category: 'sight', kind: KIND[c.cat] || 'landmark', group: 'custom', area: c.area || '', location: null, booking_status: 'none', urgency_level: 'flexible', ticket_url: null, affiliate_url: null, price: null, description: c.desc || '', tips: [], audio: null }));
  t.journal = (old.entries || []).map(e => ({ id: e.id || Date.now().toString(36), d: e.d || Date.now(), txt: e.txt || '', place_id: e.placeId ? pid(e.placeId) : '', place: e.place || '', city_id: city, stars: e.stars || 0, photos: (e.photos || []).slice(), visit: !!e.visit }));
  t.favs = (old.favs || []).slice();

  Object.assign(t.prefs, {
    cover: old.cover || null, coverMode: old.coverMode || (old.cover ? 'photo' : 'sketch'),
    igSel: old.igSel || [], wSel: old.wSel || [], wShared: old.wShared || [],
    installTipDone: !!old.installTipDone, camt: old.camt || '20',
    cdir: old.cdir === 'usd2eur' ? 'home2local' : 'local2home'
  });
  t.imported_from = 'v0';
  t.schema_version = SCHEMA_VERSION;
  return t;
}
