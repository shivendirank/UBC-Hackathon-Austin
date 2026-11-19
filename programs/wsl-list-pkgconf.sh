#!/bin/bash
set -euo pipefail
curl -fsSL http://archive.ubuntu.com/ubuntu/pool/main/p/pkgconf/ -o "$HOME/pkgconf.html"
grep -oE '[A-Za-z0-9.+~_-]+_amd64\.deb' "$HOME/pkgconf.html" | sort -u
