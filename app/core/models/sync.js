/* Shared trips (Nov 2026): what one phone shares with the group, and how the group's changes come back in.
   Pure logic: no network, storage or screens. The sync service sends and receives; this decides what.

   Shared: plan items (unless marked "Only me"), people and their dates, bookings the traveler chose to share
   (never the booking reference or private note). Never shared: journal, photos, phrases, food notes,
   emergency contact, My drivers, saved favorites, private plan items and private bookings. */

const clone = x => JSON.parse(JSON.stringify(x));
const hash = x => JSON.stringify(x);
export const entryId = (kind, key) => `${kind}_${String(key).replace(/[^A-Za-z0-9_-]/g, '-')}`;

function personOf(trip, p) {
  return { id: p.id, name: p.name || '', arrive: p.arrive || '', leave: p.leave || '', hood: p.hood || '', address: p.address || '' };
}
function meAsPerson(trip) {
  const st = (trip.stays || []).filter(s => s.start).sort((a, b) => a.start.localeCompare(b.start));
  const first = st[0] || {}, last = st[st.length - 1] || {};
  const d = trip.dates || {};   /* no dated stay yet: the trip dates stand in (Nov 2026) */
  return { id: trip.me_id, name: trip.traveler_name || '', arrive: first.start || d.start || '', leave: last.end || first.end || d.end || '', hood: first.neighborhood_id || '', address: first.address || '' };
}
function bookingForGroup(b) {
  const d = clone(b); delete d.ref; delete d.note; delete d.share; delete d.shared; delete d.by; delete d.source; return d;
}

/* Everything this phone would share right now, keyed by entry id. */
export function sharedEntries(trip) {
  const out = new Map();
  (trip.plan || []).filter(it => !it.private).forEach(it => out.set(entryId('plan', it.item_id), { kind: 'plan', key: it.item_id, data: clone(it) }));
  out.set(entryId('person', trip.me_id), { kind: 'person', key: trip.me_id, data: meAsPerson(trip) });
  (trip.people || []).forEach(p => out.set(entryId('person', p.id), { kind: 'person', key: p.id, data: personOf(trip, p) }));
  (trip.bookings || []).filter(b => b.share || b.shared).forEach(b => out.set(entryId('booking', b.id), { kind: 'booking', key: b.id, data: bookingForGroup(b) }));
  return out;
}

/* Local changes to send: entries that are new or different since the last send, and entries no longer shared. */
export function diffForPush(trip) {
  const live = trip.live || {}, sent = live.sent || {};
  const now = sharedEntries(trip);
  const upserts = [], deletes = [];
  now.forEach((e, id) => { if (sent[id] !== hash(e.data)) upserts.push(Object.assign({ id }, e)); });
  Object.keys(sent).forEach(id => { if (!now.has(id)) deletes.push(id); });
  return { upserts, deletes };
}
export function markSent(trip) {
  if (!trip.live) return;
  const sent = {};
  sharedEntries(trip).forEach((e, id) => { sent[id] = hash(e.data); });
  trip.live.sent = sent;
}

/* Bring the group's entries into this phone's trip. remote: Map id -> { kind, key, data, by_uid, by_name }.
   Private plan items, my own booking references and everything never shared stay as they are. */
export function applyRemote(trip, remote) {
  const plan = [], people = [], books = new Map();
  remote.forEach(e => {
    if (e.kind === 'plan' && e.data && e.data.item_id) plan.push(clone(e.data));
    else if (e.kind === 'person' && e.data && e.data.id && e.data.id !== trip.me_id) people.push(clone(e.data));
    else if (e.kind === 'booking' && e.data && e.data.id) books.set(e.data.id, e);
  });
  trip.plan = (trip.plan || []).filter(it => it.private).concat(plan);
  trip.people = people;
  /* A phone with no dates of its own takes the group's span, so the shared plan has days to show. */
  const hasOwn = (trip.stays || []).some(s => s.start) || (trip.dates && trip.dates.start);
  if (!hasOwn) {
    const a = people.map(x => x.arrive).filter(Boolean).sort(), l = people.map(x => x.leave || x.arrive).filter(Boolean).sort();
    if (a.length) trip.dates = { start: a[0], end: l[l.length - 1] };
  }
  const kept = [];
  (trip.bookings || []).forEach(b => {
    const r = books.get(b.id);
    if (r) { kept.push(Object.assign({}, b, r.data, { ref: b.ref || '', note: b.note || '' }, b.shared ? { shared: true, by: r.by_name || b.by } : { share: true })); books.delete(b.id); }
    else if (b.shared) { /* removed from the group */ }
    else kept.push(b.share ? Object.assign({}, b, { share: false }) : b);
  });
  books.forEach(r => kept.push(Object.assign({ ref: '', note: '', source: 'group' }, r.data, { shared: true, by: r.by_name || '' })));
  trip.bookings = kept;
  /* What the group holds now counts as sent, so only real local differences go back out. */
  if (trip.live) { const sent = {}; remote.forEach((e, id) => { sent[id] = hash(e.data); }); trip.live.sent = sent; }
  return trip;
}

/* A short line for "What changed", written from another person's change. */
export function changeLine(ch, nameOf) {
  const who = ch.by_name || 'Someone', d = ch.data || {};
  const what = ch.kind === 'plan' ? (nameOf(d.item_id) || 'a plan') : ch.kind === 'booking' ? (d.title || 'a booking') : (d.name || 'someone');
  const day = d.date ? ' on ' + new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  if (ch.kind === 'person') return ch.type === 'removed' ? `${who} removed ${what}` : ch.type === 'added' ? `${what} joined the trip` : `${who} updated ${what === who ? 'their' : what + '’s'} dates`;
  return ch.type === 'removed' ? `${who} removed ${what}` : ch.type === 'added' ? `${who} added ${what}${day}` : `${who} changed ${what}${day}`;
}
