# Changelog

All notable changes to stocks.bolewood.com are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) with 4-digit versions (MAJOR.MINOR.PATCH.MICRO).

## [0.2.0.0] - 2026-07-09

### Added
- **DXYZ ATM Issuance Bridge** — the DXYZ NAV Finder now estimates share issuance since the March 31, 2026 filing, so the headline NAV reflects the fund as it likely exists today instead of a quarter-old snapshot. Three modes: Filed Only (the filed baseline), Calibrated Estimate (inferred Apr–May issuance of ~10.9M shares from the May 26 424B5, plus daily post-May-26 simulation at a market-calibrated ~8.3% volume-participation rate), and Custom (every assumption editable: shares, prices, participation, commission, capacity, premium threshold, expense drag, as-of date).
- Every bridge figure carries a FILED / INFERRED / ESTIMATED confidence badge, with a prominent "Estimated, not company reported" notice; user re-marks are never displayed under a FILED label.
- Low / calibrated / high participation sensitivity table, remaining $1B ATM capacity readout, and per-share accretion.
- Daily DXYZ price/volume history served by a new `/api/dxyz-history` route with layered resilience: 1-hour cache, single in-flight upstream fetch, stale-cache fallback, and a checked-in snapshot as last resort — each labeled in the UI.
- Test infrastructure: `npm test` (node --test) with 22 tests covering the issuance math, gates, clamps, and calibration.

### Changed
- DXYZ baseline now reconciles to the filed NPORT-P: $742.5M portfolio plus $5.9M other net assets equals $748.36M net assets, implying ~30.47M shares (previously 30.23M from portfolio-only division) while preserving the filed $24.56 NAV per share.
- The below-NAV issuance gate runs on filed-basis NAV, so hypothetical holding re-marks change the estimated NAV but never the modeled share issuance.
- History data uses completed trading sessions only, including today's bar once the market has closed.

### Fixed
- Aggressive/Dream scenario presets silently valued two SPV positions (SpaceX Snowpoint, Skild AI) at zero and detached their inputs.
- Stale DXYZ fallback price ($12.50 → $27.60) in the shared price API.
- Premium/ratio metrics no longer display Infinity while the shares input is being edited.
