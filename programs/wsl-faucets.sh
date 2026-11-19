#!/bin/bash
set -euo pipefail
source "$HOME/.cargo/env"
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/sysroot/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
echo "=== short d ==="
devnet-pow get-all-faucets -u d -k "$HOME/.config/solana/id.json" || true
echo "=== https ==="
devnet-pow get-all-faucets -u https://api.devnet.solana.com -k "$HOME/.config/solana/id.json" || true
echo FAUCETS_DONE
