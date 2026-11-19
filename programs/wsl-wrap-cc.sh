#!/bin/bash
set -euo pipefail
mkdir -p "$HOME/sysroot"
for deb in "$HOME/debs"/*.deb; do
  echo "extract $deb"
  dpkg-deb -x "$deb" "$HOME/sysroot"
done
find "$HOME/sysroot" \( -name 'Scrt1.o' -o -name 'crtbeginS.o' -o -name 'libgcc.a' -o -name 'libc.so' -o -name 'libgcc_s.so' \) -print
GCCDIR=$(find "$HOME/sysroot/usr/lib/gcc" -name crtbeginS.o | head -n 1 | xargs dirname)
LIBDIR="$HOME/sysroot/usr/lib/x86_64-linux-gnu"
CLANG="$HOME/.cache/solana/v1.52/platform-tools/llvm/bin/clang"
mkdir -p "$HOME/bin"
cat > "$HOME/bin/cc" <<EOF
#!/bin/bash
exec "$CLANG" -B"$GCCDIR" -B"$LIBDIR" -L"$GCCDIR" -L"$LIBDIR" "\$@"
EOF
chmod +x "$HOME/bin/cc"
printf 'int main(void){return 0;}\n' > /tmp/hi.c
"$HOME/bin/cc" -o /tmp/hi /tmp/hi.c
echo HOST_CC_OK
file /tmp/hi
