# Methodology

`schemaVersion` **1.3.0** · `methodologyVersion` **1.3.0** · as of 2026-10-26

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

## FV-equivalent exposure and share-equivalent denominator normalization

**FV-equivalent exposure** at the measurement round is `reportedFairValue ÷ measurement round post-money valuation`.

### 1. Arithmetic identity and post-measurement share issuance (governs the code)

Before Anthropic's Form S-1 went public on October 26, 2026, no public fully diluted share count or primary-round share price table existed, so `filed-fv-equiv` and `carrying-value-equiv` legs retained `reportedFairValue ÷ roundPostMoney` unchanged. With the S-1 preferred price table (S-1 p. F-47) and the June 30, 2026 fully diluted share count (`1,778,366,016` pre-split including the 5% public-benefit fund, S-1 p. 13), keeping `reportedFairValue ÷ roundPostMoney` fixed would overstate legs measured at earlier rounds because Anthropic issued shares after those rounds (at minimum the 5% contribution to Anthropic Public Benefit Fund, LLC).

In v1.3, every Anthropic `filed-fv-equiv` and `carrying-value-equiv` leg is converted into pre-split **share-equivalents** at its measurement round's price per share, then divided by the selected fully diluted share count:

```
share-equivalents = reportedFairValue (or carrying value) ÷ round price per pre-split share
effective stake   = share-equivalents ÷ selected pre-split FD shares
                  = (reportedFairValue ÷ roundPostMoney) × (FD_round ÷ FD_now)
```

where `FD_round = roundPostMoney ÷ roundPricePerPreSplitShare` (S-1 p. F-47):
- Series E-1 (`$56.09`, `$61.5B`): `1,096.45M` pre-split (`10,964.5M` post-split)
- Series F-1 (`$140.97`, `$183B`): `1,298.15M` pre-split (`12,981.5M` post-split)
- Series G-1 (`$259.14`, `$380B`): `1,466.39M` pre-split (`14,663.9M` post-split)
- Series H-1 (`$589.0095`, `$965B`): `1,638.34M` pre-split (`16,383.4M` post-split)

At the default S-1 FD count (`1,778,366,016` pre-split):
- Series H-measured legs (AGIX, AMZN, ZM): `× 1,638.34M / 1,778.37M = × 0.9213 (−7.87%)`
- Series G-measured leg (ARKVX): `× 1,466.39M / 1,778.37M = × 0.8246 (−17.54%)`
- VCX (`anthropic-vcx-nport-2026-06-30`, `$863.729B` NPORT-implied mark with no disclosed per-share price): uses an explicit `estimationMethod` assumption scaling the Series H-1 price (`$589.0095`, S-1 p. F-47) by `863.729B / 965B ≈ $527.19` per pre-split share (`$52.72` per post-split ANT share), yielding the same `1,638.34M` round-implied FD as Series H-1 (`× 0.9213`, `−7.87%`) and flagged `EST. ROUND PPS` in the UI.
- `filed-units` legs (DXYZ, SKM): `units ÷ FD_now`, so `× 1,580.90M / 1,778.37M = × 0.8890 (−11.10%)` vs the prior DXYZ-calibrated proxy.
- `historical` percentage legs (`GOOG`, `≤14%` from 2025 reports, capped at `14.99%` under the Google 2026 NPA per S-1 p. 169): not scaled by FD.

The scenario sliders apply that effective stake to the user-chosen IPO valuation. Changing only the scenario company valuation never changes the effective stake percentage; changing the FD slider scales all unit and share-equivalent legs inversely with FD.

### 2. Modeling convention (governs interpretation)

Converting fair value or carrying value into share-equivalents at the measurement round's preferred price is a modeling convention, not a claim of legal share count. It may diverge from realized economics because of liquidation preferences, conversion caps (e.g., Amazon Note conversion mechanics under S-1 pp. 20, 165), SPV-level economics, manager valuation methodology, and other security-specific terms.

For `filed-units`, scenario exposure is filed pre-split units divided by the selected pre-split FD share count. That ratio stays fixed as valuation changes and changes inversely with FD. Filed unit marks remain historical observations.

## Share basis and the 10-for-1 split

