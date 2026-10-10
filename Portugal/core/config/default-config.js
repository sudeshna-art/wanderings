/* Wanderings shared core: which provider each service uses, plus feature flags.
   Read-only at runtime. Switching a provider here (for example map: 'google') must not need UI changes.
   Paid providers (Google, Firebase) stay off until the owner approves them. */
export const CONFIG = {
  schema_version: 1,
  providers: {
    content: 'local',      // edition JSON files      -> later 'firestore'
    trip: 'local',         // this phone only          -> later 'firestore' (only if accounts are approved)
    places: 'local',       // edition places list      -> later 'google'
    map: 'leaflet',        // bundled Leaflet + OSM    -> later 'google'
    location: 'browser',   // navigator.geolocation    -> later 'capacitor'
    currency: 'frankfurter',
    fare: 'local',
    storage: 'browser',    // localStorage + IndexedDB -> later 'capacitor'
    share: 'webshare',
    speech: 'browser',     // phone voice              -> later bundled TTS files
    link: 'browser'
  },
  map: {
    // OpenStreetMap-based tiles for the beta (approved Oct 9 2026). Never pre-downloaded or bulk cached.
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  currency: {
    rateUrl: 'https://api.frankfurter.dev/v2/rate/{from}/{to}',
    // The ECB reference rates do not cover AED, so AED is derived from the US dollar peg.
    aedPerUsd: 3.6725,
    aedPegSource: 'UAE dirham official US dollar peg (3.6725 since 1997)',
    aedPegChecked: '2026-10-09'
  },
  features: {
    true_wanderer: true,
    affiliate_links: false   // stays off until the owner approves a program and the disclosure wording
  }
};
