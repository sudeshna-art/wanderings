/* Test stand-in for the Firebase SDK: same functions, data kept by the test server at /__fake */
const call = (op, body) => fetch('/__fake/' + op, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
let cur = null; const watchers = [];
try { cur = JSON.parse(localStorage.getItem('__fakeuser') || 'null'); } catch (e) {}
const setUser = u => { cur = u; localStorage.setItem('__fakeuser', JSON.stringify(u)); watchers.forEach(f => f(u)); };
export const initializeApp = c => ({ c });
export const getAuth = () => ({});
export const setPersistence = async () => {}; export const browserLocalPersistence = {}; export const indexedDBLocalPersistence = {};
export const onAuthStateChanged = (a, f) => { watchers.push(f); setTimeout(() => f(cur), 0); return () => {}; };
export const sendSignInLinkToEmail = async (a, email, s) => { await call('sendlink', { email, url: s.url }); };
export const isSignInWithEmailLink = (a, href) => href.includes('oobCode=');
export const signInWithEmailLink = async (a, email) => setUser({ uid: 'u_' + email.replace(/\W/g, ''), email });
export const signInWithEmailAndPassword = async (a, email) => setUser({ uid: 'u_' + email.replace(/\W/g, ''), email });
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export const signOut = async () => setUser(null);
export const signInAnonymously = async () => setUser({ uid: "anon_" + Math.random().toString(36).slice(2), email: "" });
export const initializeFirestore = () => ({}); export const persistentLocalCache = () => ({}); export const persistentSingleTabManager = () => ({});
export const doc = (db, ...p) => ({ path: p.join('/') });
export const collection = (db, ...p) => ({ path: p.join('/') });
export const serverTimestamp = () => '__ts';
export const getDoc = async r => { const d = await call('get', { path: r.path, uid: cur && cur.uid }); if (d.error) { const e = new Error(d.error); e.code = d.error; throw e; } return { exists: () => !!d.data, data: () => d.data }; };
export const setDoc = async (r, data) => { const d = await call('set', { path: r.path, data, uid: cur && cur.uid }); if (d.error) { const e = new Error(d.error); e.code = d.error; throw e; } };
export const deleteDoc = async r => { await call('del', { path: r.path, uid: cur && cur.uid }); };
export const writeBatch = () => { const ops = []; return { set: (r, d) => ops.push(['set', r.path, d]), delete: r => ops.push(['del', r.path]), commit: () => call('batch', { ops, uid: cur && cur.uid }) }; };
export const onSnapshot = (col, opts, cb) => {
  let prev = null, stop = false;
  const tick = async () => { if (stop) return; const d = await call('list', { path: col.path, uid: cur && cur.uid });
    if (!d.error) { const now = JSON.stringify(d.docs); if (now !== prev) { const old = prev ? JSON.parse(prev) : {}; prev = now;
      const ch = []; Object.entries(d.docs).forEach(([id, v]) => { if (!old[id]) ch.push({ type: 'added', id, v }); else if (JSON.stringify(old[id]) !== JSON.stringify(v)) ch.push({ type: 'modified', id, v }); });
      Object.keys(old).forEach(id => { if (!d.docs[id]) ch.push({ type: 'removed', id, v: old[id] }); });
      cb({ forEach: f => Object.entries(d.docs).forEach(([id, v]) => f({ id, data: () => v })), docChanges: () => ch.map(c => ({ type: c.type, doc: { data: () => c.v, metadata: { hasPendingWrites: false } } })) }); } }
    setTimeout(tick, 400); };
  tick(); return () => { stop = true; };
};
