/* Near me (True Wanderer): live map with "You are here" and nearby curated spots. Location is asked for only here.
   Oct 11 2026: open to every travel style as "Near me", with "Meet back here" for friends who split up. */
import { EDITION } from '../../../edition.config.js?v=202610120955';
import { S, P, save, curCityId, cityOf, cityName, placeById, addMount, addCleanup, isWanderer, homePoint, stayHere } from '../state.js?v=202610120955';
import { clean } from '../theme.js?v=202610120955';
import { statusBadge, cardPrice, chev } from '../components.js?v=202610120955';
import { closedText } from '../../models/schema.js?v=202610120955';
import { esc, ic, ill, KIND_NAME, metres, $, toast } from '../dom.js?v=202610120955';
import { masthead, illustrationFor, statusLine, ticketButtons, searchButtons, pricePlaceholder, closedLine, tipsOf } from '../components.js?v=202610120955';
import { statusOf, isBooked, walkMinutes, km, priceText, priceShort } from '../../models/schema.js?v=202610120955';
import { mapService } from '../../services/map-service.js?v=202610120955';
import { locationService } from '../../services/location-service.js?v=202610120955';
import { placesService } from '../../services/places-service.js?v=202610120955';
import { fareService } from '../../services/fare-service.js?v=202610120955';
import { currencyService } from '../../services/currency-service.js?v=202610120955';
import { showStatus } from './offline.js?v=202610120955';

const RADIUS = 3000;           // metres counted as "near you"
const W = { map: null, stop: null, pos: null, list: [], mode: 'locating', fallbackMap: false, centered: false };
export const wanderPos = () => (W.mode === 'near' ? W.pos : null);

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
  if (W.mode === 'far') return `You’re not near any ${esc(EDITION.name)} spots yet, so here is ${c.name}. When you arrive, this follows you.`;
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
  const mh = $('#meetHere'); if (mh) mh.hidden = W.mode !== 'near';
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
  return masthead() + `<div class="greet"><h1>What’s near you.</h1><p class="lede" id="wHead">${esc(headline())}</p></div>${seg}
    <div class="wmap"><div class="wcanvas" id="wMap"></div><div class="wm-over"><span class="wm-pillnote" id="wPill">Locating you…</span></div><button class="wm-recenter" data-act="recenter" aria-label="Center on me">${ic('locate')}</button></div>
    <div data-mapstatus id="wMapStatus" style="padding-top:8px"></div>
    <div id="meetHere" hidden style="padding-top:6px"><button class="btn line sm" data-act="meetform" data-box="meetHereBox">${ic('pin', 'style="width:16px;height:16px"')}Splitting up? Meet back here</button><div id="meetHereBox" hidden></div></div>
    <div class="block" style="padding-top:6px"><div class="head"><h2>Closest spots</h2><span class="label">Curated</span></div><div id="wList">${listHTML()}</div>
    <p class="small faint">These are Wanderings’ researched places, not every business around you. Your location stays on this phone and is never saved. </p></div>`;
}

