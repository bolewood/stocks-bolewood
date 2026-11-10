# Data changelog

Typed entries: **Data update** · **Correction** · **Methodology change** · **Schema change**.

## [1.4.0] - 2026-11-10

### Data update
- 2026-11-10: Anthropic, PBC S-1/A No. 2 (accession `0001628280-26-072484`, EDGAR accepted 06:29:24 ET). New `s1a2` dataset in `data/capitalization.json` → `anthropic.ipo`: estimated range `$70.00–$78.00` (midpoint `$74`, Nasdaq `ANT`; cover); 801,351,354 primary + 23,648,646 secondary Class A, 123,750,000 option (p. 19); `$26.0B` concurrent Class N placement (351,351,348 shares at $74, not locked up; p. 19); ~`$84.6B` net proceeds (~`$93.7B` with option; p. 20); 13,086,672,593 outstanding after the offering (p. 20); the full fully diluted table, 18,012,993,381 at $74 (p. 24; treasury method; Amazon rollover notes 1,563,617,444 Class N, p. 172); reserves (p. 23). Run-Rate Revenue ~`$81B` as of Oct 31, 2026, up `$10B` from Sep 30 (p. 202; ~`$71B` at 9/30 is derived).
- 2026-11-02: Anthropic, PBC S-1/A No. 1 (accession `0001628280-26-068676`, EDGAR accepted 09:24:24 ET). Q3'26 revenue `$16,956M`, compute & infrastructure `$9,863M`, GAAP operating loss `$(567)M`, net loss `$(23,291)M` (p. 160); adjusted operating income `$2,463M` (15%) vs Q2 `$2,235M` (19%) (p. 163); 9M'26 revenue `$33,242M`, operating loss `$(1,260)M`, net loss `$(104,039)M` (p. 23); 9M operating cash flow +`$6.6B` (p. 172); cash and equivalents `$95.6B` + short-term investments `$36.3B` = `$131.9B` (p. 10).
- Commitments: S-1/A No. 2 restates S-1/A No. 1. Encoded No. 2: `$900.9B` aggregate, `$451.6B` through 2030, `$70.7B` next 12 months, `$186.2B` terminable or contingent, post-9/30 `$105.7B`, Microsoft ≥ `$47.2B` up to `$49.2B` (pp. 7, 177–179). Superseded No. 1: `$895.4B`, `$447.5B`, `$69.8B`, `$213.8B`, `$100.2B`, Microsoft ≥ `$44.9B` (pp. 6, 173–174); No. 1's ~`$150–175B` variable-payment estimate (p. 174) was removed in No. 2.
- `data/anthropic-investor-day.json`: `filings` with EDGAR acceptance times; S-1/A facts with page citations; `quarterly` table with the Q3'26 column; `s1a1` / `s1a2` chart events; upcoming milestones (S-1/A No. 1 and No. 2 filed; roadshow launched Nov 10, confirmed; pricing Nov 18 / first trade Nov 19, reported (CNBC sources), not confirmed); `lockupSchedule.pricingDate = 2026-11-18` (reported); `thirdPartyValuations` (Damodaran `$1,475,879M`, site conversion on fully diluted; Morningstar `$1.7T`, basis unconfirmed); `openInterestObservations`; `perpBasis` (Entropy docs).
- `data/disclosure.json`: `asOf` 2026-11-10, positions unchanged.

### Methodology change
- Price-first Anthropic scenarios: the input is the ANT price per share (presets $70 / $74 default / $78, Series H $58.90, DXYZ June mark $61.04). Filed-units legs are units × 10 × price; fair-value legs are value ÷ round price × 10 × price; no fully diluted count enters either. Only the GOOG ownership-percentage leg uses the selected share basis.
- Every $T ↔ $/share conversion names its share basis (`outstanding` 13.087B, `fullyDiluted` 18.013B at $74 with the treasury method recomputed at each price, `fullyDilutedWithOption`). Two converted marks never share an axis row unless they share a basis; unstated bases are `unconfirmed`. Enforced in `lib/shareBasis.mjs` and `test/shareBasis.test.mjs`.
- io:ANTH is converted on fully diluted by default (Entropy: "$1 represents $1B of the company's fully diluted valuation"); Polymarket converts on outstanding (its resolution basis), with a Class-A-only caveat ($1.25T → $95.52 vs $168.28).

