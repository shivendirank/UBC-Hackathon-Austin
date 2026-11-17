# Solana programs (Anchor, devnet)

- `odds_receipt`: `init_market`, `record_receipt` (authority only), `close_old`. Accounts:
  `Market` `["market", market_id]`, `Latest` `["latest", market_id]`,
  `Receipt` `["receipt", market_id, ts_le_bytes]`. `market_id = sha256(instrument symbol)`.
- `safe_payout`: demo consumer; `settle` fails with `ThinIce` when `Latest.grade` is worse than C.

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
