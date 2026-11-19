# Solana programs (Anchor, devnet)

- `odds_receipt`: `init_market`, `record_receipt` (authority only), `close_old`. Accounts:
  `Market` `["market", market_id]`, `Latest` `["latest", market_id]`,
  `Receipt` `["receipt", market_id, ts_le_bytes]`. `market_id = sha256(subject)`, where subject is an
  instrument symbol (liquidity assessment) or `relation:<id>` (consistency assessment).
  Each receipt has `kind` (0 liquidity, 1 consistency), `grade` (0=A..4=F) and a `flags` bitmask
  (thin, exhausted, no recent trade, wide spread, one-sided, inconsistent, inconsistent at executable
  prices, unsynced books, unverified relation).
- `safe_payout`: demo consumer. `settle(trusted_authority, max_age_s)` pauses (fails) when the
  assessment isn't from the trusted signer, is too old, grades worse than C, or carries a blocking flag.

Trust assumption: a receipt proves what Thin Ice committed and when, not that Gemini's data was
complete. Anyone can create a `Market` for a subject, so consumers must pin the authority they trust.

## Build / deploy status (Windows)

Programs compile to `target/deploy/{odds_receipt,safe_payout}.so`. Program IDs (from the
checked-in keypairs) stay:

- `odds_receipt` = `HvV3TjjxoCwNyb7a3W5ikC18RPbDkaGAfYHzKPYyqdur`
- `safe_payout` = `HPx7jxgxjDBiTKdNX1PfFcuHg41XepqayFGsUzQkZ1fB`

```bash
# From programs/ (PowerShell: $env:HOME = $env:USERPROFILE)
# Cargo.lock pins blake3/indexmap/zeroize/unicode-segmentation for platform-tools rustc 1.79
cargo-build-sbf --manifest-path programs/odds_receipt/Cargo.toml
cargo-build-sbf --manifest-path programs/safe_payout/Cargo.toml

# Local demo (unlimited SOL):
solana-test-validator --reset
solana program deploy target/deploy/odds_receipt.so --program-id target/deploy/odds_receipt-keypair.json --url localhost
solana program deploy target/deploy/safe_payout.so --program-id target/deploy/safe_payout-keypair.json --url localhost

# Public devnet (needs faucet SOL on the CLI wallet):
solana config set --url devnet
solana airdrop 2   # or https://faucet.solana.com / https://faucet.quicknode.com/solana/devnet
solana program deploy target/deploy/odds_receipt.so --program-id target/deploy/odds_receipt-keypair.json
solana program deploy target/deploy/safe_payout.so --program-id target/deploy/safe_payout-keypair.json
```

Put the `odds_receipt` program ID in `backend/.env` (`ODDS_RECEIPT_PROGRAM_ID`) and the
authority keypair path in `RECEIPT_AUTHORITY_KEYPAIR` (usually `~/.config/solana/id.json`).
For local validator minting, set `SOLANA_RPC=http://127.0.0.1:8899`.

Instruction byte layouts must stay in sync with `backend/thin_ice/receipts.py`;
`backend/tests/test_scoring.py` checks the Python side.
