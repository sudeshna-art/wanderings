/* Personal code (Nov 13 2026): optional. Keeps one traveler's journal and phrase favorites on every device
   (phone, laptop, browser or home-screen app) that has the code. No email or password.
   The code is stored on the device for all destinations; what was last synced is kept per destination. */
import { EDITION } from '../../../edition.config.js';
import { S } from '../state.js';
import { esc, toast, $ } from '../dom.js';
import { syncService } from '../../services/sync-service.js';
import { tripService } from '../../services/trip-service.js';
import { mineDiff, applyMine } from '../../models/mine.js';

const KEY = 'wanderings-mycode';
export const MINE = { code: '', status: '', msg: '', busy: false };
let redraw = () => {}, timer = null, on = false;
try { MINE.code = localStorage.getItem(KEY) || ''; } catch (e) {}

export async function mineStart(rerender) {
  redraw = rerender;
  if (!MINE.code) return;
  if (!(await syncService.available())) return;
  const r = await syncService.signInAnon(); if (r.error) { MINE.msg = r.error; return; }
  listen();
}
function listen() {
  on = true; MINE.status = 'Connecting…';
  syncService.mineListen(MINE.code, EDITION.id, all => {
    if (!all) { MINE.status = 'Offline. Changes will sync when you have signal.'; refresh(); return; }
    if (timer) flush();
    applyMine(S.trip, all);
    tripService.save(S.trip);
    MINE.status = 'Synced';
    flush(); redraw();
  });
}
export function mineSchedule() {
  if (!on || !MINE.code) return;
  clearTimeout(timer); timer = setTimeout(flush, 400);
}
function flush() {
  clearTimeout(timer); timer = null;
  if (!on || !MINE.code) return;
  const { upserts, deletes } = mineDiff(S.trip);
  if (!upserts.length && !deletes.length) return;
  syncService.minePush(MINE.code, EDITION.id, upserts, deletes);
  const sent = Object.assign({}, S.trip.mine_sent || {});
  upserts.forEach(u => { sent[u.id] = JSON.stringify(u.data); });
  deletes.forEach(id => { delete sent[id]; });
  S.trip.mine_sent = sent; tripService.save(S.trip);
}
function setCode(shown) {
  MINE.code = shown; try { localStorage.setItem(KEY, shown); } catch (e) {}
  S.trip.mine_sent = {};   /* first sync on this device: keep what's here and add what's there */
  tripService.save(S.trip); listen();
}
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => ALPHA[b % ALPHA.length]).join(''); };

export async function mineMake() {
  if (MINE.busy) return; MINE.busy = true; MINE.msg = ''; refresh();
  if (!(await syncService.available())) { MINE.busy = false; MINE.msg = 'Personal codes need a connection. Try again with signal.'; refresh(); return; }
  const s = await syncService.signInAnon();
  if (s.error) { MINE.busy = false; MINE.msg = s.error; refresh(); return; }
  const name = String(S.trip.traveler_name || 'MY').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'MY';
  let r, shown;
  for (let i = 0; i < 3; i++) { shown = `${name}-${rand(5)}-${rand(5)}`; r = await syncService.mineCreate(shown); if (r.error !== 'taken') break; }
  MINE.busy = false;
  if (r.error) { MINE.msg = r.error === 'taken' ? 'Something went wrong. Try again.' : r.error; refresh(); return; }
  setCode(shown); MINE.msg = 'new'; redraw();
}
export async function mineUse() {
  const v = (($('#mineIn') || {}).value || '').trim();
  if (!v) { toast('Type your personal code'); return; }
  if (MINE.busy) return; MINE.busy = true; MINE.msg = ''; refresh();
  if (!(await syncService.available())) { MINE.busy = false; MINE.msg = 'Personal codes need a connection. Try again with signal.'; refresh(); return; }
  const s = await syncService.signInAnon();
  const r = s.error ? s : await syncService.mineCheck(v);
  MINE.busy = false;
  if (r.error) { MINE.msg = r.error; refresh(); return; }
  setCode(v.toUpperCase()); toast('Connected. Your journal will appear in a moment.'); redraw();
}
export function mineOff() {
  if (!confirmOff()) return;
  syncService.mineStop(); on = false; MINE.code = ''; MINE.msg = ''; MINE.status = '';
  try { localStorage.removeItem(KEY); } catch (e) {}
  delete S.trip.mine_sent; tripService.save(S.trip); redraw();
}
const confirmOff = () => { const b = $('#mineOffBtn'); if (b && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Tap again to stop syncing here'; return false; } return true; };
export async function mineCopy() {
  try { await navigator.clipboard.writeText(MINE.code); toast('Code copied'); } catch (e) { toast('Copy didn’t work. Write the code down instead.'); }
}

/* The Trip tab's journal block. */
export function mineBlock() {
  const open = `<button class="btn line sm" data-act="go" data-tab="trip" data-sub="journal" style="align-self:flex-start">Open your journal</button>`;
  const msg = MINE.msg && MINE.msg !== 'new' ? `<p class="small" style="margin:0;color:var(--red-ink, #a33)">${esc(MINE.msg)}</p>` : '';
  if (MINE.code) return `<div class="block" id="mineBlock"><h2>Journal</h2>
    <p class="small muted" style="margin:0">Your journal and favorite phrases are on every device with your personal code. Photos stay on the device that took them.</p>
    ${open}
    <div class="label" style="margin-top:6px">Your personal code${MINE.status ? ' · ' + esc(MINE.status) : ''}</div>
    <div style="font-family:var(--mono);font-size:17px;letter-spacing:.04em">${esc(MINE.code)}</div>
    ${MINE.msg === 'new' ? '<p class="small" style="margin:0"><b>Write this down or save it in your notes.</b> To use your journal on another phone, laptop or browser, open Wanderings there, go to Trip, and enter this code. Keep it to yourself: anyone with it can read your journal.</p>' : '<p class="small faint" style="margin:0">Keep it to yourself: anyone with it can read your journal.</p>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="minecopy">Copy code</button><button class="text-btn" id="mineOffBtn" data-act="mineoff">Stop syncing on this device</button></div>${msg}</div>`;
  return `<div class="block" id="mineBlock"><h2>Journal</h2>
    <p class="small muted" style="margin:0">Notes, photos and voice memos from the trip. They stay on this device.</p>
    ${open}
    <details style="margin-top:4px"${MINE.msg || MINE.busy ? ' open' : ''}><summary class="small" style="cursor:pointer;font-weight:600">Use your journal on more than one device?</summary>
      <div style="display:flex;flex-direction:column;gap:10px;padding-top:10px">
        <p class="small muted" style="margin:0">Optional. A personal code keeps your journal and favorite phrases the same on your phone, laptop or any browser. No email or password.</p>
        <button class="btn sm" data-act="minemake" style="align-self:flex-start"${MINE.busy ? ' disabled' : ''}>Create my personal code</button>
        <div class="fields"><label class="f">Already have one? Enter it<input type="text" id="mineIn" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. NAME-K7P2Q-X9MZD"></label></div>
        <button class="btn line sm" data-act="mineuse" style="align-self:flex-start"${MINE.busy ? ' disabled' : ''}>Use this code</button>${msg}
      </div></details></div>`;
}
function refresh() { const el = $('#mineBlock'); if (el) el.outerHTML = mineBlock(); }
