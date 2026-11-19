#!/bin/bash
set -euo pipefail
LIBCSO="$HOME/sysroot/usr/lib/x86_64-linux-gnu/libc.so"
NONSHARED="$HOME/sysroot/usr/lib/x86_64-linux-gnu/libc_nonshared.a"
cat > "$LIBCSO" <<EOF
OUTPUT_FORMAT(elf64-x86-64)
GROUP ( /usr/lib/x86_64-linux-gnu/libc.so.6 $NONSHARED AS_NEEDED ( /lib64/ld-linux-x86-64.so.2 ) )
EOF
printf 'int main(void){return 0;}\n' > /tmp/hi.c
"$HOME/bin/cc" -o /tmp/hi /tmp/hi.c
echo HOST_CC_OK
file /tmp/hi
source "$HOME/.cargo/env"
export PATH="$HOME/bin:$PATH"
export CC="$HOME/bin/cc"
printf 'fn main() {}\n' > /tmp/hi.rs
rustc -o /tmp/hi_rs /tmp/hi.rs
echo HOST_RUSTC_OK
file /tmp/hi_rs
