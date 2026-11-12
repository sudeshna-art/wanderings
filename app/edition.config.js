/* One app, many destinations (Nov 2026). The shared core reads EDITION from here.
   This loader picks the chosen destination and returns its own settings, with paths pointing at its folder.
   Each destination keeps its own edition id and storage names, so saved trips stay separate when switching. */
import { DESTINATIONS, chosenId } from './destinations.js?v=202611121258';

const d = DESTINATIONS.find(x => x.id === chosenId()) || DESTINATIONS[0];
const base = `./destinations/${d.dir}/`;
const own = (await import(`./destinations/${d.dir}/edition.config.js`)).EDITION;

export const EDITION = {
  ...own,
  multi: true,
  tripCode: d.code || '',
  dir: d.dir,
  contentPath: base + 'content/',
  artPath: base + 'art/',
  mapsBase: d.maps != null ? d.maps : base
};
