#!/bin/bash
set -euo pipefail
dpkg -l | grep -E 'libssl|openssl' || true
cd "$HOME/debs"
base=http://archive.ubuntu.com/ubuntu/pool/main
curl -fL -O "$base/o/openssl/libssl-dev_3.5.5-1ubuntu3.7_amd64.deb"
curl -fL -O "$base/o/openssl/libssl3t64_3.5.5-1ubuntu3.7_amd64.deb"
curl -fL -O "$base/p/pkgconf/pkgconf_2.5.1-4_amd64.deb"
dpkg-deb -x libssl-dev_3.5.5-1ubuntu3.7_amd64.deb "$HOME/sysroot"
dpkg-deb -x libssl3t64_3.5.5-1ubuntu3.7_amd64.deb "$HOME/sysroot"
dpkg-deb -x pkgconf_2.5.1-4_amd64.deb "$HOME/sysroot"
echo ---- ldd
ldd "$HOME/sysroot/usr/bin/pkgconf" || true
find "$HOME/sysroot" -name 'openssl.pc' -o -name 'libssl.so' -o -name 'pkg-config' | head
echo OPENSSL_DEBS_OK
