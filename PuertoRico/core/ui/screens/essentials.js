/* Essentials: emergency card, you and your trip, bookings, getting between places, currency, getting around,
   taxis, audio, know-how, emergencies. */
import { EDITION } from '../../../edition.config.js?v=202610121715';
import { S, P, save, curCityId, cityOf, cityName, cityIds, spot, spotOptions, homePoint, addMount } from '../state.js?v=202610121715';
import { esc, ic, fmtNum, parseNum, fmtISO, $, modeIcon } from '../dom.js?v=202610121715';
import { masthead, cityBar, styleChoice, staysEditor, arrivalFields, homeCurrencySelect } from '../components.js?v=202610121715';
import { currencyService } from '../../services/currency-service.js?v=202610121715';
import { fareService } from '../../services/fare-service.js?v=202610121715';
import { speechService } from '../../services/speech-service.js?v=202610121715';
import { languageSelect } from './phrases.js?v=202610121715';
import { offlineMapsBlock, fillOfflineMaps } from './offline.js?v=202610121715';
import { bookingsBlock } from './bookings.js?v=202610121715';
import { clean } from '../theme.js?v=202610121715';
import { groupBlock, ridesBlock } from './group.js?v=202610121715';

export const E = { rate: null };

function connections() {
  const legs = S.trip.legs.length ? S.trip.legs : [{ from_city_id: cityIds()[0], to_city_id: cityIds()[1], date: '', mode: '' }];
  return legs.map(l => {
    const c = cityOf(l.from_city_id); const con = (c.connections || []).find(x => x.to_city_id === l.to_city_id);
    if (!con) return '';
    const items = con.items.slice().sort((a, b) => (a.mode === l.mode ? -1 : 0) - (b.mode === l.mode ? -1 : 0));
    return `<div style="display:flex;flex-direction:column;gap:6px"><h3>${esc(cityName(l.from_city_id))} to ${esc(cityName(l.to_city_id))}${l.date ? `<span class="small muted" style="font-weight:400"> · ${esc(fmtISO(l.date, { weekday: 'short', month: 'short', day: 'numeric' }))}</span>` : ''}</h3>
      <ul class="plain">${items.map(it => `<li><b>${ic(modeIcon(it.mode), 'style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;color:var(--accent-deep)"')}${esc(it.title)}${it.mode === l.mode ? ' <span class="urg flexible" style="margin:0 0 0 4px">Your choice</span>' : ''}</b>${esc(it.text)}${it.link ? `<br><a href="${esc(it.link.url)}" target="_blank" rel="noopener">${esc(it.link.label)} ↗</a>` : ''}</li>`).join('')}</ul></div>`;
  }).join('');
}

