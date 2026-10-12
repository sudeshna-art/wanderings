/* mappack-service: offline map packs (approved Oct 10 2026).
   Each edition lists its packs in content/maps.json: one PMTiles file per area, built from OpenStreetMap data.
   A pack is downloaded once on Wi-Fi and kept on the phone (IndexedDB), so the live map works with no signal.
   Without a download, the same file is read in small pieces from the edition's own site while online.
   Native apps later: the same files saved with Capacitor Filesystem. */
import { contentService } from './content-service.js?v=202610121014';
import { EDITION } from '../../edition.config.js?v=202610121014';

const DB = EDITION.storage.prefix + '-maps';
let _db = null;
function db() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('packs', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return _db;
}
const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction('packs', mode); const out = fn(t.objectStore('packs')); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }));
const fileCache = {};
const inside = (p, b) => p.lng >= b[0] && p.lat >= b[1] && p.lng <= b[2] && p.lat <= b[3];

export const mapPackService = {
  async list() { return ((await contentService.load()).maps || {}).packs || []; },
  async info() { return (await contentService.load()).maps || { packs: [] }; },
  /* Ids of packs saved on this phone. */
  async downloaded() {
    try { const keys = await tx('readonly', s => s.getAllKeys()); return keys || []; } catch (e) { return []; }
  },
  /* The pack whose area contains the point, preferring one on this phone. */
  async packFor(point) {
    if (!point) return null;
    const packs = (await this.list()).filter(p => inside(point, p.bbox));
    if (!packs.length) return null;
    const have = await this.downloaded();
    return packs.find(p => have.includes(p.id)) || packs[0];
  },
  async isDownloaded(id) { return (await this.downloaded()).includes(id); },
  /* A File for a saved pack, or null. */
  async file(id) {
    if (fileCache[id]) return fileCache[id];
    try {
      const rec = await tx('readonly', s => s.get(id));
      if (rec && rec.blob) return (fileCache[id] = new File([rec.blob], id + '.pmtiles'));
    } catch (e) {}
    return null;
  },
  /* Absolute address of a pack on the edition's site, for reading while online. */
  remoteUrl(pack) { return new URL(pack.file, location.href).href; },
  /* Downloads one pack. onProgress(fraction 0..1). Resolves { ok } or { ok:false, reason }. */
  async download(id, onProgress) {
    const pack = (await this.list()).find(p => p.id === id);
    if (!pack) return { ok: false, reason: 'unknown' };
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.quota && est.usage != null && est.quota - est.usage < pack.bytes * 1.2) return { ok: false, reason: 'space' };
      }
    } catch (e) {}
    let blob;
    try {
      const r = await fetch(pack.file, { cache: 'no-store' });
      if (!r.ok) return { ok: false, reason: 'missing' };
      const total = +r.headers.get('content-length') || pack.bytes;
      if (r.body && r.body.getReader) {
        const reader = r.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onProgress && onProgress(Math.min(1, got / total)); }
        blob = new Blob(parts);
      } else { blob = await r.blob(); onProgress && onProgress(1); }
    } catch (e) { return { ok: false, reason: 'network' }; }
    try {
      const built = (await this.info()).built || '';
      await tx('readwrite', s => s.put({ id, blob, bytes: blob.size, saved: Date.now(), built }));
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
      delete fileCache[id];
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'space' }; }
  },
  async remove(id) { try { await tx('readwrite', s => s.delete(id)); } catch (e) {} delete fileCache[id]; return true; }
};
