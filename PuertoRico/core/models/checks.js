/* Trip checks: gentle warnings about the plan, worked out on this phone. Pure functions, no DOM.
   Each check is { level: 'warn' | 'info', day, text, item_id?, booking_id? }. */
import { stayOn, closedOn, closedText, bookingKindLabel, sortedBookings, isBooked, tripDays, everyone, hereOn, isGroup, whoOf } from './schema.js?v=202610121715';

const mins = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const hhmm = n => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

/* ctx: { placeById(id), cityName(id), days?: [iso] } */
export function tripChecks(trip, ctx) {
  const out = [];
  const days = new Set(ctx.days || tripDays(trip));
  /* 1. Plan items on a day the place is closed */
  trip.plan.forEach(p => {
    const pl = ctx.placeById(p.item_id); if (!pl) return;
    if (closedOn(pl, p.date)) out.push({ level: 'warn', kind: 'closed', day: p.date, item_id: p.item_id, text: `${pl.name} is planned on a day it’s closed (${closedText(pl).replace(/^Closed /, 'closed ')}).` });
    /* 2. A place in a different city from where you are staying that day */
    const st = stayOn(trip, p.date);
    if (st && pl.city_id && st.city_id !== pl.city_id && pl.category !== 'day_trip') out.push({ level: 'warn', day: p.date, item_id: p.item_id, text: `${pl.name} is in ${ctx.cityName(pl.city_id)}, but you’re staying in ${ctx.cityName(st.city_id)} that day.` });
    /* 3. Must-book places in the plan that aren't booked yet */
    if (pl.booking_status === 'required' && !isBooked(trip, pl.id)) out.push({ level: 'info', day: p.date, item_id: p.item_id, text: `${pl.name} needs a ticket. Book it and tick “Booked”.` });
  });
  /* 3b. Traveling together (Oct 12 2026): someone planned on a day they aren't there yet, or have left;
         and "everyone" plans on days when only part of the group is around. */
  if (isGroup(trip)) {
    const all = everyone(trip), fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const nm = p => p.me ? 'you' : p.name;
    trip.plan.forEach(it => {
      const pl = ctx.placeById(it.item_id), what = pl ? pl.name : 'A plan';
      const who = whoOf(it), here = hereOn(trip, it.date).map(p => p.id);
      if (who) {
        all.filter(p => who.includes(p.id) && p.arrive && !here.includes(p.id)).forEach(p => {
          const why = it.date < p.arrive ? `${p.me ? 'you arrive' : 'arrives'} ${fmt(p.arrive)}` : `${p.me ? 'you leave' : 'leaves'} ${fmt(p.leave || p.arrive)}`;
          out.push({ level: 'warn', kind: 'away', day: it.date, item_id: it.item_id, text: `${what} includes ${nm(p)}, but ${p.me ? 'you’re' : 'they’re'} not here that day (${p.me ? '' : nm(p) + ' '}${why}).`.replace('( ', '(') });
        });
      } else {
        const away = all.filter(p => p.arrive && !here.includes(p.id));
        if (away.length && here.length) out.push({ level: 'info', kind: 'partial', day: it.date, item_id: it.item_id, text: `${what} is planned for everyone, but ${away.map(nm).join(', ').replace(/, ([^,]*)$/, ' and $1')} ${away.length === 1 && !away[0].me ? 'isn’t' : 'aren’t'} here that day. Choose who’s going.` });
      }
    });
  }
  /* 4. Two fixed times too close together on the same day */
  const bs = sortedBookings(trip).filter(b => b.date && b.time);
  for (let i = 1; i < bs.length; i++) {
    const a = bs[i - 1], b = bs[i];
    if (a.date !== b.date) continue;
    const aEnd = a.end_date === a.date && a.end_time ? mins(a.end_time) : mins(a.time) + 60;
    if (mins(b.time) < aEnd) out.push({ level: 'warn', day: b.date, booking_id: b.id, text: `${b.title || bookingKindLabel(b.kind)} at ${b.time} overlaps ${a.title || bookingKindLabel(a.kind)} at ${a.time}.` });
  }
  /* 5. Plans before you've landed, or after you need to leave */
  sortedBookings(trip).filter(b => b.kind === 'flight' && b.date).forEach(f => {
    const landDay = f.end_date || f.date, land = mins(f.end_time || f.time);
    const firstDay = [...days][0];
    if (land != null && landDay === firstDay) {
      trip.plan.filter(p => p.date === landDay && p.time && mins(p.time) < land + 120).forEach(p => {
        const pl = ctx.placeById(p.item_id);
        out.push({ level: 'warn', day: landDay, item_id: p.item_id, text: `${pl ? pl.name : 'A plan'} at ${p.time} is close to your flight landing around ${hhmm(land)}. Leave time for the airport.` });
      });
    }
    const lastDay = [...days].slice(-1)[0];
    const dep = mins(f.time);
    if (dep != null && f.date === lastDay && f.date !== firstDay) {
      trip.plan.filter(p => p.date === f.date && p.time && mins(p.time) > dep - 180).forEach(p => {
        const pl = ctx.placeById(p.item_id);
        out.push({ level: 'warn', day: f.date, item_id: p.item_id, text: `${pl ? pl.name : 'A plan'} at ${p.time} is close to your ${f.time} flight. Aim to reach the airport two hours before.` });
      });
    }
  });
  /* 6. Bookings outside the trip dates */
  if (days.size) sortedBookings(trip).forEach(b => { if (b.date && !days.has(b.date) && b.kind !== 'flight') out.push({ level: 'info', day: b.date, booking_id: b.id, text: `${b.title || bookingKindLabel(b.kind)} on ${b.date} is outside your stay dates. Check the date, or your stays.` }); });
  /* 7. Two stays that overlap */
  const st = trip.stays.filter(s => s.start && s.end).slice().sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < st.length; i++) if (st[i].start < st[i - 1].end) out.push({ level: 'warn', day: st[i].start, text: `Two stays overlap around ${st[i].start}. Usually one ends the day the next begins.` });
  /* de-duplicate, warnings first, then by day */
  const seen = new Set();
  return out.filter(c => { const k = c.text; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1) || String(a.day).localeCompare(String(b.day)));
}
