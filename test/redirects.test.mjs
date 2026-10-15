import { test } from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config.mjs";

// EchoStar's Nasdaq ticker changed SATS → ECHO on 2026-06-24; the calculator
// moved from /sats to /echo. Old bookmarks/inbound links get a permanent 308
// (Next preserves query strings, so /sats?scenario=bear deep-links survive).
test("next.config.mjs permanently redirects /sats to /echo", async () => {
  assert.equal(typeof nextConfig.redirects, "function", "redirects() must be defined");
  const redirects = await nextConfig.redirects();
  const sats = redirects.find((r) => r.source === "/sats");
  assert.ok(sats, "a redirect with source /sats must exist");
  assert.equal(sats.destination, "/echo");
  assert.equal(sats.permanent, true);
});

// /investor-day became the standing Anthropic IPO tape after the Oct 14,
// 2026 investor day; links and cached share-card images must keep working.
test("next.config.mjs permanently redirects /investor-day to /anthropic-ipo-tape", async () => {
  const redirects = await nextConfig.redirects();
  const page = redirects.find((r) => r.source === "/investor-day");
  assert.ok(page, "a redirect with source /investor-day must exist");
  assert.equal(page.destination, "/anthropic-ipo-tape");
  assert.equal(page.permanent, true);
  const sub = redirects.find((r) => r.source === "/investor-day/:path*");
  assert.ok(sub, "subpaths (cached OG image URLs) must redirect too");
  assert.equal(sub.destination, "/anthropic-ipo-tape/:path*");
  assert.equal(sub.permanent, true);
});
