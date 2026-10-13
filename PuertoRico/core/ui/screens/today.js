/* Today: answers "what now?" for the current city. Simplified Oct 11 2026: the time-sensitive things first
   (meeting point, travel, bookings, clashes), then what to book, ideas, your base and a phrase. */
import { S, P, curCityId, cityOf, cityName, cityTitle, placesIn, stayHere, homePoint, hoodOf, isPlanner, isWanderer, hasStays, today, itemInfo, addMount, placeById } from '../state.js?v=202610121715';
import { esc, ic, ill, fmtISO, fmtDay, plural, modeIcon } from '../dom.js?v=202610121715';
import { masthead, cityBar, legend, bookRow, placeRow, art, legInfo, bookingLine } from '../components.js?v=202610121715';
import { stage, statusOf, isBooked, itemsOn, walkMinutes, sortedStays, bookingsOn, sortedBookings, localISO } from '../../models/schema.js?v=202610121715';
import { tripChecks } from '../../models/checks.js?v=202610121715';
import { timelineView } from './plan.js?v=202610121715';
import { allPhotoIds } from './journal.js?v=202610121715';
import { view as phraseView } from './phrases.js?v=202610121715';
import { meetBlock } from './safety.js?v=202610121715';
import { myLang, placeName, copyOf, checkedText, cityIds } from '../state.js?v=202610121715';
import { speaksLocal } from '../../models/schema.js?v=202610121715';
import { mapPackService } from '../../services/mappack-service.js?v=202610121715';
import { clean } from '../theme.js?v=202610121715';
import { placeCards, checkText } from '../components.js?v=202610121715';
import { closedText } from '../../models/schema.js?v=202610121715';
import { occasionAlert } from './group.js?v=202610121715';
import { arrivalsAlert } from './together.js?v=202610121715';

let slideTimer = null, slideIdx = 0;

/* Local greeting by time of day, from phrases.json "greetings": [{ until: <hour>, t }]. */
function greeting() {
  const h = new Date().getHours(), g = S.C.phrases.greetings || [];
  return (g.find(x => h < x.until) || g[g.length - 1] || { t: 'Hello' }).t;
}

function coverHero(cityId) {
  const c = cityOf(cityId), photos = allPhotoIds();
  let mode = P().coverMode;
  if (mode === 'slides' && !photos.length) mode = 'sketch';
  if (mode === 'photo' && !(P().cover && photos.includes(P().cover))) mode = 'sketch';
  const sketch = art(c.hero.art);
  const badge = `<div class="badge-overlay">${art(c.mark)}<span>${esc(c.stamp)}</span></div>`;
  let hero, label, btns = '';
  if (mode === 'slides') {
    const ids = photos.slice(0, 12); slideIdx = 0;
    hero = `<div class="hero slides" id="slideshow" aria-roledescription="slideshow" aria-label="Your trip slideshow"><div class="slide sk on" data-slide="0">${sketch}</div>
      ${ids.map((id, i) => `<img class="slide cover-img" data-slide="${i + 1}" data-photo="${id}" alt="Your photo ${i + 1} of ${ids.length}">`).join('')}${badge}
      <div class="sdots">${[0].concat(ids.map((_, i) => i + 1)).map(i => `<button data-act="slideto" data-i="${i}" aria-label="${i === 0 ? 'Sketch' : 'Photo ' + i}" aria-current="${i === 0}"></button>`).join('')}</div></div>`;
    label = `slideshow of ${plural(ids.length, 'photo')}`;
    btns = '<button class="text-btn" data-act="uncover">Back to the sketch</button>';
  } else if (mode === 'photo') {
    hero = `<div class="hero"><img class="cover-img" data-photo="${P().cover}" alt="Your trip cover photo">${badge}</div>`;
    label = 'your photo';
    btns = '<button class="text-btn" data-act="slideshow">Slideshow instead</button><button class="text-btn" data-act="uncover">Back to the sketch</button>';
  } else {
    hero = `<div class="hero">${sketch}<div class="cap label">${esc(c.hero.caption)}</div></div>`;
    label = cityName(cityId) + ' sketch';
    if (photos.length) btns = '<button class="text-btn" data-act="slideshow">Slideshow of my photos</button>';
  }
  return hero + (btns ? `<div class="head" style="padding-top:4px;flex-wrap:wrap"><span></span><span style="display:flex;gap:14px">${btns}</span></div>` : '');
}
export function showSlide(i) {
  const el = document.getElementById('slideshow'); if (!el) return;
  const slides = el.querySelectorAll('.slide'); if (!slides.length) return;
  slideIdx = (i + slides.length) % slides.length;
  slides.forEach(sl => sl.classList.toggle('on', +sl.dataset.slide === slideIdx));
  el.querySelectorAll('[data-act="slideto"]').forEach(b => b.setAttribute('aria-current', +b.dataset.i === slideIdx));
}
export function startSlides() {
  clearInterval(slideTimer);
  const el = document.getElementById('slideshow'); if (!el) return;
  let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce) return;
  slideTimer = setInterval(() => { if (!document.body.contains(el) || el.closest('[hidden]')) { clearInterval(slideTimer); return; } showSlide(slideIdx + 1); }, 5000);
}
export const stopSlides = () => clearInterval(slideTimer);

