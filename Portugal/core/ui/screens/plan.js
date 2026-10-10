/* Planner mode: day strip across the whole trip, timeline or live map per day, add-to-a-day sheet. */
import { S, P, save, cityName, cityOf, placesIn, itemInfo, homePoint, stayHere, today, addMount, addCleanup, placeById, isPlanner } from '../state.js';
import { esc, ic, ill, fmtDay, shortDay, plural, modeIcon, toast, $, $$, KIND_NAME } from '../dom.js';
import { masthead } from '../components.js';
import { tripDays, itemsOn, stayOn, planOf, addToDay, statusOf, isBooked, walkMinutes, km } from '../../models/schema.js';
import { mapService } from '../../services/map-service.js';
import { fareService } from '../../services/fare-service.js';
import { currencyService } from '../../services/currency-service.js';

const dayCity = d => { const s = stayOn(S.trip, d); return s ? s.city_id : ''; };

function legHTML(prevLoc, loc, cityId) {
  if (!prevLoc || !loc) return `<div class="leg"><span>Getting there varies</span></div>`;
  const mins = walkMinutes(prevLoc, loc);
  if (mins > 120) return `<div class="leg"><span>Longer trip · taxi, driver or car</span><span class="alt" data-fare="${prevLoc.lat},${prevLoc.lng}|${loc.lat},${loc.lng}|${cityId}"></span></div>`;
  return `<div class="leg"><span>${mins >= 25 ? 'Longer walk' : 'Walk'} · about ${mins} min</span>${mins >= 25 ? `<span class="alt" data-fare="${prevLoc.lat},${prevLoc.lng}|${loc.lat},${loc.lng}|${cityId}"></span>` : ''}</div>`;
}
/* Fill taxi estimates after render (fare-service is async). */
export function fillFares(root = document) {
  root.querySelectorAll('[data-fare]').forEach(async el => {
    const [a, b, city] = el.dataset.fare.split('|');
    const [alat, alng] = a.split(',').map(Number), [blat, blng] = b.split(',').map(Number);
    const r = await fareService.estimate({ lat: alat, lng: alng }, { lat: blat, lng: blng }, city);
    if (!r.err) el.textContent = `or taxi ≈ ${currencyService.symbol(r.currency_code)}${r.lo}${r.hi !== r.lo ? '–' + r.hi : ''} (estimate)`;
  });
}

function stopStatus(id) {
  const p = placeById(id);
  if (statusOf(S.trip, id) === 'went') return '<div class="went">✓ Went here</div>';
  if (isBooked(S.trip, id)) return '<div class="lvl none" style="margin-top:2px">Tickets booked</div>';
  if (p && p.booking_status === 'required') return '<div class="lvl required" style="margin-top:2px">Book ahead</div>';
  return '';
}

export function timelineView(day, items, withHome) {
  const city = dayCity(day);
  if (!items.length) return `<div class="block" style="padding-top:10px"><p class="serif" style="font-size:18px">An open day. Leave room to wander, or add a stop.</p><button class="btn line" data-act="addstop" data-day="${day}" style="align-self:flex-start">+ Add a stop</button><div data-addstopform hidden></div></div>`;
  const home = withHome && city ? homePoint(city) : null;
  let html = `<div class="block" style="padding-top:14px"><div class="tl"><div class="line"></div>`;
  let prev = null;
  if (home) { html += `<div class="stop" style="align-items:center;padding-bottom:4px"><div class="t any" style="padding-top:0">Start</div><div style="display:flex;justify-content:center"><div style="width:12px;height:12px;transform:rotate(45deg);background:var(--ink)"></div></div><div class="small muted">From <b style="color:var(--ink)">${esc(home.name)}</b></div><div></div></div>`; prev = home; }
  items.forEach((v, i) => {
    const info = itemInfo(v.item_id), went = statusOf(S.trip, v.item_id) === 'went', loc = info.location;
    if (i > 0 || home) html += legHTML(prev, loc, info.city_id || city);
    html += `<div class="stop"><div class="t ${v.time ? '' : 'any'}">${v.time ? esc(v.time) : 'Anytime'}</div><div class="num ${went ? 'done' : (v.time ? '' : 'o')}">${i + 1}</div>
      <div style="padding-top:3px;display:flex;flex-direction:column;gap:3px"><div style="font-size:16px;font-weight:600;${went ? 'color:var(--muted)' : ''}">${esc(info.name)}</div><div class="small muted" style="font-size:12px">${esc(KIND_NAME[info.kind] || '')}</div>${stopStatus(v.item_id)}<div data-schedform="${v.item_id}" hidden></div></div>
      <button class="handle" data-act="sched" data-id="${v.item_id}" aria-label="Edit or move ${esc(info.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></button></div>`;
    prev = loc || prev;
  });
  html += `</div><button class="btn line sm" data-act="addstop" data-day="${day}" style="margin:14px 0 0 88px;align-self:flex-start;border-style:dashed;color:var(--accent-deep);font-weight:600">+ Add a stop</button><div data-addstopform hidden></div></div>`;
  addMount(() => fillFares());
  return html;
}

