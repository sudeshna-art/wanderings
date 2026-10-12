/* Offline maps: save each area's map on the phone, and show which map is in use under every live map. */
import { S, P, cityName } from '../state.js?v=202610121603';
import { esc, ic, toast, $, $$ } from '../dom.js?v=202610121603';
import { mapPackService } from '../../services/mappack-service.js?v=202610121603';
import { clean } from '../theme.js?v=202610121603';

const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
const busy = {};   // pack id -> fraction while downloading

/* Essentials block. Filled in after render because what's saved is read from the phone. */
export function offlineMapsBlock() {
  const info = S.C.maps || { packs: [] };
  if (!info.packs.length) return '';
  const total = info.packs.reduce((a, p) => a + p.bytes, 0);
  return `<div class="block" id="offlineBlock" tabindex="-1"><div class="head"><h2>Offline maps</h2><span class="label" id="offCount"></span></div>
    <p class="small">${clean() ? 'Save on Wi-Fi before you go. Maps and your location then work with no signal.' : 'Save the map for each area on Wi-Fi before you go. Nearby and the Plan map then work with no signal, including walking paths and trails. Your location comes from the phone’s GPS, which needs no internet.'}</p>
    <div id="offList">${info.packs.map(p => packRow(p, false)).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="mapdlall" id="offAll">Save all areas · ${mb(total)}</button></div>
    ${clean() ? `<p class="small faint">${info.note ? esc(info.note) + ' ' : ''}Map data © OpenStreetMap contributors · Protomaps.</p>` : `<p class="small faint">${esc(info.note || '')} Map data © OpenStreetMap contributors, packaged by Protomaps, ${esc(info.built ? 'built ' + info.built : '')}. Ticket sites, reviews and live exchange rates still need a connection.</p>`}</div>`;
}
function packRow(p, saved) {
  const f = busy[p.id];
  return `<div class="numrow" data-pack="${p.id}" style="grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 0">
    <div><b style="font-size:14.5px">${esc(p.name)}</b><div class="small muted">${esc(p.covers)}</div><div class="small faint" style="font-family:var(--mono);font-size:11px">${mb(p.bytes)}${saved ? ' · <span style="color:var(--green-ink)">✓ Saved on this phone</span>' : ''}</div></div>
    <div>${f != null ? `<span class="small" style="font-family:var(--mono)">${Math.round(f * 100)}%</span>` : saved ? `<button class="text-btn" data-act="mapdel" data-id="${p.id}" style="min-height:36px;color:var(--muted);font-weight:500">Remove</button>` : `<button class="btn line sm" data-act="mapdl" data-id="${p.id}">Save</button>`}</div></div>`;
}
export async function fillOfflineMaps() {
  const list = $('#offList'); if (!list) return;
  const have = await mapPackService.downloaded(), packs = S.C.maps.packs;
  list.innerHTML = packs.map(p => packRow(p, have.includes(p.id))).join('');
  const c = $('#offCount'); if (c) c.textContent = `${packs.filter(p => have.includes(p.id)).length}/${packs.length} saved`;
  const all = $('#offAll'); if (all) all.hidden = packs.every(p => have.includes(p.id));
}

export async function downloadPack(id, after, auto = false) {
  if (busy[id] != null) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { if (!auto) toast('Connect to Wi-Fi to save maps.'); return; }
  busy[id] = 0; refreshRows();
  const r = await mapPackService.download(id, f => { busy[id] = f; refreshProgress(id); });
  delete busy[id];
  const p = S.C.maps.packs.find(x => x.id === id);
  if (r.ok) toast(auto ? `Offline map saved: ${p.name}. It works with no signal.` : `${p.name} map saved for offline use`);
  else if (!auto) toast(r.reason === 'space' ? 'Not enough space on this phone for this map.' : r.reason === 'missing' ? 'This map isn’t on the site yet.' : 'The download stopped. Check your connection and try again.');
  await fillOfflineMaps(); after && after(r.ok);
}
export async function downloadAll(after) {
  const have = await mapPackService.downloaded();
  for (const p of S.C.maps.packs) if (!have.includes(p.id)) await downloadPack(p.id);
  after && after();
}
/* Editions with small map packs ("maps_auto": "all" in edition.json, e.g. Florence) save them in the background
   whenever the app opens online, and again if the phone has cleared them. Skipped when the phone asks to save data. */
export async function autoSaveMaps() {
  if ((S.C.edition || {}).maps_auto !== 'all' || !(S.C.maps || {}).packs || !S.C.maps.packs.length) return;
  try { if (navigator.onLine === false || (navigator.connection && navigator.connection.saveData)) return; } catch (e) {}
  const have = await mapPackService.downloaded();
  for (const p of S.C.maps.packs) if (!have.includes(p.id) && busy[p.id] == null) await downloadPack(p.id, null, true);
  if (P().tab === 'today') { const el = document.getElementById('todayOffline'); if (el) el.hidden = true; }
}
export async function removePack(id) { await mapPackService.remove(id); toast('Map removed from this phone'); fillOfflineMaps(); }

function refreshRows() { fillOfflineMaps(); $$('[data-mapstatus]').forEach(el => { if (el._mode) el.innerHTML = statusHTML(el._mode); }); }
function refreshProgress(id) {
  $$(`[data-pack="${id}"] .small[style*="mono"]`).forEach(el => { el.textContent = Math.round(busy[id] * 100) + '%'; });
  $$(`[data-mapdlbtn="${id}"]`).forEach(el => { el.textContent = 'Saving… ' + Math.round(busy[id] * 100) + '%'; });
}

/* One line under a live map saying which map is showing, with a one-tap save when it isn't offline yet. */
export function statusHTML(m) {
  if (!m) return '';
  const p = m.pack;
  if (m.mode === 'vector' && m.downloaded) return `<p class="small" style="color:var(--green-ink)">${ic('compass', 'style="width:14px;height:14px;vertical-align:-2px"')} Offline map saved · ${esc(p.name)}. Works with no signal.</p>`;
  if (p && (m.mode === 'vector' || m.mode === 'live')) return `<p class="small muted">Online map. Save ${esc(p.name)} (${mb(p.bytes)}) to use it with no signal. <button class="text-btn" data-act="mapdl" data-id="${p.id}" data-mapdlbtn="${p.id}" style="min-height:32px">${busy[p.id] != null ? 'Saving… ' + Math.round(busy[p.id] * 100) + '%' : 'Save for offline'}</button></p>`;
  if (m.mode === 'illustrated' && p) return `<p class="small muted">No signal, and ${esc(p.name)} isn’t saved yet, so this is the sketch map. Save areas in Essentials, Offline maps, while you have Wi-Fi.</p>`;
  if (m.mode === 'illustrated') return `<p class="small muted">Sketch map, not to scale. This area isn’t in the offline maps.</p>`;
  return `<p class="small muted">Online map. This area isn’t in the offline maps.</p>`;
}
export function showStatus(el, m) { if (!el) return; el._mode = m; el.innerHTML = statusHTML(m); }
