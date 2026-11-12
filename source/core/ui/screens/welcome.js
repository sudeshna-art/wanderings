/* Welcome steps (simplified Oct 11 2026; Oct 12 2026 adds an optional "your group" step): you, where you're staying,
   who's coming (kids, easy walking, food notes, occasions), how you like to travel.
   Arrival details now come from bookings or Essentials. Everything stays on this phone. */
import { EDITION } from '../../../edition.config.js';
import { S, copyOf, placeName } from '../state.js';
import { esc, ic } from '../dom.js';
import { styleChoice, staysEditor, homeCurrencySelect } from '../components.js';
import { languageSelect } from './phrases.js';
import { groupEditor, occasionsEditor } from './group.js';
import { peopleEditor } from './together.js';
import { currencyService } from '../../services/currency-service.js';
import { cityOf, cityIds } from '../state.js';

/* "Prices convert from euros into your currency" in the destination's own money. */
function curNote() {
  const codes = [...new Set(cityIds().map(id => cityOf(id).currency_code))];
  const names = codes.map(c => currencyService.lower(c) + 's').join(' and ');
  return codes.includes('EUR') ? `Prices convert from ${names} into your currency.` : `Prices here are in ${names}. If your money is different, the app converts it.`;
}

export const W = { step: 1 };
const STEPS = 3;   /* Oct 12 2026: travel style moved into step 1 */

export function renderWelcome() {
  const w = document.getElementById('welcome');
  if (W.step > STEPS) W.step = STEPS;
  const dots = Array.from({ length: STEPS }, (_, i) => i + 1).map(i => `<span style="width:${i === W.step ? 22 : 8}px;height:8px;border-radius:999px;background:${i === W.step ? 'var(--accent)' : 'var(--rule)'}"></span>`).join('');
  let body = '';
  if (W.step === 1) body = `<div class="eyebrow">Welcome to Wanderings</div><h1>Let’s plan your trip!</h1><p class="lede">This is ${esc(EDITION.name)}, for ${esc(copyOf('place_list', placeName()))}. A few quick questions. Everything stays on this phone, and you can change it anytime.</p>
    <label class="f" style="flex:none">What should we call you?<input type="text" data-bind="traveler_name" value="${esc(S.trip.traveler_name)}" autocomplete="given-name" placeholder="Your first name"></label>
    ${languageSelect('wLang')}
    <p class="small faint" style="margin-top:-8px">Phrase meanings and audio stories appear in your language.</p>
    ${styleChoice('wstyle', { large: true })}
    ${homeCurrencySelect()}
    <p class="small faint" style="margin-top:-8px">${esc(curNote())}</p>`;
  if (W.step === 2) body = `<div class="eyebrow">Step 2 of ${STEPS}</div><h1>Where are you staying?</h1><p class="lede">Add each place with its dates.${copyOf('follow') ? ' ' + esc(copyOf('follow')) : ''} Not sure yet? Skip it and fill it in later.</p>
    <div class="label" style="margin-top:4px">Your trip dates</div>
    <div class="fields"><label class="f">Trip starts<input type="date" data-bind="dates.start" value="${esc((S.trip.dates || {}).start || '')}"></label><label class="f">Trip ends<input type="date" data-bind="dates.end" value="${esc((S.trip.dates || {}).end || '')}"></label></div>
    <div class="label" style="margin-top:4px">Where you’re staying (optional)</div>
    <button class="btn line sm" data-act="imopen" style="align-self:flex-start">${ic('upload', 'style="width:16px;height:16px"')}Have booking emails? Import them</button>${staysEditor()}`;
  if (W.step === 3) body = `<div class="eyebrow">Step 3 of ${STEPS} · optional</div><h1>Who’s coming?</h1><p class="lede">So the app can point out what suits your group. Skip anything that doesn’t apply.</p>${peopleEditor()}${groupEditor()}${occasionsEditor()}`;
  w.innerHTML = `<div class="inner"><div style="display:flex;gap:6px">${dots}</div>${body}
    <div style="display:flex;gap:8px;margin-top:auto;padding-top:16px">${W.step > 1 ? '<button class="btn line" data-act="wback" style="flex:1">Back</button>' : '<button class="btn line" data-act="wdone" style="flex:1">Skip for now</button>'}<button class="btn" data-act="${W.step < STEPS ? 'wnext' : 'wdone'}" style="flex:1">${W.step < STEPS ? 'Next' : 'Done'}</button></div></div>`;
  w.hidden = false;
}
export const STEP_COUNT = STEPS;
