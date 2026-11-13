"""Draw every destination cover (Nov 2026): flat drawing first, then the light pen-sketch pass.

    python3 tools/covers/make_covers.py

Writes the finished SVGs into source/destinations/<dir>/art/. Each city turns its cover on with "cover" in cities.json.
"""
import subprocess, sys, tempfile, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE.parent.parent / 'source' / 'destinations'
COVERS = [   # script, destination folder, file name, extra sketch options
    ('make_puerto_rico_cover.py', 'puerto-rico', 'san-juan-cover.svg', ['--san-juan']),
    ('make_florence_cover.py', 'firenze', 'florence-cover.svg', []),
    ('make_lisbon_cover.py', 'portugal', 'lisbon-cover.svg', []),
    ('make_algarve_cover.py', 'portugal', 'algarve-cover.svg', []),
]
with tempfile.TemporaryDirectory() as tmp:
    for script, d, name, opts in COVERS:
        flat = pathlib.Path(tmp) / name
        subprocess.run([sys.executable, str(HERE / script), str(flat)], cwd=HERE, check=True)
        subprocess.run([sys.executable, str(HERE / 'sketchify.py'), str(flat), str(ART / d / 'art' / name)] + opts, cwd=HERE, check=True)
