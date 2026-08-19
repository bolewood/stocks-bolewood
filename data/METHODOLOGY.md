# Methodology

`schemaVersion` **1.0.0** · `methodologyVersion` **1.0.0** · as of 2026-08-19

This dataset estimates Anthropic and OpenAI **exposure** in public wrappers. Exposure is not always legal ownership. Each leg declares a `basis` so those cases are not flattened into one number.

Live market prices are a **runtime** input. They are not part of this dataset.

## FV-equivalent exposure

**FV-equivalent exposure** is computed as reported fair value ÷ the company valuation associated with that mark.

### 1. Arithmetic identity (governs the code)

Because the figure is a ratio of a fair value to the valuation that produced it, rolling both forward together leaves the ratio unchanged. Any code path in which re-marking alters the computed exposure percentage is a bug.

Example: VCX Anthropic filed at $112,418,000 against the Feb 2026 ~$380B mark. Rolling the dollar mark to Series H ($965B) must also roll the measurement mark, so

`(112,418,000 × 965/380) / 965,000,000,000` equals `112,418,000 / 380,000,000,000`.

The scenario sliders then apply that **same percentage** to a user-chosen IPO valuation. Changing only the scenario company valuation must not change the percentage.

### 2. Modeling convention (governs interpretation)

We hold that equivalent percentage constant when applying scenario valuations. This is a convention, not a claim of legal ownership. It may diverge from realized economics because of liquidation preferences, conversion mechanics, SPV-level economics, manager valuation methodology, and other security-specific terms.

## Other bases

| `basis` | What the number is |
| --- | --- |
| `disclosed` / `pro-forma` / `historical` | A stated ownership percentage |
| `filed-fv-equiv` | Reported fair value ÷ measurement mark |
| `carrying-value-equiv` | Reported carrying value ÷ measurement mark |
| `round-implied` | Dollars invested ÷ round post-money |
| `commitment` | An amount or status with **no** percentage |
| `estimate` | A non-issuer percentage, marked `sourceClass: secondary` |

`impliedExposure` is computed. It is never hand-authored next to the inputs.

## Denominator

| `wrapperType` | `denominatorType` |
| --- | --- |
| Listed operating company | Market cap (`price ×` share count of the quoted line, or all share classes where that is how the quote maps to the issuer) |
| ADR | Issuer-equivalent market cap (`price ×` ADS-equivalent shares) |
| Unlisted interval fund (ARKVX) | Total net assets from the same holdings schedule, not a synthetic share count |
| Listed closed-end fund | Market cap, even when the fund also reports NAV (the premium is shown separately) |

SKM: ordinary shares from the 20-F, ADS ratio 5/9, ADS-equivalent = ordinary × 9/5. SFTBY: Tokyo common × 2 for the 1:2 ADR.

## ATM issuance bridge (DXYZ)

DXYZ has an active ATM. Filed share count is implied by NPORT-P net assets ÷ NAV as of 2026-03-31. Estimated share count uses the same `computeAtmBridge` as [stocks.bolewood.com/dxyz](https://stocks.bolewood.com/dxyz): Q1 sales are already in the March 31 baseline; Apr–May inferred issuance is capped at the prior shelf remainder; post–May 26 issuance is simulated. See `lib/dxyzAtm.mjs` for the algorithm. The filed snapshot itself lives in `data/wrappers/DXYZ.json`.

## Deployment of post-filing inflows

DXYZ and ARKVX raised capital after the holdings print. Until the next N-PORT, it is unknown whether that cash bought more of the same names or sits in cash.

- **cash** — holdings FVs unchanged; denominator grows; per-$100 falls
- **into-book (prorata)** — FVs scale with net assets; look-through is roughly unchanged
- **range** (default) — both ends, until a filing pins it

## Exclusions

**DXYZ OAI I PPUs** (1.0% of the March 31 portfolio) are **not equity** per the N-CSR and are **excluded from IPO scaling**. Only the 4.7% Goanna Series C SPV is treated as OpenAI equity exposure. This exclusion is in the DXYZ OpenAI record and in the row expansion.

Amazon's $100B AWS commitments are not equity.

## What is not modeled

Taxes, fees, carry, liquidation preferences, conversion terms, anti-dilution, transfer restrictions, lockups, future financing, and the difference between a fund's mark and a primary-round post-money. Gross scenario estimates, not NAV, liquidation value, expected proceeds, or price targets.
