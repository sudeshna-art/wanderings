/* trip-service: the traveler's own trip (stays, legs, saved, plan, journal). Lives only on this phone.
   Later provider: Firestore under an optional account, only if the owner approves accounts. */
import { storageService } from './storage-service.js?v=202610121014';
import { newTrip, migrateTrip } from '../models/schema.js?v=202610121014';
import { fromV0 } from '../models/legacy.js?v=202610121014';
import { EDITION } from '../../edition.config.js?v=202610121014';

let saveTimer = null;

export const tripService = {
  async load() {
    let raw = await storageService.get('state', null);
    /* First open on the shared core: bring over the trip saved by the first app on this web address, if any.
       Photos need no copying when the edition keeps the old photo store name. */
    if (!raw && EDITION.legacy) {
      const old = await storageService.getLegacy(EDITION.legacy.state);
      if (old) {
        raw = fromV0(old, { editionId: EDITION.id, legacy: EDITION.legacy });
        await storageService.set('state', raw);
        const pend = await storageService.getLegacy(EDITION.legacy.pending), draft = await storageService.getLegacy(EDITION.legacy.draft);
        if (Array.isArray(pend) && pend.length) await storageService.set('pending', pend);
        if (draft) await storageService.set('draft', draft);
      }
    }
    return migrateTrip(raw, EDITION.id);
  },
  /* Debounced so quick taps do not hammer storage. Returns when written. */
  save(trip) {
    clearTimeout(saveTimer);
    return new Promise(res => { saveTimer = setTimeout(async () => { res(await storageService.set('state', trip)); }, 120); });
  },
  async saveNow(trip) { clearTimeout(saveTimer); return storageService.set('state', trip); },
  async reset() { const t = newTrip(EDITION.id); await storageService.set('state', t); return t; },
  async getDraft() { return storageService.get('draft', ''); },
  async setDraft(text) { return storageService.set('draft', text); },
  async getPending() { return storageService.get('pending', []); },
  async setPending(ids) { return storageService.set('pending', ids); }
};
