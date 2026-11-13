"""Turn a flat destination cover into the light pen-sketch version (approved Nov 12, 2026 for every cover).

Same drawing, same palette, same crop: fills stay flat and untouched. Only the ink changes:
- straight lines get a slight hand wobble, small overshoots at the ends and varied weight
- curves (arches, dome, palm) get a faint second pass, like a pen going over a line twice
- a few irregular facade details: worn plaster patches, hairline cracks, a drainpipe,
  a wall lantern, flower pots on two balconies, one shutter hanging a little askew

    python3 sketchify.py flat.svg out.svg [--san-juan]   (--san-juan adds the San Juan facade details)
"""
import re, sys, random, math

SRC, OUT = sys.argv[1], sys.argv[2]
PR_DETAILS = '--san-juan' in sys.argv   # the facade details below are placed for the San Juan drawing
INK = '#2E2A26'
svg = open(SRC).read()
rnd = random.Random(26)

def f(v): return f'{v:.1f}'.rstrip('0').rstrip('.')

def attrs(tag):
    return dict(re.findall(r'([\w-]+)="([^"]*)"', tag))

def wobble_seg(x1, y1, x2, y2, w):
    L = math.hypot(x2 - x1, y2 - y1)
    if L < 0.5: return ''
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    o1, o2 = rnd.uniform(-0.6, 1.4), rnd.uniform(-0.6, 1.6)          # small overshoot or short stop at the ends
    ax, ay = x1 - ux * o1, y1 - uy * o1
    bx, by = x2 + ux * o2, y2 + uy * o2
    amp = min(1.3, 0.25 + L * 0.012) * rnd.choice([-1, 1]) * rnd.uniform(0.4, 1)
    mx, my = (ax + bx) / 2 - uy * amp, (ay + by) / 2 + ux * amp
    return f'M{f(ax)} {f(ay)} Q{f(mx)} {f(my)} {f(bx)} {f(by)}'

def straight_points(d):
    """Segments of a path made only of M/L/H/V (absolute or relative) and Z. None if it has curves."""
    if re.search(r'[CcSsQqTtAa]', d): return None
    toks = re.findall(r'[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    segs, x, y, sx, sy, cmd, i = [], 0, 0, 0, 0, None, 0
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t): cmd = t; i += 1
        if cmd in 'Zz': segs.append((x, y, sx, sy)); x, y = sx, sy; continue
        n = lambda k: float(toks[i + k])
        if cmd in 'Mm':
            x, y = (n(0), n(1)) if cmd == 'M' else (x + n(0), y + n(1)); sx, sy = x, y; i += 2; cmd = 'L' if cmd == 'M' else 'l'
        elif cmd in 'Ll':
            nx, ny = (n(0), n(1)) if cmd == 'L' else (x + n(0), y + n(1)); segs.append((x, y, nx, ny)); x, y = nx, ny; i += 2
        elif cmd in 'Hh':
            nx = n(0) if cmd == 'H' else x + n(0); segs.append((x, y, nx, y)); x = nx; i += 1
        elif cmd in 'Vv':
            ny = n(0) if cmd == 'V' else y + n(0); segs.append((x, y, x, ny)); y = ny; i += 1
    return segs

def fill_only(tag, el):
    t = re.sub(r'\s(?:stroke|stroke-width)="[^"]*"', '', tag)
    return t.replace('<' + el, '<' + el + ' stroke="none"', 1)

