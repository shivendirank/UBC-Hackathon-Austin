#!/bin/bash
set -euo pipefail
CC="$HOME/.cache/solana/v1.52/platform-tools/llvm/bin/clang"
printf 'int main(void){return 0;}\n' > /tmp/hi.c
if "$CC" -o /tmp/hi /tmp/hi.c; then
  echo HOST_CC_OK
  file /tmp/hi || true
else
  echo HOST_CC_FAIL
fi
