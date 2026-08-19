# Changelog

All notable changes to stocks.bolewood.com are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) with 4-digit versions (MAJOR.MINOR.PATCH.MICRO).

## [0.3.0.0] - 2026-08-19

### Added
- **Anthropic & OpenAI Per $** calculator at `/ai` — look-through table for 11 public wrappers (GOOG, AMZN, MSFT, SFTBY, NVDA, SKM, ZM, AGIX, DXYZ, ARKVX, VCX). Live Yahoo v8 prices; curated share counts; dollars of underlying per $100 of wrapper market cap at a user-set IPO valuation and optional dilution. Not per share.
- `/api/ai-prices` route (price-only, 60s cache, recycled-ticker guard) and `lib/aiWrappers.mjs` ownership/FV table with unit tests pinning the Aug 7 AMZN and DXYZ examples.

## [0.2.2.0] - 2026-07-10

### Changed
- EchoStar calculator migrated from SATS to ECHO, matching the Nasdaq ticker change effective June 24, 2026 — the page now lives at /echo (`/sats` redirects permanently), the price API serves `ECHO`, and all live quotes flow from the new symbol.
- The missed-payment credit alert became the actual event: on June 30, 2026 DISH DBS and certain wireless subsidiaries filed a prepackaged Chapter 11 (88% bondholder support, expected Q3 exit) after the delayed ~$23B AT&T spectrum sale left $2B of notes unpaid. The banner now states the parent and SpaceX stake sit outside the filing, and the restructuring toggle models on-plan exit vs. contested.
- Wall Street reconciliation gained Citi's renewed coverage (7/8/26: Buy, $126 target, SpaceX valued at $200/share → $52B stake) alongside the ~$146 average target across 7 analysts.
- Defaults refreshed: ECHO ~$95.88, SPCX base ~$150 (live-fetched); stale VCX fallback corrected ($211 → $69.17).

### Fixed
- Mobile header navigation overflowed the viewport on every page that renders the site header (pre-existing); the header now wraps within 390px.
- Preset clicks no longer revert live market prices to dated constants (ECHO and SPCX quotes persist across scenario switches), and the heatmap's active-row highlight now picks the nearest price row instead of silently disappearing between grid steps.
- The stale VCX default price ($211 → $69.17) on the VCX page; the price API validates that Yahoo returned the symbol it asked for (recycled-ticker guard) and emits a transitional SATS alias for pre-migration browser bundles.

## [0.2.1.0] - 2026-07-09

### Changed
- The DXYZ bridge's inferred Apr–May proceeds are now capped at the original $1B ATM program's filed remainder (~$429M gross per the N-CSR and Q1 424B3), deriving a ~$39 effective average price instead of assuming the $46.23 close-VWAP — the new $1B prospectus wasn't effective until May 26, so the old shelf was the only legal capacity. Default pro forma NAV moves from $32.39 to ~$30.77.
- Commission default recalibrated to 1.0% from the audited 2025 gross-vs-net disclosure (~0.95% effective), replacing the 0.5% placeholder.
- Sensitivity high bound raised from 10% to 16.4% volume participation — the Aug–Sep 2025 pace (filed share issuance over observed volume), the program's high-water mark. Custom Apr–May price overrides are honored uncapped as explicit counterfactuals.

### Added
- Prior ATM program history in the sources (original shelf effective July 15, 2025; 11.1M shares at $29.48 through December 2025) and a "next filed NAV: June 30 N-PORT, due ~Aug 29, 2026" checkpoint note.
- Calibration-window guard: truncated price history covering fewer than 30 of the window's 36 trading days now degrades to zero inferred issuance instead of producing absurd participation rates.

## [0.2.0.0] - 2026-07-09

### Added
- **DXYZ ATM Issuance Bridge** — the DXYZ NAV Finder now estimates share issuance since the March 31, 2026 filing, so the headline NAV reflects the fund as it likely exists today instead of a quarter-old snapshot. Three modes: Filed Only (the filed baseline), Calibrated Estimate (inferred Apr–May issuance of ~10.9M shares from the May 26 424B5, plus daily post-May-26 simulation at a market-calibrated ~8.3% volume-participation rate), and Custom (every assumption editable: shares, prices, participation, commission, capacity, premium threshold, expense drag, as-of date).
- Every bridge row carries a FILED / INFERRED / ESTIMATED confidence badge, with a prominent "Estimated, not company reported" notice; user re-marks are never displayed under a FILED label.
- Low / calibrated / high participation sensitivity table, remaining $1B ATM capacity readout, and per-share accretion.
- Daily DXYZ price/volume history served by a new `/api/dxyz-history` route with layered resilience: 1-hour cache, single in-flight upstream fetch, stale-cache fallback, and a checked-in snapshot as last resort — the UI badges live/cached data as LIVE, degraded data as CACHED or SNAPSHOT.
- Test infrastructure: `npm test` (node --test) with 22 tests covering the issuance math, gates, clamps, and calibration.

### Changed
- DXYZ baseline now reconciles to the filed NPORT-P: $742.5M portfolio plus $5.9M other net assets equals $748.36M net assets, implying ~30.47M shares (previously 30.23M from portfolio-only division) while preserving the filed $24.56 NAV per share.
- The below-NAV issuance gate runs on filed-basis NAV, so hypothetical holding re-marks change the estimated NAV but never the modeled share issuance.
- History data uses completed trading sessions only, including today's bar once the market has closed.

### Fixed
- Aggressive/Dream scenario presets silently valued two SPV positions (SpaceX Snowpoint, Skild AI) at zero and detached their inputs.
- Stale DXYZ fallback price ($12.50 → $27.60) in the shared price API.
- Premium/ratio metrics no longer display Infinity while the shares input is being edited.
