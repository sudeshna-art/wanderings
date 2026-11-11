/* places-service: search, details and nearby places.
   Local provider: the edition's own researched list plus the traveler's custom places.
   Later provider: Google Places (autocomplete, details, nearby), returning these same shapes. */
import { contentService } from './content-service.js';
import { km } from '../models/schema.js';

export const placesService = {
  async all() { return (await contentService.load()).places; },
  async byId(id) { return (await this.all()).find(p => p.id === id) || null; },
  async inCity(cityId, categories) {
    return (await this.all()).filter(p => p.city_id === cityId && (!categories || categories.includes(p.category)));
  },
  async search(query, cityId) {
    const q = String(query || '').trim().toLowerCase();
    return (await this.all()).filter(p => (!cityId || p.city_id === cityId) && (p.name + ' ' + (p.area || '') + ' ' + (p.description || '')).toLowerCase().includes(q));
  },
  /* Curated places within `radiusM` metres of a point, nearest first, each with distance_m. */
  async nearby(point, radiusM = 1500, opts = {}) {
    const list = (await this.all()).filter(p => p.location && p.location.lat && (!opts.categories || opts.categories.includes(p.category)));
    return list.map(p => Object.assign({}, p, { distance_m: Math.round(km(point, p.location) * 1000) }))
      .filter(p => p.distance_m <= radiusM)
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, opts.limit || 40);
  }
};
