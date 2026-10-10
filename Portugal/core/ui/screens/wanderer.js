/* True Wanderer: live map with "You are here" and nearby curated spots. Location is asked for only here. */
import { S, P, save, curCityId, cityOf, cityName, placeById, addMount, addCleanup } from '../state.js';
import { esc, ic, ill, KIND_NAME, metres, $, toast } from '../dom.js';
import { masthead, statusLine, ticketButtons, searchButtons, pricePlaceholder } from '../components.js';
import { statusOf, isBooked, walkMinutes, km, priceText } from '../../models/schema.js';
import { mapService } from '../../services/map-service.js';
import { locationService } from '../../services/location-service.js';
import { placesService } from '../../services/places-service.js';
import { fareService } from '../../services/fare-service.js';
import { currencyService } from '../../services/currency-service.js';

const RADIUS = 3000;           // metres counted as "near you"
const W = { map: null, stop: null, pos: null, list: [], mode: 'locating', fallbackMap: false, centered: false };
export const wanderPos = () => W.pos;

const CATS = ['sight', 'food', 'shop', 'day_trip', 'audio_stop'];
/* Near the traveler: places-service decides what is nearby (Google Places later, same shapes). */
async function nearList(origin, cityId) {
  if (!cityId) return placesService.nearby(origin, RADIUS, { categories: CATS, limit: 30 });
  return (await placesService.inCity(cityId, CATS)).filter(p => p.location)
    .map(p => Object.assign({}, p, { distance_m: Math.round(km(origin, p.location) * 1000) }))
    .sort((a, b) => a.distance_m - b.distance_m);
}

function listHTML() {
  if (!W.list.length) return '<p class="small muted" style="padding-top:12px">No curated spots here yet.</p>';
  return W.list.slice(0, 12).map(p => `<button class="near" data-act="spot" data-id="${p.id}">${ill(p.kind, 44)}<span style="min-width:0"><b style="display:block;font-size:15px">${esc(p.name)}</b><span class="small muted">${esc(KIND_NAME[p.kind] || '')}${p.booking_status !== 'none' ? ' · ' + (p.booking_status === 'required' ? 'Must book' : 'Ticket') : ' · Free to visit'}${statusOf(S.trip, p.id) === 'went' ? ' · ✓ Went' : statusOf(S.trip, p.id) === 'want' ? ' · On your list' : ''}</span></span><span class="d">${metres(p.distance_m)}</span></button>`).join('');
}

function headline() {
  const c = cityOf(curCityId());
  if (W.mode === 'near') return `Spots within a short trip of you, nearest first.`;
  if (W.mode === 'far') return `You’re not near any Vamos Portugal spots yet, so here is ${c.name}. When you arrive, this follows you.`;
  if (W.mode === 'denied') return `Location is off, so here is ${c.name}. To see what’s near you, allow location for this app in your phone’s settings, then come back.`;
  if (W.mode === 'unavailable') return `We couldn’t find your location, so here is ${c.name}.`;
  return 'Finding where you are…';
}

async function refresh() {
  const c = cityOf(curCityId());
  const origin = (W.mode === 'near' && W.pos) ? W.pos : c.center;
  W.list = W.mode === 'near' ? await nearList(W.pos) : await nearList(origin, c.city_id);
  if (W.mode === 'near' && !W.list.length) { W.mode = 'far'; return refresh(); }
  const hl = $('#wHead'); if (hl) hl.textContent = headline();
  const pill = $('#wPill'); if (pill) pill.textContent = W.mode === 'near' ? 'You are here' : W.mode === 'locating' ? 'Locating you…' : cityName(c.city_id);
  const lb = $('#wList'); if (lb) lb.innerHTML = listHTML();
  if (W.map) {
    const markers = W.list.slice(0, 25).map(p => ({ id: p.id, name: p.name, location: p.location, went: statusOf(S.trip, p.id) === 'went' }));
    mapService.setMarkers(W.map, markers, { onTap: openSpot });
    mapService.setUserLocation(W.map, W.mode === 'near' ? W.pos : null);
    if (!W.centered) { W.centered = true; mapService.fitTo(W.map, (W.mode === 'near' ? [W.pos] : []).concat(markers.slice(0, 6).map(m => m.location))); }
  }
}

export function renderWanderer(seg) {
  W.mode = 'locating'; W.centered = false; W.fallbackMap = false;
  addMount(mount);
  return masthead() + `<div class="greet"><div class="eyebrow">Nearby · True Wanderer</div><h1>What’s near you.</h1><p class="lede" id="wHead">${esc(headline())}</p></div>${seg}
    <div class="wmap"><div class="wcanvas" id="wMap"></div><div class="wm-over"><span class="wm-pillnote" id="wPill">Locating you…</span></div><button class="wm-recenter" data-act="recenter" aria-label="Center on me">${ic('locate')}</button></div>
    <div class="block" style="padding-top:6px"><div class="head"><h2>Closest spots</h2><span class="label">Curated</span></div><div id="wList">${listHTML()}</div>
    <p class="small faint">These are Wanderings’ researched places, not every business around you. Your location stays on this phone and is never saved. Map data © OpenStreetMap contributors.</p></div>`;
}

