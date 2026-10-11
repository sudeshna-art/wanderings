/* currency-service: exchange rates, always labeled estimates.
   Rates: frankfurter.dev (free, no key, European Central Bank reference rates).
   AED is not an ECB reference currency, so it is derived from the official US dollar peg.
   Every answer is { rate, as_of, source, is_estimate, note }. */
import { CONFIG } from '../config/default-config.js';
import { storageService } from './storage-service.js';
import { contentService } from './content-service.js';

const C = CONFIG.currency;

async function fetchECB(from, to) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
  try {
    const r = await fetch(C.rateUrl.replace('{from}', from.toLowerCase()).replace('{to}', to.toLowerCase()), ctl ? { signal: ctl.signal } : {});
    if (!r.ok) return null;
    const j = await r.json(); const v = Number(j && j.rate);
    return v > 0 ? { rate: v, as_of: j.date || '' } : null;
  } catch (e) { return null; } finally { if (t) clearTimeout(t); }
}

/* Dated fallback rates from the edition (EUR base), used offline or if the rate source fails. */
async function fallback(from, to) {
  const ref = ((await contentService.load()).essentials.reference_rates) || null;
  if (!ref) return null;
  const perEUR = code => code === 'EUR' ? 1 : code === 'AED' ? (ref.rates.USD * C.aedPerUsd) : ref.rates[code];
  const a = perEUR(from), b = perEUR(to);
  if (!a || !b) return null;
  return { rate: b / a, as_of: ref.checked, source: ref.source, is_estimate: true };
}

export const currencyService = {
  supported: ['AED', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'INR', 'CHF', 'SGD', 'JPY'],
  symbol(code) { return { EUR: '€', USD: '$', GBP: '£', AED: 'AED ', CAD: 'C$', AUD: 'A$', INR: '₹', CHF: 'CHF ', SGD: 'S$', JPY: '¥' }[code] || code + ' '; },
  name(code) { return { EUR: 'Euro', USD: 'US dollar', GBP: 'British pound', AED: 'UAE dirham', CAD: 'Canadian dollar', AUD: 'Australian dollar', INR: 'Indian rupee', CHF: 'Swiss franc', SGD: 'Singapore dollar', JPY: 'Japanese yen' }[code] || code; },
  /* How many `to` for one `from`. */
  async getRate(from, to) {
    if (!from || !to) return null;
    if (from === to) return { rate: 1, as_of: '', source: '', is_estimate: false };
    const manual = await storageService.get('manualRate', null);
    if (manual && manual.from === from && manual.to === to && manual.rate > 0) {
      return { rate: manual.rate, as_of: manual.as_of, source: 'your own rate', is_estimate: true, manual: true };
    }
    const key = 'rate.' + from + '.' + to;
    let live = null, note = '';
    if (from === 'AED' || to === 'AED') {
      const other = from === 'AED' ? to : from;
      const usd = other === 'USD' ? { rate: 1, as_of: '' } : await fetchECB(other, 'USD');
      if (usd) {
        const otherToAED = usd.rate * C.aedPerUsd;
        live = { rate: from === 'AED' ? 1 / otherToAED : otherToAED, as_of: usd.as_of || C.aedPegChecked };
        note = 'Based on the official US dollar peg.';
      }
    } else {
      live = await fetchECB(from, to);
    }
    if (live) {
      const out = { rate: live.rate, as_of: live.as_of, source: 'European Central Bank reference rate via frankfurter.dev', is_estimate: true, note, live: true };
      storageService.set(key, out);
      return out;
    }
    const saved = await storageService.get(key, null);
    if (saved) return Object.assign({}, saved, { live: false });
    const fb = await fallback(from, to);
    if (fb && (from === 'AED' || to === 'AED')) fb.note = 'Based on the official US dollar peg.';
    return fb;
  },
  async setManualRate(from, to, rate) { return storageService.set('manualRate', rate ? { from, to, rate, as_of: new Date().toISOString().slice(0, 10) } : null); },
  async clearManualRate() { return storageService.set('manualRate', null); }
};
