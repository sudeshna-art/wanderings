/* Bookings in one place (approved Oct 11 2026): flights, stays, trains, tours and drivers, with import from
   pasted confirmation emails or calendar files. Everything is read and kept on this phone. */
import { S, P, save, cityOf, cityName, cityIds, today } from '../state.js?v=202610120955';
import { esc, ic, toast, $, fmtDay } from '../dom.js?v=202610120955';
import { bookingLine } from '../components.js?v=202610120955';
import { BOOKING_KINDS, bookingKindLabel, newBooking, sortedBookings, upsertBooking, removeBooking, newStay, syncLegs, sortedStays, tripRange } from '../../models/schema.js?v=202610120955';
import { parseAny } from '../../models/importer.js?v=202610120955';

const IM = { text: '', found: [], mode: 'paste' };

/* What the importer needs to know about this edition: its towns, neighborhoods and airports. */
function importCtx() {
  const places = [], airports = {};
  S.C.cities.forEach(c => {
    places.push({ city_id: c.city_id, words: [c.name, c.local_name, c.short_name].filter(Boolean) });
    (c.neighborhoods || []).filter(n => n.id !== 'other').forEach(n => places.push({ city_id: c.city_id, neighborhood_id: n.id,
      words: n.name.split(/\s+and\s+|,|\(|\)/).map(w => w.trim()).filter(w => w.length > 3 && !/^by the sea$/i.test(w)).concat(n.aliases || []) }));
    (c.airports || []).forEach(a => { if (a.id && /^[A-Z]{3}$/.test(a.id)) airports[a.id] = c.city_id; if (a.iata) airports[a.iata] = c.city_id; });
  });
  (S.C.edition.arrival_options || []).forEach(o => { if (/^[A-Z]{3}$/.test(o.id) && o.city_id) airports[o.id] = o.city_id; });
  const start = tripRange(S.trip).start;
  return { year: start ? +start.slice(0, 4) : 0, timezone: S.C.cities[0].timezone, places, airports };
}

