/* Itinerary import (approved Oct 11 2026, "Option A"): reads pasted confirmation emails or calendar (.ics) files
   on this phone and suggests bookings. Nothing is sent anywhere. Pure functions, no DOM.
   Pasted text is read with simple patterns, so results are suggestions: the traveler confirms or fixes each one.
   ctx: { year, timezone, places: [{ city_id, neighborhood_id?, words: [..] }], airports: { LIS: 'lisbon', ... } } */
import { newBooking } from './schema.js';

/* ---------- dates and times ---------- */
const MONTHS = {
  jan: 1, january: 1, janeiro: 1, enero: 1, janvier: 1, januar: 1, gennaio: 1, ene: 1, janv: 1, gen: 1,
  feb: 2, february: 2, fevereiro: 2, fev: 2, febrero: 2, février: 2, fevrier: 2, févr: 2, februar: 2, febbraio: 2,
  mar: 3, march: 3, março: 3, marco: 3, marzo: 3, mars: 3, märz: 3, maerz: 3, mär: 3,
  apr: 4, april: 4, abril: 4, abr: 4, avril: 4, avr: 4, aprile: 4,
  may: 5, maio: 5, mayo: 5, mai: 5, maggio: 5, mag: 5,
  jun: 6, june: 6, junho: 6, junio: 6, juin: 6, juni: 6, giugno: 6, giu: 6,
  jul: 7, july: 7, julho: 7, julio: 7, juillet: 7, juil: 7, juli: 7, luglio: 7, lug: 7,
  aug: 8, august: 8, agosto: 8, ago: 8, août: 8, aout: 8,
  sep: 9, sept: 9, september: 9, setembro: 9, set: 9, septiembre: 9, septembre: 9, settembre: 9,
  oct: 10, october: 10, outubro: 10, out: 10, octubre: 10, octobre: 10, oktober: 10, okt: 10, ottobre: 10, ott: 10,
  nov: 11, november: 11, novembro: 11, noviembre: 11, novembre: 11,
  dec: 12, december: 12, dezembro: 12, dez: 12, diciembre: 12, dic: 12, décembre: 12, decembre: 12, déc: 12, dezember: 12, dicembre: 12
};
const MON = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const pad = n => String(n).padStart(2, '0');
const nextDay = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31) ? `${y}-${pad(m)}-${pad(d)}` : '';
function guessYear(m, ctx) {
  const now = new Date(), y = ctx.year || now.getFullYear();
  /* A month well before now is next year's (e.g. booking a January trip in October). */
  if (!ctx.year && m < now.getMonth() + 1 - 2) return y + 1;
  return y;
}
const yr = y => (y < 100 ? 2000 + y : y);

