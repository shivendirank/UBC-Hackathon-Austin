#!/bin/bash
set -euo pipefail
mkdir -p "$HOME/debs" "$HOME/sysroot"
cd "$HOME/debs"
apt-get download libc6-dev linux-libc-dev libc-dev-bin libgcc-15-dev
for deb in *.deb; do
  dpkg-deb -x "$deb" "$HOME/sysroot"
done
find "$HOME/sysroot" \( -name 'Scrt1.o' -o -name 'crtbeginS.o' -o -name 'libgcc.a' -o -name 'libc.so' \) -print
echo EXTRACT_OK
