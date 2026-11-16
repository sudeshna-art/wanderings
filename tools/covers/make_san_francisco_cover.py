"""San Francisco cover (Nov 16 2026): painted Victorian houses stepping up a hill on the left, a cable car climbing
toward the skyline in the middle, and the Golden Gate Bridge above a band of fog on the right.
Palette: fog grey sky, International Orange bridge, soft pastel house fronts, blue-grey bay, dry gold headlands.

    python3 make_san_francisco_cover.py flat.svg     (then sketchify.py, see make_covers.py)
"""
import sys, random
from cover_lib import Cover, INK, W, H

r = random.Random(16)
c = Cover('Line drawing of San Francisco: pastel Victorian houses on a hill, a cable car climbing the street, and the Golden Gate Bridge rising out of the fog over the bay', '#EEF1F1')
A = c.A
ORANGE, ORANGE_D = '#C8472F', '#A93A27'

# ---------- sky: pale sun and gulls ----------
A('<circle cx="1120" cy="62" r="19" fill="#F4DDB0"/>')
for x, y in [(640, 52), (668, 40), (612, 70), (1010, 44)]:
    A(f'<path d="M{x-7} {y} q4 -5 7 0 q3 -5 7 0" fill="none" stroke="{INK}" stroke-width="1.2" stroke-linecap="round"/>')

# ---------- the bay and the Marin headlands (right) ----------
A('<path d="M700 214 H1200 V300 H700 Z" fill="#7FA0AE"/>')
A('<path d="M700 214 H1200 V224 H700 Z" fill="#A2BCC6"/>')
c.g(1.1)
c.path('M930 214 C960 176 1000 168 1040 150 C1080 134 1120 140 1150 128 C1175 120 1190 124 1200 120 V214 Z', fill='#B7AE82')
c.path('M1040 150 C1050 170 1046 190 1060 212 M1120 140 C1124 168 1136 188 1140 212', sw=.6)
c.end()
for y, x0 in [(236, 760), (250, 850), (262, 790), (272, 940), (284, 1030), (244, 1090), (266, 1140), (290, 880)]:
    A(f'<path d="M{x0} {y} q10 -4 20 0 t20 0" fill="none" stroke="#DCE8EC" stroke-width="1.4" stroke-linecap="round"/>')
# a small sailboat
A(f'<g stroke="{INK}" stroke-width="1" stroke-linejoin="round"><path d="M792 250 L792 226 L808 248 Z" fill="#FBFAF6"/><path d="M780 250 H812 L806 256 H786 Z" fill="#E9E4DA"/></g>')

# ---------- Golden Gate Bridge ----------
DECK = 196
towers = [860, 1080]
# main cables (behind the towers)
c.g(1.5)
c.path(f'M700 {DECK-18} Q780 {DECK-6} {towers[0]} 60', sw=1.6, extra=f' stroke="{ORANGE_D}"')
c.path(f'M{towers[0]} 60 Q{(towers[0]+towers[1])/2} {DECK+18} {towers[1]} 60', sw=1.6, extra=f' stroke="{ORANGE_D}"')
c.path(f'M{towers[1]} 60 Q1150 {DECK-6} 1200 {DECK-34}', sw=1.6, extra=f' stroke="{ORANGE_D}"')
c.end()
# suspender ropes
def cable_y(x):
    a, b = towers
    if a <= x <= b:
        t = (x - a) / (b - a); return (1 - t) ** 2 * 60 + 2 * (1 - t) * t * (DECK + 18) + t ** 2 * 60
    if x < a:
        t = (x - 700) / (a - 700); return (1 - t) ** 2 * (DECK - 18) + 2 * (1 - t) * t * (DECK - 6) + t ** 2 * 60
    t = (x - b) / (1200 - b); return (1 - t) ** 2 * 60 + 2 * (1 - t) * t * (DECK - 6) + t ** 2 * (DECK - 34)
for x in range(712, 1200, 12):
    if any(abs(x - t) < 12 for t in towers):
        continue
    y = cable_y(x)
    if y < DECK - 2:
        A(f'<path d="M{x} {y:.1f} V{DECK}" stroke="{ORANGE_D}" stroke-width=".6"/>')
