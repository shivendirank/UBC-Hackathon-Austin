#!/bin/bash
set -euo pipefail
source "$HOME/.cargo/env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.local/bin:$PATH"
export CARGO_TARGET_DIR="$HOME/thin-ice-target"
URL=http://127.0.0.1:8899
P=/mnt/c/Users/HEET/OneDrive/Documents/UBC-Hackathon-Austin-1/programs/target/deploy
solana --keypair "$HOME/.config/solana/id.json" airdrop 10 --url "$URL"
echo "balance $(solana --keypair "$HOME/.config/solana/id.json" balance --url "$URL")"
solana program deploy "$CARGO_TARGET_DIR/deploy/odds_receipt.so" \
  --program-id "$P/odds_receipt-keypair.json" \
  --url "$URL" \
  --keypair "$HOME/.config/solana/id.json"
solana program deploy "$CARGO_TARGET_DIR/deploy/safe_payout.so" \
  --program-id "$P/safe_payout-keypair.json" \
  --url "$URL" \
  --keypair "$HOME/.config/solana/id.json"
echo DEPLOY_OK
solana program show HvV3TjjxoCwNyb7a3W5ikC18RPbDkaGAfYHzKPYyqdur --url "$URL"
solana program show HPx7jxgxjDBiTKdNX1PfFcuHg41XepqayFGsUzQkZ1fB --url "$URL"
