#!/bin/bash
ls -la "$HOME/.cache/solana" || true
find "$HOME/.cache/solana" -maxdepth 3 -type d | head -n 40
