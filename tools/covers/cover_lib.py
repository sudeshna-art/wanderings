"""Shared drawing helpers for the Wanderings destination covers (1200 x 300, phone crop keeps x 210 to 990).
Flat fills with ink outlines; tools/covers/sketchify.py adds the light pen-sketch pass afterwards."""
import random

INK = '#2E2A26'
W, H = 1200, 300


class Cover:
    def __init__(self, label, sky, seed=7):
        self.o = []
        self.r = random.Random(seed)
        self.A(f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="{label}">')
        self.A(f'<rect width="{W}" height="{H}" fill="{sky}"/>')

    def A(self, s):
        self.o.append(s)

    def g(self, sw=1.4):
        self.A(f'<g stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">')

    def end(self):
        self.A('</g>')

    def rect(self, x, y, w, h, fill, sw=1.2):
        self.A(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" stroke-width="{sw}"/>')

    def path(self, d, fill='none', sw=1.2, extra=''):
        self.A(f'<path d="{d}" fill="{fill}" stroke-width="{sw}"{extra}/>')

    def save(self, path):
        self.A('</svg>')
        open(path, 'w').write('\n'.join(self.o))


def window(c, cx, y, h, shutter, glass='#3B3632', ww=16, frame=None, open_shutters=True):
    """A tall window with louvred shutters on either side."""
    if frame:
        c.rect(cx - ww / 2 - 3, y - 3, ww + 6, h + 6, frame, 1)
    c.rect(cx - ww / 2, y, ww, h, glass, 1)
    if open_shutters and shutter:
        c.rect(cx - ww / 2 - 9, y, 8, h, shutter, 1)
        c.rect(cx + ww / 2 + 1, y, 8, h, shutter, 1)
        for s in range(1, int(h // 5)):
            c.A(f'<path d="M{cx - ww / 2 - 8:.1f} {y + s * 5} h6 M{cx + ww / 2 + 2:.1f} {y + s * 5} h6" stroke-width=".5" stroke="#FBF3EA" opacity=".6"/>')


def balcony(c, cx, by, half=20):
    c.path(f'M{cx - half:.1f} {by} H{cx + half:.1f} M{cx - half:.1f} {by - 12} H{cx + half:.1f} M{cx - half:.1f} {by} V{by - 12} M{cx + half:.1f} {by} V{by - 12}', sw=1.1)
    n = int(half * 2 // 5)
    for s in range(1, n):
        c.path(f'M{cx - half + s * (2 * half / n):.1f} {by} v-12', sw=.6)
    c.path(f'M{cx - half - 3:.1f} {by + 1} H{cx + half + 3:.1f}', sw=1.8)


def arched_door(c, cx, base, h, w, fill):
    r = w / 2
    c.path(f'M{cx - r:.1f} {base} V{base - h + r:.1f} a{r:.1f} {r:.1f} 0 0 1 {w:.1f} 0 V{base} Z', fill=fill, sw=1.1)
    c.path(f'M{cx:.1f} {base} V{base - h + r - 6:.1f}', sw=.7)


def tile_roof(c, x, w, top, fill, eave=6, pitch=10):
    """A shallow pitched tile roof seen from the street, with deep eaves and tile ridges."""
    c.path(f'M{x - eave:.1f} {top} L{x + w / 2:.1f} {top - pitch} L{x + w + eave:.1f} {top} Z', fill=fill, sw=1.2)
    c.path(f'M{x - eave:.1f} {top} H{x + w + eave:.1f}', sw=1.8)
    for k in range(1, int(w // 8)):
        xx = x + k * 8
        yy = top - pitch * (1 - abs(xx - (x + w / 2)) / (w / 2 + eave))
        c.path(f'M{xx:.1f} {top - 1:.1f} V{yy + 1.5:.1f}', sw=.5)


def cypress(c, x, base, h, fill='#3F5A3E'):
    c.path(f'M{x} {base} C{x - 7} {base - h * .35} {x - 5} {base - h * .8} {x} {base - h} C{x + 5} {base - h * .8} {x + 7} {base - h * .35} {x} {base} Z', fill=fill, sw=1)
