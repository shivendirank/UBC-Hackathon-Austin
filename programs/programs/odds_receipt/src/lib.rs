//! odds_receipt: tamper-proof, timestamped risk assessments for Gemini prediction markets, plus a
//! `Latest` account other programs can read. Two kinds share one layout:
//!   KIND_LIQUIDITY   subject = instrument symbol; grade from the cost to move the odds 10 cents
//!   KIND_CONSISTENCY subject = "relation:<id>"; grade from the cross-contract consistency check
//! `flags` carries the specific risks (thin, exhausted, inconsistent, unsynced, ...).
//!
//! Proof chain: `snapshot_hash` = sha256 of the pinned order-book JSON at `uri`. Anyone can
//! download it, re-hash it and re-run the open formula (backend/thin_ice/scoring.py).
//!
//! Byte layouts must match backend/thin_ice/receipts.py (encode_init_market, encode_record_receipt).

use anchor_lang::prelude::*;

declare_id!("2kMn7MsDWpn5Q4WchgNxQ4dcDnQp1bQpvo9F3kSe3xPR"); // run `anchor keys sync` after `anchor build`

pub const MAX_SYMBOL: usize = 64;
pub const MAX_URI: usize = 100;
/// Grades are stored as 0=A, 1=B, 2=C, 3=D, 4=F.
pub const GRADE_F: u8 = 4;

pub const KIND_LIQUIDITY: u8 = 0;
pub const KIND_CONSISTENCY: u8 = 1;

// Risk flags (bitmask). Keep in sync with backend/thin_ice/receipts.py.
pub const FLAG_THIN: u32 = 1 << 0;
pub const FLAG_EXHAUSTED: u32 = 1 << 1;
pub const FLAG_NO_RECENT_TRADE: u32 = 1 << 2;
pub const FLAG_WIDE_SPREAD: u32 = 1 << 3;
pub const FLAG_ONE_SIDED: u32 = 1 << 4;
pub const FLAG_INCONSISTENT: u32 = 1 << 5;
pub const FLAG_INCONSISTENT_EXECUTABLE: u32 = 1 << 6;
pub const FLAG_UNSYNCED: u32 = 1 << 7;
pub const FLAG_UNVERIFIED_RELATION: u32 = 1 << 8;

#[program]
pub mod odds_receipt {
    use super::*;

    /// One-time setup per market: creates `Market` (who may write) and an empty `Latest`.
    pub fn init_market(ctx: Context<InitMarket>, market_id: [u8; 32], symbol: String) -> Result<()> {
        require!(symbol.len() <= MAX_SYMBOL, ReceiptError::SymbolTooLong);
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.market_id = market_id;
        market.symbol = symbol;
        market.bump = ctx.bumps.market;

        let latest = &mut ctx.accounts.latest;
        latest.market_id = market_id;
        latest.grade = GRADE_F;
        latest.bump = ctx.bumps.latest;
        Ok(())
    }

    /// Writes a new immutable `Receipt` and updates `Latest`. Authority only.
    pub fn record_receipt(ctx: Context<RecordReceipt>, args: ReceiptArgs) -> Result<()> {
        require!(args.grade <= GRADE_F, ReceiptError::BadGrade);
        require!(args.kind <= KIND_CONSISTENCY, ReceiptError::BadKind);
        require!(args.uri.len() <= MAX_URI, ReceiptError::UriTooLong);
        let latest = &mut ctx.accounts.latest;
        require!(args.ts > latest.ts, ReceiptError::NotNewer);

        let market_id = ctx.accounts.market.market_id;
        let receipt = &mut ctx.accounts.receipt;
        receipt.market_id = market_id;
        receipt.ts = args.ts;
        receipt.kind = args.kind;
        receipt.flags = args.flags;
        receipt.price_bps = args.price_bps;
        receipt.move_cost_cents = args.move_cost_cents;
        receipt.spread_bps = args.spread_bps;
        receipt.grade = args.grade;
        receipt.snapshot_hash = args.snapshot_hash;
        receipt.uri = args.uri;
        receipt.authority = ctx.accounts.authority.key();
        receipt.bump = ctx.bumps.receipt;

        latest.ts = args.ts;
        latest.kind = args.kind;
        latest.flags = args.flags;
        latest.price_bps = args.price_bps;
        latest.move_cost_cents = args.move_cost_cents;
        latest.spread_bps = args.spread_bps;
        latest.grade = args.grade;
        latest.snapshot_hash = args.snapshot_hash;
        latest.receipt = receipt.key();

        emit!(ReceiptRecorded {
            market_id,
            ts: args.ts,
            kind: args.kind,
            grade: args.grade,
            flags: args.flags,
            move_cost_cents: args.move_cost_cents,
            receipt: receipt.key(),
        });
        Ok(())
    }

