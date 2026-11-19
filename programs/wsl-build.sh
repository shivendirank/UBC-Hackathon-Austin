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
echo "solana $(solana --version)"
echo "cc $($CC --version | head -n 1)"
anchor build --no-idl
echo BUILD_OK
ls -la "$CARGO_TARGET_DIR/deploy"
