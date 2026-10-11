/* Ask: one search box for quick answers (Oct 11 2026). Works offline: answers come from this edition's guide
   and the traveler's own trip. Money, taxi, help, home, phrases, bookings and opening days get answer cards;
   everything else is listed by best match. */
import { S, P, curCityId, cityOf, cityName, placeById, spot, homePoint, stayHere, myLang, today, itemInfo } from '../state.js';
import { esc, ic, ill, toast, $, fmtDay, fmtNum, KIND_NAME } from '../dom.js';
import { bookingLine } from '../components.js';
import { buildIndex, ask } from '../../models/finder.js';
import { closedText, closedOn, sortedBookings, itemsOn, weekdayOf, tripDays, localISO } from '../../models/schema.js';
import { phraseRow } from './phrases.js';
import { meetBlock } from './safety.js';
import { currencyService } from '../../services/currency-service.js';
import { fareService } from '../../services/fare-service.js';
import { linkService } from '../../services/link-service.js';

const A = { docs: null, timer: null, q: '' };
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const tel = n => 'tel:' + String(n).replace(/[^\d+]/g, '');

function layer() {
  let el = document.getElementById('ask');
  if (!el) { document.body.insertAdjacentHTML('beforeend', '<div class="driver" id="ask" role="dialog" aria-label="Ask" hidden></div>'); el = document.getElementById('ask'); }
  return el;
}
function suggestions() {
  const c = cityOf(curCityId());
  const s = ['Tipping', 'Taxi to the airport', '20 euros', 'Thank you', 'Bathroom', 'Pharmacy', 'Where is my hotel', 'Police'];
  if (c.currency_code !== 'EUR') s[2] = '20 ' + c.currency_code;
  return s;
}
export function openAsk(q = '') {
  A.docs = buildIndex({ C: S.C, trip: S.trip, lang: myLang() });
  const el = layer();
  el.innerHTML = `<div class="inner" style="gap:14px"><div class="askhead"><label class="askfield">${ic('search')}<span class="offscreen">Ask anything</span><input type="search" id="askq" enterkeyhint="search" autocomplete="off" placeholder="Ask anything" value="${esc(q)}"></label><button class="btn line sm" data-act="askclose">Close</button></div>
    <div id="askOut"></div></div>`;
  el.hidden = false;
  const inp = $('#askq'); setTimeout(() => { inp.focus(); }, 60);
  renderAnswers(q);
}
export function closeAsk() { const el = document.getElementById('ask'); if (el) el.hidden = true; }
export function askInput(v) { clearTimeout(A.timer); A.timer = setTimeout(() => renderAnswers(v), 140); }
export function askSet(q) { const inp = $('#askq'); if (inp) inp.value = q; renderAnswers(q); }

/* ---------- answer cards ---------- */
function card(title, body, icon = 'search', cls = '') { return `<div class="ans ${cls}">${ic(icon)}<div style="min-width:0;display:flex;flex-direction:column;gap:6px"><b>${title}</b>${body}</div></div>`; }

