import asyncio
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
# Usage: python3 tools/test/check_destinations.py [destination-id ...]   (default: every destination in source/shell/destinations.json)
async def run(br, dest, w, h, tag):
    ctx=await br.new_context(viewport={'width':w,'height':h}, device_scale_factor=1)
    await ctx.route('**/core/vendor/firebase/firebase.js*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=FAKE))
    await ctx.route('**/__fake/**', backend)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'pmtiles' not in m.text and '404' not in m.text else None)
    await pg.goto(B+'?d='+dest); await pg.wait_for_timeout(1500)
    await pg.fill('#welcome input[data-bind="traveler_name"]','Maya')
    await pg.click('#welcome button:has-text("Next")'); await pg.wait_for_timeout(300)
    await pg.fill('#welcome [data-bind="dates.start"]','2026-12-26'); await pg.locator('#welcome [data-bind="dates.start"]').dispatch_event('change')
    await pg.fill('#welcome [data-bind="dates.end"]','2027-01-02'); await pg.locator('#welcome [data-bind="dates.end"]').dispatch_event('change')
    for _ in range(3):
        if await pg.locator('#welcome button:has-text("Done")').count(): await pg.click('#welcome button:has-text("Done")'); break
        await pg.click('#welcome button:has-text("Next")'); await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(800)
    ok=[]
    for t in ['today','plan','places','guide','trip']:
        await pg.click(f'#tab-{t}'); await pg.wait_for_timeout(600)
        vis = await pg.evaluate("[...document.querySelectorAll('section[data-tab]')].filter(s=>!s.hidden).map(s=>s.dataset.tab).join(',')")
        ok.append(f'{t}:{vis}')
        await pg.screenshot(path=os.path.join(SHOTS, f'{dest}-{tag}-{t}.png'))
    await pg.click('#tab-today'); await pg.wait_for_timeout(400)
    cover = await pg.evaluate("!!document.querySelector('.dcover')")
    print(f'{dest} {tag}: cover={cover} | ' + ' '.join(ok) + f' | errors={errs[:2]}')
    await ctx.close()
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path=CHROME) if CHROME else await p.chromium.launch()
        ids=sys.argv[1:] or [d['id'] for d in json.load(open(os.path.join(ROOT,'source/shell/destinations.json')))['destinations']]
        for d in ids:
            await run(br,d,390,844,'phone'); await run(br,d,1366,860,'desk')
        await br.close()
asyncio.run(main())
