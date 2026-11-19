#!/bin/bash
source "$HOME/.cargo/env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$HOME"
exec solana-test-validator --reset --ledger "$HOME/test-ledger" \
  --gossip-port 18001 \
  --dynamic-port-range 18010-18100 \
  --rpc-port 8899
