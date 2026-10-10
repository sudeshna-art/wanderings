/* fare-service: taxi fare estimates from the official tariff in cities.json.
   Straight-line distance with a road factor and a slow/fast traffic range. Always an estimate; the meter decides.
   Later provider: a routing service, only if ever approved. */
import { contentService } from './content-service.js';
import { km } from '../models/schema.js';

export const fareService = {
  /* from, to: { lat, lng }. Returns { lo, hi, km, currency_code, tariff, note } or { err }. */
  async estimate(from, to, cityId) {
    if (!from || !to || from.lat == null || to.lat == null) return { err: 'Pick two places with a known location. For where you are staying, choose your neighborhood or town in Essentials.' };
    const d0 = km(from, to);
    if (d0 < 0.05) return { err: 'Pick two different places.' };
    const city = await contentService.city(cityId);
    const t = city && city.taxi_tariff;
    if (!t || t.base == null || t.per_km == null) return { err: 'No official taxi tariff saved for this area yet.' };
    const road = d0 * (t.road_factor || 1.35);
    const minsAt = kmh => road / kmh * 60;
    const fare = mins => t.base + road * t.per_km + (t.per_min || 0) * mins;
    const lo = Math.max(fare(minsAt(t.fast_kmh || 30)), t.minimum || 0);
    const hi = Math.max(fare(minsAt(t.slow_kmh || 15)), t.minimum || 0);
    return {
      lo: Math.floor(lo), hi: Math.ceil(hi), km: road, currency_code: t.currency_code || 'EUR',
      tariff: t, mins: Math.round(minsAt(t.fast_kmh || 30)),
      note: t.note || 'Rough estimate from the official tariff and straight-line distance. The meter decides.'
    };
  }
};
