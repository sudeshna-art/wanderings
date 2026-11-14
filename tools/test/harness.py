"""Wanderings test harness (Nov 2026). Serves the repo on localhost:8765 and stands in for Firebase
(fake_firebase.js + backend() below, which mimics firebase/firestore.rules), so sharing and personal codes
can be tested without the real project. Used by check_destinations.py and check_sharing.py.
Needs: pip install playwright --break-system-packages; Chrome or `playwright install chromium`. Build first: python3 tools/build_app.py"""
import asyncio, json, re
from playwright.async_api import async_playwright
import os, threading, functools, http.server, socketserver
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(os.path.dirname(HERE))
SHOTS=os.path.join(HERE,'shots'); os.makedirs(SHOTS, exist_ok=True)
PORT=8765; B=f'http://localhost:{PORT}/app/'
CHROME='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h=functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address=True
    try: s=socketserver.TCPServer(('', PORT), h)
    except OSError: return   # already running
    s.handle_error=lambda *a: None
    threading.Thread(target=s.serve_forever, daemon=True).start()
serve()
DB={}; MAIL={}
def member(path, uid):
    m=re.match(r'personal/([^/]+)/', path)
    if m: return f'personal/{m.group(1)}' in DB
    m=re.match(r'trips/([^/]+)', path); return m and f'trips/{m.group(1)}/members/{uid}' in DB
async def backend(route):
    req=route.request; op=req.url.split('/__fake/')[1]; b=json.loads(req.post_data or '{}'); uid=b.get('uid'); res={}
    if op=='sendlink': MAIL[b['email']]=b['url']
    elif op=='get':
        p=b['path']
        if p.startswith('invites/') or p.count('/')==1 and p.startswith('personal/') or member(p, uid): res={'data':DB.get(p)}
        else: res={'error':'permission-denied'}
    elif op=='set':
        p=b['path']; d=b['data']
        ok = (p.startswith('personal/') and p.count('/')==1 and len(p)>=21) or p.startswith('trips/') and ('/members/' in p and (p.endswith(uid) and (DB.get(p.split('/members/')[0],{}).get('created_by')==uid or (DB.get('invites/'+str(d.get('code')),{}).get('trip')==p.split('/')[1]))) or (p.count('/')==1 and d.get('created_by')==uid)) or (p.startswith('invites/') and member('trips/'+d['trip'], uid))
        if (p.startswith('invites/') or p.startswith('personal/')) and p in DB: ok=False   # codes can only be created, never overwritten
        if ok: DB[p]=d
        else: res={'error':'permission-denied'}
    elif op=='del':
        if b['path'].startswith('invites/') and DB.get(b['path'],{}).get('by_uid')==uid: DB.pop(b['path'],None)
        else: res={'error':'permission-denied'}
    elif op=='batch':
        for o in b['ops']:
            if not member(o[1], uid): res={'error':'permission-denied'}; continue
            if o[0]=='set': DB[o[1]]=o[2]
            else: DB.pop(o[1],None)
    elif op=='list':
        if not member(b['path'], uid): res={'error':'permission-denied'}
        else: res={'docs':{k.split('/')[-1]:v for k,v in DB.items() if k.startswith(b['path']+'/') and k.count('/')==b['path'].count('/')+1}}
    await route.fulfill(status=200, content_type='application/json', body=json.dumps(res))
FAKE=open(os.path.join(HERE,'fake_firebase.js')).read()
async def phone(br, name):
    ctx=await br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
    await ctx.route('**/__fake/**', backend)
    await ctx.route('**/core/vendor/firebase/firebase.js*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=FAKE))
    await ctx.grant_permissions(['clipboard-read','clipboard-write'])
    pg=await ctx.new_page(); pg.errs=[]
    pg.on('pageerror', lambda e: pg.errs.append(name+' PAGEERR '+str(e)))
    pg.on('console', lambda m: pg.errs.append(name+' '+m.text) if m.type=='error' else None)
    return pg
async def welcome(pg, nm, start, end):
    await pg.fill('#welcome input[data-bind="traveler_name"]', nm)
    await pg.click('#welcome button:has-text("Next")'); await pg.wait_for_timeout(300)
    await pg.fill('[data-bind="stays.0.start"]', start); await pg.locator('[data-bind="stays.0.start"]').dispatch_event('change')
    await pg.fill('[data-bind="stays.0.end"]', end); await pg.locator('[data-bind="stays.0.end"]').dispatch_event('change')
    for _ in range(3):
        if await pg.locator('#welcome button:has-text("Done")').count(): await pg.click('#welcome button:has-text("Done")'); break
        await pg.click('#welcome button:has-text("Next")'); await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(500)
