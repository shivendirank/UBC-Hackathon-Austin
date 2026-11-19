#!/bin/bash
set -euo pipefail
curl -sSfL https://release.anza.xyz/v2.1.0/install | sh
mkdir -p "$HOME/.local/bin"
curl -fsSL -o "$HOME/.local/bin/anchor" \
  https://github.com/solana-foundation/anchor/releases/download/v0.31.1/anchor-0.31.1-x86_64-unknown-linux-gnu
chmod +x "$HOME/.local/bin/anchor"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.local/bin:$PATH"
solana --version
anchor --version
