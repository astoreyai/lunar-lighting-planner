"""Fetch hourly sub-Earth and sub-solar points on the Moon from JPL Horizons and pack them per year.

Horizons observer table: target Moon (301), observer geocentre (500@399), quantities 14 (sub-observer
lon/lat = the Earth's direction in MOON_ME), 15 (sub-solar lon/lat), 19 (Sun range r), 20 (Earth range
delta). Raw responses are cached in data/raw/horizons/<year>.txt, so a rerun makes no requests.

Output web/data/ephem/<year>.bin: little-endian float32 rows, one per hour from <year>-01-01 00:00 UT to
<year+1>-01-01 00:00 UT inclusive, columns [earth_lon, earth_lat, earth_km, sun_lon, sun_lat, sun_km].
"""

import struct
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/horizons"
OUT = ROOT / "web/data/ephem"
AU_KM = 149597870.7
API = "https://ssd.jpl.nasa.gov/api/horizons.api"


def fetch(year: int) -> str:
    path = RAW / f"{year}.txt"
    if path.exists():
        return path.read_text()
    q = {
        "format": "text", "COMMAND": "'301'", "CENTER": "'500@399'", "EPHEM_TYPE": "'OBSERVER'",
        "START_TIME": f"'{year}-01-01 00:00'", "STOP_TIME": f"'{year + 1}-01-01 00:00'",
        "STEP_SIZE": "'1 h'", "QUANTITIES": "'14,15,19,20'", "CSV_FORMAT": "'YES'",
        "ANG_FORMAT": "'DEG'", "TIME_TYPE": "'UT'", "EXTRA_PREC": "'YES'",
    }
    with urllib.request.urlopen(f"{API}?{urllib.parse.urlencode(q)}", timeout=300) as r:
        text = r.read().decode()
    if "$$SOE" not in text:
        raise RuntimeError(f"{year}: no data block in Horizons response:\n{text[:2000]}")
    path.write_text(text)
    time.sleep(2)  # be polite to the shared service
    return text


def parse(text: str) -> list[tuple[float, ...]]:
    assert "Target pole/equ : MOON_ME" in text, "unexpected Moon frame"
    block = text.split("$$SOE")[1].split("$$EOE")[0]
    rows = []
    for line in block.strip().splitlines():
        f = [c.strip() for c in line.split(",")]
        e_lon, e_lat, s_lon, s_lat, r_au, delta_au = (float(f[i]) for i in (3, 4, 5, 6, 7, 9))
        rows.append((e_lon, e_lat, delta_au * AU_KM, s_lon, s_lat, r_au * AU_KM))
    return rows


def main(first: int, last: int) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for year in range(first, last + 1):
        rows = parse(fetch(year))
        hours = (366 if year % 4 == 0 and (year % 100 or year % 400 == 0) else 365) * 24
        assert len(rows) == hours + 1, f"{year}: {len(rows)} rows, expected {hours + 1}"
        (OUT / f"{year}.bin").write_bytes(b"".join(struct.pack("<6f", *r) for r in rows))
        print(year, len(rows), flush=True)


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]))
