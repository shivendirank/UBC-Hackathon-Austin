//! safe_payout: a tiny demo consumer. It refuses to settle when the odds it relies on are
//! thin ice, by reading odds_receipt's `Latest` account. This is the composability demo.

use anchor_lang::prelude::*;
use odds_receipt::{Latest, Market, FLAG_INCONSISTENT, FLAG_INCONSISTENT_EXECUTABLE, FLAG_ONE_SIDED};

declare_id!("2o7C3na3sXn3KkhzrxTHKeuARAV5TyxyQu8PVNJgCoqX"); // run `anchor keys sync` after `anchor build`

/// Grades are 0=A ... 4=F. Settle only on C or better.
pub const WORST_ALLOWED_GRADE: u8 = 2;
/// Any of these risk flags pauses settlement regardless of grade.
pub const BLOCKING_FLAGS: u32 = FLAG_INCONSISTENT | FLAG_INCONSISTENT_EXECUTABLE | FLAG_ONE_SIDED;

#[program]
pub mod safe_payout {
    use super::*;

    /// `trusted_authority`: the Thin Ice signer this app trusts. Anyone can create a Market for a
    /// subject, so consumers must check who writes it, not just that the account exists.
    pub fn settle(ctx: Context<Settle>, trusted_authority: Pubkey, max_age_s: i64) -> Result<()> {
        require_keys_eq!(ctx.accounts.market.authority, trusted_authority, PayoutError::UntrustedSource);
        let latest = &ctx.accounts.latest;
        let now = Clock::get()?.unix_timestamp;
        require!(now - latest.ts <= max_age_s, PayoutError::StaleGrade);
        require!(latest.grade <= WORST_ALLOWED_GRADE, PayoutError::ThinIce);
        require!(latest.flags & BLOCKING_FLAGS == 0, PayoutError::RiskFlagged);
        msg!("settled on grade {} (move cost {} cents)", latest.grade, latest.move_cost_cents);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Settle<'info> {
    /// Owner checks: Anchor verifies both accounts are owned by the odds_receipt program.
    pub market: Account<'info, Market>,
    #[account(constraint = latest.market_id == market.market_id @ PayoutError::WrongMarket)]
    pub latest: Account<'info, Latest>,
}

#[error_code]
pub enum PayoutError {
    #[msg("odds are thin ice (grade worse than C); refusing to settle")]
    ThinIce,
    #[msg("assessment carries a blocking risk flag (inconsistent or one-sided); pausing")]
    RiskFlagged,
    #[msg("grade is too old")]
    StaleGrade,
    #[msg("assessment was not written by the trusted Thin Ice authority")]
    UntrustedSource,
    #[msg("Latest account belongs to a different market")]
    WrongMarket,
}
