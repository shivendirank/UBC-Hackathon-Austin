//! safe_payout: a tiny demo consumer. It refuses to settle when the odds it relies on are
//! thin ice, by reading odds_receipt's `Latest` account. This is the composability demo.

use anchor_lang::prelude::*;
use odds_receipt::Latest;

declare_id!("2o7C3na3sXn3KkhzrxTHKeuARAV5TyxyQu8PVNJgCoqX"); // run `anchor keys sync` after `anchor build`

/// Grades are 0=A ... 4=F. Settle only on C or better.
pub const WORST_ALLOWED_GRADE: u8 = 2;

#[program]
pub mod safe_payout {
    use super::*;

    pub fn settle(ctx: Context<Settle>, max_age_s: i64) -> Result<()> {
        let latest = &ctx.accounts.latest;
        let now = Clock::get()?.unix_timestamp;
        require!(now - latest.ts <= max_age_s, PayoutError::StaleGrade);
        require!(latest.grade <= WORST_ALLOWED_GRADE, PayoutError::ThinIce);
        msg!("settled on grade {} (move cost {} cents)", latest.grade, latest.move_cost_cents);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Settle<'info> {
    /// Owner check: Anchor verifies this account is owned by the odds_receipt program.
    pub latest: Account<'info, Latest>,
}

#[error_code]
pub enum PayoutError {
    #[msg("odds are thin ice (grade worse than C); refusing to settle")]
    ThinIce,
    #[msg("grade is too old")]
    StaleGrade,
}
