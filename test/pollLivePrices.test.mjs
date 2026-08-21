import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRICE_CLIENT_POLL_MS,
  startJsonPoll,
} from "../lib/pollLivePrices.mjs";

test("client poll interval matches the 60s CDN TTL", () => {
  assert.equal(PRICE_CLIENT_POLL_MS, 60_000);
});

test("startJsonPoll fetches immediately with cache: no-store", async () => {
  const origFetch = globalThis.fetch;
  const origDoc = globalThis.document;
  const calls = [];
  globalThis.document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const seen = [];
  const stop = startJsonPoll("/api/ai-prices", {
    onData: (d) => seen.push(d),
    intervalMs: 60_000,
  });
  await new Promise((r) => setTimeout(r, 20));
  stop();
  globalThis.fetch = origFetch;
  globalThis.document = origDoc;
  assert.equal(calls[0].url, "/api/ai-prices");
  assert.equal(calls[0].opts.cache, "no-store");
  assert.equal(seen[0].ok, true);
});
