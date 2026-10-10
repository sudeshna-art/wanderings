/* speech-service: phrase audio and audio-stop narration with the phone's own voices.
   Phrases never fall back to an English voice. Later: bundled audio files generated at build time. */

let voices = [];
function load() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } return voices; }
try { load(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', load); } catch (e) {}

const score = v => (/premium/i.test(v.name) ? 40 : 0) + (/enhanced|neural|natural/i.test(v.name) ? 30 : 0) + (/google|joana|catarina|ines|inês|cristiano|helena/i.test(v.name) ? 10 : 0) + (v.localService ? 2 : 0);

/* Best voice for a language like 'pt-PT'. Exact region first, then the same language in another region. */
function pick(lang) {
  if (!voices.length) load();
  const base = lang.split('-')[0].toLowerCase();
  const norm = v => String(v.lang || '').replace('_', '-').toLowerCase();
  const exact = voices.filter(v => norm(v) === lang.toLowerCase()).sort((a, b) => score(b) - score(a));
  if (exact.length) return { voice: exact[0], exact: true };
  const same = voices.filter(v => norm(v).split('-')[0] === base).sort((a, b) => score(b) - score(a));
  return same.length ? { voice: same[0], exact: false } : null;
}

export const speechService = {
  supported() { return Promise.resolve(typeof speechSynthesis !== 'undefined'); },
  async voiceInfo(lang) {
    const p = pick(lang);
    return p ? { name: p.voice.name, lang: p.voice.lang, exact: p.exact } : null;
  },
  onVoicesChanged(cb) { try { speechSynthesis.addEventListener('voiceschanged', () => { load(); cb(); }); } catch (e) {} },
  /* Returns { ok } or { ok:false, reason: 'unsupported' | 'novoice' | 'failed' } */
  async speak(text, lang, rate = 0.9) {
    if (typeof speechSynthesis === 'undefined') return { ok: false, reason: 'unsupported' };
    const p = pick(lang);
    if (!p) return { ok: false, reason: 'novoice' };
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(/…/g, '').replace(/\s*\/\s*/g, ', '));
      u.lang = p.voice.lang; u.voice = p.voice; u.rate = rate;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
      return { ok: true, exact: p.exact };
    } catch (e) { return { ok: false, reason: 'failed' }; }
  },
  /* Audio stops: plays a bundled recording when one exists, otherwise reads the script aloud. */
  async playStop(audio, lang = 'en') {
    if (!audio) return { ok: false, reason: 'none' };
    if (audio.recording && typeof Audio === 'function') {
      try { this._a && this._a.pause(); this._a = new Audio(audio.recording); await this._a.play(); return { ok: true }; } catch (e) {}
    }
    return this.speak(audio.script, lang, 0.95);
  },
  async stop() { try { speechSynthesis.cancel(); } catch (e) {} try { this._a && this._a.pause(); } catch (e) {} return true; }
};
