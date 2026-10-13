/* Ask (search everything, Oct 11 2026): one box that finds the best answer in the app, offline.
   Pure functions: builds a small index from the edition's content and the traveler's own trip, works out
   what kind of question it is (money, taxi, help, home, a phrase, a booking, opening days), and ranks matches.
   No network, no storage, no DOM. The UI turns the results into answer cards. */
import { phraseFor, sortedBookings, bookingKindLabel, closedText } from './schema.js?v=202610121715';

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set('a an the i me my we our you your is are am be do does did can could how what whats where wheres when which who to in on at of for from with and or it its this that there here please much many any some get go going want need tell show find about into near nearest best good'.split(' '));
/* Everyday travel words mapped to the words the content uses. */
const SYN = {
  tip: ['tipping', 'tip', 'couvert', 'gratuity'], tipping: ['tip', 'couvert'], gratuity: ['tip'],
  toilet: ['bathroom', 'restroom', 'wc', 'banho', 'toilet'], bathroom: ['toilet', 'restroom', 'banho'], restroom: ['bathroom', 'toilet'], loo: ['bathroom', 'toilet'], wc: ['bathroom'],
  cab: ['taxi'], uber: ['taxi', 'ride', 'bolt'], bolt: ['taxi', 'uber'], ride: ['taxi'], driver: ['taxi', 'driver', 'transfer'],
  money: ['currency', 'euro', 'cash', 'atm'], cash: ['atm', 'money'], atm: ['cash', 'money'], exchange: ['currency', 'rate'], rate: ['currency'],
  doctor: ['pharmacy', 'health', 'sns', 'hospital'], sick: ['pharmacy', 'health', 'doctor'], medicine: ['pharmacy'], chemist: ['pharmacy'], drugstore: ['pharmacy'], pharmacy: ['farmacia', 'pharmacy'],
  police: ['police', 'emergency', '112'], ambulance: ['emergency', '112'], emergency: ['112', 'emergency'], stolen: ['police', 'theft'], robbed: ['police', 'theft'], theft: ['police', 'pickpockets'], pickpocket: ['pickpockets', 'bag'],
  train: ['train', 'cp', 'comboio'], bus: ['coach', 'bus', 'autocarro'], coach: ['bus', 'express'], metro: ['metro', 'subway'], subway: ['metro'], tram: ['tram'],
  beach: ['beach', 'praia'], boat: ['boat', 'ferry', 'barco'], ferry: ['boat', 'ferry'],
  food: ['restaurant', 'eat', 'food'], eat: ['food', 'restaurant'], dinner: ['restaurant', 'food'], lunch: ['restaurant', 'food'], breakfast: ['cafe', 'coffee', 'pastry'], coffee: ['cafe', 'bica', 'coffee'],
  shoes: ['shoes', 'pavements', 'hills'], dress: ['churches', 'shoulders'], church: ['churches'], scarf: ['churches'],
  sunset: ['sunset', 'daylight', 'view', 'viewpoint'], dark: ['daylight'], night: ['night', 'late'], safe: ['safety', 'pickpockets', 'night'], safety: ['pickpockets', 'night', 'emergency'],
  wifi: ['wi-fi', 'password'], airport: ['airport'], hotel: ['stay', 'hotel'], open: ['open', 'closed', 'hours'], closed: ['closed', 'open'], hours: ['open', 'hours', 'closed'],
  ticket: ['tickets', 'book', 'booking'], tickets: ['ticket', 'book'], book: ['booking', 'tickets'], reservation: ['booking'],
  thanks: ['thank'], thank: ['thanks', 'obrigada'], hello: ['hello', 'ola'], bye: ['goodbye'], sorry: ['excuse', 'sorry'], water: ['water', 'agua'], bill: ['bill', 'conta', 'check'], check: ['bill']
};
const DAYS = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6, today: -1, tomorrow: -2 };
const CUR = [
  [/(€|\beur\b|\beuros?\b)/i, 'EUR'], [/(\baed\b|\bdirhams?\b|\bdhs?\b)/i, 'AED'], [/(\$|\busd\b|\bdollars?\b|\bbucks\b)/i, 'USD'],
  [/(£|\bgbp\b|\bpounds?\b|\bquid\b)/i, 'GBP'], [/(\bcad\b)/i, 'CAD'], [/(\baud\b)/i, 'AUD'], [/(₹|\binr\b|\brupees?\b)/i, 'INR'], [/(\bchf\b|\bfrancs?\b)/i, 'CHF'], [/(\bjpy\b|\byen\b|¥)/i, 'JPY'], [/(\bsgd\b)/i, 'SGD']
];

export function tokens(q) {
  return strip(q).replace(/[^a-z0-9€$£' -]/g, ' ').split(/\s+/).map(w => w.replace(/^'+|'+$/g, '').replace(/'s$/, '')).filter(w => w && !STOP.has(w));
}
function expand(ws) {
  const out = new Set(ws);
  ws.forEach(w => { (SYN[w] || []).forEach(s => out.add(s)); if (w.endsWith('s') && w.length > 4) out.add(w.slice(0, -1)); });
  return [...out];
}

