<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commands

- `npm test` — unit tests (`test/*.test.mjs`) via Node's built-in `node --test`. Route handlers (`app/api/*/route.js`) are not covered by this runner (see TODOS.md); verify them against `npm run dev`.

# API routes

- `/api/dxyz-history` — daily DXYZ price/volume history (Yahoo upstream) with a 1-hour cache, stale-cache fallback, and a checked-in snapshot (`app/api/dxyz-history/snapshot.json`) as last resort. Returns `{ rows, source, asOf }` where `source` is `live | cache | stale | snapshot`. Consumed by `components/DXYZNAVFinder.jsx` via `lib/dxyzAtm.mjs`.
- `/api/prices` — real-time quote fetch shared by the finders (60s in-memory cache, hardcoded per-ticker fallbacks). Tickers: `ECHO`, `SPCX`, `DXYZ`, `VCX`, `BOT` — `ECHO` replaced `SATS` after EchoStar's 2026-06-24 Nasdaq ticker change, and the response carries a temporary `prices.SATS` alias for pre-migration client bundles. Returns `{ prices, source, asOf }` where `source` is `live | cache | partial | fallback`. Quotes are dropped unless Yahoo confirms the requested symbol (recycled-ticker guard).

# Pages

- `/sats` permanently redirects (308) to `/echo` (`next.config.mjs` `redirects()`, covered by `test/redirects.test.mjs`).
