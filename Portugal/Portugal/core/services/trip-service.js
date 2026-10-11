/* trip-service: the traveler's own trip (stays, legs, saved, plan, journal). Lives only on this phone.
   Later provider: Firestore under an optional account, only if the owner approves accounts. */
import { storageService } from './storage-service.js';
import { newTrip, migrateTrip } from '../models/schema.js';
import { EDITION } from '../../edition.config.js';

let saveTimer = null;

export const tripService = {
  async load() {
    const raw = await storageService.get('state', null);
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
