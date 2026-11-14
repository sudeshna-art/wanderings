# Wanderings: how to work in this repo (playbook, Nov 13 2026)

Read this first in every new chat. It replaces re-exploring the code.

## What this is
- One travel web app (installable on a phone's home screen) with a destination picker: Firenze, Portugal (Lisboa and the Algarve), Puerto Rico. Washington, DC and San Francisco are next.
- Plain ES modules, no framework, no npm build. Shared code in `source/core/`, one folder per destination in `source/destinations/<dir>/`.
- Live preview: https://sudeshna-art.github.io/wanderings/app/ (GitHub Pages serves `app/` from `main`).
- Branches: `one-app` holds the source and the built `app/`. `main` is what's live: only the `app/` folder is copied over.
- Old pilot folders `Firenze/`, `Portugal/`, `PuertoRico/` at the root are still live for old links and hold the offline map files. Don't edit them.
- Family sharing and personal codes use Firebase project `wanderings-56894` (free Spark plan, anonymous sign-in, Firestore). Rules live in `firebase/firestore.rules`. Only the owner can publish rules: send her the file and tell her to paste it into Firestore > Rules > Publish.

## Who you're working for and the rules
The owner is a designer, not a developer. Explain choices in plain words, briefly.
- Explain major choices and tradeoffs before acting. Ask before any paid service or anything hard to undo or migrate.
- No fabricated facts. Every price, hour, phone number, booking rule and fee has a source and a checked date in the content.
- No em dashes in any user-facing text. Use local place names (Firenze, Lisboa).
- Keep the clean theme and the five tabs: Today, Plan, Explore, Guide, Trip.
- Keep token use low: read only the files you need, reuse existing destinations as templates, and don't re-read big JSON files you've already seen.
- Never write a real trip code or personal code into the repo, docs or examples. The repo is public. Use made-up examples like Beach-Trip-26.
- Never publish the owner's email address.

## One chat per city; shared code one chat at a time
- A city chat changes only `source/destinations/<dir>/`, its entry in `source/shell/destinations.json`, its cover script in `tools/covers/`, and the built `app/`.
- If a city needs a change to `source/core/` (the shared app), stop, describe the change and why, and ask the owner first. Core changes affect every city and every family member's phone.
- Before starting: `git pull` so you build on the latest. Before publishing: `git pull --rebase` again, in case another chat published in the meantime.

## Commands
```
python3 tools/build_app.py                          # builds app/ (keeps the Firebase settings even without .local/)
python3 tools/test/check_destinations.py            # every destination, phone 390x844 and laptop 1366x860, all 5 tabs
python3 tools/test/check_destinations.py washington-dc   # just one
python3 tools/test/check_sharing.py                 # trip codes, privacy, shared saved places, personal codes (stand-in Firebase)
```
- Screenshots land in `tools/test/shots/` (not committed). Look at them before saying something works.
- Tests need Playwright (`pip install playwright --break-system-packages`) and Chrome or `playwright install chromium`.
- Every line of output must end with `errors=[]` (or `[]` for the sharing test).

Publish (after tests pass), with the commit attribution lines the session asks for:
```
git add -A source tools app CLAUDE.md && git commit -m "..." && git push origin one-app
git checkout main && git pull --ff-only origin main && git checkout one-app -- app && git commit -m "..." && git push origin main && git checkout one-app
```
Pages takes about a minute. Check with WebFetch on `https://sudeshna-art.github.io/wanderings/app/sw.js?check=<anything>`: its first line shows the build version. The query string avoids a stale cached copy.

## Adding a destination (checklist)
Use the newest destination, `source/destinations/puerto-rico/`, as the template. Copy it, then replace its content. Don't copy its facts.

1. **Agree on scope with the owner first.** Areas covered, roughly 15 to 25 places, what the beta tester likes, their dates and neighborhood, and whether they get a trip code. Check the project doc `wanderings/editions/<city>/edition-plan.md` if there is one.
2. **Folder** `source/destinations/<dir>/` with:
   - `edition.config.js`: id, folder, name, `theme: 'clean'`, `country_label`, language, storage prefix `wanderings-<id>`.
   - `content/edition.json`: `edition_id`, name, tagline, language, `city_ids`, `modules`, `arrival_options`, `experience_themes`.
   - `content/cities.json`: city center, neighborhoods (used for the nearest-area guess from an address), currency, getting around, taxis, emergency card, `cover`.
   - `content/places.json`: must-sees, experiences, day trips. Each place has location, price with `checked` and `source`, booking status, tips. Use `booking_group` when two listings are the same booking.
   - `content/phrases.json`: only if the local language isn't English.
   - `content/essentials.json` and `content/maps.json`.
   - `art/`: `<city>-mark.svg` (small mark for the picker), `<city>-cover.svg`.
3. **English-speaking, US-dollar cities (DC, San Francisco).** Turn off phrases and currency in `edition.json` `modules`. Then check that the Guide tab hides the empty tiles. If it doesn't, that's a core change, so ask first.
4. **Register it.** Add an entry to `source/shell/destinations.json`: id, dir, title, sub, mark, maps, and a two-letter code (DC, SF). The code is the prefix that routes trip codes to the right city.
5. **Cover.** Write `tools/covers/make_<city>_cover.py` in the same light pen-sketch style (see `cover_lib.py`, the other cities' scripts and the project doc `wanderings/covers/README.md`), with a local palette.
   - Show it at phone and laptop widths and get the owner's approval before wiring it in.
6. **Maps.** Two options:
   - Ship with the online map only.
   - Have offline map packs built on the owner's Windows computer. The build server is blocked from the Claude workspace. The project doc `wanderings/tools/make-portugal-maps.ps1` is the script to copy; change its area list. Each pack must stay under 24 MB. The packs go in a root folder like `PuertoRico/maps/`, and `maps` in destinations.json points to it.
   - Ask the owner which she wants.
7. **Build and test.** Run `build_app.py`, `check_destinations.py` for the new city and all the others, and `check_sharing.py`. Read the screenshots: Today with cover, Plan, Explore, Guide, Trip, at both sizes.
8. **Publish**, confirm the version is live, then ask the owner to check on a real phone. iPhone: Safari, and the home-screen app separately. Android: Chrome.

## Quality checklist before you say "done"
- Every fact has a source and a checked date; no claims of live availability ("book ahead", never "available now").
- No em dashes: `grep -rn "—" source/destinations/<dir>` returns nothing.
- All five tabs render at both sizes, with no console errors and no empty tiles.
- "Book before you go" on Today only lists things that truly need a reservation or timed ticket.
- Other destinations still pass. The family's existing trip isn't touched: nothing in `firebase/` changed, or the owner was told to paste new rules.

## Sharing and privacy model (don't break it)
- Trip codes (`invites/`) join a device to a shared trip. Shared: plan items unless marked "Only me", people and dates, bookings the owner chose to share (never booking references), and saved "Want to go" places.
- Never shared with the group: journal, photos, phrase favorites, food notes, emergency contact, My drivers.
- Personal codes (`personal/{code}`, optional) carry one person's journal text and phrase favorites to their other devices. Photos stay on the device. Logic: `source/core/models/mine.js` and `source/core/ui/screens/mine.js`.
- On iPhone, Safari and the home-screen app keep separate storage. A code has to be entered once in each.
