/* Phrases by situation, tap to hear with the best local voice (never an English fallback), favorites, driver card. */
import { S, P, curCityId, cityName, spot, spotOptions, stayHere } from '../state.js';
import { esc, ic, toast, $ } from '../dom.js';
import { masthead } from '../components.js';
import { speechService } from '../../services/speech-service.js';

let pq = '';
export const setQuery = q => { pq = q; };
export const getQuery = () => pq;

export async function say(text) {
  const ph = S.C.phrases;
  const r = await speechService.speak(text, ph.language);
  if (!r.ok) {
    if (r.reason === 'novoice') toast(`No ${ph.language_name} voice on this phone yet. See Essentials, “Pronunciation audio.”`);
    else if (r.reason === 'unsupported') toast('Audio isn’t available in this browser');
    else toast('Audio didn’t play. Check silent mode.');
  }
}

export function renderPhrases() {
  const ph = S.C.phrases, P_ = ph.situations;
  const tabs = ['Favorites', ...Object.keys(P_)];
  if (!P().ptab || !tabs.includes(P().ptab)) P().ptab = 'Restaurant';
  const cur = P().ptab, q = pq.trim().toLowerCase();
  let rows;
  if (q) rows = Object.values(P_).flat().filter(r => r.join(' ').toLowerCase().includes(q));
  else if (cur === 'Favorites') rows = Object.values(P_).flat().filter(r => S.trip.favs.includes(r[0]));
  else rows = P_[cur] || [];
  let html = masthead() + `<div class="greet"><div class="eyebrow">Phrases</div><h1>${esc(ph.title)}</h1><p class="lede">Tap the speaker to hear it. Star the ones you’ll use again.</p></div>
  <p class="small muted" style="margin:-6px 0 10px">${esc(ph.note)} ${esc(ph.gender_note)}</p>
  <div class="chips" role="toolbar" aria-label="Situations">${tabs.map(t => `<button class="chip" data-act="ptab" data-v="${esc(t)}" aria-pressed="${!q && t === cur}">${t === 'Favorites' ? '★ Favorites' : esc(t)}</button>`).join('')}</div>
  <input type="search" id="phq" placeholder="Search, e.g. “water” or “size”" value="${esc(pq)}" aria-label="Search phrases" style="margin-top:8px">`;
  if (!q && cur === 'Taxi and transport') {
    html += `<div class="block" style="padding-top:22px"><h2>Tell the driver</h2><p class="small muted">Pick a place in ${esc(cityName(curCityId()))} and show the screen to the driver, or tap to hear it.</p>
      <div class="fields" style="align-items:flex-end"><label class="f">Destination<select id="dest">${spotOptions().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>
      <button class="btn" data-act="driver">Show driver</button></div></div>`;
  }
  html += `<div class="rows" style="margin-top:14px">${rows.length ? rows.map(([it, sy, en]) => `<div class="ph"><div><div class="it">${esc(it)}</div><div class="say">${esc(sy)}</div><div class="en">${esc(en)}</div></div>
    <button class="star" data-act="fav" data-text="${esc(it)}" aria-pressed="${S.trip.favs.includes(it)}" aria-label="Save to favorites">${ic('starO')}</button>
    <button class="hear" data-act="say" data-text="${esc(it)}" aria-label="Hear ${esc(it)}">${ic('speak')}</button></div>`).join('')
    : `<p class="serif" style="font-size:18px;padding:16px 0">${q ? `No phrase matches “${esc(pq)}”.` : 'No favorites yet. Tap the star on any phrase.'}</p>`}</div>`;
  document.querySelector('section[data-tab="phrases"]').innerHTML = html;
}

export function showDriver(id) {
  const v = id || ($('#dest') || {}).value; if (!v) return;
  const s = spot(v);
  if (!s) { toast('Add where you’re staying in Essentials, so drivers can read it.'); return; }
  const ph = S.C.phrases;
  const target = v === '__home' ? (stayHere() && stayHere().address) || s.local : s.local;
  const line = ph.driver.template.replace('{place}', target);
  const d = $('#driver');
  d.innerHTML = `<div class="inner"><div class="label">Show this to the driver</div><div class="big-it">${esc(line)}</div>
    ${v === '__home' && !(stayHere() && stayHere().address) ? '<p class="small muted">Tip: add the full street address in Essentials for the driver.</p>' : ''}
    <div class="panel" style="margin:0"><div class="it" style="font-size:20px">${esc(ph.driver.ask[0])}</div><div class="say">${esc(ph.driver.ask[1])}</div><div class="en">${esc(ph.driver.ask[2])}</div></div>
    <div style="display:flex;gap:8px;margin-top:auto"><button class="btn" data-act="say" data-text="${esc(line)}" style="flex:1">${ic('speak', 'style="width:18px;height:18px"')}Play aloud</button><button class="btn line" data-act="closedriver" style="flex:1">Close</button></div></div>`;
  d.hidden = false;
}