/* ---------- the index ---------- */
/* ctx: { C (edition content), trip, lang } */
export function buildIndex(ctx) {
  const { C, trip, lang = 'en' } = ctx, docs = [];
  const add = (kind, id, title, text, extra = {}) => docs.push(Object.assign({ kind, id, title: title || '', text: text || '', t: strip(title), x: strip(text + ' ' + (extra.kw || '')) }, extra));
  C.places.concat(trip.custom || []).forEach(p => add('place', p.id, p.name, [p.area, p.description, (p.tips || []).join(' '), p.how, p.lead_time, p.kind, p.category === 'day_trip' ? 'day trip' : p.category, closedText(p)].filter(Boolean).join(' '), { city_id: p.city_id, place: p }));
  Object.entries(C.phrases.situations || {}).forEach(([sit, list]) => list.forEach(e => { const v = phraseFor(e, lang), en = phraseFor(e, 'en'); add('phrase', v.key, v.t, [v.m, en.m, sit, v.say].join(' '), { phrase: v, situation: sit, mm: [strip(v.m), strip(en.m)] }); }));
  const ess = C.essentials || {};
  (ess.know_how || []).forEach((k, i) => add('tip', 'k' + i, k.title, k.text));
  (ess.emergency || []).forEach((e, i) => add('number', 'e' + i, e.label, e.number + ' emergency help', { number: e.number }));
  C.cities.forEach(c => {
    ((c.getting_around || {}).items || []).forEach((g, i) => add('tip', c.city_id + '-ga' + i, g.title + (C.cities.length > 1 ? ' in ' + (c.short_name || c.name) : ''), g.text, { city_id: c.city_id, link: g.link }));
    (c.connections || []).forEach(con => con.items.forEach((it, i) => add('tip', c.city_id + '-' + con.to_city_id + i, `${it.title}: ${c.short_name || c.name} to ${(C.cities.find(x => x.city_id === con.to_city_id) || {}).name || ''}`, it.text, { city_id: c.city_id, link: it.link })));
    (c.airports || []).forEach(a => add('spot', '__air:' + a.id, a.name, a.tip || '', { city_id: c.city_id, kw: [a.short, a.local, a.id, 'airport flight'].join(' ') }));
    (c.stations || []).forEach(s => add('spot', '__st:' + s.id, s.name, s.tip || '', { city_id: c.city_id, kw: [s.local, 'station train'].join(' ') }));
    ((c.rides || {}).items || []).forEach((r, i) => add('number', c.city_id + '-ride' + i, r.name, [r.what, r.area, r.note, 'driver ride transfer tour book ahead'].filter(Boolean).join(' '), { city_id: c.city_id, number: r.phone || '', kw: 'driver drivers ride rides transfer uber' }));
    if (c.taxis) add('tip', c.city_id + '-taxis', 'Taxis in ' + (c.short_name || c.name), [c.taxis.intro_bold, c.taxis.intro, c.taxis.apps, (c.taxis.numbers || []).map(n => n.number + ' ' + n.label).join(' ')].join(' '), { city_id: c.city_id });
  });
  sortedBookings(trip).forEach(b => add('booking', b.id, b.title || bookingKindLabel(b.kind), [bookingKindLabel(b.kind), b.from, b.to, b.where].join(' '), { booking: b, kw: [b.ref, b.kind === 'stay' ? 'hotel check in check out stay' : '', b.kind === 'flight' ? 'flight plane airport' : ''].join(' ') }));
  (trip.drivers || []).forEach(d => add('number', d.id, d.name || 'My driver', [d.area, d.note, 'my driver drivers ride'].filter(Boolean).join(' '), { number: d.phone || d.whatsapp || '', kw: 'driver drivers ride my' }));
  (trip.journal || []).forEach(j => add('journal', j.id, j.place || 'Journal note', j.txt, { entry: j }));
  return docs;
}

