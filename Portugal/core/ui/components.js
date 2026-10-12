/* Shared pieces of UI used by several screens. */
import { EDITION } from '../../edition.config.js?v=202610121014';
import { S, P, cityOf, cityName, curCityId, autoCityId, cityIds, placeById, isPlanner, today } from './state.js?v=202610121014';
import { esc, ic, ill, KIND_NAME, fmtDay } from './dom.js?v=202610121014';
import { statusOf, isBooked, planOf, BOOKING_LABEL, URGENCY_LABEL, priceText, priceShort, closedText, bookingKindLabel } from '../models/schema.js?v=202610121014';
import { linkService } from '../services/link-service.js?v=202610121014';

export const art = file => (S.art && S.art[file]) || '';
/* A city's own illustrated map (original line art drawn to a known area), for the offline sketch map. */
export const illustrationFor = c => c && c.illustrated_map && art(c.illustrated_map.art) ? { svg: art(c.illustrated_map.art), bbox: c.illustrated_map.bbox } : null;

/* Header: wordmark, Beta tag, search and the city's mark. No coordinates or edition name (cleanup Oct 11 2026). */
export function masthead(opts = {}) {
  const c = cityOf(curCityId());
  return `<div class="mast"><div style="display:flex;flex-direction:column;gap:5px"><div class="word">wanderings<span>.</span></div><div class="label">Beta</div></div>
  ${opts.noAsk ? '' : `<button class="mast-ask" data-act="ask" aria-label="Ask anything">${ic('search')}</button>`}
  <div class="stamp">${art(c.mark)}<div class="t"><b>${esc(c.stamp)}</b></div></div></div>`;
}

