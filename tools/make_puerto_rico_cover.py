import random
random.seed(7)
W,H=1200,300
INK='#2E2A26'
o=[]
A=o.append
A(f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Line drawing of Old San Juan: plastered colonial houses with balconies on a blue cobblestone street, the city wall and a garita above a peacock-blue sea">')
A(f'<rect width="{W}" height="{H}" fill="#FBF3EA"/>')
# sea on the right, horizon
A('<path d="M760 168 H1200 V300 H760 Z" fill="#00677A"/>')
A('<path d="M760 168 H1200 V186 H760 Z" fill="#2E8C98"/>')
for y,x0,x1 in [(184,960,0),(196,1060,0),(206,1140,0),(190,1150,0),(178,880,0),(214,1180,0)]:
    A(f'<path d="M{x0} {y} q10 -5 20 0 t20 0 t20 0" fill="none" stroke="#9ED3D6" stroke-width="1.6" stroke-linecap="round"/>')
# sun and birds
A('<circle cx="1105" cy="78" r="22" fill="#F4C46A"/>')
for x,y in [(1010,70),(1035,58),(980,92)]:
    A(f'<path d="M{x-7} {y} q4 -5 7 0 q3 -5 7 0" fill="none" stroke="{INK}" stroke-width="1.3" stroke-linecap="round"/>')
# city wall: sloping stone wall from the houses down to the sea
# the wall: top edge falls from the houses toward the sea; rocks and surf at its foot
WY=lambda x: 150+(x-760)*0.36
A(f'<path d="M760 150 L1200 {WY(1200):.0f} L1200 300 H760 Z" fill="#EAD6B8" stroke="{INK}" stroke-width="1.4" stroke-linejoin="round"/>')
A(f'<path d="M760 150 L1200 {WY(1200):.0f}" stroke="{INK}" stroke-width="2.4"/>')
A(f'<path d="M760 161 L1200 {WY(1200)+11:.0f}" stroke="{INK}" stroke-width="1"/>')
for i in range(10):
    x=800+i*44; y=WY(x)
    A(f'<path d="M{x} {y+16:.0f} V300" stroke="{INK}" stroke-width=".5" opacity=".45"/>')
for k in range(6):
    A(f'<path d="M770 {188+k*20} L1200 {188+k*20+(1200-770)*0.36:.0f}" stroke="{INK}" stroke-width=".5" opacity=".35"/>')
A('<path d="M760 300 C800 292 860 296 900 288 C960 278 1000 290 1060 282 C1120 274 1160 284 1200 278 V300 Z" fill="#00677A" opacity="0"/>')
# garita (sentry box) on the wall
gx=900; gy=round(150+(gx-760)*0.36)+2
A(f'<g stroke="{INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">')
A(f'<path d="M{gx-30} {gy} L{gx-22} {gy+22} H{gx+22} L{gx+30} {gy} Z" fill="#E3C79E"/>')   # corbel
A(f'<path d="M{gx-26} {gy} V{gy-62} H{gx+26} V{gy} Z" fill="#F3E2C4"/>')   # body
A(f'<path d="M{gx-30} {gy-62} H{gx+30} V{gy-70} H{gx-30} Z" fill="#E3C79E"/>')  # cornice
A(f'<path d="M{gx-26} {gy-70} C{gx-26} {gy-100} {gx-12} {gy-112} {gx} {gy-114} C{gx+12} {gy-112} {gx+26} {gy-100} {gx+26} {gy-70} Z" fill="#F3E2C4"/>')  # dome
A(f'<path d="M{gx-14} {gy-72} C{gx-13} {gy-95} {gx-6} {gy-106} {gx} {gy-110} M{gx+14} {gy-72} C{gx+13} {gy-95} {gx+6} {gy-106} {gx} {gy-110}" fill="none" stroke-width=".8"/>')
A(f'<circle cx="{gx}" cy="{gy-120}" r="5" fill="#F3E2C4"/><path d="M{gx} {gy-125} v-7" />')
A(f'<path d="M{gx-6} {gy-8} V{gy-38} a6 6 0 0 1 12 0 V{gy-8} Z" fill="#2E2A26"/>')   # slit door
A(f'<path d="M{gx-18} {gy-22} v-16 M{gx+18} {gy-22} v-16" stroke-width="1.4"/>')
for k in range(4):
    A(f'<path d="M{gx-22+k*2} {gy+6+k*4} H{gx+22-k*2}" stroke-width=".8"/>')
A('</g>')
# palm by the wall
px,py=800,252
A(f'<path d="M{px} {py} C{px+4} {py-40} {px+10} {py-80} {px+18} {py-120}" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>')
tx,ty=px+18,py-120
for dx,dy,cx,cy in [(-46,10,-26,-16),(-40,30,-30,4),(44,14,24,-16),(40,34,30,6),(-6,-34,-16,-22),(16,-30,12,-24)]:
    A(f'<path d="M{tx} {ty} Q{tx+cx} {ty+cy} {tx+dx} {ty+dy}" fill="none" stroke="#3E7D5A" stroke-width="5" stroke-linecap="round"/>')
    A(f'<path d="M{tx} {ty} Q{tx+cx} {ty+cy} {tx+dx} {ty+dy}" fill="none" stroke="{INK}" stroke-width=".8" stroke-linecap="round"/>')
# street of facades on the left
cols=['#E8957C','#F2C46D','#9FCBC4','#F4B98A','#E9A8B5','#F6DCA8','#D9826A','#B9D4E6']
shut=['#00677A','#2F6B4F','#004C59','#1F5F6B']
x=-10
i=0
widths=[118,96,128,104,120,110,116]
tops=[70,96,60,88,74,100,82]
while x<770:
    w=widths[i%len(widths)]; top=tops[i%len(tops)]
    if x+w>790: w=790-x
    col=cols[i%len(cols)]; sh=shut[i%len(shut)]
    A(f'<g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">')
    A(f'<rect x="{x}" y="{top}" width="{w}" height="{252-top}" fill="{col}" stroke-width="1.4"/>')
    # parapet and cornice
    A(f'<path d="M{x} {top+12} H{x+w}" stroke-width="1"/><path d="M{x-3} {top+18} H{x+w+3}" stroke-width="1.6"/>')
    if i%2==0:
        for k in range(3):
            bx=x+12+k*(w-24)/2
            A(f'<path d="M{bx-4} {top} v-8 h8 v8" fill="none" stroke-width="1"/>')
    # floor band
    mid=top+(252-top)*0.5
    A(f'<path d="M{x} {mid} H{x+w}" stroke-width="1.1"/>')
    # upper windows with shutters and balcony
    n=2 if w>100 else 1
    for k in range(n):
        cx=x+w*(k+1)/(n+1); ww=20; wy=top+28; wh=mid-wy-10
        A(f'<rect x="{cx-ww/2}" y="{wy}" width="{ww}" height="{wh}" fill="#3B3632" stroke-width="1"/>')
        A(f'<rect x="{cx-ww/2-10}" y="{wy}" width="9" height="{wh}" fill="{sh}" stroke-width="1"/><rect x="{cx+ww/2+1}" y="{wy}" width="9" height="{wh}" fill="{sh}" stroke-width="1"/>')
        for s in range(1,int(wh//6)):
            A(f'<path d="M{cx-ww/2-9} {wy+s*6} h7 M{cx+ww/2+2} {wy+s*6} h7" stroke-width=".5" stroke="#FBF3EA" opacity=".7"/>')
        by=mid-4
        A(f'<path d="M{cx-22} {by} H{cx+22} M{cx-22} {by-14} H{cx+22} M{cx-22} {by} V{by-14} M{cx+22} {by} V{by-14}" stroke-width="1.2"/>')
        for s in range(1,8):
            A(f'<path d="M{cx-22+s*5.5} {by} v-14" stroke-width=".7"/>')
        A(f'<path d="M{cx-25} {by+1} H{cx+25}" stroke-width="2"/>')
    # ground floor: arched door and window
    dx=x+w*0.32 if n==2 else x+w/2
    A(f'<path d="M{dx-12} 252 V{mid+24} a12 12 0 0 1 24 0 V252 Z" fill="{sh}" stroke-width="1.2"/>')
    A(f'<path d="M{dx} 252 V{mid+16}" stroke-width=".8"/>')
    A(f'<path d="M{dx-12} {mid+24} h24" stroke-width=".7"/>')
    if n==2:
        wx=x+w*0.72
        A(f'<path d="M{wx-10} {232} V{mid+28} a10 10 0 0 1 20 0 V232 Z" fill="#3B3632" stroke-width="1"/><path d="M{wx-14} 233 h28" stroke-width="1.6"/>')
        for s in range(1,4): A(f'<path d="M{wx-10+s*5} 232 V{mid+22}" stroke-width=".6" stroke="#FBF3EA"/>')
    A('</g>')
    # bougainvillea on some
    if i%3==1:
        for _ in range(26):
            bx=x+w-6-random.random()*28; by=top+20+random.random()*40
            A(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{2+random.random()*2.5:.1f}" fill="{random.choice(["#C2185B","#D81B60","#AD1457"])}" opacity=".85"/>')
        A(f'<path d="M{x+w-10} {top+22} C{x+w-4} {top+60} {x+w-14} {top+90} {x+w-6} 252" fill="none" stroke="#3E7D5A" stroke-width="1.6"/>')
    x+=w; i+=1
# blue cobblestones (adoquines)
A('<rect x="0" y="252" width="790" height="48" fill="#5E7F94"/>')
A(f'<path d="M0 252 H790" stroke="{INK}" stroke-width="1.6"/>')
for r in range(4):
    y=256+r*11
    off=(r%2)*9
    for c in range(0,790-24,18):
        A(f'<rect x="{c+off}" y="{y}" width="15" height="8" rx="3" fill="#7896AA"/>')
A('</svg>')
open(__import__('pathlib').Path(__file__).resolve().parent.parent / 'source/destinations/puerto-rico/art/san-juan-cover.svg','w').write('\n'.join(o))
