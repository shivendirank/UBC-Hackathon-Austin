#!/bin/bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
echo "sbf: $(cargo-build-sbf --version | tr '\n' ' ')"
find "$HOME/.cache/solana" -path '*/rust/bin/rustc' -type f 2>/dev/null | while read -r p; do
  echo "rustc $p"
  "$p" --version || true
done
