#!/bin/bash
set -euo pipefail
cd "$HOME/debs"
curl -fL -O http://archive.ubuntu.com/ubuntu/pool/main/l/linux/linux-libc-dev_7.0.0-44.44_amd64.deb
dpkg-deb -x linux-libc-dev_7.0.0-44.44_amd64.deb "$HOME/sysroot"
test -f "$HOME/sysroot/usr/include/linux/limits.h"
echo LINUX_HEADERS_OK
