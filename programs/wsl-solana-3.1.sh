#!/bin/bash
set -euo pipefail
curl -sSfL https://release.anza.xyz/v3.1.10/install | sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
cargo-build-sbf --version
