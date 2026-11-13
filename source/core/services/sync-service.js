/* sync-service (Nov 2026): sign-in and live shared trips with Firebase (Authentication + Firestore).
   Loads the bundled Firebase library only when the app has a Firebase config (firebase-config.js at the app root).
   Returns plain data; the UI never touches Firebase directly. Rules: firebase/firestore.rules. */

let FB = null, app = null, auth = null, db = null, cfg = null, ready = null;
let user = null, unsub = null, unsubMine = null;
const authWatchers = new Set();
const EMAIL_KEY = 'wanderings-signin-email';

async function load() {
  if (ready) return ready;
  ready = (async () => {
    try { cfg = (await import('../../firebase-config.js')).FIREBASE; } catch (e) { cfg = null; }
    if (!cfg || !cfg.apiKey) return false;
    FB = await import('../vendor/firebase/firebase.js');
    app = FB.initializeApp(cfg);
    auth = FB.getAuth(app);
    try { await FB.setPersistence(auth, FB.indexedDBLocalPersistence); } catch (e) { try { await FB.setPersistence(auth, FB.browserLocalPersistence); } catch (e2) {} }
    try { db = FB.initializeFirestore(app, { localCache: FB.persistentLocalCache({ tabManager: FB.persistentSingleTabManager() }) }); }
    catch (e) { db = FB.initializeFirestore(app, {}); }
    FB.onAuthStateChanged(auth, u => { user = u ? { uid: u.uid, email: u.email || '' } : null; authWatchers.forEach(f => { try { f(user); } catch (e) {} }); });
    return true;
  })();
  return ready;
}
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
/* A typed trip code: drop the destination prefix (e.g. PR-), spaces and dashes; letters only from our alphabet. */
export const normCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');   /* the invite's id: letters and digits only, any capitals, dashes or spaces ignored */
const friendly = e => {
  const c = (e && e.code) || '';
  if (/network|unavailable/.test(c)) return 'No connection right now. Try again when you have signal.';
  if (/invalid-email/.test(c)) return 'That email address doesn’t look right.';
  if (/expired|invalid-action-code/.test(c)) return 'That sign-in link has expired or was already used. Ask for a new one.';
  if (/wrong-password|invalid-credential|invalid-login/.test(c)) return 'Email or password doesn’t match.';
  if (/weak-password/.test(c)) return 'Choose a password of at least 6 characters.';
  if (/email-already-in-use/.test(c)) return 'That email already has an account. Sign in instead.';
  if (/permission-denied/.test(c)) return 'This invite doesn’t work anymore. Ask for a new one.';
  if (/operation-not-allowed/.test(c)) return 'This sign-in method isn’t turned on yet.';
  if (/unauthorized-continue-uri|unauthorized-domain/.test(c)) return 'Sign-in isn’t set up for this web address yet.';
  return 'Something went wrong. Try again in a moment.';
};

