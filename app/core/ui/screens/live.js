/* Plan together, live (Nov 2026): sign in once, start or join a shared trip, and see everyone's changes.
   Uses syncService for everything outside the phone and models/sync.js for what is shared. */
import { EDITION } from '../../../edition.config.js?v=202611121838';
import { S, save, placeById } from '../state.js?v=202611121838';
import { esc, ic, toast, $ } from '../dom.js?v=202611121838';
import { syncService, normCode } from '../../services/sync-service.js?v=202611121838';
import { tripService } from '../../services/trip-service.js?v=202611121838';
import { shareService } from '../../services/share-service.js?v=202611121838';
import { diffForPush, applyRemote, changeLine, entryId } from '../../models/sync.js?v=202611121838';

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
  if (pendingCode() && !syncService.user()) { const r = await syncService.signInAnon(); if (r.error) LV.msg = r.error; }
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
  if (inv.error) { LV.msg = /doesn’t work/.test(inv.error) ? 'That trip code didn’t work. Check the spelling, or ask for it again.' : inv.error; clearPending(); return; }
  if (inv.edition !== EDITION.id) {   /* the code belongs to another destination: open that one and join there */
    try { localStorage.setItem('wanderings-destination', inv.edition); } catch (e) {}
    location.replace(location.pathname + '?d=' + encodeURIComponent(inv.edition)); return;
  }
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
export const showCode = lv => lv.shown || String(lv.code || '').toUpperCase();
export async function joinWithCode() {
  const raw = (($('#liveCode') || {}).value || '').trim();
  if (normCode(raw).length < 6) { LV.msg = 'Type the trip code you were sent.'; refresh(); return; }
  try { localStorage.setItem(INVITE_KEY, raw); } catch (e) {}
  LV.busy = true; LV.msg = ''; refresh();
  if (!LV.user) { const a = await syncService.signInAnon(); if (a.error) { LV.busy = false; LV.msg = a.error; refresh(); return; } LV.user = syncService.user(); }
  await joinPending();
  LV.busy = false; refresh();
}
/* Choose your own code (e.g. Beach-Trip-26), and close it once everyone has joined. */
export async function customCode() {
  const lv = live(); if (!lv) return;
  const want = (($('#liveCustom') || {}).value || '').trim();
  if (normCode(want).length < 6) { LV.msg = 'Make the code at least 6 letters or numbers, like Beach-Trip-26.'; refresh(); return; }
  LV.busy = true; LV.msg = ''; refresh();
  const r = await syncService.makeInvite(lv.tid, S.trip.traveler_name || '', EDITION.id, '', want);
  LV.busy = false;
  if (r.error) { LV.msg = r.error; refresh(); return; }
  if (lv.code && lv.code !== r.code) syncService.closeInvite(lv.code);   /* the old code stops working */
  lv.code = r.code; lv.shown = r.shown; lv.closed = false; LV.editing = false; tripService.save(S.trip); refresh();
  toast('Your trip code is ' + r.shown);
}
export function editCode() { LV.editing = !LV.editing; LV.msg = ''; refresh(); }
export async function closeCode(el) {
  const lv = live(); if (!lv || !lv.code) return;
  if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again: nobody new can join with this code'; return; }
  const r = await syncService.closeInvite(lv.code);
  if (r.error) { toast(r.error); return; }
  lv.closed = true; delete lv.code; delete lv.shown; tripService.save(S.trip); refresh();
  toast('Code closed. Everyone already in stays in.');
}
export async function shareFromPlan() {
  if (!live()) { await startTrip(); if (!live()) return; }
  await invite();
}
export function toggleMode() { LV.mode = LV.mode === 'link' ? 'password' : 'link'; LV.msg = ''; refresh(); }
export async function startTrip() {
  if (!S.trip.traveler_name) { toast('Add your name first (Essentials, Settings, or the welcome steps)'); return; }
  LV.busy = true; refresh();
  if (!LV.user) { const a = await syncService.signInAnon(); if (a.error) { LV.busy = false; LV.msg = a.error; refresh(); return; } LV.user = syncService.user(); }
  const r = await syncService.createTrip({ edition: EDITION.id, name: EDITION.name, by_name: S.trip.traveler_name, person_id: S.trip.me_id });
  LV.busy = false;
  if (r.error) { LV.msg = r.error; refresh(); return; }
  S.trip.live = { tid: r.tid, from: S.trip.traveler_name, joined_at: new Date().toISOString(), sent: {}, log: [] };
  tripService.save(S.trip); flush(); listeningTo = null; listen();
  toast('Shared trip started. Now invite your group.'); refresh();
}
export async function invite() {
  const lv = live(); if (!lv) return;
  if (!lv.code) {
    LV.busy = true; refresh();
    const r = await syncService.makeInvite(lv.tid, S.trip.traveler_name || '', EDITION.id, EDITION.tripCode);
    LV.busy = false;
    if (r.error) { refresh(); toast(r.error); return; }
    lv.code = r.code; lv.shown = r.shown; lv.closed = false; tripService.save(S.trip); refresh();
  }
  const url = location.origin + location.pathname, join = url + '?join=' + encodeURIComponent(showCode(lv));
  const text = `Join our ${EDITION.name} trip on Wanderings! Tap to see our plan, no app or sign-up needed:\n${join}\n\nWant it on your home screen? Open ${url}, add it to your home screen (Safari: Share, then Add to Home Screen), open it from there and enter the trip code: ${showCode(lv)}`;
  const s = await shareService.shareText(text, EDITION.name + ' trip');
  if (s !== 'shared' && s !== 'cancelled') { const ok = await shareService.copy(text); toast(ok ? 'Invite copied. Paste it in your family chat.' : 'Sharing isn’t available here'); }
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
  if (!lv) {
    const anon = LV.user && !LV.user.email;
    body = `<p class="small muted" style="margin:0">Share your plan with family or friends. Everyone sees changes as they happen. No email or password needed.</p>
      <button class="btn sm" data-act="livestart" style="align-self:flex-start" ${LV.busy ? 'disabled' : ''}>${ic('people', 'style="width:16px;height:16px"')}Start a shared trip</button>
      <label class="f" style="flex:none;margin-top:4px">Have a trip code?<div style="display:flex;gap:8px"><input id="liveCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. Beach-Trip-26" style="flex:1;min-width:0"><button class="btn line sm" data-act="livejoin" ${LV.busy ? 'disabled' : ''}>Join</button></div></label>${msg}
      ${LV.user && !anon ? `<p class="small muted" style="margin:0">Signed in as ${esc(LV.user.email)}. <button class="text-btn" data-act="livesignout" style="min-height:28px">Sign out</button></p>` : LV.mode === 'password' ? `<label class="f" style="flex:none">Email<input type="email" id="liveEmail" autocomplete="email"></label><label class="f" style="flex:none">Password<input type="password" id="livePw" autocomplete="current-password"></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="livepw" data-create="0" ${LV.busy ? 'disabled' : ''}>Sign in</button><button class="text-btn" data-act="livemode" style="min-height:32px">Cancel</button></div>` : `<button class="text-btn" data-act="livemode" style="align-self:flex-start;min-height:28px;font-size:13px">Have an email account? Sign in</button>`}`;
  } else {
    const log = (lv.log || []).slice(0, 5);
    body = `<p class="small" style="margin:0">${ic('people', 'style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}Shared live${lv.from && lv.from !== S.trip.traveler_name ? ` with ${esc(lv.from)}’s trip` : ''}. Plans, people and shared bookings stay in sync. Mark anything “Only me” to keep it private.</p>
      ${lv.code ? `<div class="label">Trip code</div><div style="font-size:22px;font-weight:700;letter-spacing:.04em;user-select:all">${esc(showCode(lv))}</div>` : lv.closed ? '<p class="small muted" style="margin:0">The trip code is closed, so nobody new can join. Need to add someone? Make a new code.</p>' : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn sm" data-act="liveinvite" ${LV.busy ? 'disabled' : ''}>${ic('share', 'style="width:16px;height:16px"')}${lv.code ? 'Share the invite' : lv.closed ? 'Make a new code' : 'Invite your group'}</button>
        <button class="text-btn" data-act="liveeditcode" style="min-height:32px">${LV.editing ? 'Cancel' : 'Choose your own code'}</button></div>
      ${LV.editing ? `<label class="f" style="flex:none">Your code<div style="display:flex;gap:8px"><input id="liveCustom" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. Beach-Trip-26" style="flex:1;min-width:0"><button class="btn line sm" data-act="livecustom" ${LV.busy ? 'disabled' : ''}>Use it</button></div></label>
        <p class="small muted" style="margin:0">Easy to remember is also easier to guess. Once everyone has joined, close the code.</p>` : ''}
      ${lv.code ? `<button class="text-btn" data-act="liveclosecode" style="align-self:flex-start;min-height:32px">Everyone’s in? Close the code</button>` : ''}
      ${log.length ? `<div class="label">What changed</div><ul class="small" style="margin:0;padding-left:18px">${log.map(l => `<li>${esc(l.text)}</li>`).join('')}</ul>` : ''}${msg}
      <button class="text-btn" data-act="liveleave" style="align-self:flex-start;min-height:32px">Stop sharing on this phone</button>`;
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
