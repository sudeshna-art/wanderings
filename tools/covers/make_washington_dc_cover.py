"""Washington, DC cover (Nov 14 2026): red-brick Federal rowhouses with slate roofs (Georgetown) on the left,
the Capitol dome above autumn trees in the middle, the Washington Monument, and the Potomac on the right.
Palette: limestone and white marble, red brick, slate, river blue-grey, November trees.

    python3 make_washington_dc_cover.py flat.svg     (then sketchify.py, see make_covers.py)
"""
import sys, random
from cover_lib import Cover, INK, W, H

r = random.Random(11)
c = Cover('Line drawing of Washington, DC: red-brick rowhouses with slate roofs, the white Capitol dome above autumn trees, the Washington Monument and the Potomac River', '#F3F1EB')
A = c.A
GROUND = 252

# ---------- sky: a pale sun and a few birds ----------
A('<circle cx="1080" cy="70" r="20" fill="#F2D9A6"/>')
for x, y in [(990, 60), (1012, 48), (968, 82)]:
    A(f'<path d="M{x-7} {y} q4 -5 7 0 q3 -5 7 0" fill="none" stroke="{INK}" stroke-width="1.2" stroke-linecap="round"/>')

# ---------- the Potomac on the right, with the far (Virginia) bank ----------
A('<path d="M900 212 H1200 V300 H900 Z" fill="#7C9BAA"/>')
A('<path d="M900 212 H1200 V222 H900 Z" fill="#9DB6C1"/>')
for y, x0 in [(232, 960), (246, 1040), (258, 990), (270, 1100), (284, 1010), (240, 1140), (262, 1160)]:
    A(f'<path d="M{x0} {y} q10 -4 20 0 t20 0" fill="none" stroke="#D5E2E6" stroke-width="1.4" stroke-linecap="round"/>')
