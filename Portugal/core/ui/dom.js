/* Small UI helpers: escaping, toasts, icons, place illustrations, formatting. UI layer only. */

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = null;
export function toast(m) {
  const t = $('#toast'); if (!t) return;
  t.textContent = m; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

export const fmtDate = (d, o = { month: 'short', day: 'numeric' }) => new Date(d).toLocaleDateString('en-US', o);
export const fmtISO = (iso, o = { month: 'short', day: 'numeric' }) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', o) : '';
export const fmtDay = iso => fmtISO(iso, { weekday: 'short', month: 'short', day: 'numeric' });
export const shortDay = iso => fmtDay(iso).replace(/,.*$/, '') + ' ' + new Date(iso + 'T00:00:00').getDate();
export const fmtNum = n => isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
export const parseNum = s => parseFloat(String(s).replace(/,/g, '.').replace(/[^\d.]/g, ''));
export const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
export const metres = m => m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1)} km`;

/* ---------- fine-line icon set ---------- */
const ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  places: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  phrases: '<path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
  journal: '<path d="M6 3.5h10.5A1.5 1.5 0 0 1 18 5v15.5H7.5A1.5 1.5 0 0 1 6 19z"/><path d="M6 17.5h12M9.5 7.5h5M9.5 10.5h3.5"/>',
  plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 13.4 13.4 8.5 15.5l2.1-4.9z"/>',
  essentials: '<path d="M5 8h14v11H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M5 12h14"/>',
  convert: '<circle cx="9" cy="10" r="5.5"/><path d="M10.8 8.2a2.3 2.3 0 1 0 0 3.6M6.6 9.4h3M6.6 10.8h3"/><path d="M16 9.6a5.5 5.5 0 1 1-6.4 8.8"/>',
  taxi: '<path d="M4.5 16v-3.5L6.5 8h11l2 4.5V16"/><path d="M3.5 16h17v2.5h-17z"/><path d="M10 8V5.5h4V8"/><path d="M7.5 13h1.5M15 13h1.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1"/>',
  coffee: '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3"/>',
  camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  starO: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  train: '<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10.5h12M9 20.5l1.5-4M15 20.5l-1.5-4M9 13.5h.01M15 13.5h.01"/>',
  car: '<path d="M4.5 15.5v-3l2-5h11l2 5v3"/><path d="M3.5 15.5h17v3h-17zM7.5 12.5h1.5M15 12.5h1.5"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 2.5 2.5V21M8.5 12l2-4.5 3 1 2 3.5M12.5 15l-1-4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
export const ic = (k, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICON[k] || ICON.places}</svg>`;
export const modeIcon = m => ({ train: 'train', car: 'car', driver: 'car', taxi: 'taxi', bus: 'train', flight: 'arrow' }[m] || 'arrow');

