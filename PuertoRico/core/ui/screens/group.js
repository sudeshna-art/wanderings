/* Your group (Oct 12 2026, every edition): who's traveling, food notes, special occasions, the "Show your server"
   card, drivers and rides listed by official sources, and the traveler's own trusted drivers.
   Everything the traveler enters stays in her trip on this phone. */
import { S, P, save, curCityId, cityOf, cityName, myLang, today } from '../state.js?v=202610121603';
import { esc, ic, toast, $, fmtDay } from '../dom.js?v=202610121603';
import { FOOD_PREFS, FOOD_ALLERGIES, OCCASIONS, occasionLabel, newOccasion, newDriver, hasFoodNotes, localISO } from '../../models/schema.js?v=202610121603';
import { phraseFor, speaksLocal, tripDays } from '../../models/schema.js?v=202610121603';
import { peopleEditor, shareButton, groupNote } from './together.js?v=202610121603';

const chip = (act, k, label, on) => `<button class="chip" data-act="${act}" data-k="${esc(k)}" aria-pressed="${!!on}">${esc(label)}</button>`;

/* ---------- who's traveling and food notes (welcome step 3 and Essentials) ---------- */
export function groupEditor() {
  const pt = S.trip.party, fd = S.trip.food;
  return `<div id="groupEd" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;flex-direction:column;gap:8px"><span class="label">Kids traveling?</span>
      <div class="chips wrap" role="group" aria-label="Kids traveling">${chip('partykids', 'yes', 'Yes', pt.kids === 'yes')}${chip('partykids', 'no', 'No', pt.kids === 'no')}</div>
      ${pt.kids === 'yes' ? `<label class="f" style="flex:none">Ages (optional)<input type="text" inputmode="numeric" data-bind="party.kid_ages" value="${esc(pt.kid_ages)}" placeholder="e.g. 9, 15"></label>` : ''}</div>
    <div style="display:flex;flex-direction:column;gap:8px"><span class="label">Walking</span>
      <div class="chips wrap" role="group" aria-label="Walking">${chip('partyeasy', 'yes', 'Someone needs easy walking', pt.easy_walk === 'yes')}</div>
      <p class="small muted" style="margin:0">Short walks, places to sit, restrooms nearby, nothing steep. Places gets a filter, and steep or long walks are flagged.</p></div>
    <div style="display:flex;flex-direction:column;gap:8px"><span class="label">Food notes</span>
      <div class="chips wrap" role="group" aria-label="What we eat">${FOOD_PREFS.map(([k, l]) => chip('foodpref', k, l, fd.prefs.includes(k))).join('')}</div>
      <span class="small muted">Allergies</span>
      <div class="chips wrap" role="group" aria-label="Allergies">${FOOD_ALLERGIES.map(([k, l]) => chip('foodallergy', k, l, fd.allergies.includes(k))).join('')}</div>
      <label class="f" style="flex:none">Anything else (optional)<input type="text" data-bind="food.other" value="${esc(fd.other)}" placeholder="e.g. one of us is a picky eater"></label>
      <p class="small muted" style="margin:0">Places with lots of seafood or pork get a note, and Phrases gets a card in ${esc(S.C.phrases.language_name)} to show your server. Food notes stay on this phone.</p></div>
  </div>`;
}
export const refreshGroup = () => { const el = $('#groupEd'); if (el && el.isConnected) try { el.outerHTML = groupEditor(); } catch (e) {} };
export function togglePartyKids(v) { S.trip.party.kids = S.trip.party.kids === v ? '' : v; save(); refreshGroup(); }
export function togglePartyEasy() { S.trip.party.easy_walk = S.trip.party.easy_walk === 'yes' ? '' : 'yes'; save(); refreshGroup(); }
export function toggleFood(list, k) {
  const a = S.trip.food[list], i = a.indexOf(k);
  if (i >= 0) a.splice(i, 1); else a.push(k);
  if (list === 'allergies' && k === 'seafood' && i < 0) S.trip.food.allergies = a.filter(x => x !== 'shellfish');   /* fish and shellfish covers shellfish */
  if (list === 'allergies' && k === 'shellfish' && i < 0) S.trip.food.allergies = a.filter(x => x !== 'seafood');
  save(); refreshGroup();
}

