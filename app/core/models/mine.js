/* Personal code (Nov 13 2026): one traveler's journal and phrase favorites on all their devices.
   Pure logic, like models/sync.js. Photos stay on the device that took them; only the words travel.
   trip.mine_sent: entry id -> hash of what this device last saw in the personal space. */
const clone = x => JSON.parse(JSON.stringify(x));
const hash = x => JSON.stringify(x);
const jid = id => 'j_' + String(id).replace(/[^A-Za-z0-9_-]/g, '-');
const words = e => { const d = clone(e); delete d.photos; return d; };

export function mineEntries(trip) {
  const out = new Map();
  (trip.journal || []).forEach(e => out.set(jid(e.id), { kind: 'journal', data: words(e) }));
  out.set('favs', { kind: 'favs', data: { list: (trip.favs || []).slice() } });
  return out;
}
export function mineDiff(trip) {
  const sent = trip.mine_sent || {}, now = mineEntries(trip), upserts = [], deletes = [];
  now.forEach((e, id) => { if (sent[id] !== hash(e.data)) upserts.push(Object.assign({ id }, e)); });
  Object.keys(sent).forEach(id => { if (!now.has(id)) deletes.push(id); });
  return { upserts, deletes };
}
/* Bring the personal space in. Local additions and edits not yet sent are kept (they go out next);
   entries deleted on another device go; entries deleted here stay deleted. */
export function applyMine(trip, remote) {
  const sent = trip.mine_sent || {}, local = new Map((trip.journal || []).map(e => [jid(e.id), e]));
  const out = [];
  local.forEach((e, id) => {
    const r = remote.get(id);
    if (!(id in sent) || hash(words(e)) !== sent[id]) out.push(e);              /* new or edited here */
    else if (r && r.data) out.push(Object.assign(clone(r.data), { photos: e.photos || [] }));
  });
  remote.forEach((r, id) => {
    if (r.kind !== 'journal' || !r.data || local.has(id) || id in sent) return;   /* in sent but gone here: deleted here */
    out.push(Object.assign(clone(r.data), { photos: [] }));
  });
  trip.journal = out.sort((a, b) => (a.d || 0) - (b.d || 0));
  const rf = remote.get('favs');
  if (rf && rf.data && 'favs' in sent && hash({ list: trip.favs || [] }) === sent.favs) trip.favs = (rf.data.list || []).slice();
  else if (rf && rf.data) trip.favs = [...new Set((rf.data.list || []).concat(trip.favs || []))];
  const ns = {}; remote.forEach((r, id) => { ns[id] = hash(r.data); }); trip.mine_sent = ns;
  return trip;
}
