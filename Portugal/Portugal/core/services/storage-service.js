/* storage-service: key/value and photo storage on this phone.
   Local provider: localStorage (+ IndexedDB for photos). Native apps later: Capacitor Preferences / Filesystem.
   Storage names are per edition so editions sharing one web address never collide. */
import { EDITION } from '../../edition.config.js';

const PREFIX = EDITION.storage.prefix;          // e.g. 'wanderings-portugal'
const PHOTO_DB = EDITION.storage.photos;        // e.g. 'wanderings-portugal-photos'

let _db = null;
function db() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(PHOTO_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return _db;
}
const blobCache = {}, urlCache = {};

async function shrink(file, max = 1600, q = 0.82) {
  try {
    if (typeof createImageBitmap !== 'function') return { blob: file, w: 0, h: 0 };
    const bmp = await createImageBitmap(file);
    let w = bmp.width, h = bmp.height; const k = Math.min(1, max / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    let blob;
    if (typeof OffscreenCanvas === 'function') {
      const c = new OffscreenCanvas(w, h); c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      blob = await c.convertToBlob({ type: 'image/jpeg', quality: q });
    } else {
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    }
    return { blob: blob || file, w, h };
  } catch (e) { return { blob: file, w: 0, h: 0 }; }
}

export const storageService = {
  async get(key, dflt) {
    try { const v = localStorage.getItem(PREFIX + '.' + key); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
  },
  async set(key, val) {
    try { localStorage.setItem(PREFIX + '.' + key, JSON.stringify(val)); return true; } catch (e) { return false; }
  },
  /* Save smaller JPEG copies of picked photos. Originals stay in the phone's Photos app. Returns ids. */
  async addPhotos(files) {
    const ids = [], failed = [];
    for (const f of files) {
      try {
        const { blob, w, h } = await shrink(f);
        const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const d = await db();
        await new Promise((res, rej) => { const tx = d.transaction('photos', 'readwrite'); tx.objectStore('photos').put({ id, blob, w, h, d: Date.now() }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
        blobCache[id] = blob; ids.push(id);
      } catch (e) { failed.push(f.name || 'photo'); }
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return { ids, failed };
  },
  async photoBlob(id) {
    if (blobCache[id]) return blobCache[id];
    try {
      const d = await db();
      const r = await new Promise((res, rej) => { const q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      if (r && r.blob) { blobCache[id] = r.blob; return r.blob; }
    } catch (e) {}
    return null;
  },
  async photoURL(id) {
    if (urlCache[id]) return urlCache[id];
    const b = await this.photoBlob(id); if (!b) return '';
    try { return (urlCache[id] = URL.createObjectURL(b)); } catch (e) { return ''; }
  },
  async deletePhoto(id) {
    try {
      const d = await db();
      await new Promise((res, rej) => { const tx = d.transaction('photos', 'readwrite'); tx.objectStore('photos').delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (e) {}
    try { if (urlCache[id]) URL.revokeObjectURL(urlCache[id]); } catch (e) {}
    delete urlCache[id]; delete blobCache[id];
  }
};