Anthropic effected a **10-for-1 forward stock split** of its Class A and Class N common stock on **September 17, 2026**, applied retroactively to common share figures in the S-1 (S-1 p. 22). However:
1. Preferred stock prices in the S-1 financial statement footnotes are quoted **pre-split** (e.g., Series H-1 is `$589.0095` per pre-split share, which converts into 10 shares of common stock at `$58.90` per post-split ANT share; S-1 pp. 22, F-47).
2. Every wrapper's filed unit count as of June 30, 2026 (`DXYZ` `386,088` Magnitude ANC III units; `SKM` `3,860,330` common/preferred shares) is reported on a **pre-split** basis.

Therefore, `data/capitalization.json` keeps `anthropic.shareBasis: "pre-split"` with `splitFactor: 10` (`1,778,366,016` pre-split shares = `17,783,660,160` post-split shares), and every user-facing per-share price on `/ai` and `/dxyz` displays **both**: `"$X per pre-split unit ($X/10 per ANT share)"`.

## Filed units

**Filed-units exposure** starts from a filed quantity of underlying or share-equivalent securities. A USD mark per pre-split unit, when available, is computed as `valUSD / units`. SKM's KRW book value remains in KRW and is not used as a USD mark.

- DXYZ Anthropic: 386,088 pre-split Magnitude ANC III (Series B preferred) units, $235,671,976.08 ($610.41/pre-split unit, $61.04/ANT share), 0% carry. `ΔNAV/share = 386,088 ÷ 47,657,338 = $0.008101` per $1 of pre-split Anthropic price (`$0.08101` per $1 of post-split ANT share price). Under S-1 pp. 20, 309, Series B preferred converts into unlisted, non-voting Class N common stock, convertible into listed Class A common stock upon a "qualifying transfer."
- DXYZ OpenAI equity: 50,895 Goanna Capital 26E units, $35,040,868.20, 0% carry. PPUs (11,236 units, $7,735,911.09) are excluded from this identity.
- Carry is modeled **per-SPV**. MWAM VC SpaceX-II is 10%; Magnitude ANC III, DXYZ SpaceX I, Snowpoint Growth 2.6, and Goanna are 0%.

DXYZ's Level 3 table discloses volume-weighted secondary transaction prices, index prices, and recent transaction prices — not announced primary rounds. At March 31, 2026 Anthropic was marked $347.35/unit on the same 386,088 pre-split units, above the February Series G print ($259.14, S-1 p. F-47) and below the Series H announcement ($589.01, S-1 p. F-47).

SpaceX units underwent a 5:1 Unit Parity restatement between March 31 and June 30 (135,135→675,675 and 42,857→214,285 are exact ×5). Snowpoint 28,486×5 = 142,430 vs NPORT 142,425 (5-unit gap; do not invent a 28,485 March 31 count). June 30 balances are already post-split.

## Other bases

| `basis` | What the number is |
| --- | --- |
| `disclosed` / `pro-forma` / `historical` | A stated ownership percentage (not scaled by FD) |
| `filed-fv-equiv` | Share-equivalents (`reportedFairValue ÷ roundPricePerShare`) ÷ selected FD shares when round price is known (Anthropic, S-1 p. F-47); `reportedFairValue ÷ measurement mark` otherwise (OpenAI) |
| `filed-units` | Filed pre-split units × scenario price; equivalent stake = units ÷ selected FD shares |
| `carrying-value-equiv` | Share-equivalents (`reportedCarryingValue ÷ roundPricePerShare`) ÷ selected FD shares when round price is known (Anthropic, S-1 p. F-47); `reportedCarryingValue ÷ measurement mark` otherwise |
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

SKM: ordinary shares from the June 30 DART half-year report, ADS ratio 5/9, ADS-equivalent = ordinary × 9/5. SFTBY: Tokyo common × 2 for the 1:2 ADR.

## DXYZ NAV and subsequent purchases