/* All dates in the text with their positions: [{ at, end, date }]. */
export function findDates(text, ctx = {}) {
  const out = [];
  const push = (at, len, d) => { if (d && !out.some(o => at < o.end && at + len > o.at)) out.push({ at, end: at + len, date: d }); };
  let m;
  const rIso = /\b(20\d\d)-(\d\d)-(\d\d)\b/g;
  while ((m = rIso.exec(text))) push(m.index, m[0].length, iso(+m[1], +m[2], +m[3]));
  /* 15 Oct 2026, 15 de outubro de 2026, 15. Oktober, Thu 15 October */
  const rDM = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|º)?\\.?\\s*(?:de\\s+)?(${MON})\\.?,?(?:[ ,]*(?:de\\s+)?(\\d{4}))?\\b`, 'gi');
  while ((m = rDM.exec(text))) { const mo = MONTHS[m[2].toLowerCase()]; push(m.index, m[0].length, iso(m[3] ? yr(+m[3]) : guessYear(mo, ctx), mo, +m[1])); }
  /* Oct 15, 2026 / October 15 */
  const rMD = new RegExp(`\\b(${MON})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:[ ,]*(\\d{4}))?`, 'gi');
  while ((m = rMD.exec(text))) { const mo = MONTHS[m[1].toLowerCase()]; push(m.index, m[0].length, iso(m[3] ? +m[3] : guessYear(mo, ctx), mo, +m[2])); }
  /* 15/10/2026, 15.10.26, 10/15/2026 (day first unless that can't be right) */
  const rNum = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/g;
  while ((m = rNum.exec(text))) {
    let d = +m[1], mo = +m[2]; const y = yr(+m[3]);
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    else if (ctx.monthFirst && d <= 12 && mo <= 31) [d, mo] = [mo, d];
    push(m.index, m[0].length, iso(y, mo, d));
  }
  return out.filter(o => o.date).sort((a, b) => a.at - b.at);
}
/* All clock times: 14:05, 14h05, 2:05 PM, 2pm. */
export function findTimes(text) {
  const out = []; let m;
  const r = /\b(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d\/])/gi;
  while ((m = r.exec(text))) {
    let h = +m[1], mi = m[2] ? +m[2] : 0; const ap = (m[3] || '').toLowerCase().replace(/\./g, '');
    if (!m[2] && !ap) continue;                       // a bare number is not a time
    if (m[2] && m[0].includes('.') && !ap && /\d\.\d\d\.\d/.test(text.slice(m.index, m.index + 8))) continue;   // part of a date
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || mi > 59) continue;
    out.push({ at: m.index, end: m.index + m[0].length, time: pad(h) + ':' + pad(mi) });
  }
  return out;
}

/* ---------- other fields ---------- */
const REF = /(?:booking|confirmation|reservation|reserva|réservation|buchungs?|prenotazione|order)\s*(?:reference|ref\.?|number|no\.?|code|nr\.?|n[º°o]|#|id|código|numero|número|nummer)?\s*[:#]?\s*([A-Z0-9][A-Z0-9.-]{3,15}[A-Z0-9])\b|\b(?:PNR|record locator|localizador|código de reserva|booking code)\s*[:#]?\s*([A-Z0-9]{5,8})\b/i;
export function findRef(text) {
  const r = new RegExp(REF.source, 'gi'); let m;
  while ((m = r.exec(text))) { const v = m[1] || m[2]; if (v && (/\d/.test(v) || /^[A-Z]{6}$/.test(v))) return v.toUpperCase(); }
  return '';
}
const FLIGHT = /\b(?!CP\b)([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/g;
const AIRLINE_WORDS = /\b(flight|voo|vuelo|vol|flug|volo|airline|airways|air lines|boarding|depart|departure|arrival|terminal|gate|emirates|tap|ryanair|easyjet|flydubai|lufthansa|british airways|klm|iberia)\b/i;
const IATA = /\b([A-Z]{3})\b/g;
const NOT_IATA = new Set(['MRS', 'MSS', 'MISS', 'ADT', 'CHD', 'INF', 'OUT', 'ONE', 'WAY', 'ALL', 'NEW', 'YES', 'TBA', 'TBC', 'THE', 'AND', 'FOR', 'YOU', 'ARE', 'PNR', 'REF', 'EUR', 'USD', 'AED', 'GBP', 'TAP', 'CET', 'GMT', 'UTC', 'WET', 'NIF', 'VAT', 'IVA', 'TEL', 'FAX', 'APT', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'NOV', 'DEC', 'OCT', 'SEP', 'AUG', 'JUL', 'JUN', 'MAY', 'APR', 'MAR', 'FEB', 'JAN', 'ECO', 'BAG', 'SEAT', 'ROW', 'NET', 'TAX', 'PDF']);
const POSTCODE = /\b\d{4}-\d{3}\b/;
const STAY_WORDS = /\b(check-?in|check-?out|hotel|hostel|apartment|apartamento|alojamento|accommodation|guest ?house|pousada|airbnb|booking\.com|your stay|nights?|noites?|quarto|room)\b/i;
const KIND_WORDS = [
  ['train', /\b(cp\.pt|comboios de portugal|alfa pendular|intercidades|regional train|comboio|train|tren|zug|treno|carriage|carruagem)\b/i],
  ['bus', /\b(rede expressos|flixbus|coach|autocarro|bus ticket|autobús|autocar)\b/i],
  ['car', /\b(transfer|private driver|chauffeur|car hire|car rental|rent-?a-?car|hertz|europcar|sixt|avis|pick-?up point)\b/i],
  ['restaurant', /\b(table for|restaurant|restaurante|thefork|the fork|guests?|pessoas)\b/i],
  ['tour', /\b(getyourguide|viator|tour|tickets?|bilhete|entrada|admission|e-ticket|excursion|experience|kayak|boat trip|cruise|workshop|class)\b/i]
];

function kindOf(text) {
  if (AIRLINE_WORDS.test(text) && (text.match(FLIGHT) || []).length) return 'flight';
  if (STAY_WORDS.test(text)) return 'stay';
  for (const [k, r] of KIND_WORDS) if (r.test(text)) return k;
  return 'other';
}
const lines = t => t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
function labelled(text, words) {
  const r = new RegExp(`(?:^|\\n)\\s*(?:${words})\\s*[:\\-]\\s*(.+)`, 'i'); const m = text.match(r); return m ? m[1].trim().slice(0, 90) : '';
}
function stayName(text) {
  const l = labelled(text, 'hotel|property|accommodation|alojamento|propriedade|hébergement|unterkunft|struttura|establishment');
  if (l) return l;
  const ln = lines(text).find(s => s.length < 70 && /\b(hotel|pousada|suites?|apartments?|apartamentos|resort|guest ?house|hostel|casa|quinta|villa|lodge|inn)\b/i.test(s) && !/check|confirm|thank|dear|your/i.test(s));
  return ln || '';
}
function addressIn(text) {
  const ln = lines(text).find(s => POSTCODE.test(s) && s.length < 140);
  if (ln) return ln.replace(/^(address|morada|endereço|dirección|adresse)\s*[:\-]?\s*/i, '');
  return labelled(text, 'address|morada|endereço|dirección|adresse|indirizzo');
}
/* Which of the edition's cities (and towns or neighborhoods) the text mentions. */
function placeIn(text, ctx) {
  const low = ' ' + text.toLowerCase() + ' ';
  let best = null;
  (ctx.places || []).forEach(p => p.words.forEach(w => { const i = low.indexOf(w.toLowerCase()); if (i >= 0 && (!best || (p.neighborhood_id && !best.neighborhood_id))) best = p; }));
  return best;
}
/* A date found next to a word, e.g. the date right after "Check-in". */
function dateNear(text, words, ctx) {
  const r = new RegExp(`(?:${words})`, 'gi'); let m;
  const ds = findDates(text, ctx);
  while ((m = r.exec(text))) { const d = ds.find(x => x.at >= m.index && x.at - m.index < 90); if (d) return { date: d.date, at: d.at, time: timeNear(text, d.end, 40) }; }
  return null;
}
function timeNear(text, from, within) { const t = findTimes(text.slice(from, from + within)); return t.length ? t[0].time : ''; }

/* Airport codes, best evidence first: (LIS), LIS-FAO or LIS → FAO, then any other three capitals. */
function airportCodes(seg) {
  const strong = [], weak = []; let a;
  const r1 = /\(([A-Z]{3})\)|\b([A-Z]{3})\s*(?:-|–|→|->|>|to)\s*([A-Z]{3})\b/g;
  while ((a = r1.exec(seg))) [a[1], a[2], a[3]].filter(Boolean).forEach(c => { if (!NOT_IATA.has(c) && !strong.includes(c)) strong.push(c); });
  if (strong.length >= 2) return strong;
  IATA.lastIndex = 0;
  while ((a = IATA.exec(seg))) if (!NOT_IATA.has(a[1]) && !strong.includes(a[1]) && !weak.includes(a[1])) weak.push(a[1]);
  return strong.concat(weak);
}
/* Airports' own timezones, so flight times from calendar files show local departure and arrival times. */
const AIRPORT_TZ = { DXB: 'Asia/Dubai', AUH: 'Asia/Dubai', SHJ: 'Asia/Dubai', DOH: 'Asia/Qatar', IST: 'Europe/Istanbul', LIS: 'Europe/Lisbon', FAO: 'Europe/Lisbon', OPO: 'Europe/Lisbon', FNC: 'Atlantic/Madeira', MAD: 'Europe/Madrid', BCN: 'Europe/Madrid', SVQ: 'Europe/Madrid', LHR: 'Europe/London', LGW: 'Europe/London', CDG: 'Europe/Paris', ORY: 'Europe/Paris', FRA: 'Europe/Berlin', MUC: 'Europe/Berlin', AMS: 'Europe/Amsterdam', FCO: 'Europe/Rome', FLR: 'Europe/Rome', PSA: 'Europe/Rome', MXP: 'Europe/Rome', ZRH: 'Europe/Zurich', JFK: 'America/New_York', EWR: 'America/New_York', BOS: 'America/New_York', IAD: 'America/New_York', MIA: 'America/New_York', ATL: 'America/New_York', ORD: 'America/Chicago', DFW: 'America/Chicago', LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SEA: 'America/Los_Angeles', SJU: 'America/Puerto_Rico', YYZ: 'America/Toronto' };

/* ---------- pasted text ---------- */
export function parseText(raw, ctx = {}) {
  const text = String(raw || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  if (!text.trim()) return [];
  const kind = kindOf(text), ref = findRef(text), out = [];
  if (kind === 'flight') {
    /* One booking per flight number, each reading the dates, times and airports around it. */
    const fl = []; let m; FLIGHT.lastIndex = 0;
    while ((m = FLIGHT.exec(text))) { const code = m[1] + ' ' + m[2]; if (!fl.some(f => f.code === code)) fl.push({ code, at: m.index }); }
    fl.forEach((f, i) => {
      const start = f.at, end = fl[i + 1] ? fl[i + 1].at : text.length;
      const seg = text.slice(start, end);
      const ds = findDates(seg, ctx), ts = findTimes(seg);
      const known = airportCodes(seg);
      const b = Object.assign(newBooking('flight'), { title: 'Flight ' + f.code, ref, source: 'paste' });
      if (ds[0]) b.date = ds[0].date;
      if (ts[0]) b.time = ts[0].time;
      if (ts[1]) { b.end_time = ts[1].time; b.end_date = ds[1] && ds[1].at < ts[1].at + 40 ? ds[1].date : b.date; if (b.end_time < b.time && (!b.end_date || b.end_date === b.date) && b.date) b.end_date = nextDay(b.date); }
      if (known.length >= 2) { b.from = known[0]; b.to = known[1]; } else if (known.length === 1) b.to = known[0];
      const city = (ctx.airports || {})[b.to] || (ctx.airports || {})[b.from];
      if (city) b.city_id = city;
      b.found = ['flight number', b.date && 'date', b.time && 'time', b.from && 'airports', ref && 'reference'].filter(Boolean);
      if (b.date || b.time) out.push(b);
    });
    if (out.length) return out;
  }
  const b = Object.assign(newBooking(kind), { ref, source: 'paste' });
  const pl = placeIn(text, ctx); if (pl) { b.city_id = pl.city_id; if (pl.neighborhood_id) b.neighborhood_id = pl.neighborhood_id; }
  if (kind === 'stay') {
    const ci = dateNear(text, 'check-?in|arrival|arrive|chegada|entrada|llegada|arrivée|anreise|arrivo', ctx);
    const co = dateNear(text, 'check-?out|departure|depart|partida|saída|salida|départ|abreise|partenza', ctx);
    const ds = findDates(text, ctx);
    b.date = (ci && ci.date) || (ds[0] && ds[0].date) || '';
    b.end_date = (co && co.date) || (ds.find(d => d.date > b.date) || {}).date || '';
    b.time = (ci && ci.time) || ''; b.end_time = (co && co.time) || '';
    b.title = stayName(text) || 'Stay';
    b.where = addressIn(text);
  } else {
    const ds = findDates(text, ctx), ts = findTimes(text);
    b.date = ds[0] ? ds[0].date : '';
    const t = ds[0] ? ts.find(x => x.at > ds[0].at && x.at - ds[0].end < 60) || ts[0] : ts[0];
    b.time = t ? t.time : '';
    if (kind === 'train' || kind === 'bus') {
      const m = text.match(/\b(?:from|de|desde|von|da)\s+([A-ZÀ-Ý][\wÀ-ÿ .'-]{2,30}?)\s+(?:to|para|a|nach|à|->|→)\s+([A-ZÀ-Ý][\wÀ-ÿ .'-]{2,30}?)(?=[\n,.;(]|\s{2}|$)/i);
      if (m) { b.from = m[1].trim(); b.to = m[2].trim(); }
      b.title = (kind === 'train' ? 'Train' : 'Coach') + (b.from && b.to ? ` ${b.from} to ${b.to}` : '');
      if (ts[1]) b.end_time = ts[1].time;
    } else {
      b.title = labelled(text, 'activity|tour|product|experience|event|restaurant|restaurante|venue|atividade') || (lines(text).find(s => s.length > 6 && s.length < 80 && !/^(dear|hi|hello|olá|thank|your|booking|confirm|order|reservation|e-?ticket)/i.test(s) && !/^(getyourguide|viator|thefork|the fork|tripadvisor|klook|civitatis|booking\.com|airbnb)$/i.test(s) && !findDates(s, ctx).length) || '');
      b.where = addressIn(text) || labelled(text, 'meeting point|location|local|place|lugar|treffpunkt|ritrovo');
    }
  }
  b.found = [b.date && 'date', b.time && 'time', b.title && b.title !== 'Stay' && 'name', b.where && 'address', ref && 'reference'].filter(Boolean);
  return b.date || b.title ? [b] : [];
}

/* ---------- calendar files (.ics) ---------- */
function unfold(t) { return String(t || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); }
const icsText = v => String(v || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
/* Wall-clock date and time in the destination's timezone for a UTC time. */
function inZone(d, tz) {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const g = k => (p.find(x => x.type === k) || {}).value;
    return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
  } catch (e) { return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }; }
}
function icsWhen(prop, val, tz) {
  if (!val) return { date: '', time: '' };
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return { date: '', time: '' };
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
  if (m[7]) return inZone(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])), tz);
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };   /* local wall time (TZID or floating) */
}
export function parseICS(raw, ctx = {}) {
  const t = unfold(raw), out = [];
  const evs = t.split(/BEGIN:VEVENT/).slice(1).map(s => s.split(/END:VEVENT/)[0]);
  evs.forEach(ev => {
    const props = {};
    ev.split('\n').forEach(l => { const i = l.indexOf(':'); if (i < 0) return; const key = l.slice(0, i).split(';')[0].toUpperCase(); if (!props[key]) props[key] = { p: l.slice(0, i), v: l.slice(i + 1).trim() }; });
    const g = k => props[k] ? icsText(props[k].v) : '';
    const summary = g('SUMMARY'), desc = g('DESCRIPTION'), loc = g('LOCATION');
    const all = [summary, loc, desc].join('\n');
    const fmx = (summary + ' ' + desc).match(FLIGHT), cx = airportCodes(summary + ' ' + loc), isFlight = fmx && cx.length >= 2;
    const s = icsWhen(props.DTSTART && props.DTSTART.p, props.DTSTART && props.DTSTART.v, (isFlight && AIRPORT_TZ[cx[0]]) || ctx.timezone);
    const e = icsWhen(props.DTEND && props.DTEND.p, props.DTEND && props.DTEND.v, (isFlight && AIRPORT_TZ[cx[1]]) || ctx.timezone);
    const fm = (summary + ' ' + desc).match(FLIGHT), codes = airportCodes(summary + ' ' + loc);
    const kind = fm && codes.length >= 2 ? 'flight' : kindOf(all);
    const b = Object.assign(newBooking(kind), { title: summary.slice(0, 90), date: s.date, time: s.time, end_date: e.date && e.date !== s.date ? e.date : (e.time ? s.date : ''), end_time: e.time, where: loc.slice(0, 140), ref: findRef(all), source: 'ics' });
    /* An all-day hotel event ends the morning after the last night, which is the check-out day. */
    if (kind === 'stay' && !s.time && e.date) b.end_date = e.date;
    if (kind === 'flight') { const m = (summary + ' ' + desc).match(FLIGHT); if (m) b.title = 'Flight ' + m[0].replace(/^([A-Z0-9]{2})(\d)/, '$1 $2') + (codes.length >= 2 ? ` ${codes[0]} to ${codes[1]}` : ''); if (codes.length >= 2) { b.from = codes[0]; b.to = codes[1]; } }
    const pl = placeIn(all, ctx); if (pl) { b.city_id = pl.city_id; if (pl.neighborhood_id) b.neighborhood_id = pl.neighborhood_id; }
    if (kind === 'flight' && (ctx.airports || {})[b.to]) b.city_id = ctx.airports[b.to];
    b.found = ['calendar event', b.date && 'date', b.time && 'time', b.where && 'place', b.ref && 'reference'].filter(Boolean);
    if (b.date) out.push(b);
  });
  return out;
}

/* Either kind of input. */
export function parseAny(raw, ctx) { return /BEGIN:VCALENDAR|BEGIN:VEVENT/.test(raw || '') ? parseICS(raw, ctx) : parseText(raw, ctx); }