    /// Reclaims rent from an old receipt. `Latest` and the event log keep the history.
    pub fn close_old(_ctx: Context<CloseOld>) -> Result<()> {
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ReceiptArgs {
    pub ts: i64,
    pub kind: u8,
    pub price_bps: u16,
    pub move_cost_cents: u64,
    pub spread_bps: u16,
    pub grade: u8,
    pub flags: u32,
    pub snapshot_hash: [u8; 32],
    pub uri: String,
}

#[derive(Accounts)]
#[instruction(market_id: [u8; 32])]
pub struct InitMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Market::INIT_SPACE, seeds = [b"market", market_id.as_ref()], bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = authority, space = 8 + Latest::INIT_SPACE, seeds = [b"latest", market_id.as_ref()], bump)]
    pub latest: Account<'info, Latest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: ReceiptArgs)]
pub struct RecordReceipt<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority, seeds = [b"market", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        init, payer = authority, space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", market.market_id.as_ref(), &args.ts.to_le_bytes()], bump
    )]
    pub receipt: Account<'info, Receipt>,
    #[account(mut, seeds = [b"latest", market.market_id.as_ref()], bump = latest.bump)]
    pub latest: Account<'info, Latest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseOld<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub market: Account<'info, Market>,
    #[account(
        mut, close = authority,
        constraint = receipt.market_id == market.market_id @ ReceiptError::WrongMarket,
        constraint = receipt.key() != latest.receipt @ ReceiptError::StillLatest
    )]
    pub receipt: Account<'info, Receipt>,
    #[account(seeds = [b"latest", market.market_id.as_ref()], bump = latest.bump)]
    pub latest: Account<'info, Latest>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub market_id: [u8; 32],
    #[max_len(64)]
    pub symbol: String,
    pub bump: u8,
}

/// The current grade for a market. Other programs read this one account (see safe_payout).
#[account]
#[derive(InitSpace)]
pub struct Latest {
    pub market_id: [u8; 32],
    pub ts: i64,
    pub price_bps: u16,
    pub move_cost_cents: u64,
    pub spread_bps: u16,
    pub grade: u8,
    pub kind: u8,
    pub flags: u32,
    pub snapshot_hash: [u8; 32],
    pub receipt: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub market_id: [u8; 32],
    pub ts: i64,
    pub price_bps: u16,
    pub move_cost_cents: u64,
    pub spread_bps: u16,
    pub grade: u8,
    pub kind: u8,
    pub flags: u32,
    pub snapshot_hash: [u8; 32],
    #[max_len(100)]
    pub uri: String,
    pub authority: Pubkey,
    pub bump: u8,
}

#[event]
pub struct ReceiptRecorded {
    pub market_id: [u8; 32],
    pub ts: i64,
    pub kind: u8,
    pub grade: u8,
    pub flags: u32,
    pub move_cost_cents: u64,
    pub receipt: Pubkey,
}

#[error_code]
pub enum ReceiptError {
    #[msg("symbol longer than 64 bytes")]
    SymbolTooLong,
    #[msg("uri longer than 100 bytes")]
    UriTooLong,
    #[msg("grade must be 0 (A) to 4 (F)")]
    BadGrade,
    #[msg("unknown assessment kind")]
    BadKind,
    #[msg("receipt timestamp must be newer than the latest one")]
    NotNewer,
    #[msg("receipt belongs to a different market")]
    WrongMarket,
    #[msg("cannot close the receipt that Latest points to")]
    StillLatest,
}
