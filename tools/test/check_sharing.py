import asyncio, json, re, datetime, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
# Sharing test on Puerto Rico: start a trip, join with a code, private items stay private, saved places shared,
# personal code (phone makes it, laptop enters it, wrong code refused). Expect every errors list at the end to be [].
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path=CHROME)
        A=await phone(br,'A'); await A.clock.set_fixed_time(datetime.datetime(2026,11,20,19,0))
        await A.goto(B+'?d=puerto-rico'); await A.wait_for_timeout(1500)
        await A.fill('#welcome input[data-bind="traveler_name"]','Maya')
        await A.click('#welcome button:has-text("Next")'); await A.wait_for_timeout(300)
        # trip dates only, no stay
        await A.fill('#welcome [data-bind="dates.start"]','2026-12-26'); await A.locator('#welcome [data-bind="dates.start"]').dispatch_event('change')
        await A.fill('#welcome [data-bind="dates.end"]','2027-01-02'); await A.locator('#welcome [data-bind="dates.end"]').dispatch_event('change')
        for _ in range(3):
            if await A.locator('#welcome button:has-text("Done")').count(): await A.click('#welcome button:has-text("Done")'); break
            await A.click('#welcome button:has-text("Next")'); await A.wait_for_timeout(300)
        await A.wait_for_timeout(800)
        hs = await A.evaluate("[...document.querySelectorAll('section[data-tab=today] h2, section[data-tab=today] .choose > b')].map(h=>h.innerText)")
        print('Today order:', hs[:6])
        print('install tip small:', await A.locator('[data-act="dismissinstall"]').count(), '| big card gone:', 'Install Wanderings' not in await A.inner_text('section[data-tab=today]'))
        await A.screenshot(path=os.path.join(SHOTS,'q-today.png'), full_page=True)
        cnt = lambda: A.evaluate("(document.querySelector('section[data-tab=today] .head .small')||{}).innerText||''")
        print('count before:', await cnt())
        await A.evaluate("()=>{const w=window.__wanderings; w.S.trip.booked.push('pr-biobay-boat'); }"); await A.click('#tab-plan'); await A.click('#tab-today'); await A.wait_for_timeout(600)
        print('count after booking electric boat:', await cnt(), '| laguna still listed:', 'Laguna Grande' in await A.inner_text('section[data-tab=today]'))
        # Plan without stays
        await A.click('#tab-plan'); await A.wait_for_timeout(700)
        days = await A.evaluate("document.querySelectorAll('section[data-tab=plan] [data-act=\"pday\"], section[data-tab=plan] .daystrip button').length")
        print('Plan days without a stay:', days, '| share button:', await A.locator('[data-act="planshare"]').count())
        # Explore -> Want to go -> Plan (schedule El Morro on day 2)
        await A.evaluate("()=>{const w=window.__wanderings; w.S.trip.saved.push({id:'pr-morro',status:'want'}); w.S.trip.plan.push({item_id:'pr-morro',date:'2026-12-27',time:'10:00'}); w.S.afterSave&&w.S.afterSave();}")
        # share from plan
        await A.evaluate("()=>{ navigator.share = undefined; }")
        await A.click('#tab-plan'); await A.wait_for_timeout(500)
        await A.click('[data-act="planshare"]'); await A.wait_for_timeout(2500)
        clip = await A.evaluate("navigator.clipboard.readText()"); print('INVITE:\n'+clip)
        link = re.search(r'(http\S+\?join=\S+)', clip).group(1)
        await A.screenshot(path=os.path.join(SHOTS,'q-plan.png'))
        # Fresh browser, open link, no install
        F=await phone(br,'F'); await F.goto(link); await F.wait_for_selector('#liveName', timeout=15000)
        await F.fill('#liveName','Leo'); await F.click('[data-act="livepick"][data-id=""]'); await F.wait_for_timeout(1500)
        await F.click('#tab-plan'); await F.wait_for_timeout(800)
        ptxt = await F.inner_text('section[data-tab=plan]')
        print('Fresh browser sees plan:', 'Morro' in ptxt, '| days:', await F.evaluate("window.__wanderings.S.trip.dates"))
        await F.screenshot(path=os.path.join(SHOTS,'q-fresh.png'))
        # cross-device: F adds plan item + shared booking; A adds a private item; A changes trip dates? 
        await F.evaluate("()=>{const w=window.__wanderings; w.S.trip.plan.push({item_id:'pr-foodtour',date:'2026-12-30'}); w.S.trip.bookings.push({id:'bk1',kind:'tour',title:'Food tour',date:'2026-12-30',ref:'SECRET',share:true}); w.S.afterSave();}")
        await A.evaluate("()=>{const w=window.__wanderings; w.S.trip.plan.push({item_id:'pr-cerra',date:'2026-12-29',private:true}); w.S.afterSave();}")
        await A.wait_for_timeout(2500); await F.wait_for_timeout(500)
        print('A plan:', await A.evaluate("()=>window.__wanderings.S.trip.plan.map(x=>x.item_id)"), '| A bookings:', await A.evaluate("()=>window.__wanderings.S.trip.bookings.map(b=>b.title+' ref='+(b.ref||''))"))
        print('F plan (private item hidden?):', await F.evaluate("()=>window.__wanderings.S.trip.plan.map(x=>x.item_id)"), '| A people:', await A.evaluate("()=>window.__wanderings.S.trip.people.map(x=>x.name)"))
        # shared favorites: A saves a place; F sees who saved it
        await A.evaluate("()=>{const w=window.__wanderings; w.S.trip.saved.push({place_id:'pr-yunque',status:'want'}); w.S.afterSave();}")
        await A.wait_for_timeout(2000); await F.click('#tab-today'); await F.click('#tab-plan'); await F.wait_for_timeout(800)
        print('F group_saved:', await F.evaluate("()=>window.__wanderings.S.trip.group_saved"), '| tray note:', 'Maya saved this' in await F.inner_text('section[data-tab=plan]')); await F.locator('text=Maya saved this').first.scroll_into_view_if_needed(); await F.screenshot(path=os.path.join(SHOTS,'m-tray.png'))
        # personal code: F creates one, then a laptop L enters it
        await F.evaluate("()=>{const w=window.__wanderings; w.S.trip.journal.push({id:'jf1',d:Date.now(),txt:'Mofongo at the corner place',place_id:'',place:'',city_id:'',stars:5,photos:['ph1']}); w.S.trip.favs.push('hola'); w.S.afterSave();}")
        await F.click('#tab-trip'); await F.wait_for_timeout(600)
        await F.click('#mineBlock summary'); await F.click('[data-act="minemake"]'); await F.wait_for_timeout(2000)
        code = await F.evaluate("()=>localStorage.getItem('wanderings-mycode')"); print('code:', code)
        await F.locator('#mineBlock').screenshot(path=os.path.join(SHOTS,'m-code.png'))
        L=await phone(br,'L'); await L.set_viewport_size({'width':1366,'height':860}); await L.goto(B+'?d=puerto-rico'); await L.wait_for_timeout(1200)
        await welcome(L,'Leo','2026-12-26','2027-01-02')
        await L.click('#tab-trip'); await L.wait_for_timeout(500); await L.click('#mineBlock summary')
        await L.fill('#mineIn', code.lower()); await L.click('[data-act="mineuse"]'); await L.wait_for_timeout(2500)
        print('L journal:', await L.evaluate("()=>window.__wanderings.S.trip.journal.map(e=>e.txt+' photos='+e.photos.length)"), '| L favs:', await L.evaluate("()=>window.__wanderings.S.trip.favs"))
        await L.evaluate("()=>{const w=window.__wanderings; w.S.trip.journal.push({id:'jl1',d:Date.now(),txt:'Sunset from the laptop',photos:[]}); w.S.afterSave();}")
        await L.wait_for_timeout(2500); await F.wait_for_timeout(500)
        print('F journal after laptop entry:', await F.evaluate("()=>window.__wanderings.S.trip.journal.map(e=>e.txt+' photos='+e.photos.length)"))
        bad = await F.evaluate("()=>localStorage.setItem('x','')") 
        L2=await phone(br,'L2'); await L2.goto(B+'?d=puerto-rico'); await L2.wait_for_timeout(1000); await welcome(L2,'X','2026-12-26','2027-01-02')
        await L2.click('#tab-trip'); await L2.click('#mineBlock summary'); await L2.fill('#mineIn','WRONG-AAAAA-BBBBB'); await L2.click('[data-act="mineuse"]'); await L2.wait_for_timeout(1500)
        print('wrong code msg:', (await L2.inner_text('#mineBlock'))[-60:].replace('\n',' '))
        print('personal docs:', sorted(k for k in DB if k.startswith('personal/')))
        for pg in (A,F,L,L2): print(pg.errs[:4])
        await br.close()
asyncio.run(main())
