import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
# Typing a date on a computer: Chrome fires a change on every key, so 2026 passes through 0002, 0020, 0202.
# Checks that a short year never gets saved, 26 becomes 2026, an unfinished year goes back, and a birthday can be added.
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path=CHROME) if CHROME else await p.chromium.launch()
        ctx=await br.new_context(viewport={'width':1366,'height':860})
        await ctx.route('**/core/vendor/firebase/firebase.js*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=FAKE))
        await ctx.route('**/__fake/**', backend)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'?d=puerto-rico'); await pg.wait_for_timeout(1500)
        await pg.fill('#welcome input[data-bind="traveler_name"]','Maya'); await pg.click('#welcome button:has-text("Next")'); await pg.wait_for_timeout(300)
        await pg.fill('#welcome [data-bind="dates.start"]','2026-12-26'); await pg.locator('#welcome [data-bind="dates.start"]').dispatch_event('change')
        await pg.fill('#welcome [data-bind="dates.end"]','2027-01-02'); await pg.locator('#welcome [data-bind="dates.end"]').dispatch_event('change')
        for _ in range(3):
            if await pg.locator('#welcome button:has-text("Done")').count(): await pg.click('#welcome button:has-text("Done")'); break
            await pg.click('#welcome button:has-text("Next")'); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(600)
        await pg.click('#tab-trip'); await pg.wait_for_timeout(500)
        await pg.click('button:has-text("Add someone")'); await pg.wait_for_timeout(300)
        A='[data-bind="people.0.arrive"]'
        res={}
        # 1. type 12/28/2026 key by key
        await pg.locator(A).click(position={"x":12,"y":10})
        await pg.keyboard.type('12282026', delay=60); await pg.wait_for_timeout(300)
        res['full year typed']=await pg.evaluate("window.__wanderings.S.trip.people[0].arrive")
        # 2. two-digit year then leave the field
        await pg.locator(A).click(position={'x':12,'y':10}); [await pg.keyboard.press('ArrowLeft') for _ in range(3)]; await pg.keyboard.type('122926', delay=60); await pg.mouse.click(4, 600); await pg.wait_for_timeout(500)
        res['26 left as']=await pg.evaluate("window.__wanderings.S.trip.people[0].arrive")
        # 3. day typed, then year 2 and leave: the field shows the last good date (the day change, 12/30 2026), never year 0002
        await pg.locator(A).click(position={'x':12,'y':10}); [await pg.keyboard.press('ArrowLeft') for _ in range(3)]; await pg.keyboard.type('12302', delay=60); await pg.mouse.click(4, 600); await pg.wait_for_timeout(500)
        res['0002 left as']=await pg.evaluate("window.__wanderings.S.trip.people[0].arrive")
        # 4. add a birthday on the trip
        await pg.click('button:has-text("Add an occasion")'); await pg.wait_for_timeout(300)
        O='[data-bind="occasions.0.date"]'
        await pg.locator(O).click(position={'x':12,'y':10}); await pg.keyboard.type('12282026', delay=60); await pg.wait_for_timeout(300)
        res['birthday']=await pg.evaluate("window.__wanderings.S.trip.occasions[0].date")
        # 5. old data with year 0002 is cleaned on load
        await pg.evaluate("(async()=>{const t=window.__wanderings.S.trip; t.dates={start:'0002-12-28',end:'0002-12-28'}; localStorage.clear();})()")
        for k,v in res.items(): print(f'{k}: {v}')
        ok = res['full year typed']=='2026-12-28' and res['26 left as']=='2026-12-29' and res['0002 left as']=='2026-12-30' and res['birthday']=='2026-12-28'
        print('PASS' if ok else 'FAIL', 'errors=', errs[:2]); await br.close()
asyncio.run(main())