async function mount() {
  const el = document.getElementById('wMap'); if (!el) return;
  const c = cityOf(curCityId());
  W.map = mapService.create(el, { center: c.center, zoom: 14, onFallback: () => { W.fallbackMap = true; const p = $('#wPill'); if (p) p.textContent = 'Offline map'; } });
  refresh();
  addCleanup(() => { if (W.stop) W.stop(); W.stop = null; mapService.destroy(W.map); W.map = null; });
  const first = await locationService.getOnce();
  if (!document.getElementById('wMap')) return;
  if (first.error) { W.mode = first.error === 'denied' ? 'denied' : 'unavailable'; refresh(); return; }
  W.pos = first; W.mode = 'near'; refresh();
  W.stop = await locationService.watch(p => { W.pos = p; if (W.mode !== 'near' && W.mode !== 'far') W.mode = 'near'; if (W.map) mapService.setUserLocation(W.map, W.mode === 'near' ? p : null); }, () => {});
}

export function recenter() {
  if (!W.map) return;
  if (W.pos && W.mode === 'near') mapService.focus(W.map, W.pos, 16);
  else { toast(W.mode === 'denied' ? 'Location is off for this app' : 'Showing ' + cityName(curCityId())); mapService.fitTo(W.map, W.list.slice(0, 6).map(p => p.location)); }
}

/* ---------- spot modal: everything about one place, in one sheet ---------- */
export async function openSpot(id) {
  const p = placeById(id); if (!p) return;
  const st = statusOf(S.trip, id), booked = isBooked(S.trip, id);
  const here = W.mode === 'near' ? W.pos : null;
  const walk = here && p.location ? walkMinutes(here, p.location) : null;
  const dist = here && p.location ? Math.round(km(here, p.location) * 1000) : null;
  const links = p.location ? mapService.openInMapsLink({ lat: p.location.lat, lng: p.location.lng, name: p.name }) : null;
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grab"></div>
    <div style="display:grid;grid-template-columns:56px minmax(0,1fr);gap:14px;align-items:center">${ill(p.kind, 56)}<div><div class="eyebrow" style="font-size:10px">${esc(KIND_NAME[p.kind] || '')} · ${esc(p.area || cityName(p.city_id))}</div><div style="font-size:21px;font-weight:700;letter-spacing:-.015em;line-height:1.2">${esc(p.name)}</div></div></div>
    <p class="small" style="font-size:14.5px">${esc(p.description)}</p>
    ${p.audio ? `<div class="spot-audio"><button class="hear" data-act="audio" data-id="${p.id}" aria-label="Play the audio stop">${ic('speak')}</button><div><b style="font-size:14px">Audio stop</b><div class="small muted">A short story about this place, read aloud.</div></div></div>` : ''}
    <div>${booked ? '<div class="went">✓ Tickets booked</div>' : statusLine(p)}${priceText(p.price) ? `<div class="price" style="margin-top:6px">${esc(priceText(p.price))}</div>` : pricePlaceholder(p)}</div>
    ${p.tips && p.tips.length ? `<ul class="tips">${p.tips.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${(p.ticket_url || p.search_q) ? `<div class="acts" style="margin-top:0">${p.ticket_url ? ticketButtons(p) : searchButtons(p.search_q)}</div>` : ''}
    <div class="kv" style="border-top:1px solid var(--rule);padding-top:12px">
      <span>Walking</span><span>${walk != null ? (walk > 120 ? 'Too far to walk' : `about ${walk} min · ${metres(dist)}`) : 'Turn on location'}</span>
      <span>Taxi from here</span><span id="spotFare">${here ? '…' : 'Turn on location'}</span></div>
    <p class="small faint" style="margin-top:-6px">Estimates. The taxi meter decides.</p>
    ${links ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="${esc(links.walk)}" target="_blank" rel="noopener">Get directions ↗</a><a class="btn line sm" href="${esc(links.apple)}" target="_blank" rel="noopener">Apple Maps ↗</a></div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--rule);padding-top:12px">
      ${st !== 'went' ? `<button class="btn line sm" data-act="want" data-id="${p.id}" aria-pressed="${st === 'want'}">${st === 'want' ? 'On your list' : 'Want to go'}</button><button class="btn sm" data-act="spotwent" data-id="${p.id}">Went here</button>` : '<span class="went" style="align-self:center">✓ Went here</span>'}
      <button class="btn line sm" data-act="sheetclose" style="margin-left:auto">Close</button></div>`;
  $('#scrim').hidden = false; sh.hidden = false;
  if (here && p.location) {
    const r = await fareService.estimate(here, p.location, p.city_id);
    const f = $('#spotFare'); if (f) f.textContent = r.err ? 'Not available' : `about ${currencyService.symbol(r.currency_code)}${r.lo}${r.hi !== r.lo ? '–' + r.hi : ''}`;
  }
}
export const refreshWanderer = refresh;