function showInstallTip() {
  try {
    if (P().installTipDone) return false;
    if (window.self !== window.top) return false;
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return false;
    return /^https?:$/.test(location.protocol);
  } catch (e) { return false; }
}

/* ---------- "what now": only things that matter in the next day or so ---------- */
const nextDay = d => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + 1); return localISO(x); };
function travelAlert() {
  const t = today();
  const next = S.trip.legs.filter(l => l.date && l.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return '';
  const days = Math.round((new Date(next.date + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5);
  if (days > 3) return '';
  const mode = S.C.edition.leg_modes.find(m => m.id === next.mode);
  return `<div class="alert">${ic(modeIcon(next.mode))}<div style="min-width:0;display:flex;flex-direction:column;gap:4px"><b>${days === 0 ? 'Travel day' : days === 1 ? 'Travel tomorrow' : `Travel in ${days} days`}: ${esc(cityName(next.from_city_id))} to ${esc(cityName(next.to_city_id))}${mode ? ' · ' + esc(mode.label) : ''}</b>
    ${mode ? legInfo(next) : '<p class="small muted" style="margin:0">Decide how you’re getting there. Drivers and trains are worth booking a day or two ahead.</p>'}
    <button class="text-btn" data-act="go" data-tab="essentials" data-focus="#tripBlock" style="min-height:32px;align-self:flex-start">${mode ? 'Change' : 'Choose how'}</button></div></div>`;
}
function bookingAlerts(st) {
  const t = today(), tm = nextDay(t);
  let rows = bookingsOn(S.trip, t).map(x => ({ x, label: 'Today' }));
  rows = rows.concat(bookingsOn(S.trip, tm).map(x => ({ x, label: 'Tomorrow' })));
  if (!rows.length && st.k === 'before') { const nb = sortedBookings(S.trip).find(b => b.date && b.date >= t); if (nb) rows = [{ x: { b: nb, role: 'start' }, label: 'Next' }]; }
  if (!rows.length) return '';
  return `<div class="alert">${ic('ticket')}<div style="min-width:0;flex:1">${rows.slice(0, 4).map(r => `<div class="label" style="margin-top:2px">${esc(r.label)}</div>${bookingLine(r.x.b, r.x.role, { day: r.label === 'Next' })}`).join('')}
    <button class="text-btn" data-act="go" data-tab="essentials" data-focus="#bookBlock" style="min-height:32px">All bookings</button></div></div>`;
}
function checkAlerts() {
  const t = today(), tm = nextDay(t);
  const cs = tripChecks(S.trip, { placeById, cityName }).filter(c => c.level === 'warn' && (c.day === t || c.day === tm));
  if (!cs.length) return '';
  return `<div class="alert warn">${ic('sos')}<div style="min-width:0;display:flex;flex-direction:column;gap:4px"><b>Worth a look</b>${cs.slice(0, 3).map(c => `<p class="small" style="margin:0">${esc(clean() ? checkText(c) : c.text)}</p>`).join('')}</div></div>`;
}
function whatNow(st) {
  if (st.k === 'after') return '';
  let h = meetBlock() + arrivalsAlert() + travelAlert() + occasionAlert() + bookingAlerts(st) + checkAlerts();
  if (st.k === 'during' && !isWanderer()) h += `<button class="btn line" data-act="pview" data-v="nearby" data-tab="places" style="align-self:flex-start">${ic('compass', 'style="width:18px;height:18px"')}What’s near me</button>`;
  const onlyMaps = !h;   /* then the whole block hides once every map is saved, so no empty heading is left */
  if ((S.C.maps || {}).packs && S.C.maps.packs.length) {
    h = `<div class="alert" id="todayOffline" hidden>${ic('compass')}<div style="min-width:0;display:flex;flex-direction:column;gap:6px"><b>Before you lose signal</b><p class="small" style="margin:0">Save the offline maps on Wi-Fi so maps work on trails, beaches and anywhere without coverage.</p>
      <button class="btn sm" data-act="go" data-tab="essentials" data-focus="#offlineBlock" style="align-self:flex-start">Save offline maps</button></div></div>` + h;
    addMount(async () => { const have = await mapPackService.downloaded(), all = S.C.maps.packs.filter(p => !p.optional).every(p => have.includes(p.id));   /* optional packs (islands, overview) don't nag */ const el = document.getElementById('todayOffline'); if (el) el.hidden = all; const nb = document.getElementById('nowBlock'); if (nb && onlyMaps) nb.hidden = all; });
  }
  if (!h) return '';
  return `<div class="block" id="nowBlock" ${onlyMaps ? 'hidden' : ''}><h2>${st.k === 'during' ? 'Now' : 'Coming up'}</h2>${h}</div>`;
}

function baseBlock(cityId, st) {
  const sy = stayHere(cityId), c = cityOf(cityId);
  const sos = `<button class="btn line sm" data-act="emergency">${ic('sos', 'style="width:16px;height:16px"')}Emergency card</button>`;
  if (!sy || (!sy.neighborhood_id && !sy.address)) {
    return `<div class="block"><h2>Where are you staying in ${esc(cityName(cityId))}?</h2><p class="small muted">Add your ${c.region ? 'town' : 'neighborhood'} for local tips, walking times and a one-tap “take me home” for drivers.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line" data-act="welcome" data-step="2">Add where you’re staying</button>${sos}</div></div>`;
  }
  const h = hoodOf(cityId, sy.neighborhood_id), home = homePoint(cityId);
  let walk = '';
  if (home && h && h.central && !c.region) { const m = walkMinutes(home, c.landmark_center); walk = m <= 5 ? `A few minutes’ walk to ${c.landmark_center.name}.` : m <= 45 ? `About ${m} minutes’ walk to ${c.landmark_center.name}.` : ''; }
  let arrive = '';
  const firstStay = sortedStays(S.trip)[0];
  if (st.k === 'before' && firstStay && firstStay.city_id === cityId && (S.trip.arrival.via || S.trip.arrival.flight)) {
    const via = S.trip.arrival.via, opt = S.C.edition.arrival_options.find(o => o.id === via);
    const ap = (c.airports || []).find(a => a.id === via);
    arrive = `<div style="display:flex;flex-direction:column;gap:4px;padding-top:6px"><div class="label">Arriving${firstStay.start ? ' ' + esc(fmtISO(firstStay.start)) : ''}${opt ? ' · ' + esc(opt.label) : ''}</div>${ap || (opt && opt.tip) ? `<p class="small">${esc(ap ? ap.tip : opt.tip)}</p>` : ''}
      ${S.trip.arrival.flight ? `<a class="btn line sm" style="align-self:flex-start" href="https://www.google.com/search?q=${encodeURIComponent('flight ' + S.trip.arrival.flight)}" target="_blank" rel="noopener">Track flight ${esc(S.trip.arrival.flight)} ↗</a>` : ''}</div>`;
  }
  return `<div class="block"><div class="head"><h2>Your base</h2><button class="text-btn" data-act="go" data-tab="essentials" data-focus="#tripBlock">Edit</button></div>
    <div><h3>${esc(sy.label || 'Where you’re staying')}</h3><div class="meta" style="font-size:12.5px;color:var(--muted)">${esc(h ? h.name : '')}${sy.address ? ' · ' + esc(sy.address) : ''}${sy.start ? ' · ' + esc(fmtISO(sy.start)) + (sy.end ? ' to ' + esc(fmtISO(sy.end)) : '') : ''}</div></div>
    ${h && h.tip ? `<p class="small">${esc(h.tip)}</p>` : ''}${walk ? `<p class="small muted">${esc(walk)}</p>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="homedriver">${ic('taxi', 'style="width:16px;height:16px"')}Take me home</button>${home ? `<button class="btn line sm" data-act="go" data-tab="essentials" data-focus="#fareBlock">Taxi fare</button>` : ''}${sos}</div>${arrive}</div>`;
}

function planBlock(st) {
  const n = S.trip.plan.length;
  if (isPlanner()) {
    if (st.k === 'during') {
      const items = itemsOn(S.trip, today());
      return `<div class="block"><div class="head"><h2>Today’s plan</h2><button class="text-btn" data-act="pview" data-v="plan" data-tab="places">Full plan</button></div>${items.length ? timelineView(today(), items, true) : '<p class="serif" style="font-size:17px">Nothing scheduled today. An open day to wander.</p>'}</div>`;
    }
    return '';
  }
  if (st.k === 'after' || !n) return '';
  const up = S.trip.plan.filter(v => v.date >= today()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 4);
  if (!up.length) return '';
  return `<div class="block"><h2>Booked times</h2><div>${up.map(v => `<div class="prow" style="grid-template-columns:auto 36px minmax(0,1fr) auto"><div class="tm">${esc(fmtDay(v.date))}${v.time ? '<br>' + esc(v.time) : ''}</div>${ill(itemInfo(v.item_id).kind, 36)}<div style="font-weight:600">${esc(itemInfo(v.item_id).name)}<div data-schedform="${v.item_id}" hidden></div></div><button class="text-btn" data-act="sched" data-id="${v.item_id}" style="min-height:40px">Edit</button></div>`).join('')}</div></div>`;
}

function phraseNow() {
  const h = new Date().getHours(), ph = S.C.phrases;
  const m = ph.moments.find(x => h < x.until) || ph.moments[ph.moments.length - 1];
  return [m.label, phraseView((ph.situations[m.situation] || [])[m.index] || ph.situations.Greetings[0])];
}

function ideas(cityId) {
  const list = placesIn(cityId, ['sight', 'food', 'shop']);
  const wantGroups = new Set(list.filter(p => statusOf(S.trip, p.id) === 'want' || p.must).map(p => p.group));
  const pool = list.filter(p => !p.must && wantGroups.has(p.group) && !statusOf(S.trip, p.id));
  const offset = new Date().getDate() % Math.max(pool.length, 1);
  return pool.slice(offset).concat(pool.slice(0, offset)).slice(0, 3);
}

export function renderToday() {
  if (clean()) return renderTodayClean();
  const st = stage(S.trip), cityId = curCityId(), c = cityOf(cityId), name = S.trip.traveler_name;
  let eyebrow, h1, lede;
  if (st.k === 'before') {
    eyebrow = st.days == null ? `${placeName()} · add your stays` : (st.days === 0 ? 'Your trip starts today' : `Trip starts in ${plural(st.days, 'day')}`);
    h1 = `${cityTitle(cityId)} awaits${name ? ', ' + name : ''}!`;
    lede = isWanderer() ? 'No plan needed. When you arrive, open Nearby and see what’s worth a look around you.' : 'Book the few things that sell out, save some ideas, and leave room to wander.';
  } else if (st.k === 'during') {
    eyebrow = `Day ${st.day} of ${st.total} · ${cityName(cityId)}`;
    h1 = `${greeting()}${name ? ', ' + name : ''}!`;
    lede = isWanderer() ? 'Open Nearby to see what’s close, or just walk and see where the day goes.' : 'Mark “Went here” as you go and it becomes your journal.';
  } else { eyebrow = 'Trip complete'; h1 = `${copyOf('greeting_place', placeName())}, remembered!`; lede = 'Your places and notes are ready to share.'; }

  const toBook = placesIn(cityId).filter(p => p.booking_status === 'required' && (p.must || p.urgency_level === 'book_soon') && ((p.category !== 'experience' && p.category !== 'day_trip') || p.remind_before))
    .sort((a, b) => (a.urgency_level === 'book_soon' ? 0 : 1) - (b.urgency_level === 'book_soon' ? 0 : 1));
  const unbooked = toBook.filter(p => !isBooked(S.trip, p.id));
  const [moment, ph] = phraseNow();
  const wants = placesIn(cityId).filter(p => statusOf(S.trip, p.id) === 'want');
  const visited = S.trip.saved.filter(s => s.status === 'went').length;

  let html = masthead({ noAsk: true }) + `<div class="greet"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p></div><button class="askbar" data-act="ask">${ic('search')}<span>Ask anything: tipping, taxi, ${S.C.cities[0].currency_code === 'EUR' ? '20 euros' : 'drivers'}…</span></button>${cityBar()}<div style="height:10px"></div>${coverHero(cityId)}`;

  if (!hasStays()) {
    html += `<div class="block" style="padding-top:18px"><div style="border:1px solid var(--rule);padding:14px;display:flex;flex-direction:column;gap:8px"><div class="label">Your trip</div><p class="small">${cityIds().length > 1 ? `Add where you’re staying in ${esc(copyOf('place_list', placeName()))}, with dates, and the app follows you from place to place.` : 'Add where you’re staying, with dates, for local tips, walking times and a one-tap ride home.'} Have booking emails? Import them instead.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="welcome" data-step="2">Add my stays</button><button class="btn line sm" data-act="imopen">Import bookings</button></div></div></div>`;
  }
  if (showInstallTip()) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    html += `<div class="block" style="padding-top:18px"><div style="border:1px solid var(--rule);padding:14px;display:flex;flex-direction:column;gap:8px"><div class="label">Install Wanderings</div>
      <p class="small">${ios ? 'Tap the <b>Share</b> button at the bottom of Safari, then <b>Add to Home Screen</b>. It opens like an app and works offline.' : 'Open your browser menu and tap <b>Install app</b> or <b>Add to Home screen</b>. It opens like an app and works offline.'}</p>
      <button class="text-btn" data-act="dismissinstall" style="align-self:flex-start;min-height:36px">Got it</button></div></div>`;
  }
  const convert = S.trip.home_currency && S.trip.home_currency !== c.currency_code;
  html += `<div class="quick">
    ${isWanderer() ? `<button data-act="pview" data-v="nearby" data-tab="places">${ic('compass')}Nearby</button>` : `<button data-act="go" data-tab="phrases">${ic('phrases')}Say it</button>`}
    ${convert ? `<button data-act="go" data-tab="essentials" data-focus="#amtIn">${ic('convert')}Convert</button>` : ''}
    <button data-act="go" data-tab="essentials" data-focus="#taxiBlock">${ic('taxi')}Taxi</button>
    <button class="rec" data-act="go" data-tab="journal" data-focus="#jText"><span>${ic('mic')}</span>Record</button></div>`;

  html += whatNow(st);

  if (st.k !== 'after' && toBook.length) {
    if (st.k === 'before') {
      html += unbooked.length ? `<div class="block"><div class="head"><h2>Book before you go</h2><span class="label">${toBook.length - unbooked.length}/${toBook.length} done</span></div>
        <p class="small muted">${esc(cityName(cityId))} sights that sell out or have timed entry. Checked ${esc(checkedText())}.</p>${legend()}<div class="rows">${unbooked.map(bookRow).join('')}</div></div>`
        : `<div class="block"><h2>All booked in ${esc(cityName(cityId))}</h2><p class="small muted">Everything that needs a ticket is sorted. Nice work.</p></div>`;
    } else if (unbooked.length) {
      html += `<div class="block"><div class="head"><h2>Still to book</h2><span class="label">${toBook.length - unbooked.length}/${toBook.length} done</span></div><p class="small">${unbooked.map(p => esc(p.name)).join(', ')}.</p><button class="btn line sm" data-act="pview" data-v="sights" data-tab="places" style="align-self:flex-start">See tickets</button></div>`;
    }
  }
  html += planBlock(st);
  if (st.k !== 'after') {
    const id = ideas(cityId);
    if (id.length) html += `<div class="block"><div class="head"><h2>${st.k === 'during' ? 'Ideas for today' : 'Ideas to save'}</h2><button class="text-btn" data-act="pview" data-v="sights" data-tab="places">All places</button></div>
      ${wants.length ? `<p class="small muted">On your list: ${wants.slice(0, 4).map(p => esc(p.name)).join(', ')}${wants.length > 4 ? ' and more' : ''}.</p>` : ''}
      <div class="rows">${id.map(p => placeRow(p, true)).join('')}</div></div>`;
  }
  html += baseBlock(cityId, st);
  if (!P().hidePhrases) html += `<div class="block"><div class="panel"><div class="label">Phrase for ${esc(moment.toLowerCase())}</div>
    <div style="display:flex;gap:12px;align-items:center;justify-content:space-between"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><div class="it">${esc(ph.t)}</div>${myLang() === 'en' ? `<div class="say">${esc(ph.say)}</div>` : ''}${speaksLocal(myLang(), S.C.phrases.language) ? '' : `<div class="en">${esc(ph.m)}</div>`}</div>
    <button class="hear" data-act="say" data-text="${esc(ph.t)}" aria-label="Hear it">${ic('speak')}</button></div>
    <button class="text-btn" data-act="go" data-tab="phrases" style="align-self:flex-start;min-height:32px">More phrases</button></div></div>`;

  if (st.k === 'after' || visited) {
    html += `<div class="block"><div class="head"><h2>${st.k === 'after' ? 'Your trip' : 'So far'}</h2><button class="text-btn" data-act="go" data-tab="journal">Journal</button></div>
      <p class="serif" style="font-size:18px">${plural(visited, 'place')} visited, ${S.trip.journal.length} journal entr${S.trip.journal.length === 1 ? 'y' : 'ies'}.</p>
      ${st.k === 'after' ? `<button class="btn" data-act="go" data-tab="journal" data-focus="#summary">See your trip summary</button>` : ''}</div>`;
  }
  document.querySelector('section[data-tab="today"]').innerHTML = html;
  addMount(startSlides);
}

/* ---------- clean theme (Oct 12 2026): compact header, search with suggestions, the sketch as a small tile,
   the same "what now?" order, cards for what to book, and the stay address in large type. ---------- */
const pillName = n => n.replace(/\s+(Gallery|Gardens|Garden|Museum|Monastery|Tower|Castle|Palace|Cathedral)$/i, '');
function askPills(cityId) {
  const must = placesIn(cityId, ['sight']).find(p => p.must && !p.custom);
  return ['Taxis', 'Tipping'].concat(must ? [must.short_name || pillName(must.name)] : []);
}
function coverTile(cityId) {
  const c = cityOf(cityId), photos = allPhotoIds();
  const photo = P().coverMode === 'photo' && P().cover && photos.includes(P().cover) ? P().cover : (P().coverMode === 'slides' && photos.length ? photos[0] : null);
  return `<button class="cover-tile" data-act="cover" aria-label="Trip cover: the sketch or your photos">${photo ? `<img data-photo="${photo}" alt="">` : art(c.mark)}</button>`;
}
export function openCover() {
  const sh = document.getElementById('sheet'), cityId = curCityId();
  sh.innerHTML = `<div class="grab"></div><div class="cover-sheet" style="display:flex;flex-direction:column;gap:10px"><div class="sh-title">${esc(cityName(cityId))}</div>${coverHero(cityId)}
    <p class="small muted">${allPhotoIds().length ? 'Your cover can be the sketch, one of your photos or a slideshow. Set a photo as the cover from your Journal.' : 'Add photos to your journal and you can make one your trip cover.'}</p>
    <button class="btn line sm" data-act="sheetclose" style="align-self:flex-start">Close</button></div>`;
  document.getElementById('scrim').hidden = false; sh.hidden = false;
  startSlides();
}
function baseBlockClean(cityId, st) {
  const sy = stayHere(cityId), c = cityOf(cityId);
  const sos = `<button class="btn line sm" data-act="emergency">${ic('sos', 'style="width:16px;height:16px"')}Emergency card</button>`;
  if (!sy || (!sy.neighborhood_id && !sy.address)) {
    return `<div class="block"><h2>Your base</h2><p class="small muted">Add where you’re staying for local tips, walking times and a one-tap ride home.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="welcome" data-step="2">${ic('plus', 'style="width:16px;height:16px"')}Add where you’re staying</button>${sos}</div></div>`;
  }
  const h = hoodOf(cityId, sy.neighborhood_id), home = homePoint(cityId);
  /* walking time only from a known starting point: the traveler's saved stay */
  let walk = '';
  if (home && h && h.central && !c.region) { const m = walkMinutes(home, c.landmark_center); walk = m <= 5 ? `A few minutes’ walk to ${c.landmark_center.name}.` : m <= 45 ? `About ${m} minutes’ walk to ${c.landmark_center.name}.` : ''; }
  let arrive = '';
  const firstStay = sortedStays(S.trip)[0];
  if (st.k === 'before' && firstStay && firstStay.city_id === cityId && (S.trip.arrival.via || S.trip.arrival.flight)) {
    const via = S.trip.arrival.via, opt = S.C.edition.arrival_options.find(o => o.id === via), ap = (c.airports || []).find(a => a.id === via);
    arrive = `<div style="display:flex;flex-direction:column;gap:6px;padding-top:8px"><div class="label">Arriving${firstStay.start ? ' ' + esc(fmtISO(firstStay.start)) : ''}${opt ? ' · ' + esc(opt.label) : ''}</div>${ap || (opt && opt.tip) ? `<div class="tipbox">${esc(ap ? ap.tip : opt.tip)}</div>` : ''}
      ${S.trip.arrival.flight ? `<a class="text-btn" href="https://www.google.com/search?q=${encodeURIComponent('flight ' + S.trip.arrival.flight)}" target="_blank" rel="noopener">Track flight ${esc(S.trip.arrival.flight)} ↗</a>` : ''}</div>`;
  }
  return `<div class="block"><div class="head"><h2>Your base</h2><button class="text-btn" data-act="go" data-tab="essentials" data-focus="#tripBlock" style="min-height:32px">Edit</button></div>
    <div><h3>${esc(sy.label || 'Where you’re staying')}</h3><div class="small muted">${esc(h ? h.name : '')}${sy.start ? ' · ' + esc(fmtISO(sy.start)) + (sy.end ? ' to ' + esc(fmtISO(sy.end)) : '') : ''}</div></div>
    ${sy.address ? `<div class="addr-big">${esc(sy.address)}</div>` : `<button class="btn line sm" data-act="addaddr" style="align-self:flex-start">${ic('plus', 'style="width:16px;height:16px"')}Add your stay address</button>`}
    ${walk ? `<p class="small muted">${esc(walk)}</p>` : ''}${h && h.tip ? `<div class="tipbox">${esc(h.tip)}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px"><button class="btn sm" data-act="homedriver">${ic('home', 'style="width:16px;height:16px"')}Take me home</button>${home ? `<button class="btn line sm" data-act="go" data-tab="essentials" data-focus="#fareBlock">Taxi fare</button>` : ''}${sos}</div>${arrive}</div>`;
}
function renderTodayClean() {
  const st = stage(S.trip), cityId = curCityId(), name = S.trip.traveler_name;
  let eyebrow, h1;
  if (st.k === 'before') { eyebrow = st.days == null ? `${placeName()} · add your stays` : (st.days === 0 ? 'Your trip starts today' : `Trip starts in ${plural(st.days, 'day')}`); h1 = `${cityTitle(cityId)} awaits${name ? ', ' + name : ''}!`; }
  else if (st.k === 'during') { eyebrow = `Day ${st.day} of ${st.total} · ${cityName(cityId)}`; h1 = `${greeting()}${name ? ', ' + name : ''}!`; }
  else { eyebrow = 'Trip complete'; h1 = `${copyOf('greeting_place', placeName())}, remembered!`; }
  const toBook = placesIn(cityId).filter(p => p.booking_status === 'required' && (p.must || p.urgency_level === 'book_soon') && ((p.category !== 'experience' && p.category !== 'day_trip') || p.remind_before))
    .sort((a, b) => (a.urgency_level === 'book_soon' ? 0 : 1) - (b.urgency_level === 'book_soon' ? 0 : 1));
  const unbooked = toBook.filter(p => !isBooked(S.trip, p.id));
  const visited = S.trip.saved.filter(s => s.status === 'went').length;
  const [moment, ph] = phraseNow();

  let html = masthead({ noAsk: true }) + `<div class="greet"><div class="greet-row"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1></div>${coverTile(cityId)}</div></div>
    <button class="askbar" data-act="ask">${ic('search')}<span>Search trip &amp; guide…</span></button>
    <div class="askpills">${askPills(cityId).map(q => `<button data-act="askpill" data-q="${esc(q === 'Taxis' ? 'taxi' : q)}">${esc(q)}</button>`).join('')}</div>${cityBar()}`;
  if (!hasStays()) {
    html += `<div class="block" style="padding-top:20px"><div class="soft"><b>Your trip</b><p class="small">${cityIds().length > 1 ? `Add where you’re staying in ${esc(copyOf('place_list', placeName()))}, with dates, and the app follows you from place to place.` : 'Add where you’re staying, with dates, for local tips, walking times and a one-tap ride home.'}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="welcome" data-step="2">Add my stays</button><button class="btn line sm" data-act="imopen">Import bookings</button></div></div></div>`;
  }
  if (showInstallTip()) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    html += `<div class="block" style="padding-top:20px"><div class="soft"><b>Install Wanderings</b><p class="small">${ios ? 'Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>. It opens like an app and works offline.' : 'Open your browser menu and tap <b>Install app</b> or <b>Add to Home screen</b>. It opens like an app and works offline.'}</p>
      <button class="text-btn" data-act="dismissinstall" style="align-self:flex-start;min-height:36px">Got it</button></div></div>`;
  }
  html += whatNow(st);
  if (st.k !== 'after' && toBook.length) {
    if (st.k === 'before') {
      html += unbooked.length ? `<div class="block"><div class="head"><h2>Book before you go</h2><span class="small muted">${toBook.length - unbooked.length} of ${toBook.length} done</span></div>
        <p class="small muted">Checked ${esc(checkedText())}.</p>${placeCards(unbooked)}</div>`
        : `<div class="block"><h2>All booked</h2><p class="small muted">Everything that needs a ticket is sorted. Nice work.</p></div>`;
    } else if (unbooked.length) {
      html += `<div class="block"><div class="head"><h2>Still to book</h2><span class="small muted">${toBook.length - unbooked.length} of ${toBook.length} done</span></div><p>${unbooked.map(p => esc(p.name)).join(', ')}.</p><button class="text-btn" data-act="pview" data-v="sights" data-tab="places" style="align-self:flex-start">See tickets</button></div>`;
    }
  }
  html += planBlock(st);
  html += baseBlockClean(cityId, st);
  if (!P().hidePhrases) html += `<div class="block"><div class="panel"><div class="label">Phrase for ${esc(moment.toLowerCase())}</div>
    <div style="display:flex;gap:12px;align-items:center;justify-content:space-between"><div style="display:flex;flex-direction:column;gap:3px;min-width:0"><div class="it">${esc(ph.t)}</div>${myLang() === 'en' ? `<div class="say">${esc(ph.say)}</div>` : ''}${speaksLocal(myLang(), S.C.phrases.language) ? '' : `<div class="en">${esc(ph.m)}</div>`}</div>
    <button class="hear" data-act="say" data-text="${esc(ph.t)}" aria-label="Hear it">${ic('speak')}</button></div>
    <button class="text-btn" data-act="go" data-tab="phrases" style="align-self:flex-start;min-height:32px">More phrases</button></div></div>`;
  if (st.k === 'after' || visited) {
    html += `<div class="block"><div class="head"><h2>${st.k === 'after' ? 'Your trip' : 'So far'}</h2><button class="text-btn" data-act="go" data-tab="journal" style="min-height:32px">Journal</button></div>
      <p>${plural(visited, 'place')} visited, ${S.trip.journal.length} journal entr${S.trip.journal.length === 1 ? 'y' : 'ies'}.</p>
      ${st.k === 'after' ? `<button class="btn" data-act="go" data-tab="journal" data-focus="#summary">See your trip summary</button>` : ''}</div>`;
  }
  document.querySelector('section[data-tab="today"]').innerHTML = html;
}