/* ---------- Essentials block ---------- */
export function bookingsBlock() {
  const list = sortedBookings(S.trip);
  return `<div class="block" id="bookBlock" tabindex="-1"><div class="head"><h2>Your bookings</h2><span class="label">${list.length || ''}</span></div>
    <p class="small muted">Flights, hotels, trains, tours and drivers in one place. They show on your plan and on Today, and the app checks for clashes.</p>
    ${list.length ? `<div>${list.map(b => bookingLine(b, 'start', { day: true, ref: true, edit: true })).join('')}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="imopen">${ic('upload', 'style="width:16px;height:16px"')}Import from an email</button><button class="btn line sm" data-act="bkadd">+ Add by hand</button></div>
    <p class="small faint">Saved only on this phone. Booking references are never included when you share your plan.</p></div>`;
}

/* ---------- import ---------- */
export function openImport() { IM.mode = 'paste'; IM.found = []; renderImport(); }
function renderImport() {
  const d = $('#driver');
  if (IM.mode === 'paste') {
    d.innerHTML = `<div class="inner"><div class="label">Import bookings</div><h1 style="font-size:30px">Add your bookings</h1>
      <p class="small">Copy the text of a confirmation email (flight, hotel, train, tour or driver) and paste it here. You can paste several at once.</p>
      <label class="f" style="flex:none"><span class="offscreen">Confirmation text</span><textarea id="imText" style="min-height:180px;font-family:var(--sans);font-size:15px" placeholder="Paste the confirmation email here">${esc(IM.text)}</textarea></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-act="imfind">Find my bookings</button>
      <label class="btn line sm" style="cursor:pointer">${ic('plan', 'style="width:16px;height:16px"')}Open a calendar file<input type="file" id="icsInput" accept=".ics,text/calendar" class="offscreen"></label></div>
      <p class="small muted">Tip: many booking emails have an “Add to calendar” link. The calendar file it gives you reads perfectly.</p>
      <p class="small faint">Read on this phone only. Nothing is uploaded. You check every booking before it’s saved.</p>
      <div style="display:flex;gap:8px;margin-top:auto"><button class="btn line" data-act="bkadd" style="flex:1">Add one by hand</button><button class="btn line" data-act="closedriver" style="flex:1">Close</button></div></div>`;
  } else {
    const n = IM.found.length;
    d.innerHTML = `<div class="inner"><div class="label">Import bookings</div><h1 style="font-size:30px">${n ? 'Here’s what I found' : 'Nothing found yet'}</h1>
      <p class="small">${n ? 'Check each one and fix anything that’s off, then save. Untick anything you don’t want.' : 'I couldn’t find dates in that text. Try pasting the whole email, open a calendar file, or add the booking by hand.'}</p>
      ${IM.found.map((b, i) => editorCard(b, i, true)).join('')}
      <div style="display:flex;gap:8px;margin-top:auto;padding-top:8px">${n ? `<button class="btn" data-act="imsave" style="flex:1">Save ${n === 1 ? 'booking' : 'bookings'}</button>` : `<button class="btn" data-act="bkadd" style="flex:1">Add by hand</button>`}<button class="btn line" data-act="imback" style="flex:1">Back</button></div></div>`;
  }
  d.hidden = false; d.scrollTo(0, 0);
}
export function importFind() {
  IM.text = ($('#imText') || {}).value || '';
  if (!IM.text.trim()) { toast('Paste a confirmation email first'); return; }
  /* Several emails pasted together: read each part. */
  const parts = IM.text.split(/\n\s*(?:-{3,}|_{3,}|={3,}|\*{3,})\s*\n|\n(?=\s*(?:Forwarded message|Begin forwarded message|-----Original))/i);
  IM.found = parts.flatMap(p => parseAny(p, importCtx()));
  IM.mode = 'review'; renderImport();
}
export function importFile(text) { IM.found = parseAny(text, importCtx()); IM.mode = 'review'; renderImport(); }
export function importBack() { IM.mode = 'paste'; renderImport(); }

/* ---------- one booking's fields (import review and edit) ---------- */
const F = (i, k) => `bk-${i}-${k}`;
function editorCard(b, i, importing) {
  const kind = b.kind, city = b.city_id ? cityOf(b.city_id) : null;
  const lbl = { flight: ['Departs', 'Lands'], stay: ['Check in', 'Check out'], car: ['Pick-up', 'Ends'], train: ['Departs', 'Arrives'], bus: ['Departs', 'Arrives'] }[kind] || ['Starts', 'Ends'];
  const route = ['flight', 'train', 'bus', 'car'].includes(kind);
  const hood = city && b.neighborhood_id ? (city.neighborhoods || []).find(n => n.id === b.neighborhood_id) : null;
  const ap = kind === 'flight' && (S.C.edition.arrival_options || []).map(o => o.id);
  return `<div class="bkcard" data-bkcard="${i}">
    ${importing ? `<label class="check" style="min-height:32px"><input type="checkbox" id="${F(i, 'keep')}" checked><b>${esc(bookingKindLabel(kind))}</b>${b.found && b.found.length ? `<span class="small muted" style="font-weight:400">· found ${esc(b.found.join(', '))}</span>` : ''}</label>` : ''}
    <div class="fields"><label class="f">Type<select id="${F(i, 'kind')}" data-act="bkkind" data-i="${i}">${BOOKING_KINDS.map(([k, l]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <label class="f">Name<input type="text" id="${F(i, 'title')}" value="${esc(b.title)}" placeholder="${kind === 'flight' ? 'e.g. Flight EK 191' : kind === 'stay' ? 'e.g. hotel name' : 'What is it?'}"></label></div>
    <div class="fields"><label class="f">${lbl[0]}<input type="date" id="${F(i, 'date')}" value="${esc(b.date)}"></label><label class="f" style="flex:0 1 120px">Time<input type="time" id="${F(i, 'time')}" value="${esc(b.time)}"></label></div>
    <div class="fields"><label class="f">${lbl[1]}${kind === 'stay' ? '' : ' (optional)'}<input type="date" id="${F(i, 'end_date')}" value="${esc(b.end_date)}"></label><label class="f" style="flex:0 1 120px">Time<input type="time" id="${F(i, 'end_time')}" value="${esc(b.end_time)}"></label></div>
    ${route ? `<div class="fields"><label class="f">From<input type="text" id="${F(i, 'from')}" value="${esc(b.from)}" placeholder="${kind === 'flight' ? 'e.g. DXB' : 'e.g. Lisboa Oriente'}"></label><label class="f">To<input type="text" id="${F(i, 'to')}" value="${esc(b.to)}" placeholder="${kind === 'flight' ? 'e.g. LIS' : 'e.g. Faro'}"></label></div>` : ''}
    ${kind !== 'flight' ? `<div class="fields"><label class="f">${kind === 'stay' ? 'Address (for drivers)' : 'Where or meeting point'}<input type="text" id="${F(i, 'where')}" value="${esc(b.where)}" placeholder="Optional"></label></div>` : ''}
    <div class="fields"><label class="f">Booking reference (optional)<input type="text" id="${F(i, 'ref')}" value="${esc(b.ref)}" autocapitalize="characters"></label></div>
    ${kind === 'stay' && cityIds().length ? `<label class="check" style="min-height:32px;align-items:flex-start"><input type="checkbox" id="${F(i, 'asstay')}" ${importing ? 'checked' : ''} style="margin-top:2px"><span class="small">Use as my stay${city ? ` in ${esc(hood ? hood.name : cityName(city.city_id))}` : ''}, with these dates. The app follows you there.</span></label>
      ${!city && cityIds().length > 1 ? `<label class="f" style="flex:none">Where is it?<select id="${F(i, 'city')}">${cityIds().map(id => `<option value="${id}">${esc(cityName(id))}</option>`).join('')}</select></label>` : ''}` : ''}
    ${kind === 'flight' && ap ? `<label class="check" style="min-height:32px"><input type="checkbox" id="${F(i, 'asflight')}" ${importing ? 'checked' : ''}><span class="small">Use for my arrival or departure details</span></label>` : ''}
    </div>`;
}
function readCard(i, base) {
  const v = k => { const el = $('#' + F(i, k)); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : undefined; };
  const b = Object.assign({}, base);
  ['kind', 'title', 'date', 'time', 'end_date', 'end_time', 'from', 'to', 'where', 'ref'].forEach(k => { const x = v(k); if (x !== undefined) b[k] = k === 'ref' || (b.kind === 'flight' && (k === 'from' || k === 'to')) ? x.toUpperCase() : x; });
  if (v('city')) b.city_id = v('city');
  if (!b.city_id && cityIds().length === 1) b.city_id = cityIds()[0];
  return { b, keep: v('keep') !== false, asStay: !!v('asstay'), asFlight: !!v('asflight') };
}
/* Re-draw a card when its type changes, keeping what was typed. */
export function changeKind(i) {
  const list = IM.mode === 'edit' ? [IM.edit] : IM.found;
  const r = readCard(+i, list[+i]); list[+i] = r.b;
  const card = document.querySelector(`[data-bkcard="${i}"]`); if (card) card.outerHTML = editorCard(r.b, +i, IM.mode === 'review');
}

/* A hotel booking becomes the stay for those dates; a flight fills arrival or departure. */
function applyStay(b) {
  if (!b.date || !b.city_id) return false;
  /* The same city's stay that overlaps these nights (a check-out day doesn't count), or an empty one. */
  let s = S.trip.stays.find(x => x.city_id === b.city_id && x.start && x.start < (b.end_date || b.date) && (x.end || x.start) > b.date)
    || S.trip.stays.find(x => x.city_id === b.city_id && !x.start);
  if (!s) { s = newStay(b.city_id); S.trip.stays.push(s); }
  Object.assign(s, { start: b.date, end: b.end_date || s.end, label: b.title && b.title !== 'Stay' ? b.title : s.label, address: b.where || s.address });
  if (b.neighborhood_id) s.neighborhood_id = b.neighborhood_id;
  /* An empty placeholder stay for the same city is no longer needed. */
  S.trip.stays = S.trip.stays.filter(x => x === s || x.city_id !== s.city_id || x.start || x.label || x.neighborhood_id);
  syncLegs(S.trip); return true;
}
function applyFlight(b) {
  const opts = (S.C.edition.arrival_options || []).map(o => o.id), code = (b.title.match(/\b([A-Z0-9]{2}\s?\d{2,4})\b/) || [])[1] || '';
  const { start } = tripRange(S.trip);
  if (opts.includes(b.to) && (!S.trip.arrival.flight || !start || (b.end_date || b.date) <= start)) { S.trip.arrival.via = b.to; if (code) S.trip.arrival.flight = code; return 'arrival'; }
  if (opts.includes(b.from)) { S.trip.departure.via = b.from; if (code) S.trip.departure.flight = code; return 'departure'; }
  return '';
}
export function importSave() {
  let n = 0, stays = 0;
  IM.found.forEach((x, i) => {
    const r = readCard(i, x); if (!r.keep) return;
    const b = r.b; delete b.found;
    /* The same email imported twice updates the booking instead of adding a copy. */
    const twin = S.trip.bookings.find(x => x.kind === b.kind && x.date === b.date && ((b.ref && x.ref === b.ref && x.title === b.title) || (x.title === b.title && x.time === b.time)));
    if (twin) b.id = twin.id;
    upsertBooking(S.trip, b); n++;
    if (b.kind === 'stay' && r.asStay && applyStay(b)) stays++;
    if (b.kind === 'flight' && r.asFlight) applyFlight(b);
  });
  if (!n) { toast('Tick at least one booking to save'); return false; }
  save(); IM.text = ''; $('#driver').hidden = true;
  toast(`${n === 1 ? 'Booking' : n + ' bookings'} saved${stays ? (stays === 1 ? ', and your stay updated' : ', and your stays updated') : ''}`);
  return true;
}

/* ---------- add or edit one booking by hand ---------- */
export function openEditor(id) {
  const b = id ? S.trip.bookings.find(x => x.id === id) : newBooking('other');
  if (!b) return;
  IM.mode = 'edit'; IM.edit = Object.assign({}, b); IM.isNew = !id;
  const d = $('#driver');
  d.innerHTML = `<div class="inner"><div class="label">${id ? 'Edit booking' : 'Add a booking'}</div>${editorCard(IM.edit, 0, false)}
    <div style="display:flex;gap:8px;margin-top:auto;padding-top:8px"><button class="btn" data-act="bksave" style="flex:1">Save</button>${id ? `<button class="btn line" data-act="bkdel" data-id="${id}" style="flex:1">Delete</button>` : ''}<button class="btn line" data-act="closedriver" style="flex:1">Cancel</button></div></div>`;
  d.hidden = false; d.scrollTo(0, 0);
}
export function editorSave() {
  const r = readCard(0, IM.edit), b = r.b;
  if (!b.date && !b.title) { toast('Add a name or a date'); return false; }
  upsertBooking(S.trip, b);
  if (b.kind === 'stay' && r.asStay) applyStay(b);
  if (b.kind === 'flight' && r.asFlight) applyFlight(b);
  save(); $('#driver').hidden = true; toast('Booking saved'); return true;
}
export function editorDelete(el) {
  if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again to delete'; return false; }
  removeBooking(S.trip, el.dataset.id); save(); $('#driver').hidden = true; toast('Booking deleted'); return true;
}
export const importState = IM;
