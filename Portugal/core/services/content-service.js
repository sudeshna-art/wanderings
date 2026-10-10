/* content-service: the edition's researched content (edition, cities, places, phrases, essentials, art).
   Local provider reads the JSON files bundled with the edition. Later provider: Firestore. */
import { EDITION } from '../../edition.config.js';

let cache = null;
const artCache = {};

async function getJSON(name) {
  const r = await fetch(EDITION.contentPath + name, { cache: 'no-cache' });
  if (!r.ok) throw new Error('Could not load ' + name);
  return r.json();
}

export const contentService = {
  async load() {
    if (cache) return cache;
    const [edition, cities, places, phrases, essentials] = await Promise.all(
      ['edition.json', 'cities.json', 'places.json', 'phrases.json', 'essentials.json'].map(getJSON));
    cache = { edition, cities, places, phrases, essentials };
    return cache;
  },
  async city(cityId) { const c = await this.load(); return c.cities.find(x => x.city_id === cityId) || null; },
  /* Original sketches are SVG files in the edition's art folder. */
  async art(file) {
    if (!file) return '';
    if (artCache[file] != null) return artCache[file];
    try { const r = await fetch(EDITION.artPath + file); artCache[file] = r.ok ? await r.text() : ''; }
    catch (e) { artCache[file] = ''; }
    return artCache[file];
  }
};
