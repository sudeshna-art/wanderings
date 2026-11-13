"""Algarve cover: a whitewashed old town with cobalt and ochre trim, lattice chimneys and roof terraces,
a white church tower, and the ochre cliffs and sea stacks of the coast beyond.
Palette: lime white, cobalt blue and ochre-yellow trim, terracotta, warm sandstone cliffs, Atlantic blue."""
import sys
from cover_lib import Cover, INK, window, tile_roof, arched_door

c = Cover('Line drawing of an Algarve town: whitewashed houses with blue and ochre trim, lattice chimneys, a white church tower, and ochre sea cliffs beyond', '#F2E6CF')
WHITE, WHITE2 = '#FBF9F3', '#F1ECE0'
COBALT, OCHRE, TERRA = '#2E5FA3', '#E0B04A', '#C2603F'
CLIFF, CLIFF_D = '#D49A5A', '#B9783F'
SEA = '#2A7F9E'

# a low hill of scrub and almond trees behind the town, and the sun
c.A('<path d="M0 150 C140 128 260 138 380 126 C520 112 640 130 820 118 V300 H0 Z" fill="#C9C08F"/>')
c.A(f'<path d="M0 150 C140 128 260 138 380 126 C520 112 640 130 820 118" fill="none" stroke="{INK}" stroke-width="1"/>')
for x0, y0 in [(90, 136), (230, 130), (500, 118), (650, 122), (760, 116)]:
    c.A(f'<circle cx="{x0}" cy="{y0}" r="7" fill="#8C9A5B" stroke="{INK}" stroke-width=".8"/>')
c.A('<circle cx="1110" cy="70" r="22" fill="#F4C46A"/>')
# sea and cliffs on the right
c.A(f'<path d="M800 170 H1200 V300 H800 Z" fill="{SEA}"/>')
for y, x0 in [(196, 1010), (214, 1100), (232, 960), (252, 1060), (270, 1140)]:
    c.A(f'<path d="M{x0} {y} q10 -4 20 0 t20 0" fill="none" stroke="#A8D3DF" stroke-width="1.5" stroke-linecap="round"/>')
c.g(1.4)
c.path('M820 300 V150 C850 130 900 126 940 132 C980 138 1000 150 1010 176 L1018 300 Z', fill=CLIFF)       # headland
c.path('M1050 300 V198 C1056 182 1074 178 1086 186 C1094 194 1096 210 1094 300 Z', fill=CLIFF)          # sea stack
c.path('M1130 300 V226 C1136 214 1150 212 1158 222 L1162 300 Z', fill=CLIFF)
c.path('M880 300 C890 270 900 250 930 246 C956 248 966 274 970 300', fill=SEA, sw=1.2)                   # sea arch
for d in ['M840 170 C870 176 900 172 930 180', 'M836 200 C870 206 910 204 960 214', 'M1056 220 C1070 224 1080 222 1092 226', 'M846 236 C860 240 872 238 884 242']:
    c.path(d, sw=.8, extra=f' stroke="{CLIFF_D}"')
c.path('M840 132 C860 120 880 122 900 126', sw=2.2, extra=' stroke="#7F8F55"')                         # scrub on top
c.end()

# a white church tower with ochre trim, left of centre
tx = 360
c.g(1.3)
c.rect(tx - 22, 70, 44, 182, WHITE)
c.path(f'M{tx - 22} 70 V252 M{tx + 22} 70 V252', sw=3.2, extra=f' stroke="{OCHRE}"')
c.path(f'M{tx - 22} 70 V252 M{tx + 22} 70 V252', sw=1.3)
c.rect(tx - 26, 64, 52, 8, OCHRE)
c.path(f'M{tx - 12} 104 V90 a12 12 0 0 1 24 0 V104 Z', fill='#3B3632')                                  # bell opening
c.A(f'<circle cx="{tx}" cy="98" r="4" fill="{OCHRE}" stroke-width=".8"/>')
c.path(f'M{tx - 22} 64 C{tx - 20} 44 {tx - 8} 36 {tx} 34 C{tx + 8} 36 {tx + 20} 44 {tx + 22} 64 Z', fill=WHITE)
c.path(f'M{tx} 34 V20 M{tx - 5} 26 H{tx + 5}', sw=1.2)
c.end()

# whitewashed houses: flat roofs with terraces, some tile roofs, lattice chimneys, painted trim
def chimney(cx, top):
    c.rect(cx - 7, top - 30, 14, 30, WHITE, 1)
    for yy in (top - 26, top - 18, top - 10):
        c.path(f'M{cx - 4} {yy} l4 4 l4 -4 M{cx - 4} {yy + 4} l4 -4 l4 4', sw=.6)
    c.path(f'M{cx - 10} {top - 30} H{cx + 10} L{cx + 6} {top - 36} H{cx - 6} Z', fill=WHITE, sw=1)
    c.path(f'M{cx} {top - 36} V{top - 42}', sw=1)

trims = [COBALT, OCHRE, COBALT, '#4F8A6E', OCHRE, COBALT, '#A0522D', COBALT]
widths = [92, 80, 104, 86, 98, 84, 110, 90, 100]
tops = [160, 176, 150, 170, 158, 180, 154, 168, 162]
x, i = -10, 0
while x < 820:
    w = widths[i % 9]; top = tops[i % 9]
    if x + w > 830: w = 830 - x
    if w < 30: break
    trim = trims[i % 8]
    c.g(1.3)
    c.rect(x, top, w, 252 - top, WHITE if i % 2 == 0 else WHITE2)
    c.rect(x, 238, w, 14, trim, 1)                                                     # painted plinth
    if i % 3 == 1:
        tile_roof(c, x, w, top, TERRA, eave=5, pitch=9)
    else:
        c.rect(x - 2, top - 5, w + 4, 6, WHITE)                                        # terrace parapet
        c.path(f'M{x + 6} {top - 5} V{top - 14} H{x + 26} V{top - 5}', sw=.8)         # rail on the terrace
    if i % 2 == 0:
        chimney(x + w - 18, top - (0 if i % 3 != 1 else 4))
    n = max(1, int(w // 44))
    for k in range(n):
        cx = x + w * (k + 1) / (n + 1)
        c.rect(cx - 10, top + 16, 20, 30, trim, 1)                                     # painted window surround
        window(c, cx, top + 20, 22, None, glass='#3E4A57', ww=12)
    dx = x + w * 0.5
    c.rect(dx - 13, 238 - 40, 26, 40, trim, 1)
    arched_door(c, dx, 238, 36, 18, '#6B4A2F' if trim != '#A0522D' else '#2E5FA3')
    c.end()
    x += w; i += 1

# bougainvillea over two walls
for cx, cy in [(132, 186), (560, 176)]:
    for _ in range(30):
        c.A(f'<circle cx="{cx + c.r.uniform(-16, 16):.1f}" cy="{cy + c.r.uniform(-8, 22):.1f}" r="{c.r.uniform(2, 4.2):.1f}" fill="{c.r.choice(["#C2185B", "#D81B60", "#AD1457"])}" opacity=".85"/>')

# a cobbled lane in pale limestone with darker setts
c.A('<rect x="0" y="252" width="830" height="48" fill="#E6DCC6"/>')
c.A(f'<path d="M0 252 H830" stroke="{INK}" stroke-width="1.6"/>')
for r in range(4):
    for cc in range(0, 806, 18):
        c.A(f'<rect x="{cc + (r % 2) * 9}" y="{256 + r * 11}" width="15" height="8" rx="3" fill="#D3C6A8"/>')
c.save(sys.argv[1])
