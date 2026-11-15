#!/bin/sh
# Download the raw terrain and illumination inputs into data/raw/ and verify them against data/CHECKSUMS.md5.
set -eu
cd "$(dirname "$0")/.."
PDS=https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr
PGDA=http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG
mkdir -p data/raw/lola data/raw/pgda
for f in polar/img/ldem_85s_40m polar/img/ldem_75s_240m cylindrical/img/ldem_16; do
  b=$(basename "$f")
  [ -f "data/raw/lola/$b.img" ] || curl -fsS -o "data/raw/lola/$b.img" "$PDS/$f.img"
  [ -f "data/raw/lola/$b.lbl" ] || curl -fsS -o "data/raw/lola/$b.lbl" "$PDS/$f.lbl"
done
for f in AVGVISIB_85S_060M_201608 AVGVISIB_85S_060M_201608_EARTH; do
  for e in IMG LBL; do [ -f "data/raw/pgda/$f.$e" ] || curl -fsS -o "data/raw/pgda/$f.$e" "$PGDA/$f.$e"; done
done
(cd data/raw/lola && grep -i 'ldem' ../../CHECKSUMS.md5 | md5sum -c -)
(cd data/raw/pgda && grep 'AVGVISIB' ../../CHECKSUMS.md5 | md5sum -c -)
