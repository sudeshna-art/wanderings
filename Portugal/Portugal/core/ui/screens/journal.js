/* Journal: dictation-friendly entries, photos, trip summary for Instagram, Share with Wanderings, backup. */
import { S, P, save, allPlaces, placeById, cityName, curCityId, cityIds } from '../state.js';
import { esc, ic, fmtDate, fmtISO, toast, $ } from '../dom.js';
import { masthead } from '../components.js';
import { stage, statusOf, setStatus, tripRange } from '../../models/schema.js';
import { tripService } from '../../services/trip-service.js';
import { storageService } from '../../services/storage-service.js';
import { shareService } from '../../services/share-service.js';

export const J = { pending: [], draft: '' };
export const allPhotoIds = () => S.trip.journal.slice().reverse().flatMap(e => e.photos || []);
export const entryOfPhoto = id => S.trip.journal.find(e => (e.photos || []).includes(id));
const thumb = id => `<button class="ph-thumb" data-act="viewphoto" data-id="${id}" aria-label="Open photo"><img data-photo="${id}" alt=""></button>`;
const RATING = ['', '', 'Skip it', 'Fine', 'Really good', 'Loved it'];

export function summaryText() {
  const st = stage(S.trip), { start, end } = tripRange(S.trip);
  const visited = S.trip.saved.filter(s => s.status === 'went').map(s => placeById(s.place_id)).filter(Boolean);
  const loved = S.trip.journal.filter(e => e.stars >= 4);
  const best = loved.find(e => !e.visit || e.txt.length > 30) || S.trip.journal.slice().reverse().find(e => e.txt.length > 30);
  const places = cityIds().filter(id => S.trip.stays.some(s => s.city_id === id)).map(id => cityName(id));
  const lines = [`Portugal${places.length ? ': ' + places.join(' and ') : ''}${start ? ', ' + fmtISO(start) + (end && end !== start ? ' to ' + fmtISO(end) : '') : ''}${st.total ? ` · ${st.total} days` : ''}`];
  cityIds().forEach(id => { const v = visited.filter(p => p.city_id === id); if (v.length) lines.push('', `${cityName(id)}: ${v.map(p => p.name).join(', ')}.`); });
  if (loved.length) lines.push('', `Loved: ${[...new Set(loved.map(e => e.place).filter(Boolean))].join(', ') || 'see notes'}.`);
  if (best) lines.push('', `“${best.txt}”`);
  lines.push('', '#Portugal #Lisbon #Algarve #travel');
  return lines.join('\n');
}
export function consentMany(n) {
  const when = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `I give Whiskers & Wanderings permission to use ${n === 1 ? 'this photo' : 'these photos'} in the Wanderings app and its promotion. Shared by ${S.trip.traveler_name || 'a Wanderings traveler'}, ${when}.`;
}
export function consentOne(id) {
  const e = entryOfPhoto(id);
  return consentMany(1) + (e && e.place ? ` Photo: ${e.place}, Portugal.` : '');
}

function shareWBlock() {
  const photos = allPhotoIds(), sel = P().wSel.filter(id => photos.includes(id));
  return `<div class="block" id="shareW"><div class="head"><h2>Share with Wanderings</h2><span class="label">Optional</span></div>
    <p class="small muted">Want to help shape Wanderings? You can send favorite photos to the Wanderings team. Nothing is ever shared unless you choose it here, and you pick every photo.</p>
    ${photos.length ? `<div class="label" id="wSelLabel">Choose photos · ${sel.length} selected</div>
    <div class="ph-row">${photos.map(id => `<button class="ph-thumb sm" data-act="wpick" data-id="${id}" aria-pressed="${sel.includes(id)}" aria-label="Select photo to share with Wanderings"><img data-photo="${id}" alt="">${P().wShared.includes(id) ? '<span class="shared">Shared</span>' : ''}</button>`).join('')}</div>
    <label class="check" style="align-items:flex-start;min-height:0"><input type="checkbox" id="wConsent" style="margin-top:2px"><span class="small" id="wConsentText">${esc(consentMany(sel.length || 2))}</span></label>
    <button class="btn" data-act="wsend" id="wSendBtn" disabled style="align-self:flex-start">Send selected photos</button>
    <p class="small faint">Opens your share menu (Messages, email or AirDrop) so you choose who it goes to.</p>` : '<p class="small muted">Add photos to your journal entries first, then choose any you’d like to share.</p>'}</div>`;
}

