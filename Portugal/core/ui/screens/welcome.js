/* Welcome steps: name and currency, travel style, stays, arriving and leaving. Everything stays on this phone. */
import { EDITION } from '../../../edition.config.js';
import { S } from '../state.js';
import { esc } from '../dom.js';
import { styleChoice, staysEditor, arrivalFields, homeCurrencySelect } from '../components.js';

export const W = { step: 1 };
const STEPS = 4;

export function renderWelcome() {
  const w = document.getElementById('welcome');
  const dots = Array.from({ length: STEPS }, (_, i) => i + 1).map(i => `<span style="width:${i === W.step ? 22 : 8}px;height:8px;border-radius:999px;background:${i === W.step ? 'var(--accent)' : 'var(--rule)'}"></span>`).join('');
  let body = '';
  if (W.step === 1) body = `<div class="eyebrow">Welcome to Wanderings</div><h1>Let’s plan your trip!</h1><p class="lede">This is ${esc(EDITION.name)}, for Lisbon and the Algarve. A few quick questions. Everything stays on this phone, and you can change it anytime.</p>
    <label class="f" style="flex:none">What should we call you?<input type="text" data-bind="traveler_name" value="${esc(S.trip.traveler_name)}" autocomplete="given-name" placeholder="Your first name"></label>
    ${homeCurrencySelect()}
    <p class="small faint" style="margin-top:-8px">Prices convert from euros into your currency.</p>`;
  if (W.step === 2) body = `<div class="eyebrow">Step 2 of ${STEPS}</div><h1>How do you like to travel?</h1><p class="lede">This changes how the Places tab works. Switch anytime in Essentials.</p>${styleChoice('wstyle')}`;
  if (W.step === 3) body = `<div class="eyebrow">Step 3 of ${STEPS}</div><h1>Where are you staying?</h1><p class="lede">Add each place with its dates. The app follows you from Lisbon to the Algarve. Not sure yet? Pick “Not sure” and fill it in later.</p>${staysEditor()}`;
  if (W.step === 4) body = `<div class="eyebrow">Step 4 of ${STEPS}</div><h1>Arriving and leaving</h1><p class="lede">Optional. It helps with airport tips and tracking flights.</p>${arrivalFields()}`;
  w.innerHTML = `<div class="inner"><div style="display:flex;gap:6px">${dots}</div>${body}
    <div style="display:flex;gap:8px;margin-top:auto;padding-top:16px">${W.step > 1 ? '<button class="btn line" data-act="wback" style="flex:1">Back</button>' : '<button class="btn line" data-act="wdone" style="flex:1">Skip for now</button>'}<button class="btn" data-act="${W.step < STEPS ? 'wnext' : 'wdone'}" style="flex:1">${W.step < STEPS ? 'Next' : 'Done'}</button></div></div>`;
  w.hidden = false;
}
export const STEP_COUNT = STEPS;
