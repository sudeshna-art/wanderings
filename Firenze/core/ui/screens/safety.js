/* Safety (approved Oct 11 2026): an offline emergency card, "meet back here" for when friends split up,
   and sharing your plan with someone at home. Everything stays on this phone until the traveler shares it. */
import { S, save, curCityId, cityName, stayHere, placeById, homePoint, today, myLang } from '../state.js?v=202610120955';
import { esc, ic, toast, $, fmtDay, fmtISO } from '../dom.js?v=202610120955';
import { sortedStays, sortedBookings, itemsOn, bookingKindLabel, tripDays } from '../../models/schema.js?v=202610120955';
import { shareService } from '../../services/share-service.js?v=202610120955';
import { linkService } from '../../services/link-service.js?v=202610120955';
import { clean } from '../theme.js?v=202610120955';
import { hoodOf } from '../state.js?v=202610120955';

const tel = n => 'tel:' + String(n).replace(/[^\d+]/g, '');

/* ---------- emergency card (works offline) ---------- */
export function showEmergency() {
  if (clean()) return showEmergencyClean();
  const ess = S.C.essentials, sy = stayHere(), em = S.trip.emergency || {};
  const d = $('#driver');
  d.innerHTML = `<div class="inner"><div style="display:flex;justify-content:space-between;align-items:center"><div class="label">Emergency card · works offline</div><button class="btn line sm" data-act="closedriver">Close</button></div>
    <a class="btn sos" href="tel:112">${ic('sos', 'style="width:20px;height:20px"')}Call 112</a>
    <p class="small muted" style="margin-top:-8px">Police, ambulance and fire anywhere in Europe. Free from any phone.</p>
    <div>${ess.emergency.filter(e => String(e.number).replace(/\D/g, '') !== '112').map(e => `<div class="numrow"><div><div class="n">${esc(e.number)}</div><div class="small muted">${esc(e.label)}</div></div><a class="btn line sm" href="${esc(tel(e.number))}">Call</a></div>`).join('')}</div>
    <div class="em-box"><div class="label">Where I’m staying${sy ? ' · ' + esc(cityName(sy.city_id)) : ''}</div>
      ${sy && (sy.label || sy.address) ? `<div class="em-big">${esc(sy.label || '')}</div>${sy.address ? `<div style="font-size:18px">${esc(sy.address)}</div>` : '<p class="small muted">Add the street address in Essentials, so anyone can read it.</p>'}
      <button class="btn line sm" data-act="homedriver" style="align-self:flex-start">${ic('taxi', 'style="width:16px;height:16px"')}Show a driver</button>` : '<p class="small muted">Add where you’re staying in Essentials, with the street address.</p>'}</div>
    <div class="em-box"><div class="label">My emergency contact</div>
      <div class="fields"><label class="f">Name<input type="text" data-bind="emergency.name" value="${esc(em.name || '')}" placeholder="e.g. my sister"></label><label class="f">Phone, with country code<input type="text" inputmode="tel" data-bind="emergency.phone" value="${esc(em.phone || '')}" placeholder="+1 555 123 4567"></label></div>
      ${em.phone ? `<a class="btn sm" href="${esc(tel(em.phone))}" style="align-self:flex-start">Call ${esc(em.name || 'my contact')}</a>` : ''}
      <p class="small faint">Saved only on this phone.</p></div>
    <div class="em-box"><div class="label">Let someone know</div>
      <button class="btn line sm" data-act="shareplan" style="align-self:flex-start">${ic('share', 'style="width:16px;height:16px"')}Share my plan</button>
      <p class="small muted">Sends where you’re staying, your bookings and today’s plan as a message you choose who to send to. Booking references are left out.</p>
      <p class="small muted">To share your live location, use Find My on iPhone or location sharing in Google Maps. Both are free and you can stop anytime.</p></div>
    ${(ess.embassies || []).length ? `<div><div class="label" style="margin-bottom:4px">Embassies</div><ul class="plain">${ess.embassies.map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.label)} ↗</a></li>`).join('')}</ul></div>` : ''}
    <p class="small muted">${esc(ess.emergency_note || '')}</p></div>`;
  d.hidden = false; d.scrollTo(0, 0);
}

/* ---------- share my plan ---------- */
export function planText() {
  const t = S.trip, lines = [`${t.traveler_name ? t.traveler_name + '’s' : 'My'} trip plan · ${S.C.edition.name}`];
  const st = sortedStays(t).filter(s => s.start || s.label || s.address);
  if (st.length) {
    lines.push('', 'Staying:');
    st.forEach(s => lines.push(`• ${cityName(s.city_id)}${s.start ? ', ' + fmtISO(s.start, { weekday: 'short', month: 'short', day: 'numeric' }) + (s.end ? ' to ' + fmtISO(s.end, { weekday: 'short', month: 'short', day: 'numeric' }) : '') : ''}${s.label ? ': ' + s.label : ''}${s.address ? ', ' + s.address : ''}`));
  }
  const bs = sortedBookings(t).filter(b => !b.date || b.date >= today());
  if (bs.length) {
    lines.push('', 'Bookings:');
    bs.forEach(b => lines.push(`• ${b.date ? fmtDay(b.date) + ' ' : ''}${b.time || ''} ${b.kind === 'stay' ? 'Check in: ' : ''}${b.title || bookingKindLabel(b.kind)}${b.from && b.to ? ' (' + b.from + ' to ' + b.to + ')' : ''}${b.kind === 'flight' && b.end_time ? ', lands ' + b.end_time : ''}${b.where && b.kind !== 'flight' ? ', ' + b.where : ''}`.replace(/\s+/g, ' ')));
  }
  const d = today(), items = tripDays(t).includes(d) ? itemsOn(t, d) : [];
  if (items.length) { lines.push('', `Today (${fmtDay(d)}):`); items.forEach(p => { const pl = placeById(p.item_id); lines.push(`• ${p.time || 'Anytime'} ${pl ? pl.name : ''}`); }); }
  if (t.meetup && t.meetup.date >= d) lines.push('', `Meeting point: ${t.meetup.name}${t.meetup.time ? ' at ' + t.meetup.time : ''}`);
  lines.push('', 'Emergency number in Europe: 112');
  return lines.join('\n');
}
export async function sharePlan() {
  const text = planText();
  const r = await shareService.shareText(text, 'My trip plan');
  if (r === 'unavailable') { const ok = await shareService.copy(text); toast(ok ? 'Plan copied. Paste it into a message.' : 'Sharing isn’t available here'); }
}

/* ---------- meet back here ---------- */
export function meetForm(boxId, placeId) {
  const box = document.getElementById(boxId); if (!box) return;
  const now = new Date(Date.now() + 60 * 60000), t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes() < 30 ? 0 : 30).padStart(2, '0');
  box.hidden = false;
  box.innerHTML = `<div class="fields" style="align-items:flex-end;margin-top:8px"><label class="f" style="flex:0 1 140px">Meet back at<input type="time" id="meetTime" value="${t}"></label><button class="btn sm" data-act="meetsave" data-id="${esc(placeId || '')}">Save meeting point</button></div>`;
}
export function meetSave(placeId, here) {
  const time = ($('#meetTime') || {}).value || '';
  const p = placeId ? placeById(placeId) : null;
  const loc = p ? p.location : here;
  if (!loc) { toast('Turn on location to save where you are'); return false; }
  S.trip.meetup = { name: p ? p.name : 'Where we split up', location: { lat: loc.lat, lng: loc.lng }, date: today(), time, place_id: p ? p.id : '' };
  save(); toast(`Meeting point saved${time ? ' for ' + time : ''}. It’s on Today.`); return true;
}
export function meetLink(m) { return linkService.directions(m.location, 'walking'); }
export async function meetShare() {
  const m = S.trip.meetup; if (!m) return;
  const text = `Let’s meet back at ${m.name}${m.time ? ' at ' + m.time : ''}. Map: ${linkService.googleMaps({ lat: m.location.lat, lng: m.location.lng, name: m.name })}`;
  const r = await shareService.shareText(text, 'Meeting point');
  if (r === 'unavailable') { const ok = await shareService.copy(text); toast(ok ? 'Copied. Paste it into a message.' : 'Sharing isn’t available here'); }
}
/* Today's card for an active meeting point. */
export function meetBlock() {
  const m = S.trip.meetup; if (!m || m.date !== today()) return '';
  return `<div class="alert">${ic('pin')}<div style="min-width:0;display:flex;flex-direction:column;gap:6px"><b>Meet back at ${esc(m.name)}${m.time ? ', ' + esc(m.time) : ''}</b>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="${esc(meetLink(m))}" target="_blank" rel="noopener">Directions ↗</a><button class="btn line sm" data-act="meetshare">Send to my friend</button><button class="text-btn" data-act="meetclear" style="min-height:36px;color:var(--muted);font-weight:500">Clear</button></div></div></div>`;
}

/* ---------- clean theme emergency card (Oct 12 2026): empty states ask for what's missing; the address is large ---------- */
function showEmergencyClean() {
  const ess = S.C.essentials, sy = stayHere(), em = S.trip.emergency || {};
  const h = sy ? hoodOf(sy.city_id, sy.neighborhood_id) : null;
  const plus = ic('plus', 'style="width:16px;height:16px"');
  const contactFields = `<div class="fields" style="margin-top:10px"><label class="f">Name<input type="text" data-bind="emergency.name" value="${esc(em.name || '')}" placeholder="e.g. my sister"></label><label class="f">Phone, with country code<input type="text" inputmode="tel" data-bind="emergency.phone" value="${esc(em.phone || '')}" placeholder="+1 555 123 4567"></label></div>`;
  const d = $('#driver');
  d.innerHTML = `<div class="inner" style="gap:0">
    <div class="layer-head"><h1>Emergency</h1><button class="layer-done" data-act="closedriver">Done</button></div>
    <p class="small muted" style="padding-top:2px">Works without signal. Calls need a phone connection.</p>
    <div class="em-box" style="border-top:0;padding-top:18px"><a class="btn sos" href="tel:112">${ic('sos', 'style="width:22px;height:22px"')}Call 112</a>
      <p class="small">Police, ambulance and fire anywhere in Europe. Free from any phone.</p>
      ${ess.emergency.filter(e => String(e.number).replace(/\D/g, '') !== '112').map(e => `<div class="numrow"><div><div class="n">${esc(e.number)}</div><div class="small muted">${esc(e.label)}</div></div><a class="btn line sm" href="${esc(tel(e.number))}">Call</a></div>`).join('')}</div>
    <div class="em-box"><div class="label">WHERE I’M STAYING</div>
      ${sy && sy.address ? `${sy.label ? `<div class="small muted">${esc(sy.label)}</div>` : ''}<div class="em-big">${esc(sy.address)}</div>${h ? `<div class="small muted">${esc(h.name)}, ${esc(cityName(sy.city_id))}</div>` : ''}
        <button class="btn line sm" data-act="homedriver" style="align-self:flex-start">${ic('taxi', 'style="width:16px;height:16px"')}Show a driver</button>`
      : `${sy && (sy.label || h) ? `<div>${esc(sy.label || '')}${sy.label && h ? ' · ' : ''}${h ? esc(h.name) : ''}</div>` : ''}<button class="btn line sm" data-act="addaddr" style="align-self:flex-start">${plus}Add your stay address</button><p class="small muted">Once saved, it shows here in large type, ready to show a driver.</p>`}</div>
    <div class="em-box"><div class="label">MY EMERGENCY CONTACT</div>
      ${em.phone ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><b>${esc(em.name || 'My contact')}</b><div class="small muted">${esc(em.phone)}</div></div><a class="btn sm" href="${esc(tel(em.phone))}">Call</a></div>
        <details><summary class="text-btn">Edit</summary>${contactFields}</details>`
      : `<details ${em.name ? 'open' : ''}><summary class="btn line sm" style="display:inline-flex">${plus}Add emergency contact</summary>${contactFields}</details>`}
      <p class="small muted">Saved on this phone only.</p></div>
    <div class="em-box"><div class="label">LET SOMEONE KNOW</div>
      <button class="btn line sm" data-act="shareplan" style="align-self:flex-start">${ic('share', 'style="width:16px;height:16px"')}Share my plan</button>
      <div class="tipbox">Sends your stays, bookings and today’s plan, without booking references. For live location, use Find My on iPhone or location sharing in Google Maps.</div></div>
    ${(ess.embassies || []).length ? `<div class="em-box"><div class="label">EMBASSY</div>${ess.embassies.map(e => `<a href="${esc(e.url)}" target="_blank" rel="noopener" style="min-height:44px;display:flex;align-items:center;font-weight:600">${esc(e.label)} ↗</a>`).join('')}</div>` : ''}
    ${ess.emergency_note ? `<div class="em-box"><div class="label">PHARMACIES AND THEFT</div><p class="small">${esc(ess.emergency_note)}</p></div>` : ''}</div>`;
  d.hidden = false; d.scrollTo(0, 0);
}
