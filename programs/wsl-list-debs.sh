#!/bin/bash
set -euo pipefail
curl -fsSL http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/ -o /tmp/openssl.html
grep -o 'libssl-dev_[^"]*amd64.deb' /tmp/openssl.html | sort -u | tail -n 15
echo ----
curl -fsSL http://archive.ubuntu.com/ubuntu/pool/main/p/pkgconf/ -o /tmp/pkgconf.html
grep -o 'pkgconf_[^"]*amd64.deb' /tmp/pkgconf.html | sort -u | tail -n 10
echo ----
grep -o 'libssl3t64_[^"]*amd64.deb' /tmp/openssl.html | sort -u | tail -n 8
