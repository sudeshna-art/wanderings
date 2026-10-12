/* Theme switch (Oct 12 2026). The "clean" theme is chosen per edition (edition.config.js `theme: 'clean'`) or per
   build (build_edition.py --theme=clean), which writes <html data-look="clean">. Without it, every screen renders
   exactly as before. Each edition supplies its own city values: cities.json `brand.tint` (a light tint for the
   city mark tile) and the `mark` sketch it already has. Peacock stays the accent everywhere. */
import { EDITION } from '../../edition.config.js?v=202610121603';

export const theme = () => document.documentElement.getAttribute('data-look') || EDITION.theme || '';
export const clean = () => theme() === 'clean';

/* Called once at boot: apply an edition's theme if the page didn't, and the city tint. */
export function applyTheme(city) {
  const root = document.documentElement;
  if (!root.getAttribute('data-look') && EDITION.theme) root.setAttribute('data-look', EDITION.theme);
  if (clean() && city && city.brand && city.brand.tint) root.style.setProperty('--city-tint', city.brand.tint);
  if (clean()) initSheetDrag();
}

/* ---------- bottom sheet: half height on open, drag or scroll up to full screen, drag down to close ---------- */
let dragInit = false;
export function sheetOpened(sh) {
  if (!clean() || !sh) return;
  sh.setAttribute('data-size', 'half');
  sh.scrollTop = 0;
}
function initSheetDrag() {
  if (dragInit) return; dragInit = true;
  const sh = document.getElementById('sheet'); if (!sh) return;
  let y0 = null, moved = 0;
  const close = () => { const b = document.querySelector('[data-act="sheetclose"]'); if (b) b.click(); else { sh.hidden = true; const s = document.getElementById('scrim'); if (s) s.hidden = true; } };
  sh.addEventListener('pointerdown', e => { if (!e.target.closest('.grab')) return; y0 = e.clientY; moved = 0; try { e.target.setPointerCapture(e.pointerId); } catch (_) {} });
  sh.addEventListener('pointermove', e => { if (y0 == null) return; moved = e.clientY - y0; });
  const end = () => {
    if (y0 == null) return;
    const full = sh.getAttribute('data-size') === 'full';
    if (Math.abs(moved) < 6) sh.setAttribute('data-size', full ? 'half' : 'full');   /* a tap on the handle toggles */
    else if (moved < -30) sh.setAttribute('data-size', 'full');
    else if (moved > 60) { if (full) sh.setAttribute('data-size', 'half'); else close(); }
    y0 = null;
  };
  sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
  /* scrolling the content from half height opens the sheet fully, like Airbnb's place sheets */
  sh.addEventListener('scroll', () => { if (sh.scrollTop > 8 && sh.getAttribute('data-size') === 'half' && sh.scrollHeight > sh.clientHeight + 40) sh.setAttribute('data-size', 'full'); }, { passive: true });
  /* every time the sheet is shown, start at half height */
  try { new MutationObserver(() => { if (!sh.hidden && !sh.dataset.shown) { sh.dataset.shown = '1'; sheetOpened(sh); } if (sh.hidden) delete sh.dataset.shown; }).observe(sh, { attributes: true, attributeFilter: ['hidden'] }); } catch (_) {}
}