/* ---------- place illustration vocabulary (original line art) ---------- */
const ILL = {
  landmark: '<circle class="wash" cx="40" cy="20" r="9"/><path class="ink" stroke-width="1.1" d="M22 56 V24 H42 V56 M27 56 V42 a5 5 0 0 1 10 0 V56 M20 24 H44 M24 24 V17 H40 V24 M28 17 V12 H36 V17"/><path class="ink" stroke-width=".7" d="M26 30 V35 M32 30 V35 M38 30 V35 M8 56 H56"/>',
  food: '<path class="wash" d="M44 21 H52 C52 30 50 33 48 33 C46 33 44 30 44 21 Z"/><ellipse class="ink" stroke-width="1.1" cx="28" cy="42" rx="16" ry="6"/><ellipse class="ink" stroke-width=".7" cx="28" cy="41" rx="9.5" ry="3.2"/><path class="ink" stroke-width="1.1" d="M10 18 V30 M8 18 V24 Q10 27 12 24 V18 M10 30 V50 M43 18 H53 Q53 32 48 33 Q43 32 43 18 Z M48 33 V46 M44 46 H52"/><path class="ink" stroke-width=".7" d="M6 56 H58"/>',
  market: '<rect class="wash" x="12" y="20" width="40" height="8"/><path class="ink" stroke-width="1.1" d="M10 20 H54 L50 28 H14 Z M14 28 q4.5 4 9 0 q4.5 4 9 0 q4.5 4 9 0 q4.5 4 9 0 M16 30 V54 M48 30 V54 M20 44 h10 v10 h-10 z M32 42 h12 v12 h-12 z"/><path class="ink" stroke-width=".7" d="M8 54 H56"/>',
  museum: '<path class="wash" d="M12 24 L32 13 L52 24 Z"/><path class="ink" stroke-width="1.1" d="M10 24 L32 12 L54 24 Z M12 28 H52 M17 28 V50 M27 28 V50 M37 28 V50 M47 28 V50 M10 52 H54 M8 56 H56"/>',
  shop: '<path class="wash" d="M27 34 h10 l1.5 11 h-13 z"/><path class="ink" stroke-width="1.1" d="M18 56 V28 a14 14 0 0 1 28 0 V56 M27 34 h10 l1.5 11 h-13 z M29.5 34 a2.5 2.5 0 0 1 5 0"/><path class="ink" stroke-width=".6" d="M14 56 V26 a18 18 0 0 1 36 0 V56 M24 50 H40"/><path class="ink" stroke-width=".7" d="M8 56 H56"/>',
  garden: '<path class="wash" d="M36 56 Q36 46 46 46 Q56 46 56 56 Z"/><path class="ink" stroke-width="1.1" d="M18 56 C13 42 15 24 20 12 C25 24 27 42 22 56 M30 56 C26 46 27 34 31 26 C35 34 36 46 32 56 M36 56 Q36 46 46 46 Q56 46 56 56"/><path class="ink" stroke-width=".7" d="M6 56 H58"/>',
  view: '<circle class="wash" cx="46" cy="22" r="7"/><path class="ink" stroke-width="1.1" d="M6 42 Q20 32 32 38 T58 34"/><path class="ink" stroke-width=".6" d="M6 48 Q30 44 58 46"/><path class="ink" stroke-width=".9" d="M29 42 V37 a4 5 0 0 1 8 0 V42 M33 32 V29.5"/><path class="ink" stroke-width=".7" d="M6 54 H58"/>',
  beach: '<circle class="wash" cx="44" cy="18" r="7"/><path class="ink" stroke-width="1.1" d="M14 50 L26 22 M26 22 C18 20 12 24 10 30 C16 26 22 26 26 22 C30 18 38 18 42 22 C36 22 30 24 26 22"/><path class="ink" stroke-width=".8" d="M4 50 Q18 46 32 50 T60 50 M8 56 Q22 53 36 56 T60 56"/>',
  boat: '<circle class="wash" cx="16" cy="18" r="6"/><path class="ink" stroke-width="1.1" d="M12 40 H52 L46 48 H18 Z M32 40 V12 M32 14 L48 36 H32 M32 18 L20 36 H32"/><path class="ink" stroke-width=".7" d="M4 54 Q14 51 24 54 T44 54 T60 54"/>',
  palace: '<path class="wash" d="M20 30 a12 12 0 0 1 24 0 Z"/><path class="ink" stroke-width="1.1" d="M14 56 V32 H50 V56 M20 32 a12 12 0 0 1 24 0 M32 18 V12 M28 56 V46 a4 4 0 0 1 8 0 V56 M10 32 V22 H16 V32 M48 32 V22 H54 V32 M10 22 L13 17 L16 22 M48 22 L51 17 L54 22"/><path class="ink" stroke-width=".7" d="M18 40 h6 M40 40 h6 M6 56 H58"/>',
  tram: '<rect class="wash" x="14" y="22" width="36" height="12"/><path class="ink" stroke-width="1.1" d="M12 46 V22 a4 4 0 0 1 4 -4 H48 a4 4 0 0 1 4 4 V46 Z M12 34 H52 M20 22 V34 M32 22 V34 M44 22 V34 M32 18 L26 8 M22 8 H42 M18 46 v4 M46 46 v4"/><path class="ink" stroke-width=".7" d="M6 52 L58 50"/>',
  trail: '<path class="wash" d="M6 30 L22 24 L34 30 L46 22 L58 26 V56 H6 Z"/><path class="ink" stroke-width="1.1" d="M6 30 L22 24 L34 30 L46 22 L58 26"/><path class="ink" stroke-width=".8" stroke-dasharray="2 3" d="M10 52 C20 46 26 44 30 40 C34 36 40 36 46 32"/><path class="ink" stroke-width=".7" d="M6 56 H58"/>',
  cave: '<path class="wash" d="M14 56 V36 C14 24 22 16 32 16 C42 16 50 24 50 36 V56 Z"/><path class="ink" stroke-width="1.1" d="M8 56 V34 C8 20 18 10 32 10 C46 10 56 20 56 34 V56 M20 56 V40 C20 32 25 26 32 26 C39 26 44 32 44 40 V56"/><circle class="ink" stroke-width=".9" cx="32" cy="16" r="3"/><path class="ink" stroke-width=".7" d="M4 56 H60"/>',
  wine: '<path class="wash" d="M24 16 H40 C40 28 37 32 32 32 C27 32 24 28 24 16 Z"/><path class="ink" stroke-width="1.1" d="M22 12 H42 C42 28 38 34 32 34 C26 34 22 28 22 12 Z M32 34 V50 M24 50 H40"/><path class="ink" stroke-width=".7" d="M46 22 C50 22 52 26 50 30 M50 30 C54 30 56 34 52 38 M8 56 H56"/>',
  music: '<circle class="wash" cx="24" cy="40" r="10"/><path class="ink" stroke-width="1.1" d="M14 48 C10 40 14 30 24 30 C34 30 38 40 34 48 C30 54 18 54 14 48 Z M24 36 a3 3 0 1 0 0.01 0 M30 32 L48 12 M46 10 L52 14"/><path class="ink" stroke-width=".7" d="M33 31 L50 13 M8 56 H56"/>',
  spa: '<circle class="wash" cx="32" cy="34" r="12"/><path class="ink" stroke-width="1.1" d="M32 50 C24 44 20 36 22 26 C28 30 32 38 32 50 C32 38 36 30 42 26 C44 36 40 44 32 50 Z M32 50 C30 40 30 30 32 20 C34 30 34 40 32 50"/><path class="ink" stroke-width=".7" d="M8 56 H56"/>'
};
const KIND_ALIAS = { restaurant: 'food', cafe: 'food', sight: 'landmark' };
export const ill = (kind, size = 52) => `<svg class="ill" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${ILL[KIND_ALIAS[kind] || kind] || ILL.landmark}</svg>`;
export const KIND_NAME = { landmark: 'Landmark', museum: 'Museum', view: 'Viewpoint', beach: 'Beach', market: 'Market', food: 'Food', garden: 'Garden', boat: 'By boat', shop: 'Shopping', palace: 'Palace', tram: 'Tram', trail: 'Walk', cave: 'Sea cave', wine: 'Wine', music: 'Music', spa: 'Spa' };
export const CUSTOM_KINDS = ['food', 'landmark', 'view', 'beach', 'shop', 'market', 'museum', 'garden'];
