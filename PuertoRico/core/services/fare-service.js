/* fare-service: taxi fare estimates from the official tariff in cities.json.
   Straight-line distance with a road factor and a slow/fast traffic range. Always an estimate; the meter decides.
   Two tariff shapes are supported:
     simple:  { base, per_km, per_min, minimum, call_fee, ... }                     (Portugal)
     periods: { periods: [{ id, label, base, minimum, per_km_switch_at, days, from, to }],
                per_km, per_km_after, per_hour_slow, slow_min_per_km: [lo, hi],
                fixed_fares: [{ airport_id, radius_km, amounts: { <period id>: n }, note }],
                airport_meter_supplement, ... }                                       (Florence)
     zones:   { zones: [{ id, name, bbox: [w, s, e, n], airport_fare }], zone_airport, airport_fee, fixed_label, hint, note }
              Fixed fares from the airport to tourist zones (San Juan, Oct 12 2026). Other trips get a hint, no number.
   The period is chosen from the city's own clock (its timezone), so a traveler at home sees the city's current rates.
   Later provider: a routing service, only if ever approved. */
import { contentService } from './content-service.js?v=202610121715';
import { km } from '../models/schema.js?v=202610121715';

/* Day of week (0 = Sunday) and minutes past midnight in the city's timezone. */
function cityClock(tz, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { dow, mins: (+get('hour') % 24) * 60 + +get('minute') };
  } catch (e) { return { dow: at.getDay(), mins: at.getHours() * 60 + at.getMinutes() }; }
}
const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
function inWindow(p, mins) {
  if (!p.from || !p.to) return true;
  const a = hm(p.from), b = hm(p.to);
  return a <= b ? mins >= a && mins < b : mins >= a || mins < b;
}
/* Time-of-day periods first (night), then day-of-week periods (Sunday), then the default (no rules). */
export function periodFor(t, tz, at) {
  const { dow, mins } = cityClock(tz, at);
  const ps = t.periods || [];
  return ps.find(p => p.from && inWindow(p, mins) && (!p.days || p.days.includes(dow)))
    || ps.find(p => !p.from && p.days && p.days.includes(dow))
    || ps.find(p => !p.from && !p.days) || ps[0];
}
/* Meter for the period tariff: lower per-km rate until the fare reaches the switch point, then the higher one. */
function meter(t, p, roadKm, slowMins) {
  let f = p.base;
  const sw = p.per_km_switch_at;
  if (sw != null && t.per_km_after != null) {
    const kmLow = Math.max(0, (sw - p.base) / t.per_km);
    f += Math.min(roadKm, kmLow) * t.per_km + Math.max(0, roadKm - kmLow) * t.per_km_after;
  } else f += roadKm * t.per_km;
  f += (t.per_hour_slow || 0) / 60 * slowMins;
  return Math.max(f, p.minimum || 0);
}

/* Zone fares: the airport to a tourist zone (either direction) has a fixed fare plus the airport fee. */
const inBox = (p, b) => b && p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3];
function zoneFare(t, from, to, d0) {
  const cur = t.currency_code || 'USD', road = d0 * (t.road_factor || 1.35);
  const air = [from, to].find(x => x.airport_id && (!t.zone_airport || x.airport_id === t.zone_airport));
  const other = air === from ? to : from;
  const zone = air && other && !other.airport_id ? t.zones.find(z => inBox(other, z.bbox)) : null;
  if (zone && zone.airport_fare != null) {
    const a = zone.airport_fare + (t.airport_fee || 0);
    return { lo: a, hi: a, km: road, currency_code: cur, tariff: t, fixed: true, fixed_label: t.fixed_label || 'Fixed fare', decides: 'The rate posted in the taxi decides.', zone,
      note: (t.note || '') + (t.airport_fee ? ` Includes the ${symbolFor(cur)}${t.airport_fee} airport fee.` : '') };
  }
  return { err: 'No fixed fare for this trip.', hint: t.hint || 'Ask the driver for the rate before you set off.', km: road, currency_code: cur };
}
const symbolFor = c => ({ EUR: '€', USD: '$', GBP: '£' }[c] || c + ' ');

export const fareService = {
  periodFor,
  /* from, to: { lat, lng, airport_id? }. opts.at: a Date, for testing.
     Returns { lo, hi, km, currency_code, tariff, period, fixed, note } or { err }. */
  async estimate(from, to, cityId, opts = {}) {
    if (!from || !to || from.lat == null || to.lat == null) return { err: 'Pick two places with a known location. For where you are staying, choose your neighborhood or town in Essentials.' };
    const d0 = km(from, to);
    if (d0 < 0.05) return { err: 'Pick two different places.' };
    const city = await contentService.city(cityId);
    const t = city && city.taxi_tariff;
    if (t && (t.zones || []).length) return zoneFare(t, from, to, d0);
    if (!t || t.per_km == null || (t.base == null && !(t.periods || []).length)) return { err: 'No official taxi tariff saved for this area yet.' };
    const road = d0 * (t.road_factor || 1.35);
    const cur = t.currency_code || 'EUR';

    if ((t.periods || []).length) {
      const p = periodFor(t, city.timezone, opts.at);
      /* Official flat fares, e.g. airport to the city center. */
      const centre = city.landmark_center || city.center;
      for (const ff of t.fixed_fares || []) {
        const air = [from, to].find(x => x.airport_id === ff.airport_id), other = air === from ? to : from;
        if (air && other && !other.airport_id && centre && km(other, centre) <= ff.radius_km && ff.amounts[p.id] != null) {
          const a = ff.amounts[p.id];
          return { lo: a, hi: a, km: road, currency_code: cur, tariff: t, period: p, fixed: true, note: ff.note || 'Official flat fare.' };
        }
      }
      const [sLo, sHi] = t.slow_min_per_km || [1, 3];
      const sup = from.airport_id && t.airport_meter_supplement ? t.airport_meter_supplement : 0;
      const lo = meter(t, p, road, road * sLo) + sup, hi = meter(t, p, road, road * sHi) + sup;
      return {
        lo: Math.max(Math.floor(lo), Math.ceil(p.minimum || 0)), hi: Math.max(Math.ceil(hi), Math.ceil(p.minimum || 0)),
        km: road, currency_code: cur, tariff: t, period: p, mins: Math.round(road / 20 * 60),
        note: t.note || 'Rough estimate from the official tariff and straight-line distance. The meter decides.'
      };
    }

    const minsAt = kmh => road / kmh * 60;
    const fare = mins => t.base + road * t.per_km + (t.per_min || 0) * mins;
    const lo = Math.max(fare(minsAt(t.fast_kmh || 30)), t.minimum || 0);
    const hi = Math.max(fare(minsAt(t.slow_kmh || 15)), t.minimum || 0);
    return {
      lo: Math.floor(lo), hi: Math.ceil(hi), km: road, currency_code: cur,
      tariff: t, mins: Math.round(minsAt(t.fast_kmh || 30)),
      note: t.note || 'Rough estimate from the official tariff and straight-line distance. The meter decides.'
    };
  }
};
