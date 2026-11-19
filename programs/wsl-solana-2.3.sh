#!/bin/bash
set -euo pipefail
curl -sSfL https://release.anza.xyz/v2.3.0/install | sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
cargo-build-sbf --version