### Correction
- The Oct 26 per-leg changes were too large. The S-1 default (17,783,660,160 post-split) added the 846,840,960 public-benefit-fund shares on top of a count that already included them; S-1/A No. 2's filed fully diluted count less the new shares is 16,860,290,679. At a fixed $965B, the corrected changes are: DXYZ/SKM × 0.9376 (−6.24%, shipped −11.10%); AGIX/AMZN/ZM/VCX × 0.9717 (−2.83%, shipped −7.87%); ARKVX × 0.8697 (−13.03%, shipped −17.54%). Price-first scenarios make the valuation-to-price step moot. The s1 views stay frozen and reproducible (`reference/s1-*.json`, `?reference=s1`, legacy `anth`/`anthFd` links).

### Schema change
- `schemaVersion` / `methodologyVersion` `1.4.0`. Added `capitalization.anthropic.datasets` (`s1`, `s1a2`), `anthropic.ipo`, `frozenDataset`; scenario inputs `anthPrice` and `anthShareBasis`; investor-day `filings`, `quarterly`, `thirdPartyValuations` (with `basis`), `openInterestObservations`, `perpBasis`; upcoming statuses `"reported (CNBC sources), not confirmed"` and `"confirmed"`; `pageCitation` may cite `S-1/A No. N`. The reference engine still accepts 1.3.0 exports.

## [1.3.0] - 2026-10-26

### Schema change
- Bumped `schemaVersion` and `methodologyVersion` to `1.3.0`.
- Added `shareBasis: "pre-split"`, `splitFactor: 10`, `splitEffectiveDate: "2026-09-17"`, `roundPrices` (`E-1` `$56.09`, `F-1` `$140.97`, `G-1` `$259.14`, `H-1` `$589.0095`, S-1 p. F-47), `presets`, and `superseded` history to `data/capitalization.json`.
- Added `pricePerShare` and `pricePerShareFromMark` to `data/marks.json`.
- Added `s1Facts`, `lockupSchedule`, and `UPCOMING_STATUSES` (`"filed"`, `"expected, not confirmed"`, `"filed terms, pricing date TBD"`) validation in `data/schema/validate.mjs`.

### Methodology change
- Replaced the DXYZ-calibrated Anthropic FD proxy (`1,580,904,637.87`) with the issuer-derived June 30, 2026 fully diluted count from Anthropic, PBC Form S-1 (Reg. No. 333-299633, accession `0001628280-26-067168`, S-1 pp. 13, 144, 236): `1,778,366,016` pre-split (`17,783,660,160` post-split), including `846,840,960` post-split Class N shares contributed to Anthropic Public Benefit Fund, LLC (5% of pre-fund FD `16,936,819,200` post-split / `1,693,681,920` pre-split).
- Normalized all Anthropic `filed-fv-equiv` and `carrying-value-equiv` legs (`AGIX`, `AMZN`, `ARKVX`, `VCX`, `ZM`) onto the same FD share denominator by converting reported fair/carrying value into pre-split share-equivalents at the measurement round's preferred price (`reportedFairValue ÷ roundPricePerPreSplitShare`, S-1 p. F-47) and dividing by the selected FD share count (`= old % × FD_round / FD_now`). At defaults, `DXYZ`/`SKM` change by `× 0.8890 (−11.10%)`, Series H-measured legs (`AGIX`, `AMZN`, `ZM`, and `VCX` scaled from H-1) change by `× 0.9213 (−7.87%)`, and Series G-measured `ARKVX` changes by `× 0.8246 (−17.54%)`.

### Data update
- 2026-10-26: Anthropic, PBC Form S-1 went public on EDGAR at 09:00:11 ET (`0001628280-26-067168`, Reg. No. 333-299633, Nasdaq Global Select ticker `"ANT"`, S-1 p. 20). Encoded S-1 FD share count (`1,778,366,016` pre-split), 10-for-1 split effective 2026-09-17 (S-1 p. 22), preferred round prices (S-1 p. F-47), Class A / Class N / Class F (50.1% vote) / Class T (board majority) conversions (S-1 pp. 20, 309), Google 2026 NPA `14.99%` ownership cap (S-1 p. 169), Amazon convertible note Class N conversion terms (S-1 pp. 20, 165), FY23–H1'26 financials (S-1 pp. 11, 23, 25, 158), Q3/Oct-31 run-rate blanks (S-1 pp. 4, 133, 195), and the three staged lock-up schedules (S-1 pp. 118, 307–309, 318–323).
- 2026-10-26: Updated `data/disclosure.json` (`asOf: "2026-10-26"`, positions unchanged).

## [1.1.0] - 2026-08-30

### Schema change
- Added `filed-units` basis: `filedUnits`, `reportedFairValue`, `fairValueAsOf`, `carriedInterestPct`. No `measurementCompanyMark`. Mark per unit is computed.

### Methodology change
- DXYZ Anthropic/OpenAI look-through is units × price, not FV ÷ a primary-round post-money. The $T IPO slider does not apply to those rows. Per-SPV carry on `/dxyz` SpaceX. ATM accretion-only path calibrated to $30.71 vs filed $34.30.

