# Wanderings source (one app, Nov 2026)

- `core/`: the shared code, taken from the live Puerto Rico build of Oct 12 2026 (the newest core), with the version tags removed.
  Changes for one app: map files can live in another folder (`EDITION.mapsBase`, mappack-service), the header stamp and
  Essentials > Settings open the destination picker (`EDITION.multi`).
- `destinations/<dir>/`: each destination's settings, content and art, copied from the live folders (Firenze, Portugal, PuertoRico).
- `shell/`: the loader (`edition.config.js`) and the destination list (`destinations.json`).
- Build: `python3 tools/build_app.py` makes `app/`. The live folders Firenze/, Portugal/, PuertoRico/ are not touched.
