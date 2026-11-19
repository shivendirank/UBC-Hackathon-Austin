#!/bin/bash
set -euo pipefail
source "$HOME/.cargo/env"
export PATH="$HOME/sysroot/usr/bin:$HOME/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.local/bin:$PATH"
export CC="$HOME/bin/cc"
export CXX="$HOME/bin/cc"
export LD_LIBRARY_PATH="$HOME/sysroot/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PKG_CONFIG_PATH="$HOME/sysroot/usr/lib/x86_64-linux-gnu/pkgconfig"
export PKG_CONFIG_SYSROOT_DIR="$HOME/sysroot"
if ! rustup toolchain list | grep -q '^1.79.0'; then
  rustup toolchain install 1.79.0 --profile minimal
fi
cargo +1.79.0 install devnet-pow --locked
echo MINER_READY
devnet-pow mine --target-lamports 5000000000 -u devnet -k "$HOME/.config/solana/id.json"
echo MINE_DONE
solana balance -u devnet