async function moneyCard(it) {
  const local = cityOf(curCityId()).currency_code, home = S.trip.home_currency || 'USD';
  let from = it.from || local, to = it.to || (from === local ? home : local);
  if (from === to) to = from === local ? home : local;
  if (from === to) return card(`${currencyService.symbol(from)}${fmtNum(it.amount)}`, '<p class="small muted" style="margin:0">Pick your home currency in Essentials to convert.</p>', 'convert');
  const r = await currencyService.getRate(from, to);
  if (!r) return card('No rate saved yet', '<p class="small muted" style="margin:0">Connect once to load today’s rate. After that it works offline.</p>', 'convert');
  const when = r.as_of ? ' (' + r.as_of + ')' : '';
  return card(`${currencyService.symbol(from)}${fmtNum(it.amount)} ≈ ${currencyService.symbol(to)}${fmtNum(it.amount * r.rate)}`,
    `<p class="small muted" style="margin:0">${r.manual ? 'Your own rate' : r.live ? 'Today’s reference rate' : 'Saved reference rate'}${esc(when)}. Your bank adds its own rate and fees, so treat it as a close estimate.</p>
     <button class="text-btn" data-act="askgo" data-tab="essentials" data-focus="#amtIn" style="min-height:32px;align-self:flex-start">Open the converter</button>`, 'convert');
}
function sosCard() {
  const ess = S.C.essentials;
  return card('Emergency: call 112', `<a class="btn sos" href="tel:112" style="min-height:48px;font-size:16px">Call 112</a>
    ${ess.emergency.filter(e => String(e.number).replace(/\D/g, '') !== '112').map(e => `<div class="numrow"><div><div class="n">${esc(e.number)}</div><div class="small muted">${esc(e.label)}</div></div><a class="btn line sm" href="${esc(tel(e.number))}">Call</a></div>`).join('')}
    <button class="btn line sm" data-act="askemergency" style="align-self:flex-start">Open the emergency card</button>`, 'sos', 'warn');
}
function homeCard() {
  const sy = stayHere();
  if (!sy || (!sy.label && !sy.address && !sy.neighborhood_id)) return card('Where you’re staying', '<p class="small muted" style="margin:0">Add your stay in Essentials (or import your hotel booking) and it shows here, ready for a driver.</p><button class="text-btn" data-act="askgo" data-tab="essentials" data-focus="#tripBlock" style="min-height:32px;align-self:flex-start">Add my stay</button>', 'home');
  const h = homePoint();
  return card(esc(sy.label || 'Where you’re staying'), `${sy.address ? `<div style="font-size:17px">${esc(sy.address)}</div>` : ''}<div class="small muted">${esc(h ? h.hood.name : '')}${sy.start ? ' · ' + esc(fmtDay(sy.start)) + (sy.end ? ' to ' + esc(fmtDay(sy.end)) : '') : ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="askhome">${ic('taxi', 'style="width:16px;height:16px"')}Show a driver</button>${h || sy.address ? `<a class="btn line sm" href="${esc(h ? linkService.directions(h, 'walking') : linkService.googleMaps({ name: sy.address }))}" target="_blank" rel="noopener">Directions ↗</a>` : ''}</div>`, 'home');
}
async function taxiCard(it) {
  const c = cityOf(curCityId()), tx = c.taxis || {};
  const dest = it.dest && it.dest.id ? spot(it.dest.id, it.dest.city_id || curCityId()) : null;
  const fromId = homePoint() ? '__home' : ((c.airports || [])[0] ? '__air:' + c.airports[0].id : '');
  const from = fromId ? spot(fromId) : null;
  let fare = '';
  if (dest && from && fromId !== it.dest.id) {
    const pt = s => Object.assign({}, s.location, s.airport_id ? { airport_id: s.airport_id } : {});
    const r = await fareService.estimate(pt(from), pt(dest), it.dest.city_id || curCityId());
    if (!r.err) fare = `<div style="font-family:var(--mono);font-size:24px">€${r.lo}${r.hi !== r.lo ? '–' + r.hi : ''}</div><p class="small muted" style="margin:0">${r.fixed ? 'Official flat fare' : 'Estimate from the official tariff'}, from ${esc(from.name)} to ${esc(dest.name)}. The meter decides.</p>`;
  }
  const how = (c.getting_around.items || []).find(i => /taxi/i.test(i.title));
  return card(dest ? `Taxi to ${esc(dest.name)}` : `Taxis in ${esc(cityName(c.city_id))}`, `${fare}
    ${tx.intro ? `<p class="small" style="margin:0">${tx.intro_bold ? '<b>' + esc(tx.intro_bold) + '</b> ' : ''}${esc(tx.intro)}</p>` : how ? `<p class="small" style="margin:0">${esc(how.text)}</p>` : ''}
    ${(tx.numbers || []).map(n => `<div class="numrow"><div><div class="n">${esc(n.number)}</div><div class="small muted">${esc(n.label)}</div></div><a class="btn line sm" href="${esc(tel(n.number))}">Call</a></div>`).join('')}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${dest ? `<button class="btn sm" data-act="askdriver" data-id="${esc(it.dest.id)}">Show the driver</button>` : ''}<button class="btn line sm" data-act="askgo" data-tab="essentials" data-focus="#fareBlock">Fare estimates</button></div>`, 'taxi');
}
function openCard(it) {
  const p = it.place;
  if (!p) {
    const iso = isoFor(it.day), list = S.C.places.filter(x => x.city_id === curCityId() && closedOn(x, iso));
    return card(`Closed on ${DAY_NAME[weekdayOf(iso)]}s in ${esc(cityName(curCityId()))}`, list.length ? `<p class="small" style="margin:0">${list.map(x => esc(x.name)).join(', ')}.</p>` : '<p class="small muted" style="margin:0">Nothing in this guide is marked closed that day. Check hours on the official sites.</p>', 'plan');
  }
  const hours = (p.tips || []).filter(t => /\b(open|closed|hours|\d{1,2}:\d{2}|last entry)\b/i.test(t));
  let verdict = '';
  if (it.day != null) {
    const iso = isoFor(it.day), dn = DAY_NAME[weekdayOf(iso)];
    verdict = (p.closed || []).length ? (closedOn(p, iso) ? `<b style="color:var(--coral-ink)">Closed on ${dn}.</b>` : `<b style="color:var(--green-ink)">Open on ${dn}</b> <span class="small muted">(this guide only knows its weekly closing days).</span>`) : '';
  }
  return card(esc(p.name), `${verdict ? `<p style="margin:0">${verdict}</p>` : ''}${closedText(p) ? `<p class="small" style="margin:0">${esc(closedText(p))}.</p>` : ''}${hours.map(h => `<p class="small" style="margin:0">${esc(h)}</p>`).join('')}
    ${!closedText(p) && !hours.length ? '<p class="small muted" style="margin:0">This guide has no opening days for it. Check the official site.</p>' : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${p.ticket_url ? `<a class="btn line sm" href="${esc(p.ticket_url)}" target="_blank" rel="noopener">Official site ↗</a>` : ''}<button class="btn line sm" data-act="askspot" data-id="${esc(p.id)}">More</button></div>`, 'plan');
}
const isoFor = d => { if (d == null || d === -1) return today(); if (d === -2) { const x = new Date(); x.setDate(x.getDate() + 1); return localISO(x); } const x = new Date(); x.setDate(x.getDate() + ((d - x.getDay() + 7) % 7)); return localISO(x); };
function bookingsCard() {
  const bs = sortedBookings(S.trip).filter(b => !b.date || (b.end_date || b.date) >= today());
  return card('Your bookings', bs.length ? `<div>${bs.slice(0, 6).map(b => bookingLine(b, 'start', { day: true, ref: true })).join('')}</div>` : '<p class="small muted" style="margin:0">No bookings saved yet. Import a confirmation email in Essentials.</p>', 'ticket') ;
}
function planCard() {
  const d = today(), items = tripDays(S.trip).includes(d) ? itemsOn(S.trip, d) : [];
  return card('Today', items.length ? items.map(v => `<div class="small"><b style="font-family:var(--mono);font-weight:500">${esc(v.time || 'Anytime')}</b> · ${esc(itemInfo(v.item_id).name)}</div>`).join('') : '<p class="small muted" style="margin:0">Nothing planned for today.</p>', 'plan');
}

