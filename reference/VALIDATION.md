# Calculator correction validation — September 5, 2026

Version 0.12.0.0; data and methodology 1.2.0. Implemented and tested locally. This record does not assert that the public deployment contains these changes.

## Automated checks

- `npm test`: 141 passed, 0 failed. Includes all 11 wrappers in both holdings modes and all cash/pro rata/range settings; independent Anthropic/OpenAI sensitivity, dilution once, FD inverse sensitivity, acquisition independence, unchanged filed observations, excluded PPUs and invalid inputs.
- `npm run reference`: 11 Filed Holdings and 11 Estimated Holdings rows match their committed expected results at 12 significant digits. Estimated fixture uses the September 4 frozen ATM bridge: 48,076,389.95541907 modeled shares and $1,641,801,879.0109797 assets. Quote prices remain the separately dated August 19 fixture.
- Application/raw-data reference parity also covers NAV/premium, both range endpoints, lot arithmetic, modeled DXYZ assets and FD/entry sensitivity.
- Frozen export round-trip succeeds in the standalone CLI; altering an included result makes reproduction fail.
- Scoped ESLint passes for all changed calculator modules and the new scenario tests.
- README generation is idempotent. `git diff --check` passes.
- Next.js production build passes. The initial sandboxed build could not fetch the existing Google Fonts; the build passed with network access, without changing font configuration.

## Browser checks

- Loaded `/ai?reference=filed` and `/ai?reference=estimated` with live polling disabled and explicit frozen-price labels.
- Exercised both valuation sliders by keyboard at their minimum/maximum in both holdings modes. Every quantified relevant leg changed; the other company's leg did not change. Unknown/commitment legs remained unquantified.
- Numeric FD input changed DXYZ and SKM Anthropic results inversely. Independent August entry-price input changed DXYZ's estimated acquisition units and OpenAI result without changing Anthropic.
- Expanded DXYZ showed June preferred and August common separately. At the default entry proxy the acquired lot is 217,867.033329 displayed units; at $900 entry it becomes 166,666.666667. Current valuation and FD changes do not reset the entry assumption.
- A real copied browser export matched all 11 visible rows to displayed cents, including deployment ranges and custom FD/entry inputs. Mobile export also matched after dilution/FD changes.
- At a 390 × 844 viewport, page width was 390 with all six sliders accessible and no horizontal overflow. At 1280 × 900, page width was 1280. Temporary viewport override was reset after testing.
- At reference Estimated defaults, DXYZ displays Anthropic $14.93–$14.99, OpenAI $11.72–$11.73, combined $26.65–$26.72 per $100. These are deployment endpoints, not FD confidence bounds.
- Production preview smoke test passed in a fresh browser tab at `http://127.0.0.1:3000/ai?reference=estimated`. Increasing Anthropic from $965B to $1,015B moved every quantified Anthropic row and left every OpenAI leg unchanged; DXYZ moved from $14.93–$14.99 to $15.70–$15.77. Browser error log was empty. The earlier preview tab had retained a connection-error page; a fresh tab loaded successfully.

## Evidence limits

See [source changes](../data/SOURCE_CHANGES.md). FD counts and August entry price are adjustable assumptions; the exact August acquired units are not disclosed in the examined filings. GOOG's historical court exhibit, AGIX's dated archive, ARKVX's Class D archive, some publication dates and VCX's inherited OpenAI valuation remain explicitly unverified. Reproducible arithmetic does not establish that those assumptions are true.