async function mount() {
  const el = document.getElementById('wMap'); if (!el) return;
  const c = cityOf(curCityId());
  W.map = mapService.create(el, { center: c.center, zoom: 14, illustration: illustrationFor(c),
    onFallback: () => { W.fallbackMap = true; const p = $('#wPill'); if (p) p.textContent = 'Sketch map'; },
    onMode: m => showStatus($('#wMapStatus'), m) });
  refresh();
  addCleanup(() => { if (W.stop) W.stop(); W.stop = null; mapService.destroy(W.map); W.map = null; });
  const first = await locationService.getOnce();
  if (!document.getElementById('wMap')) return;
  if (first.error) { W.mode = first.error === 'denied' ? 'denied' : 'unavailable'; refresh(); return; }
  W.pos = first; W.mode = 'near'; mapService.setArea(W.map, first); refresh();
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
  if (clean()) return openSpotClean(p);
  const st = statusOf(S.trip, id), booked = isBooked(S.trip, id);
  const here = W.mode === 'near' ? W.pos : null;
  const walk = here && p.location ? walkMinutes(here, p.location) : null;
  const dist = here && p.location ? Math.round(km(here, p.location) * 1000) : null;
  const links = p.location ? mapService.openInMapsLink({ lat: p.location.lat, lng: p.location.lng, name: p.name }) : null;
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grab"></div>
    <div style="display:grid;grid-template-columns:56px minmax(0,1fr);gap:14px;align-items:center">${ill(p.kind, 56)}<div><div class="eyebrow" style="font-size:10px">${esc(KIND_NAME[p.kind] || '')} · ${esc(p.area || cityName(p.city_id))}</div><div style="font-size:21px;font-weight:700;letter-spacing:-.015em;line-height:1.2">${esc(p.name)}</div>${closedLine(p)}</div></div>
    <p class="small" style="font-size:14.5px">${esc(p.description)}</p>
    ${p.audio ? `<div class="spot-audio"><button class="hear" data-act="audio" data-id="${p.id}" aria-label="Play the audio stop">${ic('speak')}</button><div><b style="font-size:14px">Audio stop</b><div class="small muted">A short story about this place, read aloud.</div></div></div>` : ''}
    <div>${booked ? '<div class="went">✓ Tickets booked</div>' : statusLine(p)}${priceText(p.price) ? `<div class="price" style="margin-top:6px">${esc(priceText(p.price))}</div>` : pricePlaceholder(p)}</div>
    ${tipsOf(p).length ? `<ul class="tips">${tipsOf(p).slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${(p.ticket_url || p.search_q) ? `<div class="acts" style="margin-top:0">${p.ticket_url ? ticketButtons(p) : searchButtons(p.search_q)}</div>` : ''}
    <div class="kv" style="border-top:1px solid var(--rule);padding-top:12px">
      <span>Walking</span><span>${walk != null ? (walk > 120 ? 'Too far to walk' : `about ${walk} min · ${metres(dist)}`) : 'Turn on location'}</span>
      <span>Taxi from here</span><span id="spotFare">${here ? '…' : 'Turn on location'}</span></div>
    <p class="small faint" style="margin-top:-6px">Estimates. The taxi meter decides.</p>
    ${links ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="${esc(links.walk)}" target="_blank" rel="noopener">Get directions ↗</a><a class="btn line sm" href="${esc(links.apple)}" target="_blank" rel="noopener">Apple Maps ↗</a></div>` : ''}
    ${p.location ? `<div><button class="text-btn" data-act="meetform" data-box="spotMeet" data-id="${p.id}" style="min-height:36px">${ic('pin', 'style="width:16px;height:16px"')}Meet back here</button><div id="spotMeet" hidden></div></div>` : ''}
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

/* ---------- clean theme detail sheet (Oct 12 2026): Airbnb-style grouped sections and a sticky main action.
   Walking and taxi estimates appear only from a known start: live GPS, else the traveler's saved stay. ---------- */
const HOURS = /\b(open|opens|closes|closed|closing|last entry)\b/i;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
async function openSpotClean(p) {
  const id = p.id, st = statusOf(S.trip, id), booked = isBooked(S.trip, id);
  const gps = W.mode === 'near' ? W.pos : null, home = !gps ? homePoint(p.city_id) : null;
  const origin = gps || home;
  const fromLabel = gps ? 'From where you are' : home ? `From your stay${home.hood ? ' in ' + home.hood.name.replace(/\s*\(.*\)$/, '') : ''}` : '';
  const walk = origin && p.location ? walkMinutes(origin, p.location) : null;
  const links = p.location ? mapService.openInMapsLink({ lat: p.location.lat, lng: p.location.lng, name: p.name }) : null;
  const tips = tipsOf(p), hours = tips.filter(t => HOURS.test(t)), know = tips.filter(t => !HOURS.test(t));
  const cl = closedText(p), price = priceText(p.price);
  const priceNote = p.price && p.price.checked && p.price.source ? `${p.price.source}, checked ${new Date(p.price.checked + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
  const ticketed = p.ticket_url && p.booking_status !== 'none';
  let main;
  if (ticketed && !booked) main = `<a class="btn" href="${esc(p.ticket_url)}" target="_blank" rel="noopener">Book on ${esc(hostOf(p.ticket_url) || 'the official site')} ↗</a>`;
  else if (links) main = `<a class="btn" href="${esc(links.walk)}" target="_blank" rel="noopener">Directions ↗</a>`;
  else if (p.search_q) main = `<a class="btn" href="${esc(('https://www.getyourguide.com/s/?q=' + encodeURIComponent(p.search_q)))}" target="_blank" rel="noopener">Find a tour ↗</a>`;
  else main = `<button class="btn" data-act="want" data-id="${id}">${st === 'want' ? '✓ On your list' : 'Want to go'}</button>`;
  const row = (icon, title, sub, extra = '') => `<div class="sh-row">${ic(icon)}<span style="display:flex;flex-direction:column;min-width:0"><span>${title}</span>${sub ? `<span class="small muted">${sub}</span>` : ''}</span>${extra}</div>`;
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grab" role="button" aria-label="Drag to expand or close"></div>
    <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:18px">
      <div class="eyebrow">${esc(KIND_NAME[p.kind] || '')}${p.area ? ' · ' + esc(p.area) : ''}</div>
      <div class="sh-title">${esc(p.name)}</div>
      <div class="pmeta">${cardPrice(p) ? `<span>${cardPrice(p)}</span>` : ''}${statusBadge(p, booked)}${cl ? `<span class="closed-day" style="margin:0">${esc(cl)}</span>` : ''}</div>
      ${(p.price && p.price.text && p.price.amount != null) || priceNote ? `<p class="small muted">${p.price.text && p.price.amount != null ? esc(p.price.text) + (priceNote ? '. ' : '') : ''}${priceNote ? 'Source: ' + esc(priceNote) : ''}</p>` : ''}
    </div>
    <div class="seg-pill" role="group" aria-label="Your list" style="margin-top:0;margin-bottom:6px">
      <button data-act="want" data-id="${id}" aria-pressed="${st === 'want'}">${st === 'want' ? '✓ Want to go' : 'Want to go'}</button>
      <button data-act="${st === 'went' ? 'spotunwent' : 'spotwent'}" data-id="${id}" aria-pressed="${st === 'went'}">${st === 'went' ? '✓ Went here' : 'Went here'}</button></div>
    <div class="sh-sec" style="border-top:0">
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      ${p.audio ? `<div class="spot-audio"><button class="hear" data-act="audio" data-id="${id}" aria-label="Play the audio story">${ic('speak')}</button><div><b>Audio story</b><div class="small muted">A short story about this place, read aloud.</div></div></div>` : ''}
    </div>
    ${p.location ? `<div class="sh-sec"><div class="sh-cap">Getting there</div>
      ${origin ? row('walk', walk > 120 ? 'Too far to walk' : `About ${walk} min walk`, esc(fromLabel)) + row('taxi', `<span id="spotFare">Taxi …</span>`, 'Estimate from the city tariff. The meter decides.')
        : `<p class="small muted">Add where you’re staying, or open Near me with location on, to see walking times and taxi estimates.</p>`}
      ${links ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><a class="btn line sm" href="${esc(links.apple)}" target="_blank" rel="noopener">Apple Maps</a><a class="btn line sm" href="${esc(links.google || links.walk)}" target="_blank" rel="noopener">Google Maps</a></div>` : ''}</div>` : ''}
    ${cl || hours.length ? `<div class="sh-sec"><div class="sh-cap">Open and closed</div>${hours.map(t => `<p class="small">${esc(t)}</p>`).join('')}${cl && !hours.some(t => t.toLowerCase().includes(cl.toLowerCase())) ? `<p class="small" style="color:var(--coral-ink)">${esc(cl)}.</p>` : ''}${p.closed_source ? `<p class="small muted">${esc(p.closed_source.text)}, checked ${esc(new Date(p.closed_source.checked + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</p>` : ''}</div>` : ''}
    ${know.length || p.lead_time || p.how || p.duration ? `<div class="sh-sec"><div class="sh-cap">Good to know</div>
      ${p.how ? `<div class="tipbox"><b>Getting there:</b> ${esc(p.how)}${p.stay ? '. Plan for ' + esc(p.stay.toLowerCase()) + '.' : ''}</div>` : ''}${p.duration ? `<div class="tipbox"><b>How long:</b> ${esc(p.duration)}</div>` : ''}
      ${p.lead_time ? `<div class="tipbox">${esc(p.lead_time)}</div>` : ''}${know.slice(0, 4).map(t => `<div class="tipbox">${esc(t)}</div>`).join('')}
      ${p.search_q ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${searchButtons(p.search_q)}</div>` : ''}</div>` : ''}
    <div class="sh-sec" style="gap:0">
      <button class="sh-row" data-act="addsheet" data-id="${id}">${ic('plan')}<span>Add to a day</span>${chev()}</button>
      ${p.booking_status !== 'none' ? `<button class="sh-row" data-act="spotbooked" data-id="${id}">${ic('ticket')}<span>${booked ? 'Booked ✓ (tap to undo)' : 'I booked this'}</span>${chev()}</button>` : ''}
      ${p.location ? `<button class="sh-row" data-act="meetform" data-box="spotMeet" data-id="${id}">${ic('pin')}<span>Meet back here</span>${chev()}</button><div id="spotMeet" hidden></div>` : ''}
    </div>
    <div class="sheet-foot">${main}</div>`;
  $('#scrim').hidden = false; sh.hidden = false;
  if (origin && p.location) {
    const r = await fareService.estimate(origin, p.location, p.city_id);
    const f = $('#spotFare'); if (f) f.textContent = r.err ? 'Taxi estimate not available' : `Taxi about ${currencyService.symbol(r.currency_code)}${r.lo}${r.hi !== r.lo ? ' to ' + currencyService.symbol(r.currency_code) + r.hi : ''}`;
  }
}