export function renderJournal() {
  const opts = `<option value="">No place</option>` + cityIds().map(cid => `<optgroup label="${esc(cityName(cid))}">${allPlaces().filter(p => p.city_id === cid && p.category !== 'experience').map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  const list = S.trip.journal.slice().reverse(), photos = allPhotoIds(), igSel = P().igSel.filter(id => photos.includes(id));
  let html = masthead() + `<div class="greet"><div class="eyebrow">Journal</div><h1>What happened today.</h1><p class="lede">Tap in the box, then tap the microphone on your keyboard to talk instead of type.</p></div>
  <label class="f" style="flex:none"><span class="offscreen">Journal entry</span><textarea id="jText" placeholder="Where were you, what did you eat, what made you stop?">${esc(J.draft)}</textarea></label>
  <div class="fields" style="margin-top:10px"><label class="f">Place<select id="jPlace">${opts}</select></label>
  <label class="f">Rating<select id="jStars"><option value="0">No rating</option><option value="5">Loved it</option><option value="4">Really good</option><option value="3">Fine</option><option value="2">Skip it</option></select></label></div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
    <label class="btn line pick-photos" for="photoInput" data-phtarget="composer" style="align-self:flex-start">${ic('camera', 'style="width:18px;height:18px"')}Add photos</label>
    ${J.pending.length ? `<div class="ph-row">${J.pending.map(id => `<div class="ph-wrap"><img data-photo="${id}" alt=""><button data-act="unpend" data-id="${id}" aria-label="Remove photo">×</button></div>`).join('')}</div>` : ''}
  </div>
  <button class="btn" data-act="savej" style="margin-top:12px;width:100%">Save entry</button>
  <p class="small faint" style="margin-top:8px">Saved on this phone only. Photos are smaller copies; your originals stay in your Photos app. Use “Copy everything” below now and then to back up your notes.</p>`;
  html += `<div class="block"><div class="head"><h2>Entries</h2><span class="label">${S.trip.journal.length}</span></div><div>${list.length ? list.map(e => `<div class="entry"><div class="qm">“</div><div class="q">${esc(e.txt)}</div>
    <div class="m">${fmtDate(e.d, { weekday: 'short', month: 'short', day: 'numeric' })}${e.place ? ' · ' + esc(e.place) : ''}${e.city_id ? ' · ' + esc(cityName(e.city_id)) : ''}${e.stars ? ` · <span style="color:var(--coral-ink)">${RATING[e.stars]}</span>` : ''}</div>
    ${(e.photos || []).length ? `<div class="ph-row" style="margin-top:4px">${e.photos.map(thumb).join('')}</div>` : ''}
    <div style="display:flex;gap:16px;align-items:center"><label class="text-btn pick-photos" for="photoInput" data-phtarget="${e.id}" style="min-height:36px">${ic('camera', 'style="width:16px;height:16px"')}Add photos</label><button class="text-btn" data-act="delj" data-id="${e.id}" style="min-height:36px;color:var(--muted);font-weight:500">Delete</button></div></div>`).join('')
    : `<p class="serif" style="font-size:18px;border-top:1px solid var(--rule);padding-top:16px">Nothing yet. Your first memory goes here, or tap “Went here” on any place.</p>`}</div></div>`;
  html += `<div class="block" id="summary"><div class="head"><h2>Trip summary</h2><span class="label">For Instagram</span></div>
    <p class="small muted">Built from your visits and notes. Pick photos, tap Share to Instagram and choose Instagram. We copy the caption for you, so just paste it in.</p>
    <div class="summary">${esc(summaryText())}</div>
    ${photos.length ? `<div class="label" id="igSelLabel" style="margin-top:4px">Choose photos · ${igSel.length} selected</div><div class="ph-row">${photos.map(id => `<button class="ph-thumb sm" data-act="igpick" data-id="${id}" aria-pressed="${igSel.includes(id)}" aria-label="Select photo"><img data-photo="${id}" alt=""></button>`).join('')}</div>` : '<p class="small muted">Add photos to your journal entries and they’ll appear here to share.</p>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${photos.length ? '<button class="btn" data-act="igshare">Share to Instagram</button>' : ''}<button class="btn ${photos.length ? 'line' : ''}" data-act="copysum">Copy caption</button><button class="btn line" data-act="copyall">Copy everything</button></div>
    <p class="small faint"><span class="ph-flag">Later</span> Building the summary from your photos’ time and location is planned, not built yet.</p></div>`;
  html += shareWBlock();
  document.querySelector('section[data-tab="journal"]').innerHTML = html;
}

export async function saveEntry() {
  const txt = $('#jText').value.trim();
  if (!txt && !J.pending.length) { toast('Write, dictate or add a photo first'); return false; }
  const pid = $('#jPlace').value, p = pid ? placeById(pid) : null;
  S.trip.journal.push({ id: Date.now().toString(36), d: Date.now(), txt: txt || (p ? 'At ' + p.name + '.' : 'A moment in Portugal.'), place_id: pid, place: p ? p.name : '', city_id: p ? p.city_id : curCityId(), stars: +$('#jStars').value, photos: J.pending.slice() });
  if (pid && statusOf(S.trip, pid) !== 'went') setStatus(S.trip, pid, 'went');
  J.pending = []; J.draft = '';
  tripService.setPending([]); tripService.setDraft('');
  save(); toast('Saved'); return true;
}
export async function deletePhoto(id) {
  await storageService.deletePhoto(id);
  S.trip.journal.forEach(e => { if (e.photos) e.photos = e.photos.filter(x => x !== id); });
  if (P().cover === id) { P().cover = null; P().coverMode = 'sketch'; }
  P().igSel = P().igSel.filter(x => x !== id); P().wSel = P().wSel.filter(x => x !== id);
  J.pending = J.pending.filter(x => x !== id); tripService.setPending(J.pending);
  save();
}
export function backupText() {
  return ['MY PORTUGAL JOURNAL', ''].concat(S.trip.journal.map(e => `${fmtDate(e.d, { weekday: 'short', month: 'short', day: 'numeric' })}${e.place ? ' · ' + e.place : ''}${e.city_id ? ' · ' + cityName(e.city_id) : ''}\n${e.txt}\n`)).join('\n');
}
/* Shares photos through the phone's share sheet. Falls back to copying the text. */
export async function sharePhotos(ids, text, prefix) {
  const blobs = await Promise.all(ids.map(id => storageService.photoBlob(id)));
  if (blobs.some(b => !b)) { toast('A photo couldn’t be read on this phone.'); return 'failed'; }
  const files = blobs.map((b, i) => shareService.makeFile(b, `${prefix}-${i + 1}.jpg`));
  return shareService.shareFiles(files, text);
}

export function openViewer(id) {
  const e = entryOfPhoto(id), v = $('#viewer');
  v.innerHTML = `<div class="inner"><div style="display:flex;justify-content:space-between;align-items:center"><div class="label">${e ? esc(fmtDate(e.d, { weekday: 'short', month: 'short', day: 'numeric' })) + (e.place ? ' · ' + esc(e.place) : '') : 'Photo'}</div><button class="btn line sm" data-act="closeviewer">Close</button></div>
    <img data-photo="${id}" alt="${e && e.place ? 'Your photo of ' + esc(e.place) : 'Your photo'}" style="width:100%;max-height:52vh;object-fit:contain;background:var(--surface);border-radius:6px">
    <div style="display:flex;gap:8px;flex-wrap:wrap">${P().cover === id && P().coverMode === 'photo' ? '<button class="btn line sm" data-act="uncover">Back to the sketch</button><span class="went" style="align-self:center">✓ Trip cover</span>' : `<button class="btn sm" data-act="setcover" data-id="${id}">Use as trip cover</button>`}<button class="btn line sm" data-act="delphoto" data-id="${id}">Delete photo</button></div>
    <div style="border-top:1px solid var(--rule);padding-top:14px;display:flex;flex-direction:column;gap:10px">
      <h3>Share with Wanderings</h3>
      <p class="small muted">${P().wShared.includes(id) ? 'You’ve shared this photo with Wanderings. ' : ''}Send this photo to the Wanderings team by message, email or AirDrop. Your permission note goes with it.</p>
      <label class="check" style="align-items:flex-start;min-height:0"><input type="checkbox" id="consentChk" style="margin-top:2px"><span class="small">${esc(consentOne(id))}</span></label>
      <button class="btn" data-act="sharewander" data-id="${id}" id="shareWanderBtn" disabled style="align-self:flex-start">Share photo</button>
    </div></div>`;
  v.hidden = false;
}
