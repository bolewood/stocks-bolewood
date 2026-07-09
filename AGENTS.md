<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commands

- `npm test` — unit tests (`test/*.test.mjs`) via Node's built-in `node --test`. Route handlers (`app/api/*/route.js`) are not covered by this runner (see TODOS.md); verify them against `npm run dev`.

# API routes

- `/api/dxyz-history` — daily DXYZ price/volume history (Yahoo upstream) with a 1-hour cache, stale-cache fallback, and a checked-in snapshot (`app/api/dxyz-history/snapshot.json`) as last resort. Consumed by `components/DXYZNAVFinder.jsx` via `lib/dxyzAtm.mjs`.
- `/api/prices` — real-time quote fetch shared by the finders.
