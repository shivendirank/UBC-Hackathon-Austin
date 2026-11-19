#!/bin/bash
find "$HOME/.cache/solana" -type f \( -name clang -o -name gcc \) 2>/dev/null | head -n 20
