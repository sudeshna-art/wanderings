/* Plan together, live (Nov 2026): sign in once, start or join a shared trip, and see everyone's changes.
   Uses syncService for everything outside the phone and models/sync.js for what is shared. */
import { EDITION } from '../../../edition.config.js?v=202611121151';
import { S, save, placeById } from '../state.js?v=202611121151';
import { esc, ic, toast, $ } from '../dom.js?v=202611121151';
import { syncService } from '../../services/sync-service.js?v=202611121151';
import { tripService } from '../../services/trip-service.js?v=202611121151';
import { shareService } from '../../services/share-service.js?v=202611121151';
import { diffForPush, applyRemote, changeLine, entryId } from '../../models/sync.js?v=202611121151';

const INVITE_KEY = 'wanderings-live-invite';
export const LV = { on: false, user: null, mode: 'link', msg: '', busy: false, picking: null, members: 0 };
let redraw = () => {}, pushTimer = null, listeningTo = null;

const live = () => S.trip && S.trip.live && S.trip.live.tid ? S.trip.live : null;
const placeLabel = id => { const p = placeById(id); return p ? (p.short_name || p.name) : ''; };
const baseUrl = () => location.origin + location.pathname + '?d=' + encodeURIComponent(EDITION.id);

/* ---------- start-up ---------- */
export async function liveStart(rerender) {
  redraw = rerender;
  let h = ''; try { h = location.hash; } catch (e) {}
  if (h.startsWith('#live=')) {
    try { localStorage.setItem(INVITE_KEY, h.slice(6)); } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  S.afterSave = schedulePush;
  LV.on = await syncService.available();
  if (!LV.on) return;
  refresh();
  if (location.href.includes('oobCode=')) {
    const r = await syncService.finishLink(location.href, async () => prompt('To finish signing in, type the email you used:') || '');
    try { history.replaceState(null, '', baseUrl()); } catch (e) {}
    if (r && r.error) { LV.msg = r.error; toast(r.error); }
  }
  syncService.onAuth(async u => {
    LV.user = u;
    if (u) { await joinPending(); if (live()) listen(); }
    else { syncService.stop(); listeningTo = null; }
    refresh();
  });
}
const pendingCode = () => { try { return localStorage.getItem(INVITE_KEY) || ''; } catch (e) { return ''; } };
const clearPending = () => { try { localStorage.removeItem(INVITE_KEY); } catch (e) {} };

/* ---------- sending and receiving ---------- */
export function schedulePush() {
  if (!live() || !LV.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 350);
}
function flush() {
  clearTimeout(pushTimer); pushTimer = null;
  const lv = live(); if (!lv || !LV.user) return;
  const { upserts, deletes } = diffForPush(S.trip);
  if (!upserts.length && !deletes.length) return;
  syncService.push(lv.tid, upserts, deletes, S.trip.traveler_name || '');
  const sent = Object.assign({}, lv.sent || {});
  upserts.forEach(u => { sent[u.id] = JSON.stringify(u.data); });
  deletes.forEach(id => { delete sent[id]; });
  lv.sent = sent; tripService.save(S.trip);
}
function listen() {
  const lv = live(); if (!lv || listeningTo === lv.tid) return;
  listeningTo = lv.tid;
  syncService.listen(lv.tid, (all, changes, first) => {
    if (!all) { LV.msg = 'Couldn’t reach the shared trip. It will catch up when you have signal.'; refresh(); return; }
    if (LV.picking) { LV.picking = all; showPicker(); return; }
    if (pushTimer) flush();
    applyRemote(S.trip, all);
    const mine = LV.user && LV.user.uid;
    const lines = changes.filter(c => c.by_uid !== mine).map(c => changeLine(c, placeLabel));
    if (lines.length) {
      lv.log = lines.map(text => ({ at: new Date().toISOString(), text })).concat(lv.log || []).slice(0, 30);
      toast(lines[0] + (lines.length > 1 ? ` (+${lines.length - 1} more)` : ''));
    }
    tripService.save(S.trip);
    if (first) flush();
    redraw();
  });
}

/* ---------- joining from an invite ---------- */
async function joinPending() {
  const code = pendingCode(); if (!code) return;
  const inv = await syncService.openInvite(code);
  if (inv.error) { LV.msg = inv.error; clearPending(); return; }
  if (inv.edition !== EDITION.id) { LV.msg = 'That invite is for another destination. Switch destination, then open the invite again.'; return; }
  clearPending();
  if (live() && live().tid === inv.trip) return;
  const r = await syncService.join(inv.trip, code, S.trip.traveler_name || '', S.trip.me_id);
  if (r.error) { LV.msg = r.error; return; }
  S.trip.live = { tid: inv.trip, from: inv.by_name || '', joined_at: new Date().toISOString(), sent: {}, log: [] };
  tripService.save(S.trip);
  LV.picking = new Map();
  listeningTo = null; listen();
}
function showPicker() {
  const people = [...LV.picking.values()].filter(e => e.kind === 'person' && e.data && e.data.id).map(e => e.data);
  const el = $('#driver');
  el.innerHTML = `<div class="inner"><div class="label">Shared trip</div><h1 style="margin:0">Welcome to the trip!</h1>
    <p class="small muted">${esc((live() && live().from) || 'Someone')} invited you. Which one are you?</p>
    <div style="display:flex;flex-direction:column;gap:8px">${people.map(p => `<button class="btn line" data-act="livepick" data-id="${esc(p.id)}" style="justify-content:flex-start">${esc(p.name || 'Someone')}</button>`).join('')}
    <label class="f" style="flex:none;margin-top:6px">Not on the list? Your first name<input type="text" id="liveName" autocomplete="given-name" value="${esc(S.trip.traveler_name || '')}"></label>
    <button class="btn ${people.length ? 'line' : ''}" data-act="livepick" data-id="">Join as a new person</button></div>
    <p class="small muted">Your journal, photos, food notes and private plans stay on your phone.</p></div>`;
  el.hidden = false;
}
export function pickMe(id) {
  const all = LV.picking; LV.picking = null;
  if (!id) { const n = (($('#liveName') || {}).value || '').trim(); if (!n) { LV.picking = all; toast('Type your first name'); return; } S.trip.traveler_name = n; }
  if (id) {
    const me = [...all.values()].find(e => e.kind === 'person' && e.data && e.data.id === id);
    S.trip.me_id = id;
    if (me && !S.trip.traveler_name) S.trip.traveler_name = me.data.name || '';
  }
  $('#driver').hidden = true;
  applyRemote(S.trip, all);
  S.trip.onboarded = true;
  delete S.trip.live.sent[entryId('person', S.trip.me_id)];   /* send my own dates */
  save(); flush(); redraw();
  toast('You’re in! Changes now show up for everyone.');
}

/* ---------- actions ---------- */
export async function sendLink() {
  const email = ($('#liveEmail') || {}).value || ''; if (!email.includes('@')) { LV.msg = 'Type your email first.'; refresh(); return; }
  LV.busy = true; LV.msg = ''; refresh();
  const r = await syncService.sendLink(email.trim(), baseUrl());
  LV.busy = false;
  LV.msg = r.error || `Sent! Open the email on this phone and tap the link. It may take a minute; check spam too. Using Wanderings from a home-screen icon on iPhone? The link opens in Safari, so a password is easier there.`;
  refresh();
}
export async function signInPassword(create) {
  const email = (($('#liveEmail') || {}).value || '').trim(), pw = ($('#livePw') || {}).value || '';
  if (!email.includes('@') || !pw) { LV.msg = 'Type your email and a password.'; refresh(); return; }
  LV.busy = true; LV.msg = ''; refresh();
  const r = await syncService.signInPassword(email, pw, create);
  LV.busy = false; LV.msg = r.error || ''; refresh();
}
export function toggleMode() { LV.mode = LV.mode === 'link' ? 'password' : 'link'; LV.msg = ''; refresh(); }
export async function startTrip() {
  if (!S.trip.traveler_name) { toast('Add your name first (top of Essentials)'); return; }
  LV.busy = true; refresh();
  const r = await syncService.createTrip({ edition: EDITION.id, name: EDITION.name, by_name: S.trip.traveler_name, person_id: S.trip.me_id });
  LV.busy = false;
  if (r.error) { LV.msg = r.error; refresh(); return; }
  S.trip.live = { tid: r.tid, from: S.trip.traveler_name, joined_at: new Date().toISOString(), sent: {}, log: [] };
  tripService.save(S.trip); flush(); listeningTo = null; listen();
  toast('Shared trip started. Now invite your group.'); refresh();
}
export async function invite() {
  const lv = live(); if (!lv) return;
  LV.busy = true; refresh();
  const r = await syncService.makeInvite(lv.tid, S.trip.traveler_name || '', EDITION.id);
  LV.busy = false; refresh();
  if (r.error) { toast(r.error); return; }
  const url = baseUrl() + '#live=' + r.code;
  const text = `Join our ${EDITION.name} trip on Wanderings. Open this on your phone, sign in with your email, and our plans stay in sync:`;
  const s = await shareService.shareText(text + '\n' + url, EDITION.name + ' trip');
  if (s !== 'shared' && s !== 'cancelled') { const ok = await shareService.copy(text + '\n' + url); toast(ok ? 'Invite copied. Paste it in your family chat.' : 'Sharing isn’t available here'); }
}
export function leave(el) {
  if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again to stop sharing on this phone'; return; }
  syncService.stop(); listeningTo = null; delete S.trip.live; tripService.save(S.trip); toast('This phone stopped sharing. Your plan stays here.'); refresh(); redraw();
}
export async function signOutLive() { syncService.stop(); listeningTo = null; await syncService.signOut(); LV.user = null; refresh(); }

/* ---------- what the traveler sees ---------- */
function refresh() { const el = $('#liveBlock'); if (el && el.isConnected) el.outerHTML = liveBlock(); }
export function liveBlock() {
  if (!LV.on) return '<div id="liveBlock" hidden></div>';   /* filled in once sign-in is ready */
  const lv = live(), msg = LV.msg ? `<p class="small" style="margin:0">${esc(LV.msg)}</p>` : '';
  let body;
  if (!LV.user) {
    body = `<p class="small muted" style="margin:0">Everyone’s plans and changes show up on everyone’s phone. Sign in once with your email.${pendingCode() ? ' <b>Sign in to join the trip you were invited to.</b>' : ''}</p>
      <label class="f" style="flex:none">Your email<input type="email" id="liveEmail" autocomplete="email" inputmode="email" placeholder="you@example.com"></label>
      ${LV.mode === 'password' ? `<label class="f" style="flex:none">Password<input type="password" id="livePw" autocomplete="current-password" placeholder="At least 6 characters"></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="livepw" data-create="0" ${LV.busy ? 'disabled' : ''}>Sign in</button><button class="btn line sm" data-act="livepw" data-create="1" ${LV.busy ? 'disabled' : ''}>Create account</button></div>
        <button class="text-btn" data-act="livemode" style="align-self:flex-start;min-height:32px">Email me a link instead</button>`
      : `<button class="btn sm" data-act="livesend" style="align-self:flex-start" ${LV.busy ? 'disabled' : ''}>${LV.busy ? 'Sending…' : 'Email me a sign-in link'}</button>
        <button class="text-btn" data-act="livemode" style="align-self:flex-start;min-height:32px">Use a password instead</button>`}${msg}`;
  } else if (!lv) {
    body = `<p class="small muted" style="margin:0">Signed in as ${esc(LV.user.email)}. Start a shared trip for ${esc(EDITION.name)}, then invite your group. Or open an invite someone sent you.</p>
      <button class="btn sm" data-act="livestart" style="align-self:flex-start" ${LV.busy ? 'disabled' : ''}>${ic('people', 'style="width:16px;height:16px"')}Start a shared trip</button>${msg}
      <button class="text-btn" data-act="livesignout" style="align-self:flex-start;min-height:32px">Sign out</button>`;
  } else {
    const log = (lv.log || []).slice(0, 5);
    body = `<p class="small" style="margin:0">${ic('people', 'style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}Shared live${lv.from && lv.from !== S.trip.traveler_name ? ` with ${esc(lv.from)}’s trip` : ''}. Plans, people and shared bookings stay in sync. Mark anything “Only me” to keep it private.</p>
      <button class="btn sm" data-act="liveinvite" style="align-self:flex-start" ${LV.busy ? 'disabled' : ''}>${ic('share', 'style="width:16px;height:16px"')}Invite someone</button>
      ${log.length ? `<div class="label">What changed</div><ul class="small" style="margin:0;padding-left:18px">${log.map(l => `<li>${esc(l.text)}</li>`).join('')}</ul>` : ''}${msg}
      <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="text-btn" data-act="liveleave" style="min-height:32px">Stop sharing on this phone</button><button class="text-btn" data-act="livesignout" style="min-height:32px">Sign out</button></div>`;
  }
  return `<div class="soft" id="liveBlock" style="display:flex;flex-direction:column;gap:8px;margin:6px 0 10px"><b>Plan together, live</b>${body}</div>`;
}
/* Today: the latest changes from others, for the first day after they happen. */
export function liveUpdates() {
  const lv = live(); if (!lv || !(lv.log || []).length) return '';
  const fresh = lv.log.filter(l => Date.now() - new Date(l.at).getTime() < 864e5).slice(0, 3);
  return fresh.length ? `<div class="alert">${ic('people')}<div style="min-width:0"><b>Group updates</b>${fresh.map(l => `<p class="small" style="margin:0">${esc(l.text)}</p>`).join('')}</div></div>` : '';
}
export const isLive = () => !!live();
