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

Not compiled yet (no Rust toolchain on the Mac it was written on). First build:

```bash
# one-time: install Rust, the Solana CLI and Anchor (see https://www.anchor-lang.com/docs/installation)
solana config set --url devnet && solana airdrop 2
anchor build && anchor keys sync && anchor build
anchor deploy --provider.cluster devnet
```

Then put the `odds_receipt` program ID in `backend/.env` (`ODDS_RECEIPT_PROGRAM_ID`) and the
authority keypair path in `RECEIPT_AUTHORITY_KEYPAIR`. Instruction byte layouts must stay in sync
with `backend/thin_ice/receipts.py`; `backend/tests/test_scoring.py` checks the Python side.
