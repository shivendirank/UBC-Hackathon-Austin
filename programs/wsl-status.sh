#!/bin/bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
echo "solana: $(command -v solana || echo missing)"
solana --version || true
echo "anchor: $(command -v anchor || echo missing)"
anchor --version || true
echo "cargo: $(command -v cargo || echo missing)"
cargo --version || true
echo "cc: $(command -v cc || echo missing)"
ls -la /mnt/c/Users/HEET/OneDrive/Documents/UBC-Hackathon-Austin-1/programs/target/deploy 2>/dev/null || echo no-deploy
