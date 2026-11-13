"""Firenze cover: the Duomo and Giotto's bell tower over the rooftops, Palazzo Vecchio's tower, palazzi along
the Arno with green shutters, the Ponte Vecchio, cypress hills. Palette: ochre and Siena plaster, terracotta,
pietra serena grey-green, the Duomo's white, green and pink marble, a muted green river."""
import sys
from cover_lib import Cover, INK, window, tile_roof, cypress, arched_door

c = Cover('Line drawing of Firenze: Brunelleschi’s dome and Giotto’s bell tower over terracotta roofs, the tower of Palazzo Vecchio, palazzi with green shutters along the Arno and the Ponte Vecchio', '#F6F0E4')
TERRA, TERRA_D = '#B9583A', '#9C4630'
MARBLE, GREEN_M, PINK_M = '#F3EEE2', '#4F6E5A', '#D9A0A0'
STONE = '#B8B19C'
RIVER, RIPPLE = '#7E8F72', '#B7C2A2'

# hills and cypresses
c.A(f'<path d="M0 150 C120 118 220 132 330 122 C460 110 520 136 640 128 C760 120 860 104 980 116 C1080 126 1150 112 1200 118 V300 H0 Z" fill="#B7BE95"/>')
c.A(f'<path d="M0 150 C120 118 220 132 330 122 C460 110 520 136 640 128 C760 120 860 104 980 116 C1080 126 1150 112 1200 118" fill="none" stroke="{INK}" stroke-width="1.1"/>')
c.g(1)
for x, b, h in [(70, 150, 40), (86, 148, 30), (250, 136, 34), (870, 122, 38), (888, 120, 28), (1090, 128, 36), (1160, 124, 30)]:
    cypress(c, x, b, h)
c.end()
# a villa on the hill
c.g(1.1)
c.rect(1010, 104, 44, 22, '#EFDDB8'); tile_roof(c, 1010, 44, 104, TERRA, eave=4, pitch=6)
c.end()

# Palazzo Vecchio tower (Torre di Arnolfo), left of centre
px = 395
c.g(1.3)
c.rect(px - 13, 70, 26, 110, '#D7C29A')
c.path(f'M{px - 19} 70 H{px + 19} V58 H{px - 19} Z', fill='#D7C29A')                # projecting gallery
for k in range(5):
    c.path(f'M{px - 19 + k * 9.5:.1f} 58 v-6 h5 v6', fill='#D7C29A', sw=1)            # crenellations
c.rect(px - 9, 34, 18, 18, '#D7C29A')                                                 # belfry
c.path(f'M{px - 11} 34 L{px} 24 L{px + 11} 34 Z', fill=TERRA)
c.path(f'M{px} 24 V14', sw=1)
c.A(f'<circle cx="{px}" cy="92" r="6" fill="{MARBLE}" stroke-width="1"/>')           # clock
c.path(f'M{px} 92 v-4 M{px} 92 h3', sw=.8)
c.path(f'M{px - 4} 44 v8 M{px + 4} 44 v8', sw=.8)
c.end()

# The Duomo: drum, dome with white ribs, lantern
dx = 600
c.g(1.4)
c.rect(dx - 82, 132, 164, 40, MARBLE)                                                 # nave front, marble
for k in range(0, 6):
    c.rect(dx - 82 + k * 27.3, 136, 13, 32, GREEN_M, .8)
c.path(f'M{dx - 82} 150 H{dx + 82}', sw=.8, extra=f' stroke="{PINK_M}"')
c.rect(dx - 56, 112, 112, 22, MARBLE)                                                 # drum
for k in range(7):
    c.A(f'<circle cx="{dx - 45 + k * 15}" cy="123" r="4" fill="{GREEN_M}" stroke-width=".8"/>')   # oculi
c.path(f'M{dx - 50} 112 C{dx - 50} 72 {dx - 26} 48 {dx} 44 C{dx + 26} 48 {dx + 50} 72 {dx + 50} 112 Z', fill=TERRA)   # dome
c.path(f'M{dx - 26} 112 C{dx - 24} 80 {dx - 12} 58 {dx - 2} 46', sw=2.2, extra=f' stroke="{MARBLE}"')
c.path(f'M{dx + 26} 112 C{dx + 24} 80 {dx + 12} 58 {dx + 2} 46', sw=2.2, extra=f' stroke="{MARBLE}"')
c.path(f'M{dx} 112 V46', sw=2.2, extra=f' stroke="{MARBLE}"')
c.path(f'M{dx - 50} 112 C{dx - 50} 72 {dx - 26} 48 {dx} 44 C{dx + 26} 48 {dx + 50} 72 {dx + 50} 112', sw=1.4)
c.rect(dx - 7, 30, 14, 15, MARBLE)                                                    # lantern
c.path(f'M{dx - 8} 30 L{dx} 20 L{dx + 8} 30 Z', fill=MARBLE)
c.A(f'<circle cx="{dx}" cy="17" r="3" fill="#E0B04A" stroke-width=".8"/>')
c.path(f'M{dx} 14 v-6', sw=1)
c.end()