/* City switcher. Follows the traveler's dates unless they pick a city. */
export function cityBar() {
  if (cityIds().length < 2) return '';
  const cur = curCityId(), auto = autoCityId();
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="citybar" role="group" aria-label="Choose a place">${cityIds().map(id => `<button data-act="city" data-id="${id}" aria-pressed="${id === cur}">${esc(cityName(id))}</button>`).join('')}</div>
  ${P().city && P().city !== auto ? `<button class="text-btn" data-act="cityauto" style="min-height:36px;font-size:12.5px">Follow my dates</button>` : ''}</div>`;
}

export const legend = () => `<div class="legend"><span class="lvl required">Must book</span><span class="lvl optional">Optional</span><span class="lvl none">No ticket</span></div>`;

export function statusLine(p) {
  if (!p) return '';
  return `<div class="status-line"><span class="lvl ${p.booking_status}">${esc(BOOKING_LABEL[p.booking_status] || '')}</span>${p.booking_status !== 'none' ? `<span class="urg ${p.urgency_level}">${esc(URGENCY_LABEL[p.urgency_level] || '')}</span>` : ''}</div>`;
}
export function priceLabel(p) {
  const t = priceText(p.price);
  if (t) return t;
  if (p.booking_status !== 'none' && p.ticket_url) return '';
  return '';
}
export function pricePlaceholder(p) {
  return (!priceText(p.price) && p.booking_status !== 'none') ? `<span class="ph-flag">Price: check when booking</span>` : '';
}
/* Official link first. An affiliate link would only ever be second, with a disclosure, once approved. */
export function ticketButtons(p, line = false, withPrice = true) {
  if (!p.ticket_url) return '';
  return `<a class="btn ${line ? 'line ' : ''}sm" href="${esc(p.ticket_url)}" target="_blank" rel="noopener">${p.booking_status === 'none' ? 'Official site' : 'Official tickets'}${line && withPrice && priceShort(p.price) ? ' · ' + esc(priceShort(p.price)) : ''} ↗</a>`;
}
export function searchButtons(q) {
  return q ? `<a class="btn line sm" href="${esc(linkService.tripadvisor(q))}" target="_blank" rel="noopener">Tripadvisor ↗</a><a class="btn line sm" href="${esc(linkService.getyourguide(q))}" target="_blank" rel="noopener">GetYourGuide ↗</a>` : '';
}
/* "Closed Mondays" under a place's name (opening days, Oct 11 2026). */
export const closedLine = p => closedText(p) ? `<div class="closed-day">${esc(closedText(p))}</div>` : '';
/* Tips minus the closed-days sentence, which already shows under the name. */
export function tipsOf(p) {
  const cl = closedText(p);
  return (p.tips || []).map(t => cl ? t.replace(cl + '.', '').replace(/\s{2,}/g, ' ').trim() : t).filter(Boolean);
}

/* ---------- plan helpers on rows ---------- */
export function schedChip(id) {
  const s = planOf(S.trip, id); if (!s) return '';
  return `<div class="when-chip">${ic('plan', 'style="width:14px;height:14px"')}${esc(fmtDay(s.date))}${s.time ? ' · ' + esc(s.time) : ''}</div>`;
}
export function schedBtn(id, booked) {
  if (!(isPlanner() || booked)) return '';
  return `<button class="btn line sm" data-act="sched" data-id="${id}">${planOf(S.trip, id) ? 'Change time' : (isPlanner() ? 'Schedule' : 'Add booking time')}</button>`;
}
export const schedSlot = id => `<div data-schedform="${id}" hidden></div>`;

/* ---------- place row (sights, food, shops) ---------- */
export function placeMedia(p, size = 52) {
  const e = S.trip.journal.slice().reverse().find(x => x.place_id === p.id && (x.photos || []).length);
  return e ? `<div style="width:${size}px;height:${size}px;border-radius:4px;overflow:hidden;background:var(--surface);flex:none"><img data-photo="${e.photos[0]}" alt="Your photo of ${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>` : ill(p.kind, size);
}
export function placeRow(p, compact = false) {
  const s = statusOf(S.trip, p.id), booked = isBooked(S.trip, p.id);
  const ticketed = p.booking_status !== 'none';
  return `<div class="row" id="pl-${p.id}">${placeMedia(p)}<div><h3>${esc(p.name)}</h3><div class="meta">${esc(KIND_NAME[p.kind] || '')}${p.area ? ' · ' + esc(p.area) : ''}</div>${closedLine(p)}
    ${p.description && !compact ? `<p class="desc">${esc(p.description)}</p>` : ''}
    ${s === 'went' ? `<div class="went" style="margin-top:6px">✓ Went here</div>` : ''}
    ${ticketed ? (booked ? `<div class="went" style="margin-top:6px">✓ Tickets booked</div>` : statusLine(p)) : (compact ? '' : statusLine(p))}
    <div class="acts">
      ${ticketed && !booked && p.ticket_url ? ticketButtons(p, true, false) : ''}
      ${p.audio ? `<button class="btn line sm" data-act="audio" data-id="${p.id}">${ic('speak', 'style="width:16px;height:16px"')}Listen</button>` : ''}
      ${s !== 'went' ? `<button class="btn line sm" data-act="want" data-id="${p.id}" aria-pressed="${s === 'want'}">${s === 'want' ? 'On your list' : 'Want to go'}</button>
      <button class="btn sm" data-act="went" data-id="${p.id}">Went here</button>` : `<button class="btn line sm" data-act="unwent" data-id="${p.id}">Undo</button><button class="btn line sm" data-act="went" data-id="${p.id}">Add a note</button>`}
      ${s !== 'went' ? schedBtn(p.id, booked) : ''}
    </div>
    ${schedChip(p.id)}${schedSlot(p.id)}
    <div data-noteform="${p.id}" hidden></div></div><div class="price">${esc(priceShort(p.price))}</div></div>`;
}

