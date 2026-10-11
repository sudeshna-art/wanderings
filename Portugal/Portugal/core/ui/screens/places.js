/* Places tab: Plan (Planner), Nearby (True Wanderer), Sights, Experiences, Day trips. Follows the current city. */
import { S, P, save, curCityId, cityOf, cityName, placesIn, isPlanner, isWanderer, placeById } from '../state.js';
import { esc, toast, $$, $, CUSTOM_KINDS, KIND_NAME } from '../dom.js';
import { masthead, cityBar, legend, placeRow, expRow } from '../components.js';
import { statusOf } from '../../models/schema.js';
import { renderPlan } from './plan.js';
import { renderWanderer } from './wanderer.js';

export function views() {
  return (isPlanner() ? [['plan', 'My plan']] : []).concat(isWanderer() ? [['nearby', 'Nearby']] : [], [['sights', 'Sights'], ['experiences', 'Experiences'], ['trips', 'Day trips']]);
}
export function defaultView() { return isPlanner() ? 'plan' : isWanderer() ? 'nearby' : 'sights'; }

export function renderPlaces() {
  const vs = views();
  if (!P().pview || !vs.some(([k]) => k === P().pview)) P().pview = defaultView();
  const v = P().pview;
  const seg = `<div class="chips" role="tablist" aria-label="Places views" style="margin-bottom:4px">${vs.map(([k, l]) => `<button class="chip" data-act="pview" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div>`;
  const root = document.querySelector('section[data-tab="places"]');
  if (v === 'plan') { root.innerHTML = renderPlan(seg); return; }
  if (v === 'nearby') { root.innerHTML = renderWanderer(seg); return; }
  const cityId = curCityId(), c = cityOf(cityId);
  if (v === 'experiences' || v === 'trips') {
    const isTrip = v === 'trips';
    const list = placesIn(cityId, [isTrip ? 'day_trip' : 'experience']);
    root.innerHTML = masthead() + `<div class="greet"><div class="eyebrow">${isTrip ? 'Day trips' : 'Experiences'} · ${esc(cityName(cityId))}</div><h1>${isTrip ? 'Beyond the city.' : 'Worth booking.'}</h1><p class="lede">${isTrip ? 'Easy escapes, and the ones that are better with a driver or a tour.' : 'Classes, tastings and time on the water. The links show current options, prices and reviews from many providers.'}</p></div>${cityBar()}${seg}
      <div class="block" style="padding-top:12px">${legend()}<div class="rows">${list.map(expRow).join('')}</div>
      <p class="small faint">Durations are typical; providers set their own prices and times, so check when booking. Checked Oct 9, 2026.</p></div>`;
    return;
  }
  const f = P().pfilter;
  const filt = p => f === 'all' || (f === 'want' && statusOf(S.trip, p.id) === 'want') || (f === 'went' && statusOf(S.trip, p.id) === 'went');
  const list = placesIn(cityId, ['sight', 'food', 'shop', 'audio_stop']);
  let html = masthead() + `<div class="greet"><div class="eyebrow">Places · ${esc(cityName(cityId))}</div><h1>Where to wander.</h1><p class="lede">Save what catches your eye. Tap “Went here” when you visit and it lands in your journal.</p></div>${cityBar()}${seg}
    <div class="chips" role="toolbar" aria-label="Filter">${[['all', 'All'], ['want', 'Want to go'], ['went', 'Visited']].map(([k, l]) => `<button class="chip" data-act="pfilter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>`;
  const must = list.filter(p => p.must && !p.custom).filter(filt);
  if (must.length) html += `<div class="block"><h2>Must-sees</h2><div class="rows">${must.map(p => placeRow(p)).join('')}</div></div>`;
  (c.groups || []).forEach(g => {
    const gl = list.filter(p => p.group === g.id && !p.must && !p.custom).filter(filt);
    if (gl.length) html += `<div class="block"><h2>${esc(g.name)}</h2><div class="rows">${gl.map(p => placeRow(p)).join('')}</div></div>`;
  });
  const mine = list.filter(p => p.custom).filter(filt);
  if (f === 'all' || mine.length) {
    html += `<div class="block"><h2>Your own places</h2>${mine.length ? `<div class="rows">${mine.map(p => placeRow(p)).join('')}</div>` : ''}
      ${f === 'all' ? `<div class="fields" style="margin-top:4px"><label class="f">Place name<input type="text" id="cName" placeholder="e.g. a restaurant a friend recommended"></label>
      <label class="f">Type<select id="cCat">${CUSTOM_KINDS.map(k => `<option value="${k}">${esc(KIND_NAME[k])}</option>`).join('')}</select></label></div>
      <button class="btn line" data-act="addplace" style="align-self:flex-start">Add to ${esc(cityName(cityId))}</button>` : ''}</div>`;
  }
  if (f !== 'all' && !list.some(filt)) html += `<div class="block"><p class="serif" style="font-size:18px">${f === 'want' ? 'Nothing saved yet. Tap “Want to go” on any place.' : 'No visits yet. Tap “Went here” when you get somewhere.'}</p></div>`;
  root.innerHTML = html;
}

export function addCustomPlace() {
  const n = ($('#cName') || {}).value; if (!n || !n.trim()) { toast('Type a place name first'); return false; }
  S.trip.custom.push({ id: 'c' + Date.now().toString(36), city_id: curCityId(), custom: true, name: n.trim(), category: 'sight', kind: $('#cCat').value, group: 'custom', area: '', location: null, booking_status: 'none', urgency_level: 'flexible', ticket_url: null, affiliate_url: null, price: null, description: '', tips: [], audio: null });
  save(); toast('Added'); return true;
}