### Data update
- 2026-08-31: VCX affiliate overhang reconciled via Fundrise Real Estate Interval Fund, LLC Form N-CSRS (accession 0001777677-26-000057) and NPORT-P (0001777677-26-000056): Note 6 confirms $50M initial cost, $192.885M public sales proceeds ($164.114M realized gain), and 1,163,216 shares ($100.537M Level 1 FV at $86.43/share) held at June 30, 2026. Added secondary source to data/wrappers/VCX.json.
- 2026-08-30: DXYZ June 30, 2026 N-CSRS (accession 0001213900-26-095201) and NPORT-P (0000894189-26-024246): shares 47,657,338, net assets $1,634,830,252, investments FV $1,640,039,144 / cost $1,347,802,540. Anthropic Magnitude ANC III 386,088 units / $235,671,976.08. OpenAI Goanna 50,895 / $35,040,868.20. SpaceX three SPVs $173,061,169.35. Private Tape sleeve rolled to those FVs.

## [1.0.0] - 2026-08-19

### Schema change
- Initial public schema (`schemaVersion` 1.0.0): discriminated union on `basis`; `holdingSecurity`, `wrapperType`, and `denominatorType` as separate fields; `sources[]` per field; `sourceClass` primary | secondary.

### Methodology change
- Initial methodology (`methodologyVersion` 1.0.0): FV-equivalent identity vs modeling convention; ARKVX denominator is NPORT-EX TNA; DXYZ OAI I PPUs excluded from IPO scaling; deploy `range` default.
- 2026-08-20: Pre-v0.3 planning documents (`docs/ai-per-dollar-plan.md`) contain superseded figures. They were removed from the published tree in application v0.7.1.0 and are retained in git history for provenance. Cite the dated tag `data-2026-08-19`, not those documents.
- 2026-08-27: Added Private Tape methodology v0.1.0 for DXYZ lead/lag testing against Hyperliquid Anthropic and SpaceX markets. The method uses simple returns, overlapping NYSE-hours windows, no-leakage overnight windows, minimum sample gates, and labels residuals as factor/sentiment residuals rather than NAV premium.
- 2026-08-27: Bumped Private Tape methodology to v0.1.1 and expanded market-structure caveats to describe Entropy as a third-party HIP-3 builder on Hyperliquid. Entropy/Hyperliquid are used only as observable price-discovery inputs, not as recommendations.
- 2026-08-27: Bumped Private Tape methodology to v0.1.2 and schema-tagged Anthropic as private/pre-IPO tape and SpaceX as public-equity/perp tape after the 2026-06-12 SPCX Nasdaq listing. Removed the placeholder fully diluted SpaceX valuation from the app surface.

### Data update
- 2026-08-28: VCX June 30, 2026 NPORT-P (accession 0001867090-26-000109): net assets $776,968,361.92, NAV $21.70/share, 35,797,138 shares (Q2 flows $0). Anthropic remaining lots SaxeCap + AI Access 12 = $173,628,474 at an implied ~$863.7B mark (2.273× vs March 31 remaining lots; HOF AG Follow On exited). OpenAI Quiet OA + HOF AP = $84,162,466, unchanged vs March 31.
- 2026-08-28: DXYZ June 30, 2026 snapshot from the Aug 28 424B3 (accession 0001575872-26-000624): NAV $34.30, approximate $1.64B portfolio, Anthropic 14.4% ($236.16M, Series H mark), OpenAI equity 2.1% ($34.44M), PPUs 0.5% excluded. Filed Q2 ATM 17,191,674 shares already in the baseline. Subsequent $150M OpenAI purchase (2026-08-13) on ESTIMATED only.
- 2026-08-28: Private Tape sleeve rolled to the same June 30 weights: Anthropic 14.4% and SpaceX 10.5%, normalized to approximately 58% / 42%.
- 2026-08-27: Added `data/private-tape.json` with the initial two-asset modeled DXYZ sleeve: Anthropic 18.1% filed weight and SpaceX 14.4% filed weight, normalized to approximately 56% / 44% inside the Private Tape index. Added a machine-readable manifest and CSV/JSON export paths for aligned derived samples.
- 2026-08-26: ZM Anthropic preferred carrying value $3,134.5M as of 2026-07-31 (10-Q accession 0001585521-26-000121), marked to Series H. Cover-page share count 291,783,711 as of 2026-08-14. Prior snapshot used $1,266.9M / Series G as of 2026-04-30.
- Snapshot of 11 wrappers and Anthropic/OpenAI marks as used on stocks.bolewood.com v0.7.0.0 (2026-08-19).
