# TODOS

## DXYZ

### Route-handler test harness

**What:** Add a test path for `app/api/*/route.js` handlers (dxyz-history, prices).

**Why:** The history route's resilience layers (cache, in-flight coalescing, stale fallback, snapshot) are the feature's whole failure story and currently only verifiable against a running dev server — `next/server` cannot be imported under bare `node --test`.

**Context:** Attempted during the v0.2.0.0 ship review; import fails with "Cannot find module next/server" because the export alias needs bundler resolution. Options: extract the Yahoo-parse and fallback logic into a pure `lib/` function (testable today), or add vitest with the Next server condition. The 5 route branches are enumerated in the ship review's coverage diagram.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Extract custom-input option building into lib

**What:** Move the `atmOpts` unit conversions (M/% scaling, blank→default fallback) from `components/DXYZNAVFinder.jsx` into a pure `lib/` function with tests.

**Why:** A wrong scale factor there silently mis-states pro forma NAV, and it's the one load-bearing math block still living untested inside the component.

**Context:** Flagged by the testing specialist during the v0.2.0.0 ship review; behavior was browser-verified (custom 10% participation matches the sensitivity table's High row) but has no unit test. The lib now sanitizes its own inputs, so only the conversion layer is at risk.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Split bridge section into result vs. assumptions

**What:** Separate the ATM bridge into a "Bridge result" block and an "Assumptions & sensitivity" block.

**Why:** Codex design review: the section currently does five jobs (mode select, provenance warning, reconciliation table, assumptions, sensitivity) which hurts scanability.

**Context:** Assumptions were already moved above the result table during the v0.2.0.0 ship; the full split is a layout redesign best done with a visual pass (/design-review).

**Effort:** M
**Priority:** P3
**Depends on:** None

## Infrastructure

### Cross-midnight history cache staleness

**What:** Decide whether the 1h history cache should be invalidated at the NY session close instead of a fixed TTL.

**Why:** Cached rows filtered before the close can be served for up to an hour after it, omitting the just-completed session.

**Context:** Flagged (and accepted as conservative) during the v0.2.0.0 adversarial review. The post-close inclusion fix bounds the staleness at one cache TTL; a close-aware invalidation would eliminate it.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Completed