# Giotto's bell tower: marble bands, right of the dome
bx = 698
c.g(1.3)
c.rect(bx - 15, 48, 30, 130, MARBLE)
for y in range(56, 178, 22):
    c.rect(bx - 15, y, 30, 6, GREEN_M, .8)
    c.rect(bx - 11, y + 9, 22, 5, PINK_M, .6)
c.path(f'M{bx - 8} 62 V54 a8 8 0 0 1 16 0 V62', sw=.9)
c.path(f'M{bx - 18} 48 H{bx + 18} V42 H{bx - 18} Z', fill=MARBLE)
c.end()

# Palazzi along the Arno: three storeys, deep eaves, green shutters
cols = ['#D9A65A', '#E8CF96', '#C47A4A', '#EFDDB8', '#C9826B', '#E3B873', '#D8C3A0', '#C98D55']
shut = ['#4E6B4A', '#5F7550', '#4A5E46', '#6B7A4A']
widths = [96, 82, 110, 88, 100, 92, 104, 86]
tops = [170, 158, 176, 162, 182, 166, 174, 160]
x, i = -8, 0
while x < 1210:
    if 760 < x < 1170:     # leave room for the Ponte Vecchio
        x = 1170
    w = widths[i % 8]; top = tops[i % 8]
    col = cols[i % 8]; sh = shut[i % 4]
    c.g(1.3)
    c.rect(x, top, w, 240 - top, col)
    tile_roof(c, x, w, top, TERRA, eave=7, pitch=7)
    floors = 3 if 240 - top > 66 else 2
    fh = (240 - top - 4) / floors
    n = max(2, int(w // 42))
    for f in range(floors):
        y = top + 6 + f * fh
        for k in range(n):
            cx = x + w * (k + 1) / (n + 1)
            if c.r.random() < 0.45:     # shutters closed, as many are in the afternoon
                c.rect(cx - 8, y + 3, 16, fh - 11, sh, 1)
                c.path(f'M{cx:.1f} {y + 3:.1f} V{y + fh - 8:.1f}', sw=.6)
                c.rect(cx - 10, y + fh - 8, 20, 2.5, '#9C9886', .8)
            else:
                window(c, cx, y + 3, fh - 11, sh, glass='#5B5048', ww=8, frame='#9C9886')
        if f < floors - 1:
            c.path(f'M{x} {y + fh - 2:.1f} H{x + w}', sw=.7)
    c.end()
    x += w; i += 1

# Ponte Vecchio: three arches with the shops on top
c.g(1.4)
c.rect(770, 166, 410, 32, '#D9A65A')                                                  # shops
for k, colr in enumerate(['#E3B873', '#C98D55', '#D9A65A', '#E8CF96', '#C47A4A', '#E3B873', '#D9A65A']):
    sx = 776 + k * 57
    c.rect(sx, 172, 50, 24, colr, 1)
    c.path(f'M{sx + 8} 192 V180 h10 v12 M{sx + 28} 192 V180 h12 v12', sw=.7)
    tile_roof(c, sx, 50, 172, TERRA, eave=3, pitch=4)
c.rect(882, 150, 90, 18, '#E8CF96', 1.2)                                              # Vasari corridor on top
for k in range(5):
    c.path(f'M{890 + k * 17} 166 V156 h8 v10', sw=.8)
c.path('M770 198 H1180 V240 H770 Z', fill='#C8A36A')
for ax in (800, 975, 1150):
    c.path(f'M{ax - 60} 240 Q{ax} 196 {ax + 60} 240 Z', fill=RIVER, sw=1.4)
c.end()

# the Arno
c.A(f'<rect x="0" y="240" width="1200" height="60" fill="{RIVER}"/>')
c.A(f'<path d="M0 240 H1200" stroke="{INK}" stroke-width="1.6"/>')
for y, x0 in [(252, 60), (264, 210), (256, 380), (276, 520), (260, 700), (284, 860), (268, 1010), (252, 1120), (288, 300)]:
    c.A(f'<path d="M{x0} {y} q10 -4 20 0 t20 0 t20 0" fill="none" stroke="{RIPPLE}" stroke-width="1.5" stroke-linecap="round"/>')
c.save(sys.argv[1])