/* ---------- special occasions ---------- */
export function occasionsEditor() {
  const days = tripDays(S.trip);
  const rows = S.trip.occasions.map((o, i) => `<div class="fields" style="align-items:flex-end"><label class="f">What<select data-bind="occasions.${i}.what">${OCCASIONS.map(([k, l]) => `<option value="${k}" ${o.what === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <label class="f">Date<input type="date" data-bind="occasions.${i}.date" value="${esc(o.date)}" ${days[0] ? `min="${days[0]}" max="${days[days.length - 1]}"` : ''}></label>
    <button class="text-btn" data-act="occdel" data-id="${o.id}" style="min-height:44px">Remove</button></div>`).join('');
  return `<div id="occEd" style="display:flex;flex-direction:column;gap:8px"><span class="label">Any special occasion on this trip?</span>
    ${rows || '<p class="small muted" style="margin:0">A birthday, an anniversary, New Year’s Eve… Add it and Today reminds you to book the table and the ride home early.</p>'}
    <button class="btn line sm" data-act="occadd" style="align-self:flex-start">${ic('plus', 'style="width:16px;height:16px"')}Add an occasion</button></div>`;
}
export const refreshOccasions = () => { const el = $('#occEd'); if (el && el.isConnected) try { el.outerHTML = occasionsEditor(); } catch (e) {} };   /* the field may be mid-blur */
export function addOccasion() {
  const d = tripDays(S.trip), nye = d.find(x => x.endsWith('-12-31'));
  S.trip.occasions.push(newOccasion(nye && !S.trip.occasions.some(o => o.what === 'nye') ? 'nye' : 'birthday', nye && !S.trip.occasions.some(o => o.what === 'nye') ? nye : ''));
  save(); refreshOccasions();
}
export function removeOccasion(id) { S.trip.occasions = S.trip.occasions.filter(o => o.id !== id); save(); refreshOccasions(); }
/* Occasions coming up in the next two weeks (or before the trip), for Today. */
export function occasionReminders() {
  const t = today(), soon = new Date(t + 'T00:00:00'); soon.setDate(soon.getDate() + 14);
  const lim = localISO(soon);
  return S.trip.occasions.filter(o => o.date && o.date >= t && o.date <= lim).sort((a, b) => a.date.localeCompare(b.date));
}
export function occasionAlert() {
  const list = occasionReminders(); if (!list.length) return '';
  return list.map(o => {
    const days = Math.round((new Date(o.date + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
    const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : fmtDay(o.date);
    return `<div class="alert">${ic('star')}<div style="min-width:0;display:flex;flex-direction:column;gap:4px"><b>${esc(occasionLabel(o.what))} · ${esc(when)}</b>
      <p class="small" style="margin:0">${days <= 1 ? 'Have the table and the ride home confirmed?' : 'Book the table and the ride home now. Busy nights fill up early.'}</p>
      <button class="text-btn" data-act="bkadd" style="min-height:32px;align-self:flex-start">Add the booking</button></div></div>`;
  }).join('');
}

/* ---------- "Show your server": the traveler's food notes in the local language ---------- */
export function showServerCard() {
  const card = S.C.phrases.food_card, fd = S.trip.food, lang = myLang();
  if (!card) { toast('No server card for this guide yet'); return; }
  const keys = fd.prefs.concat(fd.allergies).filter(k => card.items[k]);
  const fish = fd.allergies.includes('seafood') || fd.allergies.includes('shellfish');
  const v = e => phraseFor(e, lang), local = speaksLocal(lang, S.C.phrases.language);
  const line = e => `<div style="display:flex;flex-direction:column;gap:2px"><div class="big-it" style="font-size:24px;line-height:1.25">${esc(v(e).t)}</div>${local ? '' : `<div class="small muted">${esc(v(e).m)}</div>`}</div>`;
  const d = $('#driver');
  d.innerHTML = `<div class="inner"><div class="label">${esc(card.title || 'Show your server')}</div>
    ${keys.length ? line(card.intro) + keys.map(k => line(card.items[k])).join('') + (fish && card.fryer ? line(card.fryer) : '') + line(card.closing)
      : `<p class="small">Add your food notes first (Essentials, Your group) and they appear here in ${esc(S.C.phrases.language_name)}.</p>`}
    ${fd.other ? `<p class="small muted">Your note “${esc(fd.other)}” isn’t translated. Point to the closest line above.</p>` : ''}
    <p class="small muted">A card to help you ask, not a guarantee. With a serious allergy, ask every time and carry your medicine.</p>
    <div style="display:flex;gap:8px;margin-top:auto">${keys.length ? `<button class="btn" data-act="say" data-text="${esc([card.intro].concat(keys.map(k => card.items[k]), fish && card.fryer ? [card.fryer] : [], [card.closing]).map(e => phraseFor(e, 'en').t).join(' '))}" style="flex:1">${ic('speak', 'style="width:18px;height:18px"')}Play aloud</button>` : ''}<button class="btn line" data-act="closedriver" style="flex:1">Close</button></div></div>`;
  d.hidden = false;
}
export const serverButton = (cls = 'btn line sm') => S.C.phrases.food_card && hasFoodNotes(S.trip) ? `<button class="${cls}" data-act="servercard" style="align-self:flex-start">${ic('food', 'style="width:16px;height:16px"')}Show your server</button>` : '';

/* Essentials: the group block */
export function groupBlock() {
  const ph = S.C.phrases;
  return `<div class="block" id="groupBlock" tabindex="-1"><h2>Your group</h2>${peopleEditor()}${shareButton()}${groupNote()}<div style="height:6px"></div>${groupEditor()}${serverButton()}
    <div style="padding-top:8px">${occasionsEditor()}</div>
    <div style="display:flex;flex-direction:column;gap:6px;padding-top:8px"><span class="label">Phrases tab</span>
      <div class="chips wrap" role="group" aria-label="Phrases tab">${chip('hidephrases', 'show', 'Show Phrases', !P().hidePhrases)}${chip('hidephrases', 'hide', 'Hide Phrases', !!P().hidePhrases)}</div>
      <p class="small muted" style="margin:0">Already speak ${esc(ph.language_name)}? Hide the tab to keep the app simple. You can bring it back here anytime.</p></div></div>`;
}

/* ---------- drivers and rides ---------- */
const digits = n => String(n || '').replace(/[^\d+]/g, '');
const wa = n => 'https://wa.me/' + digits(n).replace(/^\+/, '');
const telHref = n => 'tel:' + digits(n);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
/* Listed by official or licensed sources (cities.json "rides"). Never "recommended by Wanderings". */
export function ridesBlock(c = cityOf(curCityId())) {
  const r = c.rides; if (!r) return myDriversBlock();
  const item = x => `<div class="ride"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div style="min-width:0"><b>${esc(x.name)}</b>${x.what ? `<div class="small">${esc(x.what)}</div>` : ''}${x.area ? `<div class="small muted">${esc(x.area)}</div>` : ''}</div>${x.book_ahead ? '<span class="badge amber" style="flex:none">Book ahead</span>' : ''}</div>
    ${x.note ? `<div class="tipbox">${esc(x.note)}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${x.phone ? `<a class="btn line sm" href="${esc(telHref(x.phone))}">${ic('phone', 'style="width:16px;height:16px"')}${esc(x.phone)}</a>` : ''}${x.whatsapp ? `<a class="btn line sm" href="${esc(wa(x.whatsapp))}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ''}${x.url ? `<a class="btn line sm" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(host(x.url))} ↗</a>` : ''}</div>
    <p class="small faint" style="margin:0">Listed by ${x.source_url ? `<a href="${esc(x.source_url)}" target="_blank" rel="noopener">${esc(x.listed_by)}</a>` : esc(x.listed_by)}${x.checked ? ', checked ' + esc(new Date(x.checked + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : ''}.</p></div>`;
  const stt = r.status || null;   /* e.g. { badge: 'Still being verified', note } while the list is being built (Oct 12 2026) */
  return `<div class="block" id="ridesBlock" tabindex="-1"><div class="head"><h2>${esc(r.title || 'Drivers and rides')}</h2>${stt && stt.badge ? `<span class="badge amber">${esc(stt.badge)}</span>` : ''}</div>
    ${stt && stt.note ? `<div class="tipbox"><b>${esc(stt.title || 'In progress')}:</b> ${esc(stt.note)}</div>` : ''}
    ${r.intro ? `<p class="small">${esc(r.intro)}</p>` : ''}
    <div style="display:flex;flex-direction:column;gap:14px">${(r.items || []).map(item).join('')}</div>
    ${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ''}
    <button class="btn line sm" data-act="bkadd" style="align-self:flex-start">${ic('ticket', 'style="width:16px;height:16px"')}Save a ride you booked</button></div>${myDriversBlock()}`;
}
export function myDriversBlock() {
  const list = S.trip.drivers;
  return `<div class="block" id="myDrivers" tabindex="-1"><h2>My drivers</h2>
    <p class="small muted">Drivers you or your friends trust. Saved on this phone only, never shared.</p>
    ${list.map(d => `<div class="numrow"><div style="min-width:0"><div style="font-weight:600">${esc(d.name || 'Driver')}</div><div class="small muted">${esc([d.phone, d.area].filter(Boolean).join(' · '))}</div>${d.note ? `<div class="small muted">${esc(d.note)}</div>` : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${d.phone ? `<a class="btn line sm" href="${esc(telHref(d.phone))}">Call</a>` : ''}${d.whatsapp || d.phone ? `<a class="btn line sm" href="${esc(wa(d.whatsapp || d.phone))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button class="text-btn" data-act="drvedit" data-id="${d.id}" style="min-height:36px">Edit</button></div></div>`).join('')}
    <div id="drvForm" hidden></div>
    <button class="btn line sm" data-act="drvedit" style="align-self:flex-start">${ic('plus', 'style="width:16px;height:16px"')}Add a driver</button></div>`;
}
export function driverForm(id) {
  const d = S.trip.drivers.find(x => x.id === id) || newDriver();
  const box = $('#drvForm'); if (!box) return;
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;padding:10px 0" data-drv="${d.id}">
    <div class="fields"><label class="f">Name<input type="text" id="dvName" value="${esc(d.name)}" placeholder="e.g. Carlos (Laura’s cousin)"></label><label class="f">Phone<input type="tel" id="dvPhone" value="${esc(d.phone)}" placeholder="+1 787 …"></label></div>
    <div class="fields"><label class="f">WhatsApp, if different<input type="tel" id="dvWa" value="${esc(d.whatsapp)}" placeholder="Optional"></label><label class="f">Area<input type="text" id="dvArea" value="${esc(d.area)}" placeholder="e.g. San Juan, El Yunque"></label></div>
    <label class="f" style="flex:none">Note<input type="text" id="dvNote" value="${esc(d.note)}" placeholder="e.g. van for 7, quoted $X for the day"></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="drvsave" data-id="${d.id}">Save driver</button><button class="btn line sm" data-act="drvcancel">Cancel</button>${S.trip.drivers.some(x => x.id === d.id) ? `<button class="text-btn" data-act="drvdel" data-id="${d.id}" style="margin-left:auto;color:var(--coral-ink)">Delete</button>` : ''}</div></div>`;
  setTimeout(() => { const n = $('#dvName'); if (n) n.focus(); }, 50);
}
export function driverSave(id) {
  const v = k => (($(k) || {}).value || '').trim();
  const d = { id, name: v('#dvName'), phone: v('#dvPhone'), whatsapp: v('#dvWa'), area: v('#dvArea'), note: v('#dvNote') };
  if (!d.name && !d.phone) { toast('Add a name or a number'); return false; }
  const i = S.trip.drivers.findIndex(x => x.id === id);
  if (i >= 0) S.trip.drivers[i] = d; else S.trip.drivers.push(d);
  save(); toast('Saved on this phone'); return true;
}
export function driverDelete(el) {
  if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again to delete'; return false; }
  S.trip.drivers = S.trip.drivers.filter(x => x.id !== el.dataset.id); save(); toast('Deleted'); return true;
}
export { cityName };