# far bank: a low line of trees in autumn colors
c.g(1.1)
c.path('M900 212 C930 196 960 200 990 192 C1030 182 1070 196 1110 188 C1150 182 1180 192 1200 186 V212 Z', fill='#B9A36E')
c.end()
for _ in range(16):
    x = 905 + r.random() * 290; y = 196 + r.random() * 10
    A(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{5 + r.random() * 6:.1f}" fill="{r.choice(["#C98B3A", "#B5652F", "#8E8B4E", "#D2A24C"])}" opacity=".9"/>')

# ---------- Washington Monument ----------
mx, top, base = 868, 40, 244
c.g(1.4)
c.path(f'M{mx-13} {base} L{mx-8.5} {top} H{mx+8.5} L{mx+13} {base} Z', fill='#F1ECE2')
c.path(f'M{mx-8.5} {top} L{mx} {top-20} L{mx+8.5} {top} Z', fill='#E6DFD1')
c.path(f'M{mx-11.5} {178} H{mx+11.5}', sw=.7)   # the faint change in stone about a third of the way up
c.path(f'M{mx-4} {top+16} h3 M{mx+1} {top+16} h3', sw=.8)   # observation windows
c.end()
# the flags ringing its base
for k in range(-3, 4):
    fx = mx + k * 9
    A(f'<path d="M{fx} {base+6} V{base-12}" stroke="{INK}" stroke-width=".7"/>')
    A(f'<path d="M{fx} {base-12} h6 v4 h-6" fill="#C9D3DA" stroke="{INK}" stroke-width=".5"/>')

# ---------- the Capitol ----------
cx = 610
c.g(1.3)
# wings and central block
c.rect(470, 196, 280, 46, '#EDE6D6')
c.path('M470 196 H750', sw=1.8)
for x in range(478, 746, 9):
    if 586 <= x <= 634:
        continue
    c.path(f'M{x} 200 V236', sw=.6)
# central portico with pediment
c.rect(584, 192, 52, 50, '#F4EFE3')
c.path(f'M578 192 L{cx} 176 L642 192 Z', fill='#F4EFE3')
for x in range(588, 636, 6):
    c.path(f'M{x} 196 V240', sw=.8)
# lower drum with its ring of columns
c.rect(cx - 64, 160, 128, 36, '#F7F5F0')
c.path(f'M{cx-68} 160 H{cx+68}', sw=1.8)
for x in range(cx - 60, cx + 61, 8):
    c.path(f'M{x} 163 V194', sw=.8)
# upper drum (attic) with small windows
c.rect(cx - 52, 146, 104, 14, '#EFEBE2')
for x in range(cx - 44, cx + 45, 12):
    c.rect(x - 2, 149, 4, 7, '#6E6A63', .6)
# the dome, its ribs, the lantern and the Statue of Freedom
c.path(f'M{cx-50} 146 C{cx-50} 114 {cx-30} 97 {cx-14} 93 H{cx+14} C{cx+30} 97 {cx+50} 114 {cx+50} 146 Z', fill='#F9F8F4', sw=1.5)
for k in (-34, -18, 0, 18, 34):
    tx = k * 0.32
    c.path(f'M{cx+k} 146 C{cx+k*0.95} 122 {cx+tx*1.6} 102 {cx+tx} 93', sw=.6)
c.path(f'M{cx-46} 128 C{cx-20} 124 {cx+20} 124 {cx+46} 128', sw=.6)
c.rect(cx - 10, 74, 20, 19, '#F7F5F0')
for x in (cx - 6, cx - 2, cx + 2, cx + 6):
    c.path(f'M{x} 77 V91', sw=.6)
c.path(f'M{cx-11} 74 C{cx-11} 66 {cx-4} 62 {cx} 61 C{cx+4} 62 {cx+11} 66 {cx+11} 74 Z', fill='#F9F8F4')
c.path(f'M{cx} 61 V50 M{cx-2.5} 54 H{cx+2.5}', sw=1.2)
c.end()

# ---------- autumn trees in front of the Capitol and along the Mall ----------
tree_cols = ['#C98B3A', '#B5652F', '#D2A24C', '#8E8B4E', '#A8743A', '#6E8B5A']
for k in range(11):
    tx = 440 + k * 46 + r.uniform(-8, 8)
    if 840 < tx < 896:
        continue
    ty = 226 + r.uniform(-8, 6)
    A(f'<path d="M{tx:.1f} {GROUND} V{ty+8:.1f}" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>')
    for _ in range(6):
        bx = tx + r.uniform(-20, 20); by = ty + r.uniform(-14, 8)
        A(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{r.uniform(9, 14):.1f}" fill="{r.choice(tree_cols)}" stroke="{INK}" stroke-width=".9"/>')

# ---------- Georgetown: red-brick Federal rowhouses with slate roofs ----------
bricks = ['#B5533C', '#A84A36', '#C2674A', '#9E4C3A', '#B85E45']
houses = [(-10, 110, 92), (100, 104, 74), (204, 116, 98), (320, 104, 80)]
for i, (x, w, top) in enumerate(houses):
    brick = bricks[i % len(bricks)]
    c.g(1.4)
    # slate roof with dormers and chimneys
    roof_top = top - 30
    c.path(f'M{x-4} {top} L{x+12} {roof_top} H{x+w-12} L{x+w+4} {top} Z', fill='#5E6670')
    for k in range(1, 5):
        c.path(f'M{x+6} {top-k*6} H{x+w-6}', sw=.45)
    dx = x + w / 2
    c.rect(dx - 10, roof_top - 4, 20, 22, '#F4EFE6', 1)
    c.path(f'M{dx-13} {roof_top-4} L{dx} {roof_top-14} L{dx+13} {roof_top-4} Z', fill='#5E6670', sw=1)
    c.rect(dx - 5, roof_top + 1, 10, 14, '#3B3632', .8)
    c.rect(x + 14, roof_top - 16, 12, 16, brick, 1)
    c.rect(x + w - 26, roof_top - 16, 12, 16, brick, 1)
    # brick front
    c.rect(x, top, w, GROUND - top, brick)
    c.path(f'M{x-3} {top+4} H{x+w+3}', sw=1.6)
    for yy in range(top + 14, GROUND - 4, 9):
        c.path(f'M{x+3} {yy} h{r.randint(6, 14)} M{x+w-22} {yy+4} h{r.randint(6, 12)}', sw=.35)
    # white sash windows with black shutters, two upper floors
    for row, wy in enumerate((top + 16, top + 16 + (GROUND - top - 70) / 2)):
        for k in (0.28, 0.72):
            wx = x + w * k
            c.rect(wx - 9, wy, 18, 26, '#F4EFE6', 1)
            c.path(f'M{wx-9} {wy+13} H{wx+9} M{wx} {wy} V{wy+26}', sw=.6)
            c.rect(wx - 16, wy, 6, 26, '#2E2A26', .6)
            c.rect(wx + 10, wy, 6, 26, '#2E2A26', .6)
            c.path(f'M{wx-11} {wy-3} H{wx+11}', sw=1.4)
    # front door with fanlight and white steps
    ddx = x + (w * 0.3 if i % 2 else w * 0.7)
    c.path(f'M{ddx-10} {GROUND-4} V{GROUND-34} a10 10 0 0 1 20 0 V{GROUND-4} Z', fill=['#2F4A3A', '#1F2E3D', '#5A2A26', '#2E2A26'][i % 4])
    c.path(f'M{ddx-10} {GROUND-34} H{ddx+10}', sw=.7)
    c.path(f'M{ddx-14} {GROUND-4} H{ddx+14} V{GROUND} H{ddx-14} Z', fill='#E6E1D6', sw=.9)
    # ground-floor window on the other side
    gx = x + (w * 0.72 if i % 2 else w * 0.28)
    c.rect(gx - 9, GROUND - 40, 18, 26, '#F4EFE6', 1)
    c.path(f'M{gx-9} {GROUND-27} H{gx+9} M{gx} {GROUND-40} V{GROUND-14}', sw=.6)
    c.end()
# a gas-style street lamp
lx = 432
A(f'<g stroke="{INK}" stroke-linecap="round" stroke-linejoin="round"><path d="M{lx} {GROUND} V{GROUND-58}" stroke-width="2.2"/><path d="M{lx-7} {GROUND-58} h14 l-3 -14 h-8 Z" fill="#F2D9A6" stroke-width="1"/><path d="M{lx-5} {GROUND-72} L{lx} {GROUND-78} L{lx+5} {GROUND-72}" fill="none" stroke-width="1"/></g>')

# ---------- ground: brick sidewalk under the houses, grass along the Mall ----------
A(f'<rect x="0" y="{GROUND}" width="450" height="{H-GROUND}" fill="#C98A6E"/>')
for row in range(4):
    y = GROUND + 4 + row * 11
    off = (row % 2) * 10
    for x in range(0, 440, 20):
        A(f'<rect x="{x+off}" y="{y}" width="17" height="8" fill="#D9A086"/>')
A(f'<rect x="450" y="{GROUND}" width="450" height="{H-GROUND}" fill="#8E9A63"/>')
A(f'<path d="M450 {GROUND+18} C560 {GROUND+14} 700 {GROUND+22} 900 {GROUND+16}" fill="none" stroke="#E6DCC6" stroke-width="10"/>')   # gravel path on the Mall
A(f'<path d="M0 {GROUND} H900" stroke="{INK}" stroke-width="1.6"/>')

c.save(sys.argv[1])
