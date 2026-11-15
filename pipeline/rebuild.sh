#!/bin/sh
# Rebuild everything under web/data from the raw inputs and confirm it matches the shipped manifest.
#   1. raw LOLA and PGDA files: downloaded if missing, verified against data/CHECKSUMS.md5
#   2. ephemeris: packed from the cached Horizons responses in data/raw/horizons (fetched if missing)
#   3. browser DEMs, per-site horizons, 40 m windows and tiles, horizon uncertainty levels
#   4. every file compared with web/data/manifest.json
# Needs node, python3, curl and md5sum. Takes a few seconds once the raw files are present.
set -eu
cd "$(dirname "$0")/.."
sh pipeline/fetch_raw.sh
python3 pipeline/fetch_ephem.py 1969 2040 > /dev/null
node pipeline/build_web_data.mjs > /dev/null
node pipeline/build_crops40.mjs > /dev/null
node pipeline/build_tiles40.mjs > /dev/null
node pipeline/build_uncertainty.mjs > /dev/null
node pipeline/manifest.mjs --check
