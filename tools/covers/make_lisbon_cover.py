"""Lisboa cover: pastel houses stacked up the Alfama hill under terracotta roofs, the castle walls on top,
a blue-and-white azulejo facade, the yellow Tram 28 on the street, black-and-white calçada and the Tagus.
Palette: lemon yellow, coral pink, sage, pale blue and ochre plaster, white trims, cobalt tiles, terracotta."""
import sys
from cover_lib import Cover, INK, window, balcony, tile_roof, arched_door

c = Cover('Line drawing of Lisboa: pastel houses with terracotta roofs climbing to the castle walls, a blue and white tiled facade, the yellow tram and the river Tagus', '#F4F1EA')
TERRA = '#C2603F'
COBALT, TILE_BG = '#2F5DA8', '#E9EEF6'
TRIM = '#FBF8F1'
cols = ['#F1CF6B', '#E79A8C', '#A9CBB7', '#9DB9D8', '#D9A441', '#F3E3C3', '#E7B58E', '#C9D7A8']

# the Tagus and the far bank on the right
c.A('<path d="M820 150 H1200 V300 H820 Z" fill="#6E8FA6"/>')
c.A('<path d="M820 150 C900 140 980 146 1060 138 C1120 132 1170 138 1200 134 V152 H820 Z" fill="#A9B79A"/>')
c.A(f'<path d="M820 152 H1200" stroke="{INK}" stroke-width="1.1"/>')
for y, x0 in [(172, 900), (188, 1010), (204, 940), (178, 1120), (214, 1080)]:
    c.A(f'<path d="M{x0} {y} q10 -4 20 0 t20 0" fill="none" stroke="#C4D3DE" stroke-width="1.5" stroke-linecap="round"/>')

# the castle walls on the hilltop (Castelo de São Jorge), centre left
c.g(1.3)
c.path('M330 92 C380 78 440 74 520 78 C560 80 600 90 640 100 L640 130 L330 130 Z', fill='#B9B79A')   # hill
for x0, w, h in [(390, 70, 30), (460, 26, 44), (486, 64, 26), (550, 24, 38)]:
    c.rect(x0, 84 - h + 30, w, h, '#D8CCB0')
    for k in range(int(w // 9)):
        c.path(f'M{x0 + 2 + k * 9} {84 - h + 30} v-5 h5 v5', fill='#D8CCB0', sw=.9)
c.path('M380 74 C384 60 396 56 398 46 C402 58 412 60 410 74 Z', fill='#4F6E4A', sw=1)    # umbrella pine
c.path('M396 74 V86', sw=1.4)
c.end()

# three tiers of houses climbing the hill
def row(base, x0, x1, hmin, hmax, seed, floors):
    c.r.seed(seed)
    x, i = x0, seed
    while x < x1:
        w = c.r.choice([62, 70, 78, 86, 94])
        if x + w > x1: w = x1 - x
        if w < 30: break
        h = c.r.randint(hmin, hmax)
        top = base - h
        col = cols[i % len(cols)]
        azulejo = (seed == 3 and i % 5 == 2)
        c.g(1.3)
        c.rect(x, top, w, h, TILE_BG if azulejo else col)
        if azulejo:   # a tiled facade: a simple repeating blue motif
            for yy in range(int(top) + 4, int(base) - 4, 8):
                for xx in range(int(x) + 3, int(x + w) - 4, 8):
                    c.A(f'<path d="M{xx} {yy + 3} l3 -3 l3 3 l-3 3 Z" fill="{COBALT}" stroke="none"/>')
        tile_roof(c, x, w, top, TERRA, eave=4, pitch=8)
        n = max(1, int(w // 40))
        fh = (h - 6) / floors
        for f in range(floors):
            for k in range(n):
                cx = x + w * (k + 1) / (n + 1)
                y = top + 5 + f * fh
                window(c, cx, y, fh - 8, None, glass='#6B7783', ww=9, frame=TRIM)
                if f == 0 and floors > 1 and k == 0 and w > 70:
                    balcony(c, cx, y + fh - 6, half=10)
        c.end()
        x += w; i += 1

row(152, 120, 840, 34, 50, 1, 2)
row(200, 40, 860, 44, 60, 2, 2)
row(252, -10, 820, 52, 70, 3, 2)

# ground-floor doors on the front row
c.g(1.1)
for dx, colr in [(60, '#2F5DA8'), (250, '#4F6E4A'), (430, '#8C3B2E'), (720, '#2F5DA8')]:
    arched_door(c, dx, 252, 26, 14, colr)
c.end()

# the yellow tram (Tram 28) on the street in front
tx, ty = 470, 206
c.g(1.5)
c.path(f'M{tx + 70} {ty - 2} L{tx + 92} {ty - 34} M{tx + 92} {ty - 34} L{tx + 100} {ty - 34}', sw=1.4)   # trolley pole
c.rect(tx, ty, 150, 40, '#F2B705')
c.rect(tx - 4, ty - 6, 158, 8, TRIM)                                                   # white roof
c.rect(tx, ty + 30, 150, 10, '#F2B705')
c.path(f'M{tx} {ty + 30} H{tx + 150}', sw=1.4)
for k in range(6):
    c.rect(tx + 10 + k * 22, ty + 6, 16, 16, '#5B6875', 1)
c.rect(tx + 136, ty + 6, 10, 22, '#5B6875', 1)
c.A(f'<text x="{tx + 12}" y="{ty + 38}" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="{INK}" stroke="none">28</text>')
for wx in (tx + 28, tx + 122):
    c.A(f'<circle cx="{wx}" cy="{ty + 42}" r="6" fill="{INK}" stroke-width="1"/>')
c.end()
# a ferry crossing the Tagus
c.g(1.2)
c.path('M960 214 H1060 L1050 226 H970 Z', fill='#F4F1EA')
c.rect(985, 202, 50, 12, '#F2B705', 1)
c.path('M990 208 h8 M1004 208 h8 M1018 208 h8', sw=.8)
c.end()

# black and white calçada with its wave pattern
c.A('<rect x="0" y="252" width="840" height="48" fill="#EFE7D6"/>')
c.A(f'<path d="M0 252 H840" stroke="{INK}" stroke-width="1.6"/>')
for k in range(3):
    y = 262 + k * 13
    c.A(f'<path d="M0 {y} ' + ' '.join(f'q18 -7 36 0 t36 0' for _ in range(11)) + f'" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>')
# rails

c.save(sys.argv[1])