let planMap = null;
function mapView(day, items) {
  const city = dayCity(day), home = city ? homePoint(city) : null;
  const pts = items.map((v, i) => ({ v, i, info: itemInfo(v.item_id) })).filter(o => o.info.location);
  if (!P().pin || !pts.some(o => o.v.item_id === P().pin)) P().pin = pts.length ? pts[pts.length - 1].v.item_id : null;
  const list = items.length ? `<div style="padding-top:18px">${items.map((v, i) => `<div style="display:grid;grid-template-columns:24px 56px minmax(0,1fr);gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--rule)"><span style="font-family:var(--mono);font-size:12px;color:var(--accent)">${i + 1}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">${v.time ? esc(v.time) : 'Anytime'}</span><span style="font-size:14px;font-weight:${v.item_id === P().pin ? 600 : 500}">${esc(itemInfo(v.item_id).name)}${itemInfo(v.item_id).location ? '' : ' <span class="small faint">(not on the map)</span>'}</span></div>`).join('')}</div>` : `<p class="serif" style="font-size:17px;padding-top:14px">No stops on this day yet. Switch to Timeline to add one.</p>`;
  addMount(() => {
    const el = document.getElementById('planMap'); if (!el) return;
    const c = cityOf(city || S.C.edition.city_ids[0]);
    planMap = mapService.create(el, { center: home || c.center, zoom: 14 });
    const markers = pts.map(o => ({ id: o.v.item_id, name: o.info.name, location: o.info.location, number: o.i + 1, hollow: !o.v.time, went: statusOf(S.trip, o.v.item_id) === 'went' }));
    const draw = () => mapService.setMarkers(planMap, markers, { selectedId: P().pin, route: true, routeStart: home, onTap: id => { P().pin = id; save(); draw(); pinCard(items, home); } });
    draw();
    mapService.fitTo(planMap, markers.map(m => m.location).concat(home ? [home] : []));
    pinCard(items, home);
    addCleanup(() => { mapService.destroy(planMap); planMap = null; });
  });
  return `<div class="block" style="padding-top:12px"><div class="wmap small"><div class="wcanvas" id="planMap"></div></div><div id="pinCard"></div>${list}<p class="small faint">Map data © OpenStreetMap contributors. Directions open in your maps app.</p></div>`;
}
function pinCard(items, home) {
  const el = document.getElementById('pinCard'); if (!el) return;
  const idx = items.findIndex(v => v.item_id === P().pin); if (idx < 0) { el.innerHTML = ''; return; }
  const v = items[idx], info = itemInfo(v.item_id), loc = info.location;
  const prev = idx > 0 ? itemInfo(items[idx - 1].item_id).location : home;
  const mins = prev && loc ? walkMinutes(prev, loc) : null;
  const links = loc ? mapService.openInMapsLink({ lat: loc.lat, lng: loc.lng, name: info.name }) : null;
  el.innerHTML = `<div style="display:grid;grid-template-columns:30px minmax(0,1fr);gap:12px;align-items:start;padding-top:16px"><div class="num ${v.time ? '' : 'o'}">${idx + 1}</div><div style="display:flex;flex-direction:column;gap:3px"><div style="font-size:17px;font-weight:600">${esc(info.name)}</div><div style="font-family:var(--mono);font-size:12px;color:var(--accent-deep)">${v.time ? esc(v.time) : 'Anytime'} · ${esc(KIND_NAME[info.kind] || '')}</div>${mins && mins <= 120 ? `<div class="serif" style="font-size:15px;color:var(--muted)">About ${mins} min on foot from the previous stop.</div>` : ''}</div></div>
    ${links ? `<div style="display:flex;gap:8px;flex-wrap:wrap;padding-left:42px;margin-top:8px"><a class="btn sm" href="${esc(links.apple)}" target="_blank" rel="noopener">Apple Maps ↗</a><a class="btn line sm" href="${esc(links.google)}" target="_blank" rel="noopener">Google Maps ↗</a></div>` : ''}`;
}

