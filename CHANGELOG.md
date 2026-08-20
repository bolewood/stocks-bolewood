# Changelog

All notable changes to stocks.bolewood.com are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) with 4-digit versions (MAJOR.MINOR.PATCH.MICRO).

## [0.8.3.0] - 2026-08-20

### Changed
- `/dxyz` SpaceX row uses post-split shares (177,992 N-CSR × 5-for-1 = 889,960; split effective May 4, 2026 per SpaceX 424B4) and the live Yahoo SPCX quote from `/api/prices`.

## [0.8.2.0] - 2026-08-20

### Fixed
- Price routes no longer fan out one Yahoo chart call per visitor. `/api/ai-prices` and `/api/prices` send `Cache-Control` so Vercel can serve the JSON from the CDN, coalesce in-flight refreshes, keep last-good quotes when Yahoo 429s, and retry `query2` after `query1` fails.

## [0.8.1.0] - 2026-08-20

### Added
- `/ai` call-out above Sources & footnotes for the public dataset: GitHub link and a two-line LLM audit prompt.

## [0.8.0.0] - 2026-08-20

### Added
- Public README for the open data layer: generated DXYZ worked example and disclosure sentence from `data/` (`npm run sync:readme`). Tests fail if either region is stale, or if `disclosure.asOf` is older than 30 days.

### Changed
- Site and README render the same `disclosureSentence()` string; disclosure age sits beside it on `/ai`, not inside it.

### Removed
- Root `dxyz_holdings.csv`. Scratch EDGAR fetch scripts moved to `scripts/scratch/`.

## [0.7.1.0] - 2026-08-19

### Changed
- Quote chip uses **CLOSE** after the NYSE cash session (and all weekend) when the print is last session's close. **STALE** is only a lagging quote while 9:30–16:00 ET is open.

### Removed
- Internal v1 plan (`docs/ai-per-dollar-plan.md`) and Playwright `test-results/` from the published tree.

## [0.7.0.0] - 2026-08-19

### Added
- Public data layer under `data/`: one JSON file per wrapper, `marks.json`, discriminated-union schema, methodology, and a MIT reference calculator (`npm run reference`) that reproduces `reference/expected-results.json` from `data/` with no app code.
- `SECONDARY` marker on estimate/commitment legs that have no primary source. DXYZ OpenAI row expansion states that OAI I PPUs are not equity and are excluded.

### Changed
- Production `/ai` wrapper records load only through `lib/loadAiData.mjs`. Ticker-specific financial inputs no longer live in `lib/aiWrappers.mjs`.

## [0.6.0.0] - 2026-08-19

### Added
- Position disclosure from `data/disclosure.json`: above-fold text on `/ai`, a `HELD` pill on DXYZ, SKM, ZM, AMZN, GOOG and NVDA, and a generated README section. Tests fail if the README section is stale.
- Quote-feed states `LIVE` / `CACHED` / `STALE` / `UNAVAILABLE` with explicit 15-minute and 18-hour thresholds. The chip shows `quoteAsOf` as an absolute Eastern date-time; page state is the worst material row.

### Changed
- `/ai` headline is **Pre-IPO Anthropic and OpenAI per $100**. `<title>` and `og:title` are `Pre-IPO Anthropic & OpenAI per $100 | stocks.bolewood.com`. Subtitle is estimated exposure per $100 of wrapper value, not market cap.

## [0.5.0.0] - 2026-08-19

### Fixed
- MSFT Anthropic is a commitment with no percentage (combined is OpenAI-only). NVDA no longer shows a bare ownership % — OpenAI is $30B ÷ $852B round-implied; Anthropic is a commitment.
- SKM denominator is 383,368,095 ADS-equivalent from the 20-F 212,982,275 ordinary × 9/5 (ADS ratio 5/9).
- ARKVX denominator is NPORT-EX total net assets $871,119,657 as of 2026-04-30, not a synthetic share count. Deploy range is ~$13.49 cash – ~$19.19 into-book at $1.0T/$1.25T. Row labeled as an Apr 30 snapshot.
- AMZN Anthropic is filed $92.5B preferred + $97.9B notes = $190.4B ÷ $965B (10-Q 2026-06-30). OpenAI is $50B ÷ $852B.

### Changed
- Default sliders are 1.0× last primary (Anthropic $0.965T, OpenAI $0.852T). Per-leg Basis badges; collapsed table is Ticker / Basis / Wrapper value / per-$100 / Evidence / As of; click a row for the source arithmetic and four as-of dates. Implied exposure digits use enough precision to reproduce per-$100.

## [0.4.1.0] - 2026-08-19

### Fixed
- VCX ESTIMATED no longer inflates Anthropic stake % (0.03% → 0.08%). Rolling the mark to Series H now rolls the marking round too, so ownership is invariant across bases. Only PREM/NAV moves.

### Changed
- `/ai` headline is **Per $100**; `<title>` / `og:title` stay `Anthropic & OpenAI Per $100`. Dropped the TYPE column so CONF (HIGH/MED/LOW) stays visible. Removed Bear/Base/Bull/Ultra chips. IPO sliders are log-scaled $0.5T–$5.0T in trillions, with a last-primary tick. Basis toggle is labeled "Share counts, net assets & marks".

## [0.4.0.0] - 2026-08-19

### Added
- `/ai` FILED ONLY / ESTIMATED toggle (default ESTIMATED) so fund shares, net assets, stakes, and marks move together. DXYZ ESTIMATED shares come from the same `computeAtmBridge` as `/dxyz`. ATM/inflow deployment is a stated range (cash vs into-book) until the next N-PORT. Prem/NAV column on fund rows.

### Changed
- ARKVX ESTIMATED uses 21,613,728 shares as of 2026-07-31 (ARK published SO). VCX share count held stable (listed CEF as of 2026-03-19; no post-listing continuous offering); ESTIMATED rolls Anthropic/OpenAI marks to last primary. Confidence cannot be HIGH when the row as-of is >90 days. DXYZ confidence is MEDIUM.

## [0.3.2.0] - 2026-08-19

### Added
- `/ai` preset chips and sliders show multiples vs last primary round (Anthropic Series H $965B, 2026-05-28; OpenAI $852B, 2026-03-31), from a single `LAST_PRIMARY_ROUNDS` config. Security column, as-of staleness dots, shareable `?anth=&oai=&dil=&sort=` URLs, copy-link, SFTBY expandable NAV note, and a dedicated OG image.

### Changed
- `/ai` meta text (chips, captions, as-of dates) raised to WCAG AA contrast against the cream background.

## [0.3.1.0] - 2026-08-19

### Changed
- VCX and BOT now fetch live Yahoo v8 prices from `/api/prices` (they had been sitting on dated hardcoded quotes). DXYZ, ECHO, and `/ai` already did; `/api/prices` now shares `lib/yahooQuote.mjs` with `/api/ai-prices`.
- Site chrome is consistent: Header and Footer on every calculator page (DXYZ was missing both; BOT was missing Footer), and Footer links match Header (Home, VCX, DXYZ, BOT, ECHO, AI Per $, About).

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