/* ---------- matches ---------- */
function hitRow(h) {
  if (h.kind === 'place') { const p = h.place; return `<button class="near" data-act="askspot" data-id="${esc(p.id)}">${ill(p.kind, 40)}<span style="min-width:0"><b style="display:block;font-size:15px">${esc(p.name)}</b><span class="small muted">${esc(KIND_NAME[p.kind] || '')}${p.area ? ' · ' + esc(p.area) : ''}${closedText(p) ? ' · ' + esc(closedText(p)) : ''}</span></span><span class="d">${esc(cityName(p.city_id))}</span></button>`; }
  if (h.kind === 'phrase') return phraseRow(findPhrase(h.id));
  if (h.kind === 'number') return `<div class="numrow"><div><div class="n">${esc(h.number)}</div><div class="small muted">${esc(h.title)}</div></div><a class="btn line sm" href="${esc(tel(h.number))}">Call</a></div>`;
  if (h.kind === 'booking') return bookingLine(h.booking, 'start', { day: true, ref: true, edit: true });
  if (h.kind === 'journal') return `<div class="ansrow"><b>${esc(h.title)}</b><p class="small muted" style="margin:0">${esc(h.text.slice(0, 160))}</p></div>`;
  return `<div class="ansrow"><b>${esc(h.title)}</b><p class="small" style="margin:0">${esc(h.text)}</p>${h.link ? `<a class="small" href="${esc(h.link.url)}" target="_blank" rel="noopener">${esc(h.link.label)} ↗</a>` : ''}</div>`;
}
function findPhrase(key) { for (const list of Object.values(S.C.phrases.situations)) { const e = list.find(x => (x.t || x[0]) === key); if (e) return e; } return [key, '', '']; }
const GROUPS = [['tip', 'Good to know'], ['phrase', 'Say it'], ['place', 'Places'], ['spot', 'Getting there'], ['number', 'Numbers'], ['booking', 'Your bookings'], ['journal', 'Your journal']];

