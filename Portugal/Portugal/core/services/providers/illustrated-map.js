/* Illustrated offline map: the same pins drawn as quiet line art when live tiles cannot load.
   Not to scale. Implements the map-service interface. */

const NS = 'http://www.w3.org/2000/svg';
const W = 350, H = 380, PAD = 34;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function draw(h) {
  const pts = h.places.filter(p => p.location).map(p => p.location).concat(h.you ? [h.you] : [], h.routeOn && h.routeStart ? [h.routeStart] : []);
  if (!pts.length) pts.push(h.center);
  let la0 = Math.min(...pts.map(p => p.lat)), la1 = Math.max(...pts.map(p => p.lat));
  let lo0 = Math.min(...pts.map(p => p.lng)), lo1 = Math.max(...pts.map(p => p.lng));
  const span = Math.max(la1 - la0, (lo1 - lo0) * 0.8, 0.004);
  const cla = (la0 + la1) / 2, clo = (lo0 + lo1) / 2;
  la0 = cla - span / 2; la1 = cla + span / 2; lo0 = clo - span / 1.6; lo1 = clo + span / 1.6;
  const proj = p => [PAD + (p.lng - lo0) / (lo1 - lo0) * (W - 2 * PAD), PAD + (la1 - p.lat) / (la1 - la0) * (H - 2 * PAD)];
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" role="img" aria-label="Illustrated map of nearby places, not to scale">`;
  for (let i = 1; i < 7; i++) s += `<path d="M0 ${i * H / 7} H${W}" stroke="var(--rule)" stroke-width=".6"/><path d="M${i * W / 6} 0 V${H}" stroke="var(--rule)" stroke-width=".6"/>`;
  s += `<path d="M326 22 V42 M321 28 L326 22 L331 28" fill="none" stroke="var(--ink)" stroke-width=".9" stroke-linecap="round"/><text x="322.5" y="54" font-family="IBM Plex Mono, monospace" font-size="8" fill="var(--muted)">N</text>`;
  const placed = h.places.filter(p => p.location);
  if (h.routeOn && placed.length > 1) {
    const r = (h.routeStart ? [h.routeStart] : []).concat(placed.map(p => p.location)).map(proj);
    s += `<polyline points="${r.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="4 4"/>`;
  }
  /* labels only where they do not collide, so dense areas stay readable */
  const boxes = [];
  if (h.you) { const [ux, uy] = proj(h.you); boxes.push([ux - 12, uy - 20, ux + 34, uy + 12]); }
  const fits = b => !boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const order = placed.slice().sort((a, b) => (b.id === h.selectedId) - (a.id === h.selectedId) || (a.number ?? 99) - (b.number ?? 99));
  const showLabel = {};
  order.forEach(p => { const [x, y] = proj(p.location); const nm = p.name.length > 24 ? p.name.slice(0, 23) + '…' : p.name; const b = [x + 10, y - 7, x + 14 + nm.length * 5.4, y + 7]; if (b[2] < W && fits(b)) { boxes.push(b); showLabel[p.id] = true; } boxes.push([x - 9, y - 9, x + 9, y + 9]); });
  placed.forEach(p => {
    const [x, y] = proj(p.location); const sel = h.selectedId === p.id;
    const fill = p.hollow ? 'var(--bg)' : 'var(--accent)'; const tc = p.hollow ? 'var(--accent)' : 'var(--on-accent)';
    s += `<g class="pin" data-mappin="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(p.name)}">${sel ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="none" stroke="var(--accent)" stroke-width="1.2"/>` : ''}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.number != null ? 11 : 7}" fill="${fill}" stroke="var(--accent)" stroke-width="1.5"/>${p.number != null ? `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="${tc}" style="pointer-events:none">${p.number}</text>` : ''}${showLabel[p.id] ? `<text x="${(x + 12).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-family="Schibsted Grotesk, sans-serif" font-size="9.5" fill="var(--ink)" style="pointer-events:none">${esc(p.name.length > 24 ? p.name.slice(0, 23) + '…' : p.name)}</text>` : ''}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="22" fill="transparent"/></g>`;
  });
  if (h.routeOn && h.routeStart) { const [x, y] = proj(h.routeStart); s += `<rect x="${(x - 5.5).toFixed(1)}" y="${(y - 5.5).toFixed(1)}" width="11" height="11" fill="var(--ink)" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/><text x="${(x + 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-family="Schibsted Grotesk, sans-serif" font-size="9.5" font-weight="600" fill="var(--ink)">Home</text>`; }
  if (h.you) { const [x, y] = proj(h.you); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="var(--coral)" fill-opacity=".18"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="var(--coral)" stroke="#fff" stroke-width="2"/><text x="${(x + 10).toFixed(1)}" y="${(y - 9).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="8.5" fill="var(--coral-ink)">YOU</text>`; }
  s += `</svg>`;
  h.el.innerHTML = `<div class="wm-illus">${s}<p class="wm-illus-note">Offline map, not to scale. Live map returns when you are online.</p></div>`;
  h.el.querySelectorAll('[data-mappin]').forEach(g => {
    const go = () => h.onTap && h.onTap(g.getAttribute('data-mappin'));
    g.addEventListener('click', go);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

export const illustratedMap = {
  ready() { return true; },
  create(el, { center }) { const h = { kind: 'illustrated', el, center, places: [], you: null }; draw(h); return h; },
  setUserLocation(h, pos) { h.you = pos || null; draw(h); },
  setMarkers(h, places, opts = {}) { h.places = places; h.onTap = opts.onTap; h.selectedId = opts.selectedId; h.routeOn = !!opts.route; h.routeStart = opts.routeStart; draw(h); },
  focus() {}, fitTo() {}, resize() {},
  destroy(h) { h.el.innerHTML = ''; }
};
