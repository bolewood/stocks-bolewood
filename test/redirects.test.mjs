import { test } from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config.mjs";

// EchoStar's Nasdaq ticker changed SATS → ECHO on 2026-06-24; the calculator
// moved from /sats to /echo. Old bookmarks/inbound links must 301 to the new page.
test("next.config.mjs permanently redirects /sats to /echo", async () => {
  assert.equal(typeof nextConfig.redirects, "function", "redirects() must be defined");
  const redirects = await nextConfig.redirects();
  const sats = redirects.find((r) => r.source === "/sats");
  assert.ok(sats, "a redirect with source /sats must exist");
  assert.equal(sats.destination, "/echo");
  assert.equal(sats.permanent, true);
});