function currencyBlock(c) {
  const home = S.trip.home_currency, local = c.currency_code;
  if (!home) return clean() ? `<div class="block" id="convBlock"><h2>Currency</h2>${homeCurrencySelect()}</div>` : `<div class="block" id="convBlock"><h2>Currency</h2><p class="small muted">Pick your home currency above and the converter appears here.</p></div>`;
  if (home === local) return `<div class="block" id="convBlock"><h2>Currency</h2><p class="small muted">Your home currency is the ${esc(currencyService.lower(local))}, the same as here, so there’s nothing to convert.</p></div>`;
  const toHome = P().cdir !== 'home2local';
  const sh = currencyService.symbol(home), sl = currencyService.symbol(local);
  const ess = S.C.essentials;
  return `<div class="block" id="convBlock"><div class="head"><h2>Currency</h2><span class="ph-flag">Estimate</span></div>
    <div class="chips" role="tablist" aria-label="Direction" style="margin-top:-2px">
      <button class="chip" data-act="cdir" data-v="local2home" aria-pressed="${toHome}">${esc(currencyService.name(local))} → ${esc(currencyService.name(home))}</button>
      <button class="chip" data-act="cdir" data-v="home2local" aria-pressed="${!toHome}">${esc(currencyService.name(home))} → ${esc(currencyService.name(local))}</button></div>
    <label class="f" style="flex:none">${toHome ? 'Price in ' + esc(currencyService.lower(local)) + 's' : 'Amount in ' + esc(home)}<div class="big"><span>${esc(toHome ? sl : sh)}</span><input id="amtIn" inputmode="decimal" value="${esc(P().camt || '20')}" aria-describedby="convOut"></div></label>
    <div id="convOut" aria-live="polite" style="font-family:var(--mono);font-size:30px;font-variant-numeric:tabular-nums;padding:4px 0"></div>
    <p class="small muted" id="rateLine">Getting today’s rate…</p>
    <h3 style="margin-top:6px">Typical prices</h3>
    <div class="grid3" id="typGrid">${ess.typical_prices.map(t => `<div><b>${esc(t.label)}</b>${sl}${Number.isInteger(t.amount) ? t.amount : t.amount.toFixed(2)}<span data-typ="${t.amount}" style="display:block;color:var(--muted)"></span></div>`).join('')}</div>
    <p class="small faint">${esc(ess.typical_note)}</p>
    <details style="margin-top:4px"><summary class="small" style="cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--accent-deep);font-weight:600">Use my own rate</summary>
      <p class="small muted">For example, the rate your bank app shows.</p>
      <div class="fields" style="align-items:flex-end"><label class="f" style="flex:0 1 180px">${esc(sl)}1 equals ${esc(sh)}<input id="rateIn" inputmode="decimal" placeholder="e.g. 4.1"></label><button class="btn line" data-act="saverate">Save rate</button><button class="btn line" data-act="resetrate">Use reference rate</button></div></details></div>`;
}

export async function loadRate() {
  const c = cityOf(curCityId()), home = S.trip.home_currency;
  if (!home || home === c.currency_code) return;
  E.rate = await currencyService.getRate(c.currency_code, home);
  const rl = $('#rateLine'); if (!rl) return;
  const r = E.rate, sh = currencyService.symbol(home), sl = currencyService.symbol(c.currency_code);
  if (!r) { rl.textContent = 'No rate available offline yet. Connect once to load one.'; return; }
  const when = r.as_of ? fmtISO(r.as_of) : '';
  rl.textContent = (r.manual ? `Using your own rate: ${sl}1 = ${sh}${r.rate} (set ${when}).` : `${r.live ? 'Today’s reference rate' : 'Saved reference rate'}: ${sl}1 ≈ ${sh}${r.rate.toFixed(r.rate < 10 ? 4 : 2)}${when ? ' (' + when + ')' : ''}. ${r.note || ''} Source: ${r.source}.`) + ' Your card or bank uses its own rate and may add fees, so treat this as a close estimate.';
  document.querySelectorAll('[data-typ]').forEach(el => { el.textContent = ` ≈ ${sh}${fmtNum(+el.dataset.typ * r.rate)}`; });
  updateConv();
}
export function updateConv() {
  const out = $('#convOut'), inp = $('#amtIn'); if (!out || !inp || !E.rate) return;
  const a = parseNum(inp.value), r = E.rate.rate, toHome = P().cdir !== 'home2local';
  const c = cityOf(curCityId());
  if (!isFinite(a)) { out.textContent = ''; return; }
  out.textContent = toHome ? `≈ ${currencyService.symbol(S.trip.home_currency)}${fmtNum(a * r)}` : `≈ ${currencyService.symbol(c.currency_code)}${fmtNum(a / r)}`;
}

