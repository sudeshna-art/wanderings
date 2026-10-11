/* Phrases by situation, shown with meanings in the traveler's own language.
   Tap to hear with the best local voice (never an English fallback). Favorites, search, driver card. */
import { S, P, curCityId, cityName, spot, spotOptions, stayHere, myLang } from '../state.js';
import { esc, ic, toast, $ } from '../dom.js';
import { masthead } from '../components.js';
import { speechService } from '../../services/speech-service.js';
import { CONFIG } from '../../config/default-config.js';
import { phraseFor, speaksLocal } from '../../models/schema.js';

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

/* Small picker reused on Phrases, in the welcome steps and in Essentials. */
export function languageSelect(id = 'langSel') {
  return `<label class="f" style="flex:none">Your language<select id="${id}" data-bind="traveler_language">${CONFIG.languages.map(l => `<option value="${l.code}" ${myLang() === l.code ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select></label>`;
}

/* The phrase entry for the current traveler, shaped for display. */
export const view = entry => phraseFor(entry, myLang());

export function phraseRow(entry) {
  const p = view(entry), lang = myLang(), local = speaksLocal(lang, S.C.phrases.language);
  return `<div class="ph"><div><div class="it">${esc(p.t)}</div>${lang === 'en' ? `<div class="say">${esc(p.say)}</div>` : ''}${local ? '' : `<div class="en">${esc(p.m)}</div>`}</div>
    <button class="star" data-act="fav" data-text="${esc(p.key)}" aria-pressed="${S.trip.favs.includes(p.key)}" aria-label="Save to favorites">${ic('starO')}</button>
    <button class="hear" data-act="say" data-text="${esc(p.t)}" aria-label="Hear ${esc(p.t)}">${ic('speak')}</button></div>`;
}

export function renderPhrases() {
  const ph = S.C.phrases, P_ = ph.situations, lang = myLang();
  const tabs = ['Favorites', ...Object.keys(P_)];
  if (!P().ptab || !tabs.includes(P().ptab)) P().ptab = 'Restaurant';
  const cur = P().ptab, q = pq.trim().toLowerCase();
  const all = Object.values(P_).flat();
  let rows;
  if (q) rows = all.filter(e => { const v = view(e); return [v.t, v.m, v.say].join(' ').toLowerCase().includes(q); });
  else if (cur === 'Favorites') rows = all.filter(e => S.trip.favs.includes(view(e).key));
  else rows = P_[cur] || [];
  const local = speaksLocal(lang, ph.language);
  let html = masthead() + `<div class="greet"><div class="eyebrow">Phrases</div><h1>${esc(ph.title)}</h1><p class="lede">Tap the speaker to hear it. Star the ones you’ll use again.</p></div>
  <div class="fields" style="align-items:flex-end;margin:-6px 0 6px">${languageSelect('phLang')}</div>
  <p class="small muted" style="margin:0 0 10px">${local ? esc(ph.local_note || `You already speak ${ph.language_name}. These are the everyday phrases for the trip, and the audio can still help.`) : esc(ph.note)}${lang !== 'en' && !local ? ' Tap the speaker to hear how each phrase sounds.' : ''}</p>
  <div class="chips" role="toolbar" aria-label="Situations">${tabs.map(t => `<button class="chip" data-act="ptab" data-v="${esc(t)}" aria-pressed="${!q && t === cur}">${t === 'Favorites' ? '★ Favorites' : esc(t)}</button>`).join('')}</div>
  <input type="search" id="phq" placeholder="Search phrases" value="${esc(pq)}" aria-label="Search phrases" style="margin-top:8px">`;
  if (!q && cur === 'Taxi and transport') {
    html += `<div class="block" style="padding-top:22px"><h2>Tell the driver</h2><p class="small muted">Pick a place in ${esc(cityName(curCityId()))} and show the screen to the driver, or tap to hear it.</p>
      <div class="fields" style="align-items:flex-end"><label class="f">Destination<select id="dest">${spotOptions().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>
      <button class="btn" data-act="driver">Show driver</button></div></div>`;
  }
  html += `<div class="rows" style="margin-top:14px">${rows.length ? rows.map(phraseRow).join('')
    : `<p class="serif" style="font-size:18px;padding:16px 0">${q ? `No phrase matches “${esc(pq)}”.` : 'No favorites yet. Tap the star on any phrase.'}</p>`}</div>`;
  document.querySelector('section[data-tab="phrases"]').innerHTML = html;
}

export function showDriver(id) {
  const v = id || ($('#dest') || {}).value; if (!v) return;
  const s = spot(v);
  if (!s) { toast('Add where you’re staying in Essentials, so drivers can read it.'); return; }
  const ph = S.C.phrases, ask = view(ph.driver.ask), lang = myLang();
  const target = v === '__home' ? (stayHere() && stayHere().address) || s.local : s.local;
  const line = ph.driver.template.replace('{place}', target);
  const d = $('#driver');
  d.innerHTML = `<div class="inner"><div class="label">Show this to the driver</div><div class="big-it">${esc(line)}</div>
    ${v === '__home' && !(stayHere() && stayHere().address) ? '<p class="small muted">Tip: add the full street address in Essentials for the driver.</p>' : ''}
    <div class="panel" style="margin:0"><div class="it" style="font-size:20px">${esc(ask.t)}</div>${lang === 'en' ? `<div class="say">${esc(ask.say)}</div>` : ''}<div class="en">${esc(ask.m)}</div></div>
    <div style="display:flex;gap:8px;margin-top:auto"><button class="btn" data-act="say" data-text="${esc(line)}" style="flex:1">${ic('speak', 'style="width:18px;height:18px"')}Play aloud</button><button class="btn line" data-act="closedriver" style="flex:1">Close</button></div></div>`;
  d.hidden = false;
}