/* Things saved but not on a day yet */
function trayBlock() {
  const scheduled = new Set(S.trip.plan.map(p => p.item_id));
  const ids = [...new Set(S.trip.saved.filter(s => s.status === 'want').map(s => s.place_id).concat(S.trip.booked))].filter(id => !scheduled.has(id) && placeById(id));
  const days = tripDays(S.trip);
  return `<div class="block"><div class="head"><h2>Saved, not on a day yet</h2><span class="label">${ids.length}</span></div>${ids.length ? `<div>${ids.map(id => { const nb = nearbyDay(id), info = itemInfo(id); return `<div class="prow" style="grid-template-columns:40px minmax(0,1fr) auto">${ill(info.kind, 40)}<div><div style="font-weight:600">${esc(info.name)}</div><div class="small muted">${esc(cityName(info.city_id))}${nb ? ` · near ${esc(nb.name)}, fits Day ${days.indexOf(nb.day) + 1}` : ''}</div></div><button class="btn line sm" data-act="addsheet" data-id="${id}">Add to a day</button></div>`; }).join('')}</div>` : '<p class="small muted">Tap “Want to go” or “Interested” on places, experiences and day trips. They wait here until you give them a day.</p>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="pview" data-v="sights">Browse sights</button><button class="btn line sm" data-act="pview" data-v="experiences">Experiences</button><button class="btn line sm" data-act="pview" data-v="trips">Day trips</button></div></div>`;
}

export function nearbyDay(id) {
  const info = itemInfo(id); if (!info.location) return null;
  let best = null;
  tripDays(S.trip).forEach(d => {
    if (dayCity(d) && dayCity(d) !== info.city_id) return;
    itemsOn(S.trip, d).forEach(v => { if (v.item_id === id) return; const l2 = itemInfo(v.item_id).location; if (l2) { const dist = km(info.location, l2); if (dist < 0.9 && (!best || dist < best.dist)) best = { day: d, dist, name: itemInfo(v.item_id).name }; } });
  });
  return best;
}

export function renderPlan(seg) {
  const days = tripDays(S.trip);
  const head = masthead() + `<div class="greet"><div class="eyebrow">Plan · Planner mode</div><h1>Day by day.</h1><p class="lede">${days.length ? `${plural(days.length, 'day')} in Portugal. Fill what you like, leave the rest open.` : 'Give things a day, and a time if you like. Everything can move.'}</p></div>${seg}`;
  if (!days.length) return head + `<div class="block" style="padding-top:14px"><p class="serif" style="font-size:18px">Add your stays with dates to lay out your days.</p><button class="btn line" data-act="welcome" data-step="3" style="align-self:flex-start">Add my stays</button></div>` + trayBlock();
  if (!P().pday || !days.includes(P().pday)) P().pday = days.includes(today()) ? today() : days[0];
  const day = P().pday, di = days.indexOf(day), items = itemsOn(S.trip, day), city = dayCity(day);
  const strip = `<div class="daystrip" role="group" aria-label="Trip days">${days.map(d => { const n = itemsOn(S.trip, d).length, dt = new Date(d + 'T00:00:00'), dc = dayCity(d); return `<button class="day" data-act="pday" data-v="${d}" aria-pressed="${d === day}" aria-label="${esc(fmtDay(d))}${dc ? ', ' + esc(cityName(dc)) : ''}, ${n} planned"><span class="dw">${dt.toLocaleDateString('en-US', { weekday: 'short' })}</span><span class="dn">${dt.getDate()}</span><span class="dc">${esc(dc ? cityName(dc) : '')}</span><span class="dots">${'<i></i>'.repeat(Math.min(n, 4))}</span></button>`; }).join('')}</div>`;
  const toggle = `<div class="seg2" role="group" aria-label="View" style="margin-top:16px"><button data-act="pmode" data-v="timeline" aria-pressed="${P().pmode !== 'map'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M11 5h9M11 19h9M11 12h6"/></svg>Timeline</button><button data-act="pmode" data-v="map" aria-pressed="${P().pmode === 'map'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>Map</button></div>`;
  const leg = S.trip.legs.find(l => l.date === day);
  const mode = leg && S.C.edition.leg_modes.find(m => m.id === leg.mode);
  const travel = leg ? `<div class="travelday">${ic(modeIcon(leg.mode))}<span><b>Travel day:</b> ${esc(cityName(leg.from_city_id))} to ${esc(cityName(leg.to_city_id))}${mode ? ' by ' + esc(mode.label.toLowerCase()) : ''}. Keep the plan light.</span></div>` : '';
  const dayHead = `<div class="block" style="padding-top:22px;gap:4px"><div class="head"><h2>${esc(new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }))}</h2><span class="label">Day ${di + 1}${city ? ' · ' + esc(cityName(city)) : ''}</span></div>
    <div style="font-family:var(--mono);font-size:11.5px;color:var(--muted)">${items.length ? plural(items.length, 'stop') : 'Open day'}</div>${travel}</div>`;
  const body = P().pmode === 'map' ? mapView(day, items) : timelineView(day, items, true);
  return head + strip + toggle + dayHead + body + trayBlock();
}

