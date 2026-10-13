/* Wanderings app shell: boot, tabs, taps and form binding. All outside access goes through services. */
import { CONFIG } from '../config/default-config.js?v=202610121715';
import { S, P, save, copyOf, myLang, curCityId, cityIds, cityName, placeById, isPlanner, isWanderer, runMounts, runCleanups, today } from './state.js?v=202610121715';
import { $, $$, esc, ic, toast } from './dom.js?v=202610121715';
import { staysEditor } from './components.js?v=202610121715';
import { contentService } from '../services/content-service.js?v=202610121715';
import { tripService } from '../services/trip-service.js?v=202610121715';
import { storageService } from '../services/storage-service.js?v=202610121715';
import { shareService } from '../services/share-service.js?v=202610121715';
import { speechService } from '../services/speech-service.js?v=202610121715';
import { currencyService } from '../services/currency-service.js?v=202610121715';
import { newStay, syncLegs, setStatus, statusOf, setBooked, isBooked, addToDay, removeFromPlan, moveItem, planOf, tripDays, sortedStays } from '../models/schema.js?v=202610121715';
import { renderToday, showSlide, startSlides, stopSlides } from './screens/today.js?v=202610121715';
import { renderPlaces, defaultView, addCustomPlace } from './screens/places.js?v=202610121715';
import { openSched, openAddSheet, closeSheet, setSheetDay, sheetDay, openAddStop, pickSheetWho, pickSchedWho, sheetWhoSel, schedWhoSel } from './screens/plan.js?v=202610121715';
import { addPerson, removePerson, refreshPeople, shareGroup, checkJoin, cancelJoin, applyJoin } from './screens/together.js?v=202610121715';
import { openSpot, recenter, refreshWanderer, wanderPos } from './screens/wanderer.js?v=202610121715';
import { renderPhrases, say, showDriver, setQuery } from './screens/phrases.js?v=202610121715';
import { renderJournal, J, saveEntry, deletePhoto, backupText, summaryText, consentMany, consentOne, allPhotoIds, sharePhotos, openViewer } from './screens/journal.js?v=202610121715';
import { renderEssentials, showFare, updateConv, loadRate } from './screens/essentials.js?v=202610121715';
import { renderWelcome, W, STEP_COUNT } from './screens/welcome.js?v=202610121715';
import { downloadPack, downloadAll, removePack, autoSaveMaps } from './screens/offline.js?v=202610121715';
import { openImport, importFind, importFile, importBack, importSave, openEditor, editorSave, editorDelete, changeKind } from './screens/bookings.js?v=202610121715';
import { showEmergency, sharePlan, meetForm, meetSave, meetShare } from './screens/safety.js?v=202610121715';
import { openAsk, closeAsk, askInput, askSet } from './screens/ask.js?v=202610121715';
import { applyTheme, clean } from './theme.js?v=202610121715';
import { openCover } from './screens/today.js?v=202610121715';
import { togglePartyKids, togglePartyEasy, toggleFood, addOccasion, removeOccasion, refreshOccasions, showServerCard, driverForm, driverSave, driverDelete } from './screens/group.js?v=202610121715';
import { stayHere, curCity } from './state.js?v=202610121715';

const TABS = [['today', 'Today'], ['places', 'Places'], ['phrases', 'Phrases'], ['journal', 'Journal'], ['essentials', 'Essentials']];
const RENDER = { today: renderToday, places: renderPlaces, phrases: renderPhrases, journal: renderJournal, essentials: renderEssentials };

