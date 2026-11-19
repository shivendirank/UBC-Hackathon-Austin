#!/bin/bash
set -euo pipefail
mkdir -p "$HOME/bin"
if [ ! -x "$HOME/bin/micromamba" ]; then
  curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xj -C "$HOME/bin" --strip-components=1 bin/micromamba
fi
"$HOME/bin/micromamba" --version
export MAMBA_ROOT_PREFIX="$HOME/micromamba"
"$HOME/bin/micromamba" create -y -p "$HOME/gccenv" -c conda-forge gcc_linux-64 gxx_linux-64 sysroot_linux-64
ln -sfn x86_64-conda-linux-gnu-gcc "$HOME/gccenv/bin/cc" || true
ln -sfn x86_64-conda-linux-gnu-gcc "$HOME/gccenv/bin/gcc" || true
"$HOME/gccenv/bin/cc" --version
echo GCC_OK
