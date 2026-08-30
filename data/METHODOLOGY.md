# Methodology

`schemaVersion` **1.1.0** · `methodologyVersion` **1.1.0** · as of 2026-08-30

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
Anthropic at $235,671,976.08 and SpaceX at $173,061,169.35 of the filed
$1,640,039,144 portfolio (NPORT-P unit fair values). Those two filed weights
are normalized inside the modeled sleeve. This is a two-asset tape sleeve only,
not all of DXYZ NAV.

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

Example: VCX Anthropic remaining lots filed at $173,628,474 against the June 30 NPORT-implied ~$863.7B mark (Series G $380B × the 2.273× multiple on SaxeCap and AI Access 12). Rolling the dollar mark to Series H ($965B) must also roll the measurement mark, so

`(173,628,474 × 965/863.7) / 965,000,000,000` equals `173,628,474 / 863,700,000,000`.

The scenario sliders then apply that **same percentage** to a user-chosen IPO valuation. Changing only the scenario company valuation must not change the percentage.

### 2. Modeling convention (governs interpretation)

We hold that equivalent percentage constant when applying scenario valuations. This is a convention, not a claim of legal ownership. It may diverge from realized economics because of liquidation preferences, conversion mechanics, SPV-level economics, manager valuation methodology, and other security-specific terms.

This identity does **not** apply to `filed-units`. DXYZ Anthropic and OpenAI equity are filed unit counts. Per $100 is `reportedFairValue × 100 / wrapper market cap` and does not move with the $T IPO slider, because converting a company valuation into a share price requires a fully diluted share count that is not public.

## Filed units

**Filed-units exposure** is a fund's NPORT `balance` (share-equivalent units of the underlying company) and `valUSD`. Mark per unit is computed as `valUSD / units`. It is never stored next to those inputs.

- DXYZ Anthropic: 386,088 Magnitude ANC III units, $235,671,976.08, 0% carry. `ΔNAV/share = 386,088 ÷ 47,657,338 = $0.008101` per $1 of Anthropic share price.
- DXYZ OpenAI equity: 50,895 Goanna Capital 26E units, $35,040,868.20, 0% carry. PPUs (11,236 units, $7,735,911.09) are excluded from this identity.
- Carry is modeled **per-SPV**. MWAM VC SpaceX-II is 10%; Magnitude ANC III, DXYZ SpaceX I, Snowpoint Growth 2.6, and Goanna are 0%.

DXYZ's Level 3 table discloses volume-weighted secondary transaction prices, index prices, and recent transaction prices — not announced primary rounds. At March 31, 2026 Anthropic was marked $347.35/unit on the same 386,088 units, above the February Series G print and below the Series H announcement three weeks later.

SpaceX units underwent a 5:1 Unit Parity restatement between March 31 and June 30 (135,135→675,675 and 42,857→214,285 are exact ×5). Snowpoint 28,486×5 = 142,430 vs NPORT 142,425 (5-unit gap; do not invent a 28,485 March 31 count). June 30 balances are already post-split.

## Other bases

| `basis` | What the number is |
| --- | --- |
| `disclosed` / `pro-forma` / `historical` | A stated ownership percentage |
| `filed-fv-equiv` | Reported fair value ÷ measurement mark |
| `filed-units` | Filed share-equivalent units × price; no company-ownership % |
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

DXYZ has an active ATM. Filed share count is **47,657,338** from the June 30, 2026 N-CSRS (30,465,664 at March 31 = 21,976,305 year-end + 8,489,359 Q1 ATM, plus 17,191,674 Q2 ATM). Estimated share count uses the same `computeAtmBridge` as [stocks.bolewood.com/dxyz](https://stocks.bolewood.com/dxyz): Q2 sales are already in the June 30 baseline; post–June 30 issuance is simulated from July 1. See `lib/dxyzAtm.mjs`. The filed snapshot lives in `data/wrappers/DXYZ.json`.

The May 26, 2026 shelf (File 333-296212) authorizes an indeterminate amount. There is no filed remaining-capacity dollar figure. Forward simulation uses the May 26 424B5 $1B illustration as a modeling cap only.

In August 2026 the Board approved a share repurchase program at prices below then-current NAV, discretionary as to size and timing. That fact sits beside the open ATM; neither is treated as dominant.

### ATM-accretion calibration (6/30/2026 filing)

Before the N-CSRS posted, the site's pro-forma rolled March 31 net assets forward with modeled Q2 ATM proceeds and no mark-to-market on the private book. Against the filed 6/30 share count, that accretion-only path is **$30.71** NAV: `(30,465,664 × $24.56 + $715,442,732) / 47,657,338`. The N-CSRS printed NAV is **$34.30**. The ATM-accretion method was correct to the penny; the *appreciation* half (H1 unrealized gain $250,844,944) was not being modeled. Treat accretion as a validated method with that caveat.

## Deployment of post-filing inflows

DXYZ and ARKVX raised capital after the holdings print. Until the next N-PORT, it is unknown whether that cash bought more of the same names or sits in cash.

- **cash** — holdings FVs unchanged; denominator grows; per-$100 falls
- **into-book (prorata)** — FVs scale with net assets; look-through is roughly unchanged
- **range** (default) — both ends, until a filing pins it

## Exclusions

**DXYZ OAI I PPUs** (11,236 units, $7,735,911.09 on the June 30 NPORT) are **not equity** per the N-CSR and are **excluded from IPO scaling**. Only Goanna Capital 26E (50,895 units) is treated as OpenAI equity exposure. The Aug 13 $150M additional Goanna purchase is applied on ESTIMATED only (cash already inside June 30 NAV).

Amazon's $100B AWS commitments are not equity.

## What is not modeled

Taxes, liquidation preferences, conversion terms, anti-dilution, transfer restrictions, lockups, future financing, and — except for DXYZ SpaceX SPVs on `/dxyz` — carried interest. Gross scenario estimates, not NAV, liquidation value, expected proceeds, or price targets. DXYZ private marks are not last-primary-round marks.