async function renderAnswers(q) {
  const out = $('#askOut'); if (!out) return;
  A.q = q = String(q || '').trim();
  if (!q) {
    out.innerHTML = `<div class="chips" style="flex-wrap:wrap;margin:0;padding:0;overflow:visible">${suggestions().map(s => `<button class="chip" data-act="askq" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <p class="small faint">Type a question or a few words. Answers come from this guide and your own trip, and work with no signal.</p>`;
    return;
  }
  const { intents, hits } = ask(q, A.docs);
  const cards = [];
  for (const it of intents) {
    if (it.type === 'money') cards.push(await moneyCard(it));
    else if (it.type === 'sos') cards.push(sosCard());
    else if (it.type === 'home') cards.push(homeCard());
    else if (it.type === 'taxi') cards.push(await taxiCard(it));
    else if (it.type === 'open') cards.push(openCard(it));
    else if (it.type === 'bookings') cards.push(bookingsCard());
    else if (it.type === 'plan') cards.push(planCard());
    else if (it.type === 'near') cards.push(card('What’s near you', '<button class="btn sm" data-act="asknear" style="align-self:flex-start">Open Near me</button>', 'compass'));
    else if (it.type === 'meet') cards.push(meetBlock() || card('Meet back somewhere', '<p class="small muted" style="margin:0">Open a place, or Near me, and tap “Meet back here”.</p><button class="btn line sm" data-act="asknear" style="align-self:flex-start">Open Near me</button>', 'pin'));
  }
  if (A.q !== q) return;                                   // a newer question arrived while we waited
  const said = intents.find(i => i.type === 'say');
  let html = cards.join('');
  if (said) { const ph = hits.filter(h => h.kind === 'phrase').slice(0, 4); if (ph.length) html += `<div class="ansgroup"><div class="label">Say it</div>${ph.map(hitRow).join('')}</div>`; }
  const shown = new Set(said ? hits.filter(h => h.kind === 'phrase').slice(0, 4).map(h => h.id) : []);
  const top = hits.filter(h => !shown.has(h.id)).slice(0, 14);
  const best = k => Math.max(0, ...top.filter(h => h.kind === k).map(h => h.score));
  GROUPS.slice().sort((x, y) => best(y[0]) - best(x[0])).forEach(([k, label]) => { const g = top.filter(h => h.kind === k).slice(0, k === 'place' ? 6 : 4); if (g.length) html += `<div class="ansgroup"><div class="label">${label}</div>${g.map(hitRow).join('')}</div>`; });
  if (!html) {
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    html = `<p class="serif" style="font-size:18px">Nothing in this guide matches “${esc(q)}”.</p><p class="small muted">Try fewer words, like “taxi”, “tip” or a place name.</p>
      ${online ? `<a class="btn line sm" href="${esc(linkService.web(q + ' ' + cityOf(curCityId()).name))}" target="_blank" rel="noopener" style="align-self:flex-start">Search the web ↗</a>` : '<p class="small muted">You’re offline, so searching the web will work when you have signal.</p>'}`;
  }
  out.innerHTML = html;
}
export const askAnswerFor = q => ask(q, buildIndex({ C: S.C, trip: S.trip, lang: myLang() }));   // for testing