/* Experiences and day trips */
export function expRow(x) {
  const st = statusOf(S.trip, x.id), booked = isBooked(S.trip, x.id), trip = x.category === 'day_trip';
  return `<div class="row">${ill(x.kind)}<div><h3>${esc(x.name)}</h3>
    <div class="meta">${trip ? esc(x.how || '') : esc([x.area, x.duration].filter(Boolean).join(' · '))}</div>
    ${trip && x.stay ? `<div class="meta">Plan for ${esc(x.stay.toLowerCase())}</div>` : ''}${closedLine(x)}
    <p class="desc">${esc(x.description)}</p>
    ${booked ? `<div class="went" style="margin-top:6px">✓ Booked</div>` : statusLine(x)}
    ${x.lead_time ? `<p class="small muted" style="margin-top:3px">${esc(x.lead_time)}</p>` : ''}
    ${tipsOf(x).length ? `<ul class="tips">${tipsOf(x).slice(0, 4).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${x.price && x.price.text ? `<p class="small" style="margin-top:4px"><b style="font-family:var(--mono);font-weight:500">${esc(x.price.text)}</b> <span class="small muted">${x.price.kind === 'typical' ? 'typical, varies by provider' : ''}</span></p>` : (!trip ? `<p style="margin-top:4px"><span class="ph-flag">Prices vary by provider</span></p>` : '')}
    <div class="acts">${x.ticket_url ? ticketButtons(x, true) : ''}${searchButtons(x.search_q)}</div>
    <div class="acts"><button class="btn line sm" data-act="want" data-id="${x.id}" aria-pressed="${st === 'want'}">${st === 'want' ? 'On your list' : 'Want to go'}</button>
      <label class="check"><input type="checkbox" data-act="booked" data-id="${x.id}" ${booked ? 'checked' : ''}>Booked</label>${schedBtn(x.id, booked)}</div>
    ${schedChip(x.id)}${schedSlot(x.id)}
  </div><div></div></div>`;
}

/* Book-ahead row for Today */
export function bookRow(p) {
  return `<div class="row">${ill(p.kind)}<div><h3>${esc(p.name)}</h3><div class="meta">${esc(p.area || '')}</div>${closedLine(p)}${statusLine(p)}
    ${tipsOf(p).length ? `<ul class="tips">${tipsOf(p).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <div class="acts">${p.ticket_url ? ticketButtons(p) : searchButtons(p.search_q)}
    <label class="check"><input type="checkbox" data-act="booked" data-id="${p.id}" ${isBooked(S.trip, p.id) ? 'checked' : ''}>Booked</label>${schedBtn(p.id, isBooked(S.trip, p.id))}</div>
    ${priceText(p.price) ? `<p class="small" style="font-family:var(--mono)">${esc(priceText(p.price))}</p>` : pricePlaceholder(p)}
    ${schedChip(p.id)}${schedSlot(p.id)}</div>
    <div></div></div>`;
}

/* ---------- bookings (flights, stays, trains, tours) ---------- */
const BK_ICON = { flight: 'arrow', stay: 'home', train: 'train', bus: 'train', car: 'car', tour: 'ticket', restaurant: 'food', other: 'plan' };
export const bookingIcon = k => BK_ICON[k] || 'plan';
/* One line for a booking. role 'end' marks a check-out. */
export function bookingLine(b, role = 'start', opts = {}) {
  const t = role === 'end' ? b.end_time : b.time;
  const what = b.title || bookingKindLabel(b.kind);
  const route = b.from && b.to ? `${b.from} to ${b.to}` : '';
  const sub = [role === 'end' ? 'Check out' : b.kind === 'stay' ? 'Check in' : bookingKindLabel(b.kind), route, b.where && b.kind !== 'flight' ? b.where : ''].filter(Boolean).join(' · ');
  return `<div class="bk">${ic(bookingIcon(b.kind))}<div style="min-width:0"><div class="bk-t">${opts.day ? esc(fmtDay(role === 'end' ? b.end_date : b.date)) + (t ? ' · ' : '') : ''}${t ? esc(t) : opts.day ? '' : 'Anytime'}</div><b>${esc(what)}</b><div class="small muted">${esc(sub)}</div>${opts.ref && b.ref ? `<div class="small" style="font-family:var(--mono)">Ref ${esc(b.ref)}</div>` : ''}</div>${opts.edit ? `<button class="text-btn" data-act="bkedit" data-id="${b.id}" style="min-height:36px">Edit</button>` : ''}</div>`;
}

/* ---------- travel style choice ---------- */
export function styleChoice(name) {
  const v = S.trip.travel_style;
  const opt = (val, title, text) => `<label class="opt"><input type="radio" name="${name}" data-bind="travel_style" value="${val}" ${v === val ? 'checked' : ''}><span><b>${title}</b><br><span class="small muted">${text}</span></span></label>`;
  return `<fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;min-width:0"><legend style="font-size:12px;color:var(--muted);margin-bottom:6px;padding:0">How do you like to travel?</legend>
    ${opt('flow', 'Go with the flow', 'A list of ideas and must-sees. Decide as you go.')}
    ${opt('planner', 'Planner', 'Put places on a day and time, with a day-by-day view. Everything can move.')}
    ${opt('wanderer', 'True Wanderer', 'No plan at all. The app opens on a live map of what’s worth seeing near you.')}
    </fieldset><p class="small faint" style="margin:0">Everyone gets the “Near me” map in Places.</p>`;
}

/* ---------- stays editor (welcome steps and Essentials) ---------- */
/* The chosen way of getting between two places, with the edition's notes and official link. */
export function legInfo(l) {
  if (!l || !l.mode) return '';
  const con = (cityOf(l.from_city_id).connections || []).find(x => x.to_city_id === l.to_city_id);
  const it = con && con.items.find(x => x.mode === l.mode || (l.mode === 'taxi' && x.mode === 'driver'));
  if (!it) return '';
  return `<p class="small muted" style="margin:0">${esc(it.text)}${it.link ? ` <a href="${esc(it.link.url)}" target="_blank" rel="noopener">${esc(it.link.label)} ↗</a>` : ''}</p>`;
}
export function staysEditor(opts = {}) {
  const info = opts.info !== false;
  const stays = S.trip.stays;
  const cityOpts = sel => cityIds().map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(cityOf(id).short_name ? 'The ' + cityOf(id).short_name : cityOf(id).name)}</option>`).join('');
  const rows = stays.map((s, i) => {
    const c = cityOf(s.city_id);
    const hoods = (c.neighborhoods || []).map(n => `<option value="${n.id}" ${s.neighborhood_id === n.id ? 'selected' : ''}>${esc(n.name)}${n.area ? ' (' + esc(n.area) + ')' : ''}</option>`).join('');
    const h = (c.neighborhoods || []).find(n => n.id === s.neighborhood_id);
    return `<div class="stay"><div class="stay-h"><span class="label">Stay ${i + 1}</span>${stays.length > 1 ? `<button class="text-btn" data-act="staydel" data-i="${i}" style="min-height:32px;color:var(--muted);font-weight:500">Remove</button>` : ''}</div>
      <div class="fields">${cityIds().length > 1 ? `<label class="f">Where<select data-bind="stays.${i}.city_id">${cityOpts(s.city_id)}</select></label>` : ''}
      <label class="f">${c.region ? 'Town' : 'Neighborhood'}<select data-bind="stays.${i}.neighborhood_id"><option value="">Choose…</option>${hoods}</select></label></div>
      ${h && h.tip ? `<p class="small muted" style="margin-top:-2px">${esc(h.tip)}</p>` : ''}
      <div class="fields"><label class="f">From<input type="date" data-bind="stays.${i}.start" value="${esc(s.start)}"></label><label class="f">To<input type="date" data-bind="stays.${i}.end" value="${esc(s.end)}" ${s.start ? `min="${s.start}"` : ''}></label></div>
      <div class="fields"><label class="f">Name it (optional)<input type="text" data-bind="stays.${i}.label" value="${esc(s.label)}" placeholder="e.g. Hotel name"></label>
      <label class="f">Street address (for drivers)<input type="text" data-bind="stays.${i}.address" value="${esc(s.address)}" placeholder="Optional"></label></div></div>`;
  }).join('');
  const legs = S.trip.legs.map((l, i) => `<div style="display:flex;flex-direction:column;gap:6px"><div class="legrow">${ic(l.mode ? modeIconName(l.mode) : 'arrow')}<span style="flex:none">${esc(cityName(l.from_city_id))} to ${esc(cityName(l.to_city_id))}${l.date ? ', ' + esc(fmtDay(l.date)) : ''}</span>
    <select data-bind="legs.${i}.mode" aria-label="How you’ll travel"><option value="">How? Not sure yet</option>${S.C.edition.leg_modes.map(m => `<option value="${m.id}" ${l.mode === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>${info ? legInfo(l) : ''}</div>`).join('');
  return `<div id="staysEd" style="display:flex;flex-direction:column;gap:6px">${rows || '<p class="small muted">No stays yet.</p>'}
    <button class="btn line sm" data-act="stayadd" style="align-self:flex-start;margin-top:6px">+ Add another stay</button>
    ${legs ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><span class="label">${info ? 'Getting between places' : 'How you’ll travel'}</span>${legs}</div>` : ''}</div>`;
}
const modeIconName = m => ({ train: 'train', car: 'car', driver: 'car', taxi: 'taxi', bus: 'train', flight: 'arrow' }[m] || 'arrow');

export function arrivalFields() {
  const opts = sel => `<option value="">Not set</option>` + S.C.edition.arrival_options.map(o => `<option value="${o.id}" ${sel === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  return `<div class="fields"><label class="f">Arriving by<select data-bind="arrival.via">${opts(S.trip.arrival.via)}</select></label><label class="f">Leaving by<select data-bind="departure.via">${opts(S.trip.departure.via)}</select></label></div>
    <div class="fields"><label class="f">Arrival flight (optional)<input type="text" data-bind="arrival.flight" value="${esc(S.trip.arrival.flight)}" placeholder="e.g. EK 191" autocapitalize="characters"></label><label class="f">Departure flight (optional)<input type="text" data-bind="departure.flight" value="${esc(S.trip.departure.flight)}" placeholder="e.g. TP 1901" autocapitalize="characters"></label></div>`;
}

export function homeCurrencySelect(bind = 'home_currency') {
  const cur = S.trip.home_currency;
  const names = { EUR: 'Euro', USD: 'US dollar', GBP: 'British pound', AED: 'UAE dirham', CAD: 'Canadian dollar', AUD: 'Australian dollar', INR: 'Indian rupee', CHF: 'Swiss franc', SGD: 'Singapore dollar', JPY: 'Japanese yen' };
  return `<label class="f" style="flex:none">Your home currency<select data-bind="${bind}"><option value="">Choose…</option>${S.C.edition.home_currencies.map(c => `<option value="${c}" ${cur === c ? 'selected' : ''}>${esc(names[c] || c)} (${c})</option>`).join('')}</select></label>`;
}

/* ---------- clean theme pieces (Oct 12 2026). Used only when theme.js clean() is true. ---------- */
/* A trip-check line. Closed-day lines name the plan's real date, worked out from the calendar
   ("Accademia Gallery is closed Mondays. It’s in your plan for Mon, Oct 19."). */
export function checkText(c) {
  if (c.kind === 'closed') {
    const p = placeById(c.item_id);
    if (p && c.day) return `${p.name} is ${closedText(p).replace(/^Closed/, 'closed')}. It’s in your plan for ${fmtDay(c.day)}.`;
  }
  return c.text;
}
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
export const chev = (cls = 'chev') => CHEV.replace('<svg ', `<svg class="${cls}" `);
/* One soft badge for booking status plus urgency, always in words. */
export function statusBadge(p, booked) {
  if (booked) return '<span class="badge green">Booked ✓</span>';
  if (p.booking_status === 'required') return `<span class="badge red">${p.urgency_level === 'book_soon' ? 'Must book · Book soon' : 'Must book'}</span>`;
  if (p.booking_status === 'optional') return `<span class="badge amber">Booking optional${p.urgency_level === 'book_soon' ? ' · Book soon' : ''}</span>`;
  return '<span class="badge green">No ticket needed</span>';
}
/* Price for the card: the short official price, "Free" when no ticket is needed, or "Check when booking". */
export function cardPrice(p) {
  const s = priceShort(p.price);
  if (s) return esc(s);
  if (p.price && p.price.text) return esc(p.price.text);
  if (p.booking_status === 'none') return p.category === 'day_trip' ? '' : 'Free';
  return '<span class="muted">Check when booking</span>';
}
/* The card's one link: the official booking site when booking applies, else Directions, else Save. */
export function cardLink(p, booked) {
  const st = statusOf(S.trip, p.id);
  if (p.ticket_url && p.booking_status !== 'none' && !booked) return `<a class="pcard-go" href="${esc(p.ticket_url)}" target="_blank" rel="noopener">${esc(host(p.ticket_url) || 'Official tickets')} ↗</a>`;
  if (p.location) return `<a class="pcard-go" href="${esc(linkService.directions(p.location, 'walking'))}" target="_blank" rel="noopener">Directions</a>`;
  if (p.search_q) return `<a class="pcard-go" href="${esc(linkService.getyourguide(p.search_q))}" target="_blank" rel="noopener">Compare tours ↗</a>`;
  return `<button class="pcard-go" data-act="want" data-id="${p.id}" aria-pressed="${st === 'want'}">${st === 'want' ? '✓ Saved' : 'Save'}</button>`;
}
/* Affiliate links stay off (features.affiliate_links). When a program is approved, a second, quieter link
   with a visible disclosure goes here, never before the official link. */
function affiliateLink(p) { return ''; }
/* The four-part place card: title, one metadata line, one tip, one link. Tapping the card opens its detail sheet. */
export function placeCard(p) {
  const booked = isBooked(S.trip, p.id), st = statusOf(S.trip, p.id);
  const tip = tipsOf(p)[0] || p.lead_time || (p.category === 'day_trip' ? p.how : '') || p.description || '';
  const price = cardPrice(p), cl = closedText(p);
  return `<div class="pcard" id="pl-${p.id}"><button class="pcard-tap" data-act="spot" data-id="${p.id}" aria-label="${esc(p.name)}, details">
    <span class="pcard-top"><b>${esc(p.name)}</b>${chev()}</span>
    <span class="pmeta">${price ? `<span>${price}</span>` : ''}${statusBadge(p, booked)}${st === 'went' ? '<span class="badge gray">Went ✓</span>' : st === 'want' ? '<span class="badge gray">Saved</span>' : ''}${cl ? `<span class="closed-day" style="margin:0">${esc(cl)}</span>` : ''}</span>
    ${tip ? `<span class="tipbox">${esc(tip)}</span>` : ''}</button>
    ${cardLink(p, booked)}${affiliateLink(p)}</div>`;
}
export const placeCards = list => `<div class="pcards">${list.map(placeCard).join('')}</div>`;

export { today, placeById };
