#!/bin/bash
pkill -f solana-test-validator || true
sleep 1
if pgrep -f solana-test-validator >/dev/null; then
  echo STILL_RUNNING
else
  echo STOPPED
fi
