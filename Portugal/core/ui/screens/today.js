/* Today: stage-aware home screen for the current city. */
import { S, P, curCityId, cityOf, cityName, cityTitle, placesIn, stayHere, homePoint, hoodOf, isPlanner, isWanderer, hasStays, today, itemInfo, addMount } from '../state.js';
import { esc, ic, ill, fmtISO, fmtDay, plural, modeIcon } from '../dom.js';
import { masthead, cityBar, legend, bookRow, placeRow, art } from '../components.js';
import { stage, statusOf, isBooked, itemsOn, walkMinutes, km, sortedStays } from '../../models/schema.js';
import { timelineView } from './plan.js';
import { allPhotoIds } from './journal.js';

let slideTimer = null, slideIdx = 0;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite';
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
  return hero + `<div class="head" style="padding-top:4px;flex-wrap:wrap"><span class="label">Cover · ${esc(label)}</span><span style="display:flex;gap:14px">${btns}</span></div>`;
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

function travelBlock() {
  const t = today();
  const next = S.trip.legs.filter(l => l.date && l.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return '';
  const days = Math.round((new Date(next.date + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5);
  if (days > 3) return '';
  const mode = S.C.edition.leg_modes.find(m => m.id === next.mode);
  return `<div class="block"><div class="head"><h2>${days === 0 ? 'Travel day' : days === 1 ? 'Travel tomorrow' : `Travel in ${days} days`}</h2><button class="text-btn" data-act="go" data-tab="essentials" data-focus="#connBlock">Options</button></div>
    <div class="legrow">${ic(modeIcon(next.mode))}<span>${esc(cityName(next.from_city_id))} to ${esc(cityName(next.to_city_id))}, ${esc(fmtDay(next.date))}${mode ? ' · ' + esc(mode.label) : ''}</span></div>
    ${!mode ? '<p class="small muted">Decide how you’re getting there in Essentials. Drivers and trains are worth booking a day or two ahead.</p>' : ''}</div>`;
}

function baseBlock(cityId, st) {
  const sy = stayHere(cityId), c = cityOf(cityId);
  if (!sy || (!sy.neighborhood_id && !sy.address)) {
    return `<div class="block"><h2>Where are you staying in ${esc(cityName(cityId))}?</h2><p class="small muted">Add your ${c.region ? 'town' : 'neighborhood'} for local tips, walking times and a one-tap “take me home” for drivers.</p><button class="btn line" data-act="welcome" data-step="3" style="align-self:flex-start">Add where you’re staying</button></div>`;
  }
  const h = hoodOf(cityId, sy.neighborhood_id), home = homePoint(cityId);
  let walk = '';
  if (home && h && h.central && !c.region) { const m = walkMinutes(home, c.landmark_center); walk = m <= 5 ? `A few minutes’ walk to ${c.landmark_center.name}.` : m <= 45 ? `About ${m} minutes’ walk to ${c.landmark_center.name}.` : ''; }
  let arrive = '';
  const firstStay = sortedStays(S.trip)[0];
  if (st.k === 'before' && firstStay && firstStay.city_id === cityId && (S.trip.arrival.via || S.trip.arrival.flight)) {
    const via = S.trip.arrival.via, opt = S.C.edition.arrival_options.find(o => o.id === via);
    const ap = (c.airports || []).find(a => a.id === via);
    arrive = `<div style="display:flex;flex-direction:column;gap:4px;padding-top:6px"><div class="label">Arriving${firstStay.start ? ' ' + esc(fmtISO(firstStay.start)) : ''}${opt ? ' · ' + esc(opt.label) : ''}</div>${ap ? `<p class="small">${esc(ap.tip)}</p>` : ''}
      ${S.trip.arrival.flight ? `<a class="btn line sm" style="align-self:flex-start" href="https://www.google.com/search?q=${encodeURIComponent('flight ' + S.trip.arrival.flight)}" target="_blank" rel="noopener">Track flight ${esc(S.trip.arrival.flight)} ↗</a>` : ''}</div>`;
  }
  return `<div class="block"><div class="head"><h2>Your base</h2><button class="text-btn" data-act="go" data-tab="essentials" data-focus="#tripBlock">Edit</button></div>
    <div><h3>${esc(sy.label || 'Where you’re staying')}</h3><div class="meta" style="font-size:12.5px;color:var(--muted)">${esc(h ? h.name : '')}${sy.address ? ' · ' + esc(sy.address) : ''}${sy.start ? ' · ' + esc(fmtISO(sy.start)) + (sy.end ? ' to ' + esc(fmtISO(sy.end)) : '') : ''}</div></div>
    ${h && h.tip ? `<p class="small">${esc(h.tip)}</p>` : ''}${walk ? `<p class="small muted">${esc(walk)}</p>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="homedriver">${ic('taxi', 'style="width:16px;height:16px"')}Take me home</button>${home ? `<button class="btn line sm" data-act="go" data-tab="essentials" data-focus="#fareBlock">Taxi fare estimate</button>` : ''}</div>${arrive}</div>`;
}

function planBlock(st) {
  const n = S.trip.plan.length;
  if (isPlanner()) {
    if (st.k === 'during') {
      const items = itemsOn(S.trip, today());
      return `<div class="block"><div class="head"><h2>Today’s plan</h2><button class="text-btn" data-act="pview" data-v="plan" data-tab="places">Full plan</button></div>${items.length ? timelineView(today(), items, true) : '<p class="serif" style="font-size:17px">Nothing scheduled today. An open day to wander.</p>'}</div>`;
    }
    if (st.k === 'before') return `<div class="block"><div class="head"><h2>Your plan</h2><button class="text-btn" data-act="pview" data-v="plan" data-tab="places">Open plan</button></div><p class="small">${n ? `${plural(n, 'thing')} scheduled so far.` : 'Pick a day and time for the places you want to see. You can always change it.'}${hasStays() ? '' : ' Add your stays and dates first.'}</p></div>`;
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
  return [m.label, (ph.situations[m.situation] || [])[m.index] || ph.situations.Greetings[0]];
}

function ideas(cityId) {
  const list = placesIn(cityId, ['sight', 'food', 'shop']);
  const wantGroups = new Set(list.filter(p => statusOf(S.trip, p.id) === 'want' || p.must).map(p => p.group));
  const pool = list.filter(p => !p.must && wantGroups.has(p.group) && !statusOf(S.trip, p.id));
  const offset = new Date().getDate() % Math.max(pool.length, 1);
  return pool.slice(offset).concat(pool.slice(0, offset)).slice(0, 3);
}

export function renderToday() {
  const st = stage(S.trip), cityId = curCityId(), c = cityOf(cityId), name = S.trip.traveler_name;
  let eyebrow, h1, lede;
  if (st.k === 'before') {
    eyebrow = st.days == null ? 'Portugal · add your stays' : (st.days === 0 ? 'Your trip starts today' : `Trip starts in ${plural(st.days, 'day')}`);
    h1 = `${cityTitle(cityId)} awaits${name ? ', ' + name : ''}!`;
    lede = isWanderer() ? 'No plan needed. When you arrive, open Nearby and see what’s worth a look around you.' : 'Book the few things that sell out, save some ideas, and leave room to wander.';
  } else if (st.k === 'during') {
    eyebrow = `Day ${st.day} of ${st.total} · ${cityName(cityId)}`;
    h1 = `${greeting()}${name ? ', ' + name : ''}!`;
    lede = isWanderer() ? 'Open Nearby to see what’s close, or just walk and see where the day goes.' : 'A few ideas for today. Mark “Went here” as you go and it becomes your journal.';
  } else { eyebrow = 'Trip complete'; h1 = 'Portugal, remembered!'; lede = 'Your places and notes are ready to share.'; }

  const toBook = placesIn(cityId).filter(p => p.booking_status === 'required' && (p.must || p.urgency_level === 'book_soon') && p.category !== 'experience' && p.category !== 'day_trip')
    .sort((a, b) => (a.urgency_level === 'book_soon' ? 0 : 1) - (b.urgency_level === 'book_soon' ? 0 : 1));
  const unbooked = toBook.filter(p => !isBooked(S.trip, p.id));
  const note = S.C.essentials.travel_notes[new Date().getDate() % S.C.essentials.travel_notes.length];
  const [moment, ph] = phraseNow();
  const wants = placesIn(cityId).filter(p => statusOf(S.trip, p.id) === 'want');
  const visited = S.trip.saved.filter(s => s.status === 'went').length;

  let html = masthead() + `<div class="greet"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1><p class="lede">${esc(lede)}</p></div>${cityBar()}<div style="height:10px"></div>${coverHero(cityId)}`;

  if (!hasStays()) {
    html += `<div class="block" style="padding-top:18px"><div style="border:1px solid var(--rule);padding:14px;display:flex;flex-direction:column;gap:8px"><div class="label">Your trip</div><p class="small">Add where you’re staying in Lisbon and the Algarve, with dates, and the app follows you from place to place.</p><button class="btn sm" data-act="welcome" data-step="3" style="align-self:flex-start">Add my stays</button></div></div>`;
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
    ${convert ? `<button data-act="go" data-tab="essentials" data-focus="#amtIn">${ic('convert')}Convert</button>` : `<button data-act="go" data-tab="phrases">${ic('phrases')}Say it</button>`}
    <button data-act="go" data-tab="essentials" data-focus="#taxiBlock">${ic('taxi')}Taxi</button>
    <button class="rec" data-act="go" data-tab="journal" data-focus="#jText"><span>${ic('mic')}</span>Record</button></div>`;

  if (isWanderer() && st.k !== 'after') {
    html += `<div class="block"><div class="head"><h2>Wander now</h2><span class="label">True Wanderer</span></div><p class="serif" style="font-size:17px">See the curated spots closest to you on a live map, with what they cost and how to get there.</p>
      <button class="btn" data-act="pview" data-v="nearby" data-tab="places" style="align-self:flex-start">${ic('compass', 'style="width:18px;height:18px"')}What’s near me</button></div>`;
  }
  html += travelBlock();

  if (st.k !== 'after' && toBook.length) {
    html += unbooked.length ? `<div class="block"><div class="head"><h2>${st.k === 'before' ? 'Book before you go' : 'Still to book'}</h2><span class="label">${toBook.length - unbooked.length}/${toBook.length} done</span></div>
      <p class="small muted">${esc(cityName(cityId))} sights that sell out or have timed entry. Checked Oct 9, 2026.</p>${legend()}<div class="rows">${unbooked.map(bookRow).join('')}</div></div>`
      : `<div class="block"><h2>All booked in ${esc(cityName(cityId))}</h2><p class="small muted">Everything that needs a ticket is sorted. Nice work.</p></div>`;
  }
  if (st.k === 'before') {
    const xs = placesIn(cityId, ['experience', 'day_trip']);
    const wantX = xs.filter(x => statusOf(S.trip, x.id) === 'want' && !isBooked(S.trip, x.id));
    html += `<div class="block"><div class="head"><h2>Experiences &amp; day trips</h2><button class="text-btn" data-act="pview" data-v="experiences" data-tab="places">Browse</button></div>
      <p class="small">${wantX.length ? `On your list, not booked yet: ${wantX.map(x => esc(x.name)).join(', ')}.` : esc(xs.slice(0, 4).map(x => x.name).join(', ')) + ' and more.'}</p></div>`;
  }
  html += planBlock(st);
  html += baseBlock(cityId, st);
  html += `<div class="note">${ic(note[0])}<div style="display:flex;flex-direction:column;gap:3px"><div class="label coral">${esc(note[1])}</div><p class="serif">${esc(note[2])}</p></div></div>`;

  if (st.k !== 'after') {
    const id = ideas(cityId);
    if (id.length) html += `<div class="block"><div class="head"><h2>${st.k === 'during' ? 'Ideas for today' : 'Ideas to save'}</h2><button class="text-btn" data-act="pview" data-v="sights" data-tab="places">All places</button></div>
      ${wants.length ? `<p class="small muted">On your list: ${wants.slice(0, 4).map(p => esc(p.name)).join(', ')}${wants.length > 4 ? ' and more' : ''}.</p>` : ''}
      <div class="rows">${id.map(p => placeRow(p, true)).join('')}</div></div>`;
  }
  html += `<div class="block"><div class="panel"><div class="label">Phrase for ${esc(moment.toLowerCase())}</div>
    <div style="display:flex;gap:12px;align-items:center;justify-content:space-between"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><div class="it">${esc(ph[0])}</div><div class="say">${esc(ph[1])}</div><div class="en">${esc(ph[2])}</div></div>
    <button class="hear" data-act="say" data-text="${esc(ph[0])}" aria-label="Hear it">${ic('speak')}</button></div>
    <button class="text-btn" data-act="go" data-tab="phrases" style="align-self:flex-start;min-height:32px">More phrases</button></div></div>`;

  if (st.k === 'after' || visited) {
    html += `<div class="block"><div class="head"><h2>${st.k === 'after' ? 'Your trip' : 'So far'}</h2><button class="text-btn" data-act="go" data-tab="journal">Journal</button></div>
      <p class="serif" style="font-size:18px">${plural(visited, 'place')} visited, ${S.trip.journal.length} journal entr${S.trip.journal.length === 1 ? 'y' : 'ies'}.</p>
      ${st.k === 'after' ? `<button class="btn" data-act="go" data-tab="journal" data-focus="#summary">See your trip summary</button>` : ''}</div>`;
  } else {
    html += `<div class="block"><h2>Journal</h2><p class="serif" style="font-size:18px">Your first memory will appear here. Say it out loud or type it.</p>
      <button class="btn" data-act="go" data-tab="journal" data-focus="#jText" style="align-self:flex-start">${ic('mic', 'style="width:18px;height:18px"')}Record a memory</button></div>`;
  }
  document.querySelector('section[data-tab="today"]').innerHTML = html;
  addMount(startSlides);
}
