/* Traveling together (Oct 12 2026, every edition): the people on the trip with their own dates, who's going to
   each plan, who's around each day, arrivals on Today, and sharing the group plan as a link.
   No accounts or server: the plan travels inside the link (compressed), and the latest shared version wins.
   When accounts and sync arrive (architecture section 10), sync replaces the link. */
import { EDITION } from '../../../edition.config.js?v=202610121715';
import { S, save, today, cityOf, cityIds, placeById } from '../state.js?v=202610121715';
import { esc, ic, toast, $, fmtDay } from '../dom.js?v=202610121715';
import { everyone, hereOn, isGroup, newPerson, whoOf, whoText, planDays, newStay, syncLegs, localISO } from '../../models/schema.js?v=202610121715';
import { shareService } from '../../services/share-service.js?v=202610121715';

const city = () => cityOf(cityIds()[0]);
const nm = p => p.me ? 'You' : p.name;

/* ---------- the people editor (welcome step 3 and Essentials) ---------- */
export function peopleEditor() {
  const hoods = sel => `<option value="">Not sure yet</option>` + (city().neighborhoods || []).filter(n => n.id !== 'other').map(n => `<option value="${n.id}" ${sel === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('');
  const rows = S.trip.people.map((p, i) => `<div class="stay"><div class="stay-h"><span class="label">${esc(p.name || 'Someone')}</span><button class="text-btn" data-act="persondel" data-id="${p.id}" style="min-height:32px;color:var(--muted);font-weight:500">Remove</button></div>
    <div class="fields"><label class="f">Name<input type="text" data-bind="people.${i}.name" value="${esc(p.name)}" placeholder="e.g. Mom, Avi, Petra"></label>
    <label class="f">Staying in<select data-bind="people.${i}.hood">${hoods(p.hood)}</select></label></div>
    <div class="fields"><label class="f">Arrives<input type="date" data-bind="people.${i}.arrive" value="${esc(p.arrive)}"></label><label class="f">Leaves<input type="date" data-bind="people.${i}.leave" value="${esc(p.leave)}" ${p.arrive ? `min="${p.arrive}"` : ''}></label></div></div>`).join('');
  return `<div id="peopleEd" style="display:flex;flex-direction:column;gap:8px"><span class="label">Traveling with others?</span>
    ${rows || '<p class="small muted" style="margin:0">Add the people coming, each with their own dates. The plan then shows who’s around each day, and you can share it with them.</p>'}
    <button class="btn line sm" data-act="personadd" style="align-self:flex-start">${ic('plus', 'style="width:16px;height:16px"')}Add someone</button></div>`;
}
export const refreshPeople = () => { const el = $('#peopleEd'); if (el && el.isConnected) try { el.outerHTML = peopleEditor(); } catch (e) {} };
export function addPerson() { const p = newPerson(); const r = everyone(S.trip)[0]; p.arrive = r.arrive || ''; p.leave = r.leave || ''; S.trip.people.push(p); save(); refreshPeople(); }
export function removePerson(id) {
  S.trip.people = S.trip.people.filter(p => p.id !== id);
  S.trip.plan.forEach(it => { if (it.who) { it.who = it.who.filter(x => x !== id); if (!it.who.length) delete it.who; } });
  save(); refreshPeople();
}

/* ---------- who's going ---------- */
/* Chips for the add-to-a-day sheet and the schedule form. sel: null (everyone) or [ids]. */
export function whoChips(sel, act, day) {
  if (!isGroup(S.trip)) return '';
  const here = day ? hereOn(S.trip, day).map(p => p.id) : null;
  const all = everyone(S.trip);
  return `<div style="display:flex;flex-direction:column;gap:6px"><span class="label">Who’s going</span><div class="chips wrap" role="group" aria-label="Who’s going">
    <button class="chip" data-act="${act}" data-k="all" aria-pressed="${!sel}">Everyone</button>
    ${all.map(p => `<button class="chip" data-act="${act}" data-k="${p.id}" aria-pressed="${!!sel && sel.includes(p.id)}">${esc(nm(p))}${here && p.arrive && !here.includes(p.id) ? ' (away)' : ''}</button>`).join('')}</div></div>`;
}
/* Toggle a chip: "all" clears the list; picking everyone one by one also means everyone. */
export function toggleWho(sel, k) {
  if (k === 'all') return null;
  let w = sel ? sel.slice() : [];
  w = w.includes(k) ? w.filter(x => x !== k) : w.concat(k);
  return !w.length || w.length === everyone(S.trip).length ? null : w;
}
export const whoLine = item => isGroup(S.trip) ? `<div class="small muted">${ic('people', 'style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}${esc(whoText(S.trip, whoOf(item)))}</div>` : '';

/* Who's around on a day, with arrivals and departures, for the Plan's day header. */
export function dayPeople(day) {
  if (!isGroup(S.trip)) return '';
  const all = everyone(S.trip), here = hereOn(S.trip, day);
  const arr = all.filter(p => p.arrive === day), dep = all.filter(p => (p.leave || p.arrive) === day && p.arrive !== day);
  const hereIds = here.map(p => p.id), away = all.filter(p => p.arrive && !hereIds.includes(p.id));
  return `<div class="people-day small">${ic('people', 'style="width:16px;height:16px;vertical-align:-3px;margin-right:4px"')}<b>Here:</b> ${here.length ? esc(here.map(nm).join(', ')) : 'nobody yet'}
    ${arr.length ? `<br><span class="muted">Arriving: ${esc(arr.map(nm).join(', '))}</span>` : ''}${dep.length ? `<br><span class="muted">Leaving: ${esc(dep.map(nm).join(', '))}</span>` : ''}
    ${away.length && !arr.length && !dep.length ? `<br><span class="muted">Not here: ${esc(away.map(nm).join(', '))}</span>` : ''}</div>`;
}

/* Today: who arrives or leaves today or tomorrow. */
export function arrivalsAlert() {
  if (!isGroup(S.trip)) return '';
  const t = today(), d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() + 1); const tm = localISO(d);
  const all = everyone(S.trip).filter(p => !p.me);
  const lines = [];
  [[t, 'Today'], [tm, 'Tomorrow']].forEach(([day, label]) => {
    const a = all.filter(p => p.arrive === day), l = all.filter(p => p.leave === day && p.arrive !== day);
    if (a.length) lines.push(`${label}: ${a.map(p => p.name).join(', ')} arrive${a.length === 1 ? 's' : ''}`);
    if (l.length) lines.push(`${label}: ${l.map(p => p.name).join(', ')} leave${l.length === 1 ? 's' : ''}`);
  });
  if (!lines.length) return '';
  return `<div class="alert">${ic('people')}<div style="min-width:0;display:flex;flex-direction:column;gap:4px"><b>${esc(lines[0])}</b>${lines.slice(1).map(x => `<p class="small" style="margin:0">${esc(x)}</p>`).join('')}
    <p class="small muted" style="margin:0">Airport pickups are worth booking ahead.</p><button class="text-btn" data-act="pview" data-v="plan" data-tab="places" style="min-height:32px;align-self:flex-start">See the plan</button></div></div>`;
}

/* ---------- sharing the group plan as a link ---------- */
const b64 = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  try { if (typeof CompressionStream === 'function') return 'z' + b64(new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())); } catch (e) {}
  return 'j' + b64(raw);
}
async function unpack(str) {
  const bytes = unb64(str.slice(1));
  const raw = str[0] === 'z' ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}
/* What goes in the link: people and their dates, the plan, and shared bookings without booking references.
   Never the journal, photos, favorites, food notes, emergency contact or my drivers. */
function payload() {
  const me = everyone(S.trip)[0], st = S.trip.stays.find(s => s.start) || {};
  const people = [{ id: me.id, name: S.trip.traveler_name || 'Organizer', arrive: me.arrive, leave: me.leave, hood: st.neighborhood_id || '', address: st.address || '' }].concat(S.trip.people);
  const bookings = S.trip.bookings.filter(b => !['flight', 'stay'].includes(b.kind)).map(b => ({ id: b.id, kind: b.kind, title: b.title, date: b.date, time: b.time, end_date: b.end_date, end_time: b.end_time, from: b.from, to: b.to, where: b.where, contact: b.contact || '', cancel_by: b.cancel_by || '', city_id: b.city_id, who: b.who }));
  return { v: 1, ed: EDITION.id, g: (S.trip.group && S.trip.group.id) || ('g' + Date.now().toString(36)), by: S.trip.traveler_name || 'A friend', at: new Date().toISOString(), people, plan: S.trip.plan, bookings };
}
export async function shareGroup() {
  if (!isGroup(S.trip)) { toast('Add the people traveling with you first'); return; }
  const data = payload();
  S.trip.group = Object.assign({}, S.trip.group || {}, { id: data.g, shared_at: data.at }); save();
  const url = location.href.split('#')[0] + '#join=' + await pack(data);
  const text = `${data.by} shared our ${EDITION.name} plan: who’s here when, and what we’re doing. Open it on your phone and pick your name.`;
  const r = await shareService.shareText(text + '\n' + url, EDITION.name + ' group plan');
  if (r !== 'shared' && r !== 'cancelled') { const ok = await shareService.copy(text + '\n' + url); toast(ok ? 'Link copied. Paste it in your family chat.' : 'Sharing isn’t available here'); }
}
export const groupNote = () => isGroup(S.trip) ? `<p class="small muted" style="margin:0">${S.trip.group && S.trip.group.shared_at ? `Last shared ${esc(new Date(S.trip.group.shared_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}${S.trip.group.from ? ' by ' + esc(S.trip.group.from) : ''}. ` : ''}After changes, share again: the newest link wins. Journals, photos, food notes and booking references are never shared.</p>` : '';
export const shareButton = () => isGroup(S.trip) ? `<button class="btn line sm" data-act="sharegroup" style="align-self:flex-start">${ic('share', 'style="width:16px;height:16px"')}Share the group plan</button>` : '';

/* ---------- joining from a link ---------- */
let incoming = null;
export async function checkJoin() {
  let h = ''; try { h = location.hash; } catch (e) {}
  if (!h.startsWith('#join=')) return false;
  try { incoming = await unpack(h.slice(6)); } catch (e) { toast('That plan link couldn’t be read. Ask for it again.'); return false; }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (!incoming || incoming.ed !== EDITION.id) { toast('That plan is for another Wanderings guide.'); incoming = null; return false; }
  showJoin(); return true;
}
function showJoin() {
  const d = incoming, mine = S.trip.people.length || S.trip.plan.length;
  const days = d.people.filter(p => p.arrive).map(p => [p.arrive, p.leave || p.arrive]);
  const from = days.length ? days.map(x => x[0]).sort()[0] : '', to = days.length ? days.map(x => x[1]).sort().slice(-1)[0] : '';
  const meNow = d.people.find(p => p.id === S.trip.me_id);
  const el = $('#driver');
  el.innerHTML = `<div class="inner"><div class="label">Group plan</div><h1 style="margin:0">${esc(d.by)} shared your plan</h1>
    <p class="small muted">${d.people.length} people${from ? ` · ${esc(fmtDay(from))} to ${esc(fmtDay(to))}` : ''} · ${d.plan.length} plans · ${d.bookings.length} shared bookings</p>
    <span class="label">Which one are you?</span>
    <div style="display:flex;flex-direction:column;gap:8px">${d.people.map(p => `<button class="btn ${meNow && meNow.id === p.id ? '' : 'line'}" data-act="joinpick" data-id="${esc(p.id)}" style="justify-content:space-between"><span>${esc(p.name)}</span><span class="small" style="font-weight:400">${p.arrive ? esc(fmtDay(p.arrive)) + ' to ' + esc(fmtDay(p.leave || p.arrive)) : ''}</span></button>`).join('')}</div>
    ${mine ? '<p class="small">This replaces the group plan on this phone with this newer version. Your journal, photos, phrases, food notes and private bookings stay as they are.</p>' : '<p class="small muted">Your journal, photos and notes stay private on your phone.</p>'}
    <button class="btn line" data-act="joincancel" style="margin-top:auto">Not now</button></div>`;
  el.hidden = false;
}
export function cancelJoin() { incoming = null; $('#driver').hidden = true; }
/* Apply the shared plan as the chosen person. */
export function applyJoin(personId) {
  const d = incoming; if (!d) return false;
  const me = d.people.find(p => p.id === personId); if (!me) return false;
  S.trip.me_id = me.id;
  if (!S.trip.traveler_name) S.trip.traveler_name = me.name;
  S.trip.people = d.people.filter(p => p.id !== me.id).map(p => ({ id: p.id, name: p.name, arrive: p.arrive || '', leave: p.leave || '', hood: p.hood || '', address: p.address || '' }));
  /* her own stay: keep one she already set; otherwise use her dates from the plan */
  const hasStay = S.trip.stays.some(s => s.start);
  if (!hasStay && me.arrive) {
    const s = newStay(cityIds()[0]); s.start = me.arrive; s.end = me.leave || me.arrive; s.neighborhood_id = me.hood || ''; s.address = me.address || '';
    S.trip.stays = [s]; syncLegs(S.trip);
  }
  S.trip.plan = (d.plan || []).filter(it => placeById(it.item_id));
  const own = S.trip.bookings.filter(b => !b.shared), ownIds = new Set(own.map(b => b.id));   /* her own copy keeps its booking reference */
  S.trip.bookings = own.concat((d.bookings || []).filter(b => !ownIds.has(b.id)).map(b => Object.assign({ ref: '', note: '', source: 'group' }, b, { shared: true })));
  S.trip.group = { id: d.g, from: d.by, shared_at: d.at };
  S.trip.onboarded = true;
  save(); incoming = null; $('#driver').hidden = true;
  toast(`Welcome, ${me.name}! The group plan is on your phone.`);
  return true;
}
export { planDays };