# deck
c.g(1.2)
c.rect(700, DECK, 500, 7, ORANGE)
c.path(f'M700 {DECK+11} H1200', sw=.7)
for x in range(708, 1200, 16):
    c.path(f'M{x} {DECK+7} l8 4 l8 -4', sw=.5)
c.end()
# towers: two legs with stepped Art Deco setbacks and four portal braces
for tx in towers:
    c.g(1.3)
    for side in (-1, 1):
        lx = tx + side * 11
        c.path(f'M{lx-5} 250 V120 H{lx-4} V78 H{lx-3} V52 H{lx+3} V78 H{lx+4} V120 H{lx+5} V250 Z', fill=ORANGE)
    for by, bh in [(58, 9), (92, 10), (132, 11), (172, 12)]:
        c.rect(tx - 8, by, 16, bh, ORANGE_D, 1)
    c.rect(tx - 20, 246, 40, 10, '#D9D4C8', 1.1)   # concrete pier
    c.end()

# ---------- fog: soft bands across the bridge and the water ----------
for cx, cy, rx, ry, op in [(760, 208, 90, 13, .95), (900, 222, 120, 15, .92), (1040, 210, 110, 12, .9), (1160, 224, 80, 13, .92),
                           (830, 150, 70, 9, .75), (990, 128, 90, 9, .7), (1130, 160, 70, 8, .7), (720, 176, 50, 8, .8)]:
    A(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#FBFBF9" opacity="{op}"/>')

# ---------- skyline in the distance (middle) ----------
c.g(1)
for x, w, top in [(520, 20, 150), (544, 16, 132), (600, 22, 144), (626, 18, 160), (648, 24, 138), (676, 18, 156)]:
    c.rect(x, top, w, 214 - top, '#D8DDDD', .9)
    for yy in range(top + 8, 208, 10):
        c.path(f'M{x+4} {yy} H{x+w-4}', sw=.35)
# the pyramid tower
c.path('M572 214 L584 84 L596 214 Z', fill='#E4E7E6', sw=1)
c.path('M578 150 H590 M576 176 H592', sw=.4)
# a round tower on a wooded hill
c.path('M690 214 C700 176 730 168 760 176 C780 182 792 198 800 214 Z', fill='#8FA07A')
c.rect(733, 138, 12, 36, '#F4F1E8', 1)
c.path('M731 138 H747 M735 146 v6 M739 146 v6 M743 146 v6', sw=.6)
c.end()

# ---------- the hill street with a cable car (middle) ----------
# street rising from right to left
A('<path d="M430 300 L430 232 L700 214 L700 300 Z" fill="#C9CBC6"/>')
A(f'<path d="M430 232 L700 214" stroke="{INK}" stroke-width="1.6"/>')
A('<path d="M430 262 L700 246" stroke="#EDEEE9" stroke-width="2" stroke-dasharray="14 10"/>')
A(f'<path d="M430 280 L700 266 M430 286 L700 272" stroke="{INK}" stroke-width=".7"/>')   # cable car rails
# cable car, tilted to the slope
A('<g transform="translate(566 244) rotate(-3.8)">')
c.g(1.3)
c.rect(-58, -42, 116, 6, '#F2E6C8')                       # roof
c.path('M-52 -42 Q0 -54 52 -42', fill='#F2E6C8', sw=1.2)  # clerestory curve
c.rect(-54, -36, 108, 14, '#F7F3E8', 1)                   # window band
for x in range(-46, 50, 12):
    c.path(f'M{x} -36 V-22', sw=.7)
c.rect(-58, -22, 116, 22, '#9C2F2A')                      # body, the deep red of the Powell cars
c.path('M-58 -12 H58', sw=.8, extra=' stroke="#F2E6C8"')
c.rect(-22, -22, 44, 22, '#B8862F', 1)                    # the open middle section, gold trim
for x in (-14, -4, 6, 16):
    c.path(f'M{x} -22 V0', sw=.7)
c.rect(-60, 0, 120, 5, '#3A3632', 1)                      # running board
c.path('M-40 5 v6 M40 5 v6', sw=1.4)
A(f'<circle cx="-36" cy="12" r="5" fill="#3A3632"/><circle cx="36" cy="12" r="5" fill="#3A3632"/>')
c.path('M0 -48 V-62 M-3 -62 H3', sw=1)                    # bell post
c.end()
A('</g>')
# a street lamp at the crest
lx = 446
A(f'<g stroke="{INK}" stroke-linecap="round" stroke-linejoin="round"><path d="M{lx} 232 V172" stroke-width="2"/><path d="M{lx-6} 172 h12 l-3 -12 h-6 Z" fill="#F4DDB0" stroke-width="1"/></g>')

# ---------- painted Victorian houses stepping up the hill (left) ----------
fronts = ['#E9C9A6', '#A9C6CB', '#E2B9B0', '#C7D1A6', '#E6DAB6']
trims = ['#8A4B3A', '#3F5F6B', '#7A3F47', '#56683C', '#8A6A2F']
GROUND = 252
for i in range(5):
    x = -6 + i * 88
    w = 80
    base = GROUND - i * 5            # each house sits a little higher than the last
    top = base - 112
    f, t = fronts[i], trims[i]
    c.g(1.3)
    # steep gable roof with a small finial
    c.path(f'M{x-3} {top} L{x+w/2} {top-42} L{x+w+3} {top} Z', fill='#6B6F78')
    c.path(f'M{x+4} {top-2} L{x+w/2} {top-34} L{x+w-4} {top-2} Z', fill=f, sw=1)
    c.path(f'M{x+w/2} {top-42} v-8', sw=1.1)
    # round attic window and gable trim
    A(f'<circle cx="{x+w/2}" cy="{top-14}" r="6" fill="#3B3632" stroke-width="1"/>')
    c.path(f'M{x+12} {top-6} L{x+w/2} {top-28} L{x+w-12} {top-6}', sw=.6, extra=f' stroke="{t}"')
    # house front
    c.rect(x, top, w, base - top, f)
    c.path(f'M{x-3} {top} H{x+w+3}', sw=1.8)
    for yy in range(top + 8, base - 4, 7):
        c.path(f'M{x+2} {yy} h{r.randint(5, 12)}', sw=.3)
    # two-story bay window on one side
    bx = x + 8
    c.rect(bx, top + 8, 36, base - top - 20, '#F8F4EA', 1.1)
    for row in (top + 14, top + 58):
        for k in range(3):
            c.rect(bx + 3 + k * 11, row, 8, 26, '#3B3632', .7)
        c.path(f'M{bx-2} {row-4} H{bx+38}', sw=1.3, extra=f' stroke="{t}"')
    c.path(f'M{bx} {top+50} H{bx+36}', sw=.8)
    # upper window and front door with steps on the other side
    c.rect(x + 54, top + 14, 16, 26, '#3B3632', .9)
    c.path(f'M{x+51} {top+10} H{x+73}', sw=1.3, extra=f' stroke="{t}"')
    c.path(f'M{x+53} {base-8} V{base-44} a9 9 0 0 1 18 0 V{base-8} Z', fill=t)
    for s in range(3):
        c.rect(x + 50 - s * 2, base - 8 + s * 4, 24 + s * 4, 4, '#E6E1D6', .8)
    c.end()
# sloping sidewalk and a strip of park grass in front
A(f'<path d="M0 {GROUND+6} L436 {GROUND-18} L436 300 L0 300 Z" fill="#9DAA72"/>')
A(f'<path d="M0 {GROUND+6} L436 {GROUND-18}" stroke="{INK}" stroke-width="1.5"/>')
for k in range(14):
    gx = 14 + k * 30 + r.uniform(-6, 6); gy = GROUND + 20 + r.uniform(-4, 16) - k * 1.6
    A(f'<path d="M{gx:.1f} {gy:.1f} q2 -6 4 0 M{gx+7:.1f} {gy+2:.1f} q2 -5 4 0" fill="none" stroke="#6F7F4A" stroke-width="1" stroke-linecap="round"/>')
# a cypress, bent a little by the wind
c.g(1.1)
c.path('M404 244 C398 214 404 190 414 170 C420 190 424 214 418 244 Z', fill='#4E6548')
c.end()

c.save(sys.argv[1])
