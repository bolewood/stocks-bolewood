<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commands

- `npm test` — unit tests (`test/*.test.mjs`) via Node's built-in `node --test`. Route handlers (`app/api/*/route.js`) are not covered by this runner (see TODOS.md); verify them against `npm run dev`.
- `npm run reference` — reproduce `reference/expected-results.json` from `data/` with no app code.

# API routes

- `/api/dxyz-history` — daily DXYZ price/volume history (Yahoo upstream) with a 1-hour cache, stale-cache fallback, and a checked-in snapshot (`app/api/dxyz-history/snapshot.json`) as last resort. Returns `{ rows, source, asOf }` where `source` is `live | cache | stale | snapshot`. Consumed by `components/DXYZNAVFinder.jsx` via `lib/dxyzAtm.mjs`.
- `/api/prices` — real-time quote fetch shared by the NAV/SOTP finders (60s in-memory cache, hardcoded per-ticker fallbacks). Tickers: `ECHO`, `SPCX`, `DXYZ`, `VCX`, `BOT` — `ECHO` replaced `SATS` after EchoStar's 2026-06-24 Nasdaq ticker change, and the response carries a temporary `prices.SATS` alias for pre-migration client bundles. Returns `{ prices, source, asOf }` where `source` is `live | cache | partial | fallback`. Uses `lib/yahooQuote.mjs` (`fetchChartPrice` / recycled-ticker guard), same v8 chart path as `/api/ai-prices`.
- `/api/ai-prices` — Yahoo v8 chart prices for the Anthropic/OpenAI wrapper table. Price only. Curated share counts, stakes, and marks live in `data/` and load through `lib/loadAiData.mjs`. 60s in-memory cache, per-ticker fallbacks, recycled-ticker `meta.symbol === ticker` guard. Returns `{ prices, quotes, source, fetchedAt, cacheWrittenAt }` where page-level `source` is `live | cached | close | stale | unavailable` (`lib/priceState.mjs`). Parse helpers live in `lib/yahooQuote.mjs`.
- `/api/arkvx-shares` — Class D published SO, used only as a current-assets proxy. ARKVX look-through denominator is NPORT-EX total net assets.

# Pages

- `/sats` permanently redirects (308) to `/echo` (`next.config.mjs` `redirects()`, covered by `test/redirects.test.mjs`).
- `/ai` — Pre-IPO Anthropic and OpenAI per $100 (`components/AIPerDollarFinder.jsx`). Live prices from `/api/ai-prices`; wrapper records from `data/` via `lib/loadAiData.mjs`. Fund FILED/ESTIMATED in `lib/aiFundBasis.mjs`. Quote chip is market-hours-aware: LIVE/CACHED while RTH is open, CLOSE after the session, STALE only when a quote lags an open market.