/* ---------- schedule form and add-to-a-day sheet ---------- */
export function openSched(id) {
  if (isPlanner() && !planOf(S.trip, id)) return openAddSheet(id);
  $$('[data-schedform]').forEach(el => { el.hidden = true; el.innerHTML = ''; });
  const box = document.querySelector(`[data-schedform="${id}"]`); if (!box) return;
  const cur = planOf(S.trip, id) || {}; const days = tripDays(S.trip); const mn = days[0] || '', mx = days[days.length - 1] || '';
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
    <div class="fields"><label class="f">Day<input type="date" id="sd-${id}" value="${esc(cur.date || mn)}" ${mn ? `min="${mn}"` : ''} ${mx ? `max="${mx}"` : ''}></label><label class="f">Time (optional)<input type="time" id="st-${id}" value="${esc(cur.time || '')}"></label></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="savesched" data-id="${id}">Save</button>${cur.date && isPlanner() ? `<button class="btn line sm" data-act="move" data-id="${id}" data-dir="-1">Move earlier</button><button class="btn line sm" data-act="move" data-id="${id}" data-dir="1">Move later</button>` : ''}${cur.date ? `<button class="btn line sm" data-act="unsched" data-id="${id}">Remove from plan</button>` : ''}<button class="btn line sm" data-act="cancelsched" data-id="${id}">Cancel</button></div></div>`;
}

let sheetSel = null;
export const sheetDay = () => sheetSel;
export function setSheetDay(d) {
  sheetSel = d;
  $$('[data-act="pickday"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === d));
  const ab = $('#sheetAddBtn'); if (ab) ab.textContent = 'Add to ' + shortDay(d);
}
export function openAddSheet(id) {
  const all = tripDays(S.trip), info = itemInfo(id), near = nearbyDay(id);
  const days = all.filter(d => !dayCity(d) || !info.city_id || dayCity(d) === info.city_id);
  const cur = planOf(S.trip, id);
  sheetSel = (cur && cur.date) || (near && near.day) || (days.includes(today()) ? today() : days[0]) || null;
  const sh = $('#sheet');
  const head = `<div class="grab"></div><div style="display:grid;grid-template-columns:56px minmax(0,1fr);gap:14px;align-items:center">${ill(info.kind, 56)}<div><div class="eyebrow" style="font-size:10px">On your list · ${esc(cityName(info.city_id || S.C.edition.city_ids[0]))}</div><div style="font-size:20px;font-weight:700;letter-spacing:-.015em;line-height:1.2">Add ${esc(info.name)} to a day?</div></div></div>`;
  if (!days.length) {
    sh.innerHTML = head + `<p class="small">${all.length ? `None of your days are in ${esc(cityName(info.city_id))} yet. Check your stays.` : 'Add your stays with dates first, then you can place things on days.'}</p><div style="display:flex;gap:8px"><button class="btn" data-act="sheetstays" style="flex:1">Edit my stays</button><button class="btn line" data-act="sheetclose" style="flex:1">Later</button></div>`;
  } else {
    sh.innerHTML = head + `<div class="daypick" role="group" aria-label="Choose a day">${days.map(d => `<button data-act="pickday" data-v="${d}" aria-pressed="${d === sheetSel}"><span>${esc(shortDay(d))}</span><b>Day ${all.indexOf(d) + 1}${near && near.day === d ? ' · nearby' : ''}</b></button>`).join('')}</div>
      ${near ? `<p class="serif" style="font-size:15px;margin-top:-4px">Day ${all.indexOf(near.day) + 1} already has ${esc(near.name)}, just nearby.</p>` : ''}
      <div class="fields" style="align-items:flex-end"><label class="f">Time (optional)<input type="time" id="sheetTime" value="${esc((cur || {}).time || '')}"></label></div>
      <div style="display:flex;gap:8px"><button class="btn" data-act="sheetadd" data-id="${id}" id="sheetAddBtn" style="flex:1">Add to ${esc(sheetSel ? shortDay(sheetSel) : 'day')}</button><button class="btn line" data-act="sheetclose" style="flex:1">Later</button></div>`;
  }
  $('#scrim').hidden = false; sh.hidden = false;
}
export function closeSheet() { $('#sheet').hidden = true; $('#scrim').hidden = true; }

export function openAddStop(day) {
  const box = document.querySelector('[data-addstopform]'); if (!box) return;
  const city = dayCity(day);
  const opts = placesIn(city || S.C.edition.city_ids[0]).map(p => [p.id, (p.category === 'day_trip' ? 'Day trip: ' : '') + p.name]);
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px"><div class="fields"><label class="f">Place or activity<select id="asWhat">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label><label class="f" style="flex:0 1 130px">Time (optional)<input type="time" id="asTime"></label></div>
    <div style="display:flex;gap:8px"><button class="btn sm" data-act="addstopsave" data-day="${day}">Add to this day</button><button class="btn line sm" data-act="addstopcancel">Cancel</button></div></div>`;
}
export { addToDay };