const SEP = '<span class="sep"></span><span class="sep" style="display:none"></span>';   /* two spans keep the label/value columns aligned */
let SYM = '€';   /* set from the city's tariff currency on each render */
const money = n => SYM + n.toFixed(2);
const whole = n => SYM + (Number.isInteger(n) ? n : n.toFixed(2));   /* flat fares read better without cents */
/* Official tariff table. Simple tariffs (flag fall, per km, per minute) and period tariffs (day, holiday, night). */
function tariffRows(t) {
  SYM = currencyService.symbol(t.currency_code || 'EUR');
  if ((t.zones || []).length) {   /* zone fares (Oct 12 2026): fixed fares from the airport to each tourist zone */
    let h = t.zones.filter(z => z.airport_fare != null).map(z => `<span>${esc(t.zones_from || 'Airport')} to ${esc(z.name)}</span><span>${whole(z.airport_fare)}</span>`).join('');
    if ((t.supplements || []).length) h += SEP + t.supplements.map(x => `<span>${esc(x.label)}</span><span>+${money(x.amount)}</span>`).join('');
    return h;
  }
  if (!(t.periods || []).length) {
    return `<span>Flag fall</span><span>${money(t.base)}</span><span>Per km</span><span>${money(t.per_km)}</span>${t.per_min ? `<span>Per minute of travel</span><span>${money(t.per_min)}</span>` : ''}${t.call_fee ? `<span>Calling for a taxi</span><span>+${money(t.call_fee)}</span>` : ''}`;
  }
  let h = t.periods.map(p => `<span>Meter start, ${esc(p.rule || p.label)}</span><span>${money(p.base)}</span>`).join('');
  h += `<span>Then per km</span><span>${money(t.per_km)}${t.per_km_after ? '–' + money(t.per_km_after).slice(1) : ''}</span>`;
  if (t.per_hour_slow) h += `<span>Plus time in slow traffic</span><span>${money(t.per_hour_slow)}/h</span>`;
  (t.fixed_fares || []).forEach(ff => { h += SEP + t.periods.filter(p => ff.amounts[p.id] != null).map(p => `<span>${esc(ff.label)}, ${esc(p.label)}</span><span>${whole(ff.amounts[p.id])}</span>`).join(''); });
  if ((t.supplements || []).length) h += SEP + t.supplements.map(x => `<span>${esc(x.label)}</span><span>+${money(x.amount)}</span>`).join('');
  return h;
}
function taxiBlock(c) {
  const t = c.taxi_tariff, from = homePoint() ? '__home' : ((c.airports || [])[0] ? '__air:' + c.airports[0].id : '');
  const opts = sel => spotOptions().map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const firstPlace = spotOptions().find(([v]) => !v.startsWith('__'));
  const tx = c.taxis || {};
  return `<div class="block" id="taxiBlock" tabindex="-1"><h2>Taxis in ${esc(cityName(c.city_id))}</h2>
    ${tx.intro ? `<p class="small">${tx.intro_bold ? `<b>${esc(tx.intro_bold)}</b> ` : ''}${esc(tx.intro)}</p>` : ''}
    ${(tx.numbers || []).length ? `<div>${tx.numbers.map(n => `<div class="numrow"><div><div class="n">${esc(n.number)}</div><div class="small muted">${esc(n.label)}</div></div><button class="text-btn" data-act="copy" data-text="${esc(n.number)}">Copy</button></div>`).join('')}</div>` : ''}
    ${tx.apps ? `<p class="small muted">${esc(tx.apps)}</p>` : ''}
    <div id="fareBlock" tabindex="-1" style="display:flex;flex-direction:column;gap:10px;padding-top:6px"><h3>Fare estimate</h3>
      <div class="fields"><label class="f">From<select id="fFrom">${opts(from)}</select></label><label class="f">To<select id="fTo">${opts(firstPlace ? firstPlace[0] : '')}</select></label></div>
      <div id="fareOut"></div></div>
    <h3 style="margin-top:10px">${esc(t.table_title || ('Official ' + (t.periods ? 'fares' : 'tariff')))}</h3>
    <div class="kv">${tariffRows(t)}</div>
    ${(t.discounts || []).map(d => `<p class="small"><b>${esc(d.title)}:</b> ${esc(d.text)}</p>`).join('')}
    <p class="small faint">${t.periods ? '' : esc(t.note) + ' '}Source: ${esc(t.source)}, checked ${esc(fmtISO(t.checked))}.</p>
    ${t.rush_note ? `<p class="small muted"><b>Rush hour:</b> ${esc(t.rush_note)}</p>` : ''}
    <button class="btn line" data-act="ptabgo" data-v="${esc((S.C.phrases.driver && S.C.phrases.driver.situation) || 'Taxi and transport')}" style="align-self:flex-start">Taxi phrases &amp; “Show driver”</button></div>`;
}
export async function showFare() {
  const out = $('#fareOut'); if (!out) return;
  const a = spot($('#fFrom').value), b = spot($('#fTo').value);
  const pt = s => s && s.location ? Object.assign({}, s.location, s.airport_id ? { airport_id: s.airport_id } : {}) : null;
  const r = await fareService.estimate(pt(a), pt(b), curCityId());
  if (r.err) { out.innerHTML = `<p class="small muted">${esc(r.hint ? r.err + ' ' + r.hint : r.err)}</p>`; return; }
  out.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="font-family:var(--mono);font-size:30px;font-variant-numeric:tabular-nums">${esc(currencyService.symbol(r.currency_code))}${r.lo}${r.hi !== r.lo ? '–' + r.hi : ''}</span><span class="small muted">${r.fixed ? esc(r.fixed_label ? r.fixed_label.toLowerCase() : 'flat fare') : 'estimate'}${r.period ? ' · ' + esc(r.period.label) + ' rates' : ''}${r.fixed ? '' : ` · about ${r.km.toFixed(1)} km by road`}</span></div>${r.period || r.fixed ? `<p class="small faint">${esc(r.note)}</p>` : ''}`;
}

async function voiceBlock() {
  const ph = S.C.phrases, v = await speechService.voiceInfo(ph.language);
  const el = $('#voiceInfo'); if (!el) return;
  el.innerHTML = v ? (v.exact ? `Using the ${esc(ph.language_name)} voice “${esc(v.name)}” on this phone.` : `Using “${esc(v.name)}” (${esc(v.lang)}). ${esc(ph.voice_region_note || 'It is a voice from another region, so a local voice is better:')}`) : `<b>This phone has no ${esc(ph.language_name)} voice installed</b>, so phrases can’t play yet.`;
}

export function renderEssentials() {
  const c = cityOf(curCityId()), ess = S.C.essentials, ga = c.getting_around;
  let html = masthead() + `<div class="greet"><h1>The practical bits.</h1></div>
  <button class="btn line" data-act="emergency" style="align-self:flex-start">${ic('sos', 'style="width:18px;height:18px"')}Emergency card · works offline</button>
  <div class="block" id="tripBlock" tabindex="-1" style="padding-top:22px"><h2>You &amp; your trip</h2>
    <div class="fields"><label class="f">Your first name<input type="text" data-bind="traveler_name" value="${esc(S.trip.traveler_name)}" autocomplete="given-name" placeholder="Used in your greeting"></label></div>
    ${clean() ? '' : languageSelect('eLang')}
    ${homeCurrencySelect()}
    ${clean() ? '' : styleChoice('estyle')}
    <h3 style="margin-top:10px">Where you’re staying</h3>
    ${staysEditor({ info: cityIds().length < 2 })}
    <h3 style="margin-top:10px">Arriving and leaving</h3>
    ${arrivalFields()}
    ${S.trip.departure.flight ? `<a class="btn line sm" style="align-self:flex-start" href="https://www.google.com/search?q=${encodeURIComponent('flight ' + S.trip.departure.flight)}" target="_blank" rel="noopener">Track departure flight ${esc(S.trip.departure.flight)} ↗</a>` : ''}
    ${S.trip.refs ? `<div class="fields"><label class="f">Booking notes<input type="text" data-bind="refs" value="${esc(S.trip.refs)}"></label></div><p class="small faint">From before bookings had their own list. You can move these into Your bookings below.</p>` : ''}
    ${clean() ? '' : '<button class="text-btn" data-act="welcome" data-step="1" style="align-self:flex-start">Show the welcome steps again</button>'}</div>
  ${groupBlock()}
  ${bookingsBlock()}
  ${cityIds().length > 1 ? `<div class="block" id="connBlock" tabindex="-1"><h2>Getting between places</h2>${connections()}<p class="small faint">Times are approximate. Check live times on the official sites when you book.</p></div>` : ''}
  ${offlineMapsBlock()}
  ${cityIds().length > 1 ? `<div class="block" style="padding-top:28px"><span class="label">Now showing</span>${cityBar()}</div>` : ''}
  ${currencyBlock(c)}
  <div class="block"><h2>Getting around ${esc(cityName(c.city_id))}</h2><ul class="plain">${ga.items.map(i => `<li><b>${esc(i.title)}</b>${esc(i.text)}${i.link ? `<br><a href="${esc(i.link.url)}" target="_blank" rel="noopener">${esc(i.link.label)} ↗</a>` : ''}</li>`).join('')}</ul>
    ${(ga.links || []).map(l => `<a class="btn line sm" style="align-self:flex-start" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>
  ${taxiBlock(c)}
  ${ridesBlock(c)}
  <div class="block" id="voiceBlock"><h2>Pronunciation audio</h2><p class="small" id="voiceInfo">Checking this phone’s voices…</p>
    <p class="small muted">Phrases use your phone’s built-in voice. For the most natural sound, download a better one (free):</p>
    <ul class="plain">${ess.voice_help.map(v => `<li><b>${esc(v.title)}</b>${esc(v.text)}</li>`).join('')}</ul><p class="small muted">Then close and reopen this app.</p>
    <button class="btn line" data-act="say" data-text="${esc(ess.voice_test)}" style="align-self:flex-start">${ic('speak', 'style="width:18px;height:18px"')}Test: “${esc(ess.voice_test)}”</button></div>
  <div class="block"><h2>Local know-how</h2><ul class="plain">${ess.know_how.map(k => `<li><b>${esc(k.title)}</b>${esc(k.text)}</li>`).join('')}</ul><p class="small faint">${esc(ess.know_how_note)}</p></div>
  <div class="block"><h2>Emergencies</h2><div>${ess.emergency.map(e => `<div class="numrow"><div><div class="n">${esc(e.number)}</div><div class="small muted">${esc(e.label)}</div></div><a class="text-btn" href="tel:${esc(String(e.number).replace(/[^\d+]/g, ''))}">Call</a></div>`).join('')}</div>
    <ul class="plain">${ess.embassies.map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.label)} ↗</a></li>`).join('')}</ul>
    <p class="small muted">${esc(ess.emergency_note)}</p>
    <button class="btn line sm" data-act="emergency" style="align-self:flex-start">${ic('sos', 'style="width:16px;height:16px"')}Open the emergency card</button></div>
  ${clean() ? `<div class="block" id="settingsBlock"><h2>Settings</h2><div class="setgroup">${languageSelect('eLang')}${styleChoice('estyle')}<button class="text-btn" data-act="welcome" data-step="1" style="align-self:flex-start">Show the welcome steps again</button></div></div>` : ''}
  <p class="small faint" style="padding-top:28px">Prices, hours and fares checked ${esc(fmtISO(ess.checked, { month: 'short', day: 'numeric', year: 'numeric' }))} from official sites and travel sources. They change, so confirm when booking.</p>
  <p class="small faint" style="padding-top:10px">Wanderings by Whiskers &amp; Wanderings · ${esc(EDITION.name)} edition</p>`;
  document.querySelector('section[data-tab="essentials"]').innerHTML = html;
  addMount(() => { loadRate(); showFare(); voiceBlock(); fillOfflineMaps(); });
}
