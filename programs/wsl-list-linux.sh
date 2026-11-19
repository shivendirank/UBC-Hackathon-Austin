#!/bin/bash
set -euo pipefail
curl -fsSL http://archive.ubuntu.com/ubuntu/pool/main/l/linux/ -o "$HOME/linux-pool.html"
grep -o 'linux-libc-dev_7[^"]*amd64.deb' "$HOME/linux-pool.html" | sort -u | tail -n 15