/* The Phrases tab can be hidden by travelers who speak the local language (Oct 12 2026). */
const shownTabs = () => TABS.filter(([k]) => !(k === 'phrases' && P().hidePhrases));
function renderTabs() {
  $('#tabbar').innerHTML = shownTabs().map(([k, l]) => {
    const label = k === 'places' ? (isPlanner() ? 'Plan' : isWanderer() ? 'Nearby' : 'Places') : l;
    const icon = k === 'places' ? (isPlanner() ? 'plan' : isWanderer() ? 'compass' : 'places') : k;
    return `<button role="tab" data-act="go" data-tab="${k}" data-fromtab="1" id="tab-${k}" aria-selected="${P().tab === k}">${ic(icon)}<span>${label}</span></button>`;
  }).join('');
}
function render(k = P().tab, keepScroll = false) {
  const y = window.scrollY;
  if (clean()) { const c = curCity(); document.documentElement.style.setProperty('--city-tint', (c.brand && c.brand.tint) || ''); }
  runCleanups();
  if (k !== 'today') stopSlides();
  RENDER[k]();
  runMounts();
  if (keepScroll) window.scrollTo(0, y);
}
function go(k, opts = {}) {
  P().tab = k; save();
  TABS.forEach(([t]) => { document.querySelector(`section[data-tab="${t}"]`).hidden = t !== k; const b = $('#tab-' + t); if (b) b.setAttribute('aria-selected', t === k); });
  render(k); window.scrollTo(0, 0);
  if (opts.focus) { const el = $(opts.focus); if (el) setTimeout(() => { el.focus(); el.scrollIntoView({ block: 'center' }); }, 80); }
}
const rerender = () => render(P().tab, true);
/* After the trip changes from a full-screen layer (import, bookings): refresh what's underneath. */
function afterTripChange() { syncLegs(S.trip); if (!$('#welcome').hidden) renderWelcome(); rerender(); }