/* ---------- what kind of question is it? ---------- */
function money(q) {
  const s = q.replace(/,(\d{1,2})\b/g, '.$1');
  const num = s.match(/(\d+(?:\.\d+)?)/);
  const curs = [];
  CUR.forEach(([r, code]) => { const m = s.match(r); if (m) curs.push({ code, at: m.index }); });
  curs.sort((a, b) => a.at - b.at);
  const wants = /\b(convert|exchange|how much|in (dollars|dirhams|pounds|euros|my currency|usd|aed|gbp|eur))\b/i.test(s);
  if (!num || (!curs.length && !wants)) return null;
  return { amount: parseFloat(num[1]), from: curs[0] ? curs[0].code : '', to: curs[1] ? curs[1].code : '' };
}
const has = (ws, list) => ws.some(w => list.includes(w));
export function intents(q, docs) {
  const ws = tokens(q), raw = strip(q), out = [];
  const m = money(q); if (m) out.push(Object.assign({ type: 'money' }, m));
  if (has(ws, ['112', 'emergency', 'police', 'ambulance', 'help', 'stolen', 'robbed', 'theft', 'lost', 'hospital', 'sos', 'fire', 'attacked', 'unsafe', 'scared', 'embassy', 'consulate', 'passport'])) out.push({ type: 'sos' });
  if ((has(ws, ['home', 'hotel', 'address', 'staying', 'airbnb', 'apartment']) || /\b(where am i staying|my stay)\b/.test(raw)) && !has(ws, ['flight', 'tip', 'tipping', 'tax'])) out.push({ type: 'home' });
  if (has(ws, ['taxi', 'cab', 'uber', 'bolt', 'ride', 'fare', 'driver', 'transfer']) || /\bhow (much|long) (is it )?to\b/.test(raw) || /\b(get|go) to\b/.test(raw)) {
    const after = raw.split(/\bto\b/).slice(1).join(' to ').trim();
    const dest = after ? bestDoc(after, docs, ['place', 'spot']) : null;
    out.push({ type: 'taxi', dest });
  }
  const sayM = raw.match(/^(?:how (?:do (?:you|i)|to) )?say\s+(.+?)(?:\s+in\s+\w+)?\??$/) || raw.match(/^(.+?)\s+in (?:portuguese|italian|spanish|french|german|the local language)\??$/) || raw.match(/^(?:what is|whats|translate)\s+(.+?)\s+in\s+\w+\??$/);
  if (sayM) out.push({ type: 'say', what: sayM[1] });
  const day = ws.find(w => DAYS[w] != null);
  if (has(ws, ['open', 'closed', 'close', 'hours', 'opening']) || (day && ws.length > 1)) {
    const rest = ws.filter(w => DAYS[w] == null && !['open', 'closed', 'close', 'hours', 'opening'].includes(w));
    const p = rest.length ? bestDoc(rest.join(' '), docs, ['place']) : null;
    const named = p && rest.some(w => p.t.includes(w));          /* only when the place is named in the question */
    if (named || (day != null && !rest.length)) out.push({ type: 'open', place: named ? p.place : null, day: day != null ? DAYS[day] : null });
  }
  if (has(ws, ['flight', 'booking', 'bookings', 'reservation', 'reference', 'confirmation', 'checkin', 'checkout', 'pnr']) || /check.?(in|out)/.test(raw)) out.push({ type: 'bookings' });
  if (has(ws, ['today', 'plan', 'schedule', 'tomorrow', 'itinerary']) && !out.some(i => i.type === 'open' && i.place)) out.push({ type: 'plan' });
  if (has(ws, ['near', 'nearby', 'around', 'close']) || /near me|around here/.test(raw)) out.push({ type: 'near' });
  if (has(ws, ['meet', 'meeting', 'friend', 'split', 'lost']) && /meet|split|friend/.test(raw)) out.push({ type: 'meet' });
  return out;
}

/* ---------- ranking ---------- */
function scoreDoc(d, ws, raw) {
  let s = 0, hit = 0;
  ws.forEach(w => {
    const re = new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '');
    let got = 0;
    if (d.t === w) got = 6; else if (re.test(d.t)) got = 3; else if (re.test(d.x)) got = 1;
    if (got) { hit++; s += got; }
  });
  if (!hit) return 0;
  if (raw.length > 3 && d.t.includes(raw)) s += 6;
  if (d.mm && d.mm.some(m => m.replace(/\(.*?\)/g, '').split(/[,/]/).some(part => part.replace(/[^a-z ]/g, '').trim() === raw.replace(/[^a-z ]/g, '').trim()))) s += 10;   /* the phrase means exactly this */
  s *= hit / ws.length;                        // favour docs that match more of the question
  if (d.kind === 'phrase') s *= 0.9;
  if (d.kind === 'journal') s *= 0.6;
  return s;
}
export function bestDoc(q, docs, kinds) {
  const r = search(q, docs, { kinds, limit: 1 });
  return r[0] || null;
}
export function search(q, docs, opts = {}) {
  const base = tokens(q); if (!base.length) return [];
  const ws = expand(base), raw = strip(q).trim();
  return docs.filter(d => !opts.kinds || opts.kinds.includes(d.kind))
    .map(d => Object.assign({ score: Math.max(scoreDoc(d, base, raw) * 1.4, scoreDoc(d, ws, raw)) }, d))
    .filter(d => d.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit || 40);
}

/* Everything for one question: the answer cards to show first, then the matches. */
export function ask(q, docs) {
  const its = intents(q, docs);
  let hits = search(q, docs);
  if (its.some(i => i.type === 'money') && tokens(q).every(w => /^[\d.,€$£]+$|^(eur|euro|euros|aed|usd|gbp|dollars?|dirhams?|pounds?|convert|exchange|in)$/.test(w))) hits = [];
  const say = its.find(i => i.type === 'say');
  if (say) hits = search(say.what, docs, { kinds: ['phrase'], limit: 6 }).concat(hits.filter(h => h.kind !== 'phrase'));
  return { intents: its, hits };
}