export const syncService = {
  async available() { return load(); },
  user: () => user,
  onAuth(f) { authWatchers.add(f); load().then(ok => { if (ok) f(user); }); return () => authWatchers.delete(f); },

  /* Email link: we send a link; opening it on this phone finishes sign-in. */
  async sendLink(email, returnUrl) {
    if (!(await load())) return { error: 'Sign-in isn’t set up yet.' };
    try {
      await FB.sendSignInLinkToEmail(auth, email, { url: returnUrl, handleCodeInApp: true });
      try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
      return { ok: true };
    } catch (e) { return { error: friendly(e) }; }
  },
  /* Call on start: finishes sign-in if this page was opened from the email link. */
  async finishLink(href, askEmail) {
    if (!(await load())) return null;
    if (!FB.isSignInWithEmailLink(auth, href)) return null;
    let email = ''; try { email = localStorage.getItem(EMAIL_KEY) || ''; } catch (e) {}
    if (!email && askEmail) email = await askEmail();
    if (!email) return { error: 'Enter your email to finish signing in.' };
    try { await FB.signInWithEmailLink(auth, email, href); try { localStorage.removeItem(EMAIL_KEY); } catch (e) {} return { ok: true }; }
    catch (e) { return { error: friendly(e) }; }
  },
  async signInPassword(email, password, create) {
    if (!(await load())) return { error: 'Sign-in isn’t set up yet.' };
    try {
      if (create) await FB.createUserWithEmailAndPassword(auth, email, password);
      else await FB.signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) { return { error: friendly(e) }; }
  },
  /* Join with a code (Nov 12 2026): no email or password. Firebase gives this phone an anonymous id.
     The phone is the login; if the app is removed, the trip code brings the person back. */
  async signInAnon() {
    if (!(await load())) return { error: 'Sharing isn’t set up yet.' };
    try { if (auth.authStateReady) await auth.authStateReady(); } catch (e) {}   /* never make a second id for a phone that has one */
    if (auth.currentUser || user) return { ok: true };
    try { await FB.signInAnonymously(auth); return { ok: true }; } catch (e) { return { error: friendly(e) }; }
  },
  async signOut() { this.stop(); if (await load()) await FB.signOut(auth); },

  /* Start a shared trip for this destination; the creator becomes its first member. */
  async createTrip(meta) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    const tid = 't' + rand(20);
    try {
      await FB.setDoc(FB.doc(db, 'trips', tid), { edition: meta.edition, name: meta.name || '', created_by: user.uid, created_at: FB.serverTimestamp() });
      await FB.setDoc(FB.doc(db, 'trips', tid, 'members', user.uid), { uid: user.uid, name: meta.by_name || '', person_id: meta.person_id || '', joined_at: FB.serverTimestamp() });
      return { tid };
    } catch (e) { return { error: friendly(e) }; }
  },
  /* An invite code: random (prefix + 10 characters) or one the organizer chooses, like Beach-Trip-26.
     A code already used by any trip can't be taken (the rules only allow creating new codes). */
  async makeInvite(tid, byName, edition, prefix, custom) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    const shown = custom ? custom.trim() : (prefix ? prefix + '-' : '') + rand(10).toUpperCase().replace(/(.{5})(?=.)/g, '$1-');
    const code = normCode(shown);
    if (code.length < 6) return { error: 'Make the code at least 6 letters or numbers.' };
    try {
      await FB.setDoc(FB.doc(db, 'invites', code), { trip: tid, edition, shown, by_name: byName || '', by_uid: user.uid, created_at: FB.serverTimestamp() });
      return { code, shown };
    } catch (e) { return { error: custom && /permission/.test((e && e.code) || '') ? 'That code is already taken. Try adding something, like a number.' : friendly(e) }; }
  },
  async closeInvite(code) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    try { await FB.deleteDoc(FB.doc(db, 'invites', normCode(code))); return { ok: true }; } catch (e) { return { error: friendly(e) }; }
  },
  async openInvite(code) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    code = normCode(code);
    try { const s = await FB.getDoc(FB.doc(db, 'invites', code)); return s.exists() ? Object.assign({ code }, s.data()) : { error: 'This invite doesn’t work anymore. Ask for a new one.' }; }
    catch (e) { return { error: friendly(e) }; }
  },
  async join(tid, code, name, personId) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    code = normCode(code);   /* the rules look the invite up by its clean id */
    try { await FB.setDoc(FB.doc(db, 'trips', tid, 'members', user.uid), { uid: user.uid, name: name || '', person_id: personId || '', code, joined_at: FB.serverTimestamp() }); return { ok: true }; }
    catch (e) { return { error: friendly(e) }; }
  },

  /* Live updates: handler(entries Map id -> { kind, key, data, by_uid, by_name }, changes[], first). */
  async listen(tid, handler) {
    this.stop();
    if (!(await load()) || !user) return false;
    let first = true;
    unsub = FB.onSnapshot(FB.collection(db, 'trips', tid, 'entries'), { includeMetadataChanges: false }, snap => {
      const all = new Map();
      snap.forEach(d => all.set(d.id, d.data()));
      const changes = first ? [] : snap.docChanges().filter(c => !c.doc.metadata.hasPendingWrites).map(c => Object.assign({ type: c.type }, c.doc.data()));
      handler(all, changes, first); first = false;
    }, () => handler(null, [], false));
    return true;
  },
  /* Personal code (Nov 13 2026): personal/{code} marks a real code; its items hold one traveler's journal.
     Only someone who knows the code can reach it, and nobody can list codes. */
  async mineCreate(shown) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    const code = normCode(shown);
    try { await FB.setDoc(FB.doc(db, 'personal', code), { created_at: FB.serverTimestamp() }); return { code }; }
    catch (e) { return { error: /permission/.test((e && e.code) || '') ? 'taken' : friendly(e) }; }
  },
  async mineCheck(shown) {
    if (!(await load()) || !user) return { error: 'Sign in first.' };
    const code = normCode(shown);
    if (code.length < 12) return { error: 'That code is too short. Check it and try again.' };
    try { const s = await FB.getDoc(FB.doc(db, 'personal', code)); return s.exists() ? { code } : { error: 'That code wasn’t found. Check the spelling.' }; }
    catch (e) { return { error: friendly(e) }; }
  },
  async mineListen(code, edition, handler) {
    this.mineStop();
    if (!(await load()) || !user) return false;
    unsubMine = FB.onSnapshot(FB.collection(db, 'personal', normCode(code), 'editions', edition, 'items'), { includeMetadataChanges: false }, snap => {
      const all = new Map(); snap.forEach(d => all.set(d.id, d.data())); handler(all);
    }, () => handler(null));
    return true;
  },
  mineStop() { if (unsubMine) { try { unsubMine(); } catch (e) {} unsubMine = null; } },
  async minePush(code, edition, upserts, deletes) {
    if (!(await load()) || !user) return false;
    const b = FB.writeBatch(db), col = ['personal', normCode(code), 'editions', edition, 'items'];
    upserts.forEach(u => b.set(FB.doc(db, ...col, u.id), { kind: u.kind, data: u.data, at: FB.serverTimestamp() }));
    deletes.forEach(id => b.delete(FB.doc(db, ...col, id)));
    b.commit().catch(() => {});
    return true;
  },

  stop() { if (unsub) { try { unsub(); } catch (e) {} unsub = null; } },

  /* Send this phone's changes. Writes are queued while offline and go out when there is signal. */
  async push(tid, upserts, deletes, byName) {
    if (!(await load()) || !user) return false;
    const b = FB.writeBatch(db);
    upserts.forEach(u => b.set(FB.doc(db, 'trips', tid, 'entries', u.id), { kind: u.kind, key: String(u.key), data: u.data, by_uid: user.uid, by_name: byName || '', at: FB.serverTimestamp() }));
    deletes.forEach(id => b.delete(FB.doc(db, 'trips', tid, 'entries', id)));
    b.commit().catch(() => {});   /* offline: Firestore keeps the writes and sends them later */
    return true;
  }
};