/* ---------- visits ---------- */
function openNoteForm(id) {
  $$('[data-noteform]').forEach(el => { el.hidden = true; el.innerHTML = ''; });
  const box = document.querySelector(`[data-noteform="${id}"]`); if (!box) return quickVisit(id);
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><label class="f" style="flex:none">A quick note (optional). Tap the keyboard mic to talk.<textarea id="nf-${id}" style="min-height:80px" placeholder="What was it like?"></textarea></label>
    <div class="fields" style="align-items:flex-end"><label class="f" style="flex:0 1 150px">Rating<select id="ns-${id}"><option value="0">No rating</option><option value="5">Loved it</option><option value="4">Really good</option><option value="3">Fine</option><option value="2">Skip it</option></select></label>
    <button class="btn" data-act="savevisit" data-id="${id}">Save visit</button><button class="btn line" data-act="cancelvisit" data-id="${id}">Cancel</button></div></div>`;
  setTimeout(() => { const t = $('#nf-' + id); if (t) t.focus(); }, 50);
}
function recordVisit(id, txt = '', stars = 0) {
  const p = placeById(id); if (!p) return;
  setStatus(S.trip, id, 'went');
  if (isPlanner() && !planOf(S.trip, id) && tripDays(S.trip).includes(today())) addToDay(S.trip, id, today(), '');
  S.trip.journal.push({ id: Date.now().toString(36), d: Date.now(), txt: txt || `Visited ${p.name}.`, place_id: id, place: p.name, city_id: p.city_id, stars, visit: true });
  save(); toast('Saved to your journal');
}
const quickVisit = id => { recordVisit(id); rerender(); };

/* ---------- taps ---------- */
const A = {
  go: el => { if (el.dataset.tab === 'places' && el.dataset.fromtab) P().pview = defaultView(); if (el.dataset.tab === 'phrases' && P().hidePhrases) { P().hidePhrases = false; save(); renderTabs(); } go(el.dataset.tab, { focus: el.dataset.focus }); },
  pview: el => { P().pview = el.dataset.v; save(); if (el.dataset.tab && P().tab !== el.dataset.tab) go(el.dataset.tab); else render('places'); if (P().tab === 'places') window.scrollTo(0, 0); },
  city: el => { P().city = el.dataset.id; save(); rerender(); },
  cityauto: () => { P().city = ''; save(); rerender(); },
  say: el => say(el.dataset.text),
  audio: async el => {
    const p = placeById(el.dataset.id); if (!p || !p.audio) return;
    const l = CONFIG.languages.find(x => x.code === myLang()) || CONFIG.languages[0];
    const r = await speechService.playStop(p.audio, l.code, l.voice);
    if (!r.ok) toast('Audio isn’t available on this phone right now');
    else if (r.fellBack) toast(`No ${l.label} voice on this phone, so this story plays in English.`);
  },
  want: el => { const id = el.dataset.id; setStatus(S.trip, id, statusOf(S.trip, id) === 'want' ? null : 'want'); save(); const now = statusOf(S.trip, id) === 'want'; if (!$('#sheet').hidden) { openSpot(id); rerenderBehindSheet(); return; } rerender(); if (isPlanner() && now && !planOf(S.trip, id)) openAddSheet(id); },
  went: el => openNoteForm(el.dataset.id),
  savevisit: el => { const id = el.dataset.id; recordVisit(id, ($('#nf-' + id) || {}).value ? $('#nf-' + id).value.trim() : '', +(($('#ns-' + id) || {}).value || 0)); rerender(); },
  cancelvisit: el => { const b = document.querySelector(`[data-noteform="${el.dataset.id}"]`); if (b) { b.hidden = true; b.innerHTML = ''; } },
  unwent: el => { setStatus(S.trip, el.dataset.id, null); save(); rerender(); toast('Visit removed. Journal notes are kept.'); },
  spotwent: el => { recordVisit(el.dataset.id); openSpot(el.dataset.id); rerenderBehindSheet(); },
  spot: el => openSpot(el.dataset.id),
  recenter: () => recenter(),
  booked: el => { setBooked(S.trip, el.dataset.id, el.checked); save(); toast(el.checked ? 'Marked as booked' : 'Unmarked'); setTimeout(rerender, 350); },
  sched: el => openSched(el.dataset.id),
  savesched: el => { const id = el.dataset.id, dt = $('#sd-' + id).value, tm = $('#st-' + id).value; if (!dt) { toast('Pick a day first'); return; } addToDay(S.trip, id, dt, tm, schedWhoSel()); save(); toast('Saved to your plan'); rerender(); },
  cancelsched: el => { const b = document.querySelector(`[data-schedform="${el.dataset.id}"]`); if (b) { b.hidden = true; b.innerHTML = ''; } },
  unsched: el => { removeFromPlan(S.trip, el.dataset.id); save(); toast('Removed from plan'); rerender(); },
  move: el => { moveItem(S.trip, el.dataset.id, +el.dataset.dir); save(); rerender(); setTimeout(() => openSched(el.dataset.id), 0); },
  addsheet: el => openAddSheet(el.dataset.id),
  pickday: el => setSheetDay(el.dataset.v),
  sheetadd: el => { const d = sheetDay(); if (!d) { toast('Pick a day'); return; } addToDay(S.trip, el.dataset.id, d, ($('#sheetTime') || {}).value || '', sheetWhoSel()); P().pday = d; save(); closeSheet(); toast('Added to your plan'); rerender(); },
  sheetclose: () => { closeSheet(); },
  sheetstays: () => { closeSheet(); go('essentials', { focus: '#tripBlock' }); },
  addstop: el => openAddStop(el.dataset.day),
  addstopsave: el => { addToDay(S.trip, $('#asWhat').value, el.dataset.day, $('#asTime').value || ''); save(); toast('Added'); rerender(); },
  addstopcancel: () => { const b = document.querySelector('[data-addstopform]'); if (b) { b.hidden = true; b.innerHTML = ''; } },
  pday: el => { P().pday = el.dataset.v; save(); render('places', true); },
  pmode: el => { P().pmode = el.dataset.v; save(); render('places', true); },
  pfilter: el => { P().pfilter = el.dataset.v; save(); render('places', true); },
  addplace: () => { if (addCustomPlace()) rerender(); },
  ptab: el => { P().ptab = el.dataset.v; setQuery(''); save(); render('phrases', true); },
  ptabgo: el => { P().ptab = el.dataset.v; setQuery(''); if (P().hidePhrases) { P().hidePhrases = false; save(); renderTabs(); } go('phrases'); },
  fav: el => { const t = el.dataset.text, i = S.trip.favs.indexOf(t); i >= 0 ? S.trip.favs.splice(i, 1) : S.trip.favs.push(t); save(); el.setAttribute('aria-pressed', i < 0); if (P().ptab === 'Favorites') render('phrases', true); },
  driver: () => showDriver(),
  homedriver: () => showDriver('__home'),
  closedriver: () => { $('#driver').hidden = true; },
  dismissinstall: () => { P().installTipDone = true; save(); rerender(); },
  welcome: el => { W.step = Math.min(+el.dataset.step || 1, STEP_COUNT); renderWelcome(); },
  wnext: () => { W.step = Math.min(STEP_COUNT, W.step + 1); renderWelcome(); $('#welcome').scrollTo(0, 0); },
  wback: () => { W.step = Math.max(1, W.step - 1); renderWelcome(); },
  wdone: () => { S.trip.onboarded = true; syncLegs(S.trip); P().pview = defaultView(); save(); $('#welcome').hidden = true; renderTabs(); go(P().tab); },
  stayadd: () => { const last = sortedStays(S.trip).slice(-1)[0]; const ns = newStay(last && last.city_id === cityIds()[0] ? (cityIds()[1] || cityIds()[0]) : cityIds()[0]); if (last && last.end) ns.start = last.end; S.trip.stays.push(ns); syncLegs(S.trip); save(); refreshStays(); },
  staydel: el => { S.trip.stays.splice(+el.dataset.i, 1); syncLegs(S.trip); save(); refreshStays(); },
  slideto: el => { showSlide(+el.dataset.i); startSlides(); },
  slideshow: () => { P().coverMode = 'slides'; save(); toast('Slideshow on. The sketch opens the show.'); render('today', true); if (clean() && !$('#sheet').hidden) openCover(); },
  uncover: () => { P().cover = null; P().coverMode = 'sketch'; save(); $('#viewer').hidden = true; toast('Back to the sketch'); rerender(); if (clean() && !$('#sheet').hidden) openCover(); },
  setcover: el => { P().cover = el.dataset.id; P().coverMode = 'photo'; save(); $('#viewer').hidden = true; toast('Set as your trip cover'); rerender(); },
  viewphoto: el => openViewer(el.dataset.id),
  closeviewer: () => { $('#viewer').hidden = true; },
  delphoto: el => { if (el.dataset.armed) { deletePhoto(el.dataset.id).then(() => { $('#viewer').hidden = true; toast('Photo deleted from the app. Your original is still in Photos.'); rerender(); }); } else { el.dataset.armed = '1'; el.textContent = 'Tap again to delete'; } },
  unpend: el => { const id = el.dataset.id; J.pending = J.pending.filter(x => x !== id); tripService.setPending(J.pending); storageService.deletePhoto(id); render('journal', true); },
  savej: async () => { if (await saveEntry()) render('journal', true); },
  delj: el => { if (el.dataset.armed) { const gone = S.trip.journal.find(x => x.id === el.dataset.id); (gone && gone.photos || []).forEach(id => deletePhoto(id)); S.trip.journal = S.trip.journal.filter(x => x.id !== el.dataset.id); save(); render('journal', true); toast('Deleted'); } else { el.dataset.armed = '1'; el.textContent = 'Tap again to delete'; } },
  copysum: () => copy(summaryText()),
  copyall: () => copy(backupText()),
  copy: el => copy(el.dataset.text),
  igpick: el => { const id = el.dataset.id, i = P().igSel.indexOf(id); if (i >= 0) P().igSel.splice(i, 1); else { if (P().igSel.length >= 10) { toast('Instagram allows up to 10 at a time'); return; } P().igSel.push(id); } save(); el.setAttribute('aria-pressed', i < 0); const lb = $('#igSelLabel'); if (lb) lb.textContent = 'Choose photos · ' + P().igSel.length + ' selected'; },
  igshare: async () => {
    const sel = P().igSel.filter(id => allPhotoIds().includes(id)); if (!sel.length) { toast('Tap the photos you want to share first'); return; }
    const cap = summaryText(); await shareService.copy(cap);
    const r = await sharePhotos(sel, cap, copyOf('file_prefix', 'wanderings'));
    if (r === 'shared' || r === 'cancelled') { if (r === 'shared') toast('Caption copied. Choose Instagram, then paste it.'); }
    else { await copy(cap, true); toast('Photo sharing isn’t available here. Caption copied; post your photos from Instagram.'); }
  },
  wpick: el => { const id = el.dataset.id, i = P().wSel.indexOf(id); if (i >= 0) P().wSel.splice(i, 1); else P().wSel.push(id); save(); el.setAttribute('aria-pressed', i < 0); const lb = $('#wSelLabel'); if (lb) lb.textContent = 'Choose photos · ' + P().wSel.length + ' selected'; const ct = $('#wConsentText'); if (ct) ct.textContent = consentMany(P().wSel.length || 2); },
  wsend: async () => {
    const sel = P().wSel.filter(id => allPhotoIds().includes(id)); if (!sel.length) { toast('Tap the photos you want to share first'); return; }
    if (!($('#wConsent') || {}).checked) { toast('Tick the permission box first'); return; }
    const text = consentMany(sel.length), r = await sharePhotos(sel, text, 'wanderings');
    if (r === 'shared') { sel.forEach(id => { if (!P().wShared.includes(id)) P().wShared.push(id); }); P().wSel = []; save(); toast('Sent. Thank you!'); render('journal', true); }
    else if (r !== 'cancelled') { await copy(text, true); toast('Photo sharing isn’t available here. Permission note copied; send the photos from your Photos app.'); }
  },
  sharewander: async el => {
    const id = el.dataset.id, text = consentOne(id), r = await sharePhotos([id], text, 'wanderings-photo');
    if (r === 'shared') { if (!P().wShared.includes(id)) P().wShared.push(id); save(); toast('Shared. Thank you!'); }
    else if (r !== 'cancelled') { await copy(text, true); toast('Photo sharing isn’t available here. Permission note copied; send the photo from your Photos app.'); }
  },
  mapdl: el => downloadPack(el.dataset.id, ok => { if (ok && P().tab === 'places') rerender(); }),
  mapdlall: () => downloadAll(() => { if (P().tab === 'places') rerender(); }),
  mapdel: el => removePack(el.dataset.id),
  cdir: el => { P().cdir = el.dataset.v; save(); render('essentials', true); },
  saverate: async () => { const v = parseFloat(String(($('#rateIn') || {}).value || '').replace(',', '.')); if (!(v > 0)) { toast('Enter a rate like 4.1'); return; } const c = S.C.cities.find(x => x.city_id === curCityId()); await currencyService.setManualRate(c.currency_code, S.trip.home_currency, v); toast('Rate saved'); loadRate(); },
  resetrate: async () => { await currencyService.clearManualRate(); toast('Using the reference rate'); loadRate(); },
  /* bookings and import (Oct 11 2026) */
  imopen: () => openImport(),
  imfind: () => importFind(),
  imback: () => importBack(),
  imsave: () => { if (importSave()) afterTripChange(); },
  bkadd: () => openEditor(),
  bkedit: el => openEditor(el.dataset.id),
  bksave: () => { if (editorSave()) afterTripChange(); },
  bkdel: el => { if (editorDelete(el)) afterTripChange(); },
  /* safety (Oct 11 2026) */
  emergency: () => showEmergency(),
  shareplan: () => sharePlan(),
  meetform: el => meetForm(el.dataset.box, el.dataset.id),
  meetsave: el => { if (meetSave(el.dataset.id, wanderPos())) { closeSheet(); const b = $('#meetHereBox'); if (b) { b.hidden = true; b.innerHTML = ''; } } },
  meetshare: () => meetShare(),
  meetclear: () => { S.trip.meetup = null; save(); rerender(); toast('Meeting point cleared'); },
  /* Ask: one search box for quick answers (Oct 11 2026) */
  ask: () => openAsk(),
  askclose: () => closeAsk(),
  askq: el => askSet(el.dataset.q),
  askgo: el => { closeAsk(); go(el.dataset.tab, { focus: el.dataset.focus }); },
  askemergency: () => showEmergency(),
  askhome: () => showDriver('__home'),
  askdriver: el => showDriver(el.dataset.id),
  askspot: el => openSpot(el.dataset.id),
  asknear: () => { closeAsk(); P().pview = 'nearby'; save(); go('places'); },
  /* your group, occasions, server card, drivers (Oct 12 2026) */
  partykids: el => togglePartyKids(el.dataset.k),
  partyeasy: () => togglePartyEasy(),
  foodpref: el => toggleFood('prefs', el.dataset.k),
  foodallergy: el => toggleFood('allergies', el.dataset.k),
  occadd: () => addOccasion(),
  occdel: el => removeOccasion(el.dataset.id),
  servercard: () => showServerCard(),
  hidephrases: el => { P().hidePhrases = el.dataset.k === 'hide'; save(); renderTabs(); toast(P().hidePhrases ? 'Phrases tab hidden. Bring it back here anytime.' : 'Phrases tab is back'); rerender(); },
  drvedit: el => driverForm(el.dataset.id),
  drvcancel: () => { const b = $('#drvForm'); if (b) { b.hidden = true; b.innerHTML = ''; } },
  drvsave: el => { if (driverSave(el.dataset.id)) rerender(); },
  drvdel: el => { if (driverDelete(el)) rerender(); },
  setstyle: el => { const v = el.dataset.v; if (S.trip.travel_style === v) return; S.trip.travel_style = v; P().pview = defaultView(); save(); renderTabs(); render('places'); window.scrollTo(0, 0); toast(v === 'planner' ? 'Planner: your day-by-day plan' : v === 'wanderer' ? 'True Wanderer: what’s near you' : 'Go with the flow: ideas and must-sees'); },
  /* traveling together (Oct 12 2026) */
  personadd: () => addPerson(),
  persondel: el => { removePerson(el.dataset.id); if ($('#welcome').hidden) rerender(); },
  sheetwho: el => pickSheetWho(el.dataset.k),
  schedwho: el => pickSchedWho(el.dataset.k),
  sharegroup: () => shareGroup(),
  joinpick: el => { if (applyJoin(el.dataset.id)) { $('#welcome').hidden = true; P().pview = 'plan'; save(); renderTabs(); go('places'); } },
  joincancel: () => cancelJoin(),
  /* clean theme (Oct 12 2026) */
  askpill: el => openAsk(el.dataset.q),
  cover: () => openCover(),
  addaddr: () => {   /* "Add your stay address": straight to the address field of the current stay */
    $('#driver').hidden = true; closeAsk(); closeSheet();
    const i = S.trip.stays.indexOf(stayHere());
    go('essentials', { focus: i >= 0 ? `[data-bind="stays.${i}.address"]` : '#tripBlock' });
  },
  spotunwent: el => { setStatus(S.trip, el.dataset.id, null); save(); toast('Visit removed. Journal notes are kept.'); openSpot(el.dataset.id); rerenderBehindSheet(); },
  spotbooked: el => { const id = el.dataset.id; setBooked(S.trip, id, !isBooked(S.trip, id)); save(); toast(isBooked(S.trip, id) ? 'Marked as booked' : 'Unmarked'); openSpot(id); rerenderBehindSheet(); }
};
async function copy(text, quiet) { const ok = await shareService.copy(text); if (!quiet) toast(ok ? 'Copied' : 'Press and hold the text to copy it'); return ok; }
function rerenderBehindSheet() { if (P().tab === 'places' && P().pview === 'nearby') refreshWanderer(); else rerender(); }
function refreshStays() { const ed = $('#staysEd'); if (ed && ed.isConnected) try { ed.outerHTML = staysEditor({ info: !$('#welcome').hidden }); } catch (e) {} }   /* the field may be mid-blur */

document.addEventListener('click', e => {
  if (e.target.id === 'scrim') { closeSheet(); return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  const fn = A[t.dataset.act]; if (!fn) return;
  if (t.tagName === 'A') return;                     // plain links open normally
  fn(t, e);
});
let photoTarget = 'composer';
document.addEventListener('click', e => { const l = e.target.closest && e.target.closest('[data-phtarget]'); if (l) photoTarget = l.dataset.phtarget; }, true);

function setPath(obj, path, val) { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) o[k[i]] = {}; o = o[k[i]]; } o[k[k.length - 1]] = val; }
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset && el.dataset.act === 'booked') return;           // handled on click
  if (el.dataset && el.dataset.act === 'bkkind') { changeKind(el.dataset.i); return; }
  if (el.id === 'icsInput') {
    const f = (el.files || [])[0]; el.value = ''; if (!f) return;
    try { importFile(await f.text()); } catch (err) { toast('That file couldn’t be read'); }
    return;
  }
  if (el.id === 'wConsent') { const b = $('#wSendBtn'); if (b) b.disabled = !el.checked; return; }
  if (el.id === 'consentChk') { const b = $('#shareWanderBtn'); if (b) b.disabled = !el.checked; return; }
  if (el.id === 'fFrom' || el.id === 'fTo') { showFare(); return; }
  if (el.id === 'photoInput') {
    const files = [...(el.files || [])]; el.value = ''; if (!files.length) return;
    toast(files.length > 1 ? 'Adding ' + files.length + ' photos…' : 'Adding photo…');
    const { ids, failed } = await storageService.addPhotos(files);
    if (failed.length) toast('A photo couldn’t be saved on this phone.');
    if (!ids.length) return;
    if (photoTarget === 'composer') { J.pending = J.pending.concat(ids); tripService.setPending(J.pending); }
    else { const en = S.trip.journal.find(x => x.id === photoTarget); if (en) { en.photos = (en.photos || []).concat(ids); save(); } }
    toast(ids.length > 1 ? ids.length + ' photos added' : 'Photo added'); render(P().tab, true); return;
  }
  const bp = el.dataset && el.dataset.bind; if (!bp) return;
  let v = el.value;
  if (/flight$/.test(bp)) v = v.toUpperCase().trim(); else if (el.type === 'text') v = v.trim();
  setPath(S.trip, bp, v);
  const inWelcome = !$('#welcome').hidden;
  if (/^stays\.\d+\.city_id$/.test(bp)) setPath(S.trip, bp.replace('city_id', 'neighborhood_id'), '');
  if (/^stays\.\d+\.start$/.test(bp)) { const i = +bp.split('.')[1], s = S.trip.stays[i]; if (s.end && s.end < s.start) s.end = s.start; }
  if (/^(stays|legs)\./.test(bp)) { syncLegs(S.trip); }
  save();
  if (bp === 'travel_style') { P().pview = defaultView(); renderTabs(); if (!inWelcome) toast(v === 'planner' ? 'Planner mode on. Places is now Plan.' : v === 'wanderer' ? 'True Wanderer on. Places is now Nearby.' : 'Go with the flow'); }
  if (/^(stays|legs)\./.test(bp)) { refreshStays(); }
  if (/^emergency\./.test(bp)) { toast('Saved on this phone'); showEmergency(); return; }
  if (/^occasions\./.test(bp)) { refreshOccasions(); }
  if (/^people\.\d+\.(name|arrive)$/.test(bp)) { const i = +bp.split('.')[1], pp = S.trip.people[i]; if (pp && pp.leave && pp.arrive > pp.leave) pp.leave = pp.arrive; refreshPeople(); }
  if (inWelcome) return;
  toast('Saved');
  if (bp === 'traveler_language') { rerender(); return; }
  if (P().tab === 'essentials' && /^(stays|legs|home_currency|travel_style|arrival|departure)/.test(bp)) rerender();
  if (/^(party|food|occasions|people)\./.test(bp) && P().tab !== 'essentials') rerender();
});
document.addEventListener('input', e => {
  if (e.target.id === 'askq') { askInput(e.target.value); return; }
  if (e.target.id === 'phq') { setQuery(e.target.value); const pos = e.target.selectionStart; render('phrases', true); const n = $('#phq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} }
  if (e.target.id === 'amtIn') { P().camt = e.target.value; save(); updateConv(); }
  if (e.target.id === 'jText') { J.draft = e.target.value; tripService.setDraft(e.target.value); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'askq') { e.target.blur(); return; }
  if (e.key === 'Escape') { if (!$('#sheet').hidden) { closeSheet(); return; } if (!$('#driver').hidden) { $('#driver').hidden = true; return; } if ($('#ask') && !$('#ask').hidden) { closeAsk(); return; } if (!$('#viewer').hidden) $('#viewer').hidden = true; if (!$('#driver').hidden) $('#driver').hidden = true; }
});
/* Photos are stored on the phone; fill <img data-photo> as they appear. */
function hydratePhotos() { $$('img[data-photo]:not([src])').forEach(img => { img.setAttribute('src', ''); storageService.photoURL(img.dataset.photo).then(u => { if (u) img.src = u; }); }); }
try { new MutationObserver(hydratePhotos).observe(document.body, { childList: true, subtree: true }); } catch (e) {}

async function boot() {
  const root = $('#app');
  try { S.C = await contentService.load(); }
  catch (e) { root.innerHTML = '<p class="loading">Wanderings couldn’t load its guide. Check your connection and open it again.</p>'; return; }
  S.trip = await tripService.load();
  if (!S.trip.stays.length) { S.trip.stays = cityIds().map(id => newStay(id)); syncLegs(S.trip); }
  J.pending = await tripService.getPending(); J.draft = await tripService.getDraft();
  S.art = {};
  await Promise.all(S.C.cities.flatMap(c => [c.hero.art, c.mark].concat(c.illustrated_map ? [c.illustrated_map.art] : [])).map(async f => { S.art[f] = await contentService.art(f); }));
  applyTheme(curCity());
  root.querySelector('.loading')?.remove();
  TABS.forEach(([k]) => { if (!document.querySelector(`section[data-tab="${k}"]`)) root.insertAdjacentHTML('beforeend', `<section data-tab="${k}" hidden></section>`); });
  renderTabs();
  go(shownTabs().some(([k]) => k === P().tab) ? P().tab : 'today');
  let force = false; try { force = location.hash === '#welcome'; } catch (e) {}
  if (await checkJoin()) {}   /* a shared group plan link: choose who you are (Oct 12 2026) */
  else if (!S.trip.onboarded || force) { W.step = 1; renderWelcome(); }
  window.addEventListener('hashchange', () => { try { if (location.hash === '#welcome') { W.step = 1; renderWelcome(); } else if (location.hash.startsWith('#join=')) checkJoin(); } catch (e) {} });
  speechService.onVoicesChanged(() => { if (P().tab === 'essentials') rerender(); });
  setTimeout(autoSaveMaps, 2500);                                   // editions that save their offline map by themselves
  window.addEventListener('online', () => autoSaveMaps());
  window.__wanderings = { S, go, render };   // for testing only
}
boot();
