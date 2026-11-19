#!/bin/bash
set -euo pipefail
source "$HOME/.cargo/env"
export PATH="$HOME/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.local/bin:$PATH"
export CC="$HOME/bin/cc"
export CXX="$HOME/bin/cc"
export CARGO_TARGET_DIR="$HOME/thin-ice-target"
mkdir -p "$HOME/.config/solana"
if [ ! -e "$HOME/.config/solana/id.json" ]; then
  ln -s /mnt/c/Users/HEET/.config/solana/id.json "$HOME/.config/solana/id.json"
fi
cd /mnt/c/Users/HEET/OneDrive/Documents/UBC-Hackathon-Austin-1/programs
echo "odds_receipt $(solana-keygen pubkey "$CARGO_TARGET_DIR/deploy/odds_receipt-keypair.json")"
echo "safe_payout $(solana-keygen pubkey "$CARGO_TARGET_DIR/deploy/safe_payout-keypair.json")"
echo "wallet $(solana address)"
solana config set --url https://api.devnet.solana.com >/dev/null
echo "balance $(solana balance)"
anchor keys sync
anchor build --no-idl
echo SYNC_BUILD_OK
grep -n 'declare_id!' odds_receipt/src/lib.rs safe_payout/src/lib.rs
