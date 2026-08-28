# Methodology

`schemaVersion` **1.0.0** · `methodologyVersion` **1.0.0** · as of 2026-08-28

This dataset estimates Anthropic and OpenAI **exposure** in public wrappers. Exposure is not always legal ownership. Each leg declares a `basis` so those cases are not flattened into one number.

Live market prices are a **runtime** input. They are not part of this dataset.

## Private Tape / DXYZ Tape Lab

Private Tape asks whether Anthropic's private/pre-IPO tape and SpaceX's public 24/7 tape
contain information that appears in DXYZ when the NYSE opens. It does **not** claim those
markets establish fair value, true NAV, or cash equity turnover.

The current Anthropic input comes from Entropy's `io:ANTH` market on Hyperliquid. Entropy is
a third-party builder using Hyperliquid's HIP-3 infrastructure for pre-IPO and
real-world-asset perpetual markets. Public commentary around Entropy emphasizes competition
with Trade, lessons from Ventuals, and market-structure questions around liquidity,
distribution partnerships and funding-rate design. Private Tape treats Entropy and
Hyperliquid as observable market-data inputs only; it is not a recommendation to trade on,
custody assets with, or rely on either venue.

SpaceX began public trading as SPCX on Nasdaq on 2026-06-12, so `xyz:SPCX` is treated as a
24/7 public-equity/perp tape rather than pre-IPO price discovery. DXYZ's SpaceX exposure is
held through SPVs, so public SPCX moves may not flow through to DXYZ NAV one-for-one because
of conversion timing, lockups, distributions, and vehicle-level economics.

The reusable assumptions live in `data/private-tape.json` and carry their own
`methodologyVersion`. The first version models two DXYZ filed exposures as of 2026-06-30:
Anthropic at 14.4% of the filed portfolio and SpaceX at 10.5% of the filed portfolio. Those
two filed weights are normalized inside the modeled sleeve, producing approximately 58%
Anthropic and 42% SpaceX. This is a two-asset tape sleeve only, not all of DXYZ NAV.

Runtime analysis uses simple returns:

`end_price / start_price - 1`

The plain correlation test aligns 30-minute returns during overlapping NYSE cash-session
windows. It reports DXYZ vs ANTH, DXYZ vs SPCX, and ANTH vs SPCX using returns rather than
price levels.

The overnight lead/lag test measures ANTH/SPCX tape returns from the prior DXYZ 4:00pm ET
close to the next DXYZ 9:30am ET open, then compares those returns with DXYZ's next opening
gap. Tape prices are selected from candles closed at or before each boundary, so
the construction does not use information that was unavailable before the DXYZ open.

The DXYZ residual regresses DXYZ returns on ANTH, SPCX and QQQ. The residual is a
sentiment/factor residual, not a NAV premium. Results are hidden until minimum sample sizes
are met, and displayed correlations include N.

Open exports are available from:

| Endpoint | Contents |
| --- | --- |
| `/api/private-tape/manifest` | Dataset manifest and methodology |
| `/api/private-tape` | Full JSON payload |
| `/api/private-tape?format=csv&dataset=overnight` | Overnight opening-gap sample set |
| `/api/private-tape?format=csv&dataset=rth` | NYSE-hours 30-minute return sample set |

Raw Hyperliquid candles, Yahoo candles and live quotes are runtime inputs and are not
committed to `data/`.

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

DXYZ has an active ATM. Filed share count is March 31 NPORT implied shares plus 17,191,674 ATM shares sold April 1–June 30 (424B3 dated Aug 28, 2026). Estimated share count uses the same `computeAtmBridge` as [stocks.bolewood.com/dxyz](https://stocks.bolewood.com/dxyz): Q2 sales are already in the June 30 baseline; post–June 30 issuance is simulated from July 1. See `lib/dxyzAtm.mjs` for the algorithm. The filed snapshot itself lives in `data/wrappers/DXYZ.json`.

## Deployment of post-filing inflows

DXYZ and ARKVX raised capital after the holdings print. Until the next N-PORT, it is unknown whether that cash bought more of the same names or sits in cash.

- **cash** — holdings FVs unchanged; denominator grows; per-$100 falls
- **into-book (prorata)** — FVs scale with net assets; look-through is roughly unchanged
- **range** (default) — both ends, until a filing pins it

## Exclusions

**DXYZ OAI I PPUs** (0.5% of the June 30 portfolio) are **not equity** per the N-CSR and are **excluded from IPO scaling**. Only the 2.1% Goanna Series C SPV is treated as OpenAI equity exposure. This exclusion is in the DXYZ OpenAI record and in the row expansion. The Aug 13 $150M additional Goanna purchase is applied on ESTIMATED only (cash already inside June 30 NAV).

Amazon's $100B AWS commitments are not equity.

## What is not modeled

Taxes, fees, carry, liquidation preferences, conversion terms, anti-dilution, transfer restrictions, lockups, future financing, and the difference between a fund's mark and a primary-round post-money. Gross scenario estimates, not NAV, liquidation value, expected proceeds, or price targets.
