/* Andiamo Firenze edition settings. Read by the shared core. No content here: content lives in ./content/. */
export const EDITION = {
  id: 'florence',
  folder: 'florence',
  name: 'Andiamo Firenze',
  /* Clean theme (approved Oct 12 2026): native system fonts, white ground, place cards and detail sheets. */
  theme: 'clean',
  country_label: 'ITALY',
  language: 'it-IT',
  /* The photo store keeps the first Florence app's name, so photos saved there show up here with no copying. */
  storage: { prefix: 'wanderings-florence', photos: 'wanderings-photos' },
  /* Trip saved by the first Florence app (same web address). Brought over once, the first time this edition opens.
     Old ids gain the "florence-" prefix; the old "dome" booking is the Duomo place; a Pitti booking also covers Boboli. */
  legacy: {
    state: 'andiamo2.state', pending: 'andiamo2.pending', draft: 'andiamo2.draft',
    idPrefix: 'florence-', idMap: { dome: 'duomo' }, bookAlso: { pitti: ['boboli'] },
    cityId: 'florence', homeCurrency: 'USD'
  },
  contentPath: './content/',
  artPath: './art/'
};
