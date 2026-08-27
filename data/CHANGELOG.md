# Data changelog

Typed entries: **Data update** · **Correction** · **Methodology change** · **Schema change**.

## [1.0.0] - 2026-08-19

### Schema change
- Initial public schema (`schemaVersion` 1.0.0): discriminated union on `basis`; `holdingSecurity`, `wrapperType`, and `denominatorType` as separate fields; `sources[]` per field; `sourceClass` primary | secondary.

### Methodology change
- Initial methodology (`methodologyVersion` 1.0.0): FV-equivalent identity vs modeling convention; ARKVX denominator is NPORT-EX TNA; DXYZ OAI I PPUs excluded from IPO scaling; deploy `range` default.
- 2026-08-20: Pre-v0.3 planning documents (`docs/ai-per-dollar-plan.md`) contain superseded figures. They were removed from the published tree in application v0.7.1.0 and are retained in git history for provenance. Cite the dated tag `data-2026-08-19`, not those documents.
- 2026-08-27: Added Private Tape methodology v0.1.0 for DXYZ lead/lag testing against Hyperliquid Anthropic and SpaceX markets. The method uses simple returns, overlapping NYSE-hours windows, no-leakage overnight windows, minimum sample gates, and labels residuals as factor/sentiment residuals rather than NAV premium.
- 2026-08-27: Bumped Private Tape methodology to v0.1.1 and expanded market-structure caveats to describe Entropy as a third-party HIP-3 builder on Hyperliquid. Entropy/Hyperliquid are used only as observable price-discovery inputs, not as recommendations.

### Data update
- 2026-08-27: Added `data/private-tape.json` with the initial two-asset modeled DXYZ sleeve: Anthropic 18.1% filed weight and SpaceX 14.4% filed weight, normalized to approximately 56% / 44% inside the Private Tape index. Added a machine-readable manifest and CSV/JSON export paths for aligned derived samples.
- 2026-08-26: ZM Anthropic preferred carrying value $3,134.5M as of 2026-07-31 (10-Q accession 0001585521-26-000121), marked to Series H. Cover-page share count 291,783,711 as of 2026-08-14. Prior snapshot used $1,266.9M / Series G as of 2026-04-30.
- Snapshot of 11 wrappers and Anthropic/OpenAI marks as used on stocks.bolewood.com v0.7.0.0 (2026-08-19).
