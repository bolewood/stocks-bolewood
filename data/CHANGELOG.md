# Data changelog

Typed entries: **Data update** · **Correction** · **Methodology change** · **Schema change**.

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