def sketch_element(tag, inherited_w):
    name = re.match(r'<(\w+)', tag).group(1)
    a = attrs(tag)
    w = float(a.get('stroke-width', inherited_w or 1))
    w2 = w * rnd.uniform(0.78, 1.3)                                    # varied line weight
    stroke = a.get('stroke', INK)
    op = a.get('opacity')
    opa = f' opacity="{op}"' if op else ''
    fill = a.get('fill')
    out = []
    if name == 'rect':
        x, y, W, H = (float(a[k]) for k in ('x', 'y', 'width', 'height'))
        out.append(fill_only(tag, 'rect'))
        segs = [(x, y, x + W, y), (x + W, y, x + W, y + H), (x + W, y + H, x, y + H), (x, y + H, x, y)]
        d = ' '.join(wobble_seg(*s, w) for s in segs)
        out.append(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{f(w2)}"{opa}/>')
        return ''.join(out)
    if name == 'circle':
        return tag.replace(f'stroke-width="{a["stroke-width"]}"', f'stroke-width="{f(w2)}"') if 'stroke-width' in a else tag
    d = a.get('d', '')
    segs = straight_points(d)
    if segs is not None:
        if fill and fill != 'none':
            out.append(fill_only(tag, 'path'))
        dd = ' '.join(s for s in (wobble_seg(*sg, w) for sg in segs) if s)
        out.append(f'<path d="{dd}" fill="none" stroke="{stroke}" stroke-width="{f(w2)}"{opa}/>')
        if w >= 1 and rnd.random() < 0.35:                               # now and then a second, lighter pass
            dd2 = ' '.join(s for s in (wobble_seg(*sg, w) for sg in segs) if s)
            out.append(f'<path d="{dd2}" fill="none" stroke="{stroke}" stroke-width="{f(w * 0.45)}" opacity=".5"/>')
        return ''.join(out)
    # curves: keep the shape, vary the weight, add a faint offset pass
    t = re.sub(r'stroke-width="[^"]*"', f'stroke-width="{f(w2)}"', tag) if 'stroke-width' in a else tag.replace('<path', f'<path stroke-width="{f(w2)}"', 1)
    dx, dy = rnd.uniform(0.5, 1.0) * rnd.choice([-1, 1]), rnd.uniform(0.3, 0.8)
    ghost = f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{f(w * 0.5)}" opacity=".45" transform="translate({f(dx)} {f(dy)})"/>'
    return t + ghost

# walk the file, tracking stroke and stroke-width set on <g> groups
out, stack, pos = [], [], 0
for m in re.finditer(r'<g\b[^>]*>|</g>|<(?:path|rect|circle)\b[^>]*/>', svg):
    out.append(svg[pos:m.start()]); pos = m.end(); tag = m.group(0)
    if tag.startswith('<g'):
        ga = attrs(tag); stack.append((ga.get('stroke'), ga.get('stroke-width'))); out.append(tag); continue
    if tag == '</g>':
        stack.pop(); out.append(tag); continue
    a = attrs(tag)
    g_stroke = next((s for s, _ in reversed(stack) if s), None)
    g_w = next((w for _, w in reversed(stack) if w), None)
    stroked = a.get('stroke', g_stroke) not in (None, 'none')
    if stroked and a.get('stroke', g_stroke) in (INK, '#FBF3EA'):
        out.append(sketch_element(tag, g_w))
    else:
        out.append(tag)
out.append(svg[pos:])
svg = ''.join(out)

# ---------- a few irregular facade details (same layout as the drawing script) ----------
if not PR_DETAILS:
    svg = svg.replace('aria-label="Line drawing of', 'aria-label="Pen sketch of', 1); open(OUT, 'w').write(svg); print('wrote', OUT, len(svg), 'bytes'); sys.exit(0)
widths = [118, 96, 128, 104, 120, 110, 116]; tops = [70, 96, 60, 88, 74, 100, 82]
cols = ['#E8957C', '#F2C46D', '#9FCBC4', '#F4B98A', '#E9A8B5', '#F6DCA8', '#D9826A', '#B9D4E6']
def shade(hexc, k):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02X%02X%02X' % tuple(int(c * k) for c in (r, g, b))
houses, x, i = [], -10, 0
while x < 770:
    w = widths[i % 7]; top = tops[i % 7]
    if x + w > 790: w = 790 - x
    houses.append((x, w, top, top + (252 - top) * 0.5, cols[i % 8], 2 if w > 100 else 1)); x += w; i += 1
D = []
def blob(cx, cy, rx, ry, col):
    pts = []
    for k in range(9):
        t = k / 9 * math.tau; r = rnd.uniform(0.7, 1.15)
        pts.append((cx + math.cos(t) * rx * r, cy + math.sin(t) * ry * r))
    return '<path d="M' + ' L'.join(f'{f(px)} {f(py)}' for px, py in pts) + f' Z" fill="{col}"/>'
# worn plaster patches, a little darker than the wall, on the lower floors
for hi, (cx, cy, rx, ry) in {0: (88, 212, 12, 7), 3: (420, 222, 9, 6), 5: (563, 214, 5, 9), 6: (774, 214, 7, 10)}.items():
    hx, hw, ht, hm, hc, n = houses[hi]
    D.append(blob(cx, cy, rx, ry, shade(hc, 0.9)))
    D.append(f'<path d="{wobble_seg(cx - rx, cy + ry * .6, cx + rx * .7, cy + ry * .8, .5)}" fill="none" stroke="{INK}" stroke-width=".5" opacity=".55"/>')
# hairline cracks
for cx, cy in [(130, 200), (470, 128), (705, 205)]:
    p = [(cx, cy)]
    for _ in range(4): p.append((p[-1][0] + rnd.uniform(-3, 4), p[-1][1] + rnd.uniform(4, 7)))
    D.append('<path d="M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in p) + f'" fill="none" stroke="{INK}" stroke-width=".55" opacity=".7"/>')
# drainpipe down the edge of the sea-green house
hx, hw, ht, *_ = houses[2]
px = hx + hw - 5
D.append(f'<path d="{wobble_seg(px, ht + 14, px, 251, 1.6)}" fill="none" stroke="{INK}" stroke-width="2.2"/>')
D.append(f'<path d="M{px - 3} {ht + 12} h6" stroke="{INK}" stroke-width="1.4"/>')
for yy in (ht + 60, ht + 120, 236):
    D.append(f'<path d="M{px - 2.5} {yy} h5" stroke="{INK}" stroke-width="1"/>')
# wall lanterns beside two doors
for hi in (1, 4):
    hx, hw, ht, hm, hc, n = houses[hi]
    lx = (hx + hw * 0.32 + 20) if n == 2 else (hx + hw / 2 + 20)
    ly = hm + 22
    D.append(f'<g stroke="{INK}" stroke-width="1" stroke-linejoin="round"><path d="M{f(lx - 6)} {f(ly)} h6 v4" fill="none"/>'
             f'<path d="M{f(lx - 4)} {f(ly + 4)} h8 l-1.5 9 h-5 Z" fill="#F4C46A"/><path d="M{f(lx - 4.5)} {f(ly + 4)} h9" stroke-width="1.4"/></g>')
# flower pots on two balconies
for hi, k in ((0, 0), (5, 1)):
    hx, hw, ht, hm, hc, n = houses[hi]
    cx = hx + hw * (k + 1) / (n + 1); by = hm - 4
    for dx in (-14, 12):
        D.append(f'<path d="M{f(cx + dx - 4)} {f(by - 14)} h8 l-1.4 6 h-5.2 Z" fill="#C8643F" stroke="{INK}" stroke-width=".8"/>')
        D.append(blob(cx + dx, by - 17, 5, 3.5, '#3E7D5A'))
        D.append(f'<circle cx="{f(cx + dx + 1)}" cy="{f(by - 19)}" r="1.6" fill="#D81B60"/>')
D_svg = '\n'.join(D)
svg = svg.replace('<rect x="0" y="252" width="790"', D_svg + '\n<rect x="0" y="252" width="790"', 1)

# one shutter left hanging slightly open: rotate the right shutter of the coral house's first window
m = re.search(r'<rect stroke="none" x="40\.33[^"]*" y="98" width="9" height="53\.0" fill="#00677A"/><path d="([^"]*)"[^>]*/>', svg)
if m:
    sub = m.group(0)
    svg = svg.replace(sub, f'<g transform="rotate(-4 40.3 98)">{sub}</g>', 1)

svg = svg.replace('aria-label="Line drawing of Old San Juan', 'aria-label="Pen sketch of Old San Juan', 1)
open(OUT, 'w').write(svg)
print('wrote', OUT, len(svg), 'bytes')
