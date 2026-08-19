<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commands

- `npm test` — unit tests (`test/*.test.mjs`) via Node's built-in `node --test`. Route handlers (`app/api/*/route.js`) are not covered by this runner (see TODOS.md); verify them against `npm run dev`.

# API routes

- `/api/dxyz-history` — daily DXYZ price/volume history (Yahoo upstream) with a 1-hour cache, stale-cache fallback, and a checked-in snapshot (`app/api/dxyz-history/snapshot.json`) as last resort. Returns `{ rows, source, asOf }` where `source` is `live | cache | stale | snapshot`. Consumed by `components/DXYZNAVFinder.jsx` via `lib/dxyzAtm.mjs`.
- `/api/prices` — real-time quote fetch shared by the NAV/SOTP finders (60s in-memory cache, hardcoded per-ticker fallbacks). Tickers: `ECHO`, `SPCX`, `DXYZ`, `VCX`, `BOT` — `ECHO` replaced `SATS` after EchoStar's 2026-06-24 Nasdaq ticker change, and the response carries a temporary `prices.SATS` alias for pre-migration client bundles. Returns `{ prices, source, asOf }` where `source` is `live | cache | partial | fallback`. Uses `lib/yahooQuote.mjs` (`fetchChartPrice` / recycled-ticker guard), same v8 chart path as `/api/ai-prices`.
- `/api/ai-prices` — Yahoo v8 chart prices for the Anthropic/OpenAI wrapper table (GOOG, AMZN, MSFT, SFTBY, NVDA, SKM, ZM, AGIX, DXYZ, ARKVX, VCX). Price only — shares outstanding are curated in `lib/aiWrappers.mjs`. 60s in-memory cache, per-ticker fallbacks, recycled-ticker `meta.symbol === ticker` guard. Returns `{ prices, source, asOf }` where `source` is `live | cache | partial | fallback`. Parse helpers live in `lib/yahooQuote.mjs` (the route is a thin fetch/cache wrapper; `app/api/*/route.js` is not covered by `npm test`).

# Pages

- `/sats` permanently redirects (308) to `/echo` (`next.config.mjs` `redirects()`, covered by `test/redirects.test.mjs`).
- `/ai` — Anthropic & OpenAI Per $ look-through calculator (`components/AIPerDollarFinder.jsx`). Live prices from `/api/ai-prices`; curated shares and stakes in `lib/aiWrappers.mjs`.