`/dxyz` imports June Anthropic/OpenAI observations from `data/wrappers/DXYZ.json` and uses the same `unitLots` calculation and `data/capitalization.json` entry assumptions as `/ai`. `lib/dxyzNav.mjs` values the complete NAV ledger. Its price-per-share input corresponds to `/ai` company valuation × (1 − dilution) ÷ estimated FD shares. The Implied EV ($T) field is the inverse at dilution 0: PPS × the same estimated FD. Equal inputs produce equal equity exposure; the NAV tests also compare complete scenario net assets with `/ai` using cash deployment and the same wrapper shares, without ATM or other holding revaluations. A new primary may issue shares that identity does not model.

Subsequent purchases through August 13 are enabled by default, independently of the ATM toggle. The [August 28 424B3, Portfolio Deployment Update](https://www.sec.gov/Archives/edgar/data/1843974/000157587226000624/dxyx104_424b3.htm) discloses $150M OpenAI common on August 13, $15M Fluidstack preferred on July 16 and a separate $4M Boom SAFE on August 4, funded from existing cash. The model subtracts all $169M from June money-market assets, leaving $770,712,701 before ATM proceeds, expenses and other unknown cash movements. Fluidstack and the new Boom SAFE remain at cost; this is an assumption, not a newer filed fair value. June Boom preferred remains in the original ledger.

August OpenAI units = $150M ÷ assumed entry price. Entry defaults to the full-precision June preferred mark, $688.4933333333333; ±25% presets and a $100–$2,000 slider are sensitivity choices, not observed transaction quotes. The new common and June preferred lots use the same scenario price under assumed parity. Entry and units stay fixed when scenario PPS changes. Only August value less its $150M cost changes NAV. At default entry and PPS, NAV is unchanged; doubling PPS creates $150M of August gain, about $3.15 per filed DXYZ share. PPUs remain a separate MOIC line and do not follow equity PPS.

Restore June 30 snapshot disables subsequent purchases and ATM estimates, restores filed shares and private marks, and stops live SpaceX marks. It reproduces $1,634,830,252 / 47,657,338 = $34.30385 per share. The ATM model takes the corrected marked ledger once; it does not add purchase cost or scale August units with modeled issuance. If history stops before August 13, the UI flags the mixed dates and incomplete issuance/expense coverage. These are scenario estimates, not company-reported current NAV.

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

**DXYZ OAI I PPUs** (11,236 units, $7,735,911.09 on the June 30 NPORT) are **not equity** per the N-CSR and are **excluded from IPO scaling**. June Goanna Series C has 50,895 units; the August Class A Common purchase is a separate estimated-unit lot. The Aug 13 $150M additional Goanna purchase is applied on ESTIMATED only (cash already inside June 30 NAV).

Amazon's $100B AWS commitments are not equity.

## What is not modeled

Taxes, liquidation preferences, conversion terms, anti-dilution, transfer restrictions, lockups, future financing, and — except for DXYZ SpaceX SPVs on `/dxyz` — carried interest. Gross scenario estimates, not NAV, liquidation value, expected proceeds, or price targets. DXYZ private marks are not last-primary-round marks.

## Holdings modes and valuation scenarios (v1.3)

**Filed Holdings** fixes fund quantities and wrapper denominators to filed snapshots. **Estimated Holdings** adds known subsequent purchases and explicitly modeled ATM/inflow assumptions. Both modes revalue every quantified exposure under both company valuation sliders. They select holdings; they do not switch valuation sensitivity off. Strategic rows retain their individual historical, pro forma, round-implied or other basis in either mode. In particular SoftBank's 13% is not current funded ownership.

```
scenario company price = post-IPO equity valuation × (1 − incremental IPO dilution) / pre-IPO FD shares
scenario holding value = equivalent units × scenario company price
scenario equivalent stake = equivalent units / pre-IPO FD shares
per $100 = scenario holding value / wrapper denominator × 100
```

For Anthropic, the pre-IPO FD share denominator (`data/capitalization.json`) is shared across all unit-based (`filed-units`: DXYZ, SKM) and round-price share-equivalent (`filed-fv-equiv` / `carrying-value-equiv`: AGIX, AMZN, ARKVX, VCX, ZM) legs:
- `equivalent units = filedUnits` for `filed-units` legs (DXYZ `386,088`, SKM `3,860,330` pre-split).
- `equivalent units = reportedFairValue (or carrying value) ÷ roundPricePerPreSplitShare` for `filed-fv-equiv` and `carrying-value-equiv` legs (measured at Series G-1 `$259.14`, Series H-1 `$589.0095`, or VCX's scaled `863.729/965 × $589.0095 ≈ $527.19` per pre-split share; S-1 p. F-47).
- `historical` percentage legs (`GOOG` `≤14%`, capped at `14.99%` under the 2026 NPA per S-1 p. 169) are not scaled by FD.

For OpenAI (where no S-1 round price table exists), `filed-fv-equiv` legs continue to use `reportedFairValue ÷ roundPostMoney`, while `filed-units` (DXYZ) uses `units ÷ oaiFdShares`. Valuation and incremental dilution affect all quantified legs. No ownership is invented for null/undisclosed stakes or unallocated commitments. Preferred/common conversion at parity is a gross modeling convention, not a guarantee of identical realizable economics.

### Capitalization and FD share counts

`data/capitalization.json` holds dated, sourced FD share counts:
- **Anthropic (issuer-derived from Form S-1, `sourceClass: primary`, as of June 30, 2026):** S-1 p. 13 (also pp. 144, 236) discloses that Anthropic contributed `846,840,960` post-split shares of Class N common stock, representing **5%** of fully diluted shares as of June 30, 2026 (assuming full conversion of the Amazon Notes), to **Anthropic Public Benefit Fund, LLC** (a wholly owned subsidiary). Those shares are legally outstanding even though excluded from GAAP share counts (S-1 pp. 20, 24).
  - Pre-fund fully diluted = `846,840,960 ÷ 0.05 = 16,936,819,200` post-split (`1,693,681,920` pre-split).
  - Including the public-benefit fund (default) = `16,936,819,200 + 846,840,960 = 17,783,660,160` post-split (`1,778,366,016` pre-split).
  - Future milestone issuances: the board may issue up to an additional **2%** of then-outstanding fully diluted shares (including the fund's shares) to the fund each time the share price appreciates 50% above the prior milestone, starting from the IPO price (`×1.02 ≈ 1,814,000,000` pre-split after one milestone issuance; S-1 p. 13).
  - Prior calibration proxies (`1,580,904,637.87` DXYZ-calibrated default and `1,544,132,000` / `1,930,165,000` / `2,573,553,333.33` SKM rounding cross-checks) are retained in `anthropic.superseded` for reproducibility.
- **OpenAI (calibration proxy, `sourceClass: assumption`, as of June 30, 2026):** OpenAI has no public S-1 cap table. Its default (`1,237,484,749` shares) pairs the full-precision DXYZ June unit mark (`$688.493333`) with the `$852B` last primary valuation.

| Company | Low preset | Default | High preset | Basis & interpretation |
| --- | ---: | ---: | ---: | --- |
| Anthropic (pre-split, ÷10 of ANT) | 1,693.681920M | 1,778.366016M | 1,814.000000M | S-1 p. 13: Low = ex-fund (`846,840,960 ÷ 0.05 ÷ 10`, also the "5% of post-issuance" reading); Default = incl. 5% public-benefit fund; High = +one future 2% milestone issuance |
| OpenAI | 928.113562M | 1,237.484749M | 1,546.855937M | Calibration proxy (`$852B ÷ $688.493333`); Low/high are ±25% stress choices |

Slider limits are exploration limits, not confidence bounds. The UI labels the separate FD/entry-price sensitivity range; the main table's deployment range covers cash versus pro rata deployment only.

Sources: [Anthropic Form S-1 (Reg. No. 333-299633)](https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm) (pp. 13, 20, 22, 24, 144, 236, F-47), [DXYZ June N-PORT](https://www.sec.gov/Archives/edgar/data/1843974/000089418926024246/xslFormNPORT-P_X01/primary_doc.xml), [Anthropic Series H](https://www.anthropic.com/news/series-h), [OpenAI March primary](https://openai.com/index/accelerating-the-next-phase-ai/), [SKM DART](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260813001728).

### August OpenAI lot and cash reconciliation

The [August 28 supplement](https://www.sec.gov/Archives/edgar/data/1843974/000157587226000624/dxyx104_424b3.htm) reports a $150M August 13 purchase of Class A Common through Goanna Capital 26E, funded from existing cash. It does not report acquired units or entry price. The independent entry-price control defaults to June preferred FV / units = $688.4933333333333; approximate acquired units = **217,867.033328815**. Low/high entry-price presets are ±25% stress assumptions, not transaction evidence. The June preferred lot and August common lot remain distinct.

Acquired units = purchase cost / selected acquisition entry price. They do not change when current valuation, FD count, IPO dilution or ATM assumptions change. Pro rata ATM deployment adds its own assumed-unit lot based on the old filed book; it never scales the known August purchase. Known purchase inclusion is independent of ATM history availability. With no bridge available, Estimated Holdings retains filed wrapper shares and still includes the August acquisition.

The purchase exchanges cash for equity within existing assets. Modeled assets = baseline/ATM assets + scenario equity value − the carrying amounts already included in baseline/ATM assets. Do not add $150M again. The result is a partial revaluation, not reported NAV or a full portfolio valuation. PPUs stay in historical NAV and are excluded from equity scaling.

### Provenance and unresolved observations

Every source record has a measurement date (day or month precision) and a URL or SEC accession. Publication dates are separate and may be null when not pinned; no fictional day is inserted. `sourceClass: assumption` requires an estimation method. A source URL is a locator, not automatic proof: `verificationStatus: unverified` explicitly flags inherited observations whose exact historical source remains unpinned. Schema validation checks structure; it cannot verify that a webpage supports a fact.

GOOG's historical court exhibit, AGIX's August 18 archive and ARKVX's July 31 Class D archive remain unpinned. GOOG's ownership cap is updated to 14.99% (post-money, as-converted) per the Google 2026 NPA disclosed in S-1 p. 169; non-voting Class N holdings are omitted from the S-1 beneficial ownership table (pp. 289–290), so Google's exact current percentage remains undisclosed. VCX's $850B OpenAI measurement valuation is an unverified inherited assumption; its June fair value is filed. VCX's Anthropic ~$863.729B valuation is inferred from remaining-lot changes and scaled against the S-1 Series H-1 share price ($589.0095 × 863.729/965 ≈ $527.19/pre-split share) as an explicit assumption. See `data/SOURCE_CHANGES.md` for primary evidence and superseded pre-S-1 assumptions.

### Frozen reproduction

`npm run reference` verifies Filed Holdings (`fixtures.json` / `expected-results.json`) and Estimated Holdings (`estimated-fixtures.json` / `estimated-expected-results.json`). Frozen prices dated August 19 are intentionally separate from dataset availability on October 26. These fixtures are not a backtest of what was knowable August 19.

Open `/ai?reference=filed`, `/ai?reference=estimated`, or `/ai?reference=s1` to load those same frozen prices, quantities, S-1 FD (`1,778,366,016` pre-split) / entry assumptions and bridge without live polling. Sliders remain interactive. Ordinary links preserve assumptions using `anthFd`/`oaiFd` in millions, `oaiEntry` in dollars and `holdings=filed|estimated`; legacy `basis` links still parse. Ordinary links do not freeze quotes or history.

Copy/export scenario JSON embeds the versioned raw dataset, all numerical controls, prices, quote metadata and the resolved ATM bridge plus available input history. The bridge is a frozen numerical runtime input to the offline calculator; it is not silently rebuilt from a later history snapshot. To reproduce an export:

```
npm run reference -- --scenario /absolute/path/ai-scenario.json
```

This also checks any included expected results. The independent raw-data engine and app are cross-checked for both holdings modes, all deployment endpoints, both valuations, dilution, FD and acquisition changes. Full precision is retained until display; fixtures compare 12 significant digits. Displayed cents use the same rounding for both engines.

### SoftBank gross exposure versus shareholder NAV

SFTBY uses SVF2’s approximately 13% pro forma **gross fund** stake. That is not a disclosed shareholder-attributable net ownership percentage. Management co-investment has preferred-capital, fund-wide hurdle and receivable terms; a flat 17.25% deduction from gross exposure is not justified. The [SoftBank SOTP methodology](./SFTBY_METHODOLOGY.md) preserves issuer NAV and exposes incremental allocation and funding sensitivities. `/ai` gross calculations do not deduct those liabilities or allocations.
